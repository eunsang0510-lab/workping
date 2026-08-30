from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from database.connection import get_db, SessionLocal
from models.meeting import Meeting
from models.meeting_progress import MeetingProgress
from models.company import CompanyMember
from routers.deps import get_current_user
from utils.meeting_ai import transcribe_audio, summarize_meeting, analyze_progress
from utils.team import get_user_team_id
from utils.text_diff import word_diff
from utils.push import send_push_to_users

router = APIRouter()

MAX_AUDIO_BYTES = 25 * 1024 * 1024  # OpenAI 오디오 인식 API 요청당 상한
MAX_DURATION_SECONDS = 30 * 60  # 녹음 최대 30분

# 베타 기간 비용 제어: 계정당 월 무료 이용 횟수
FREE_MONTHLY_LIMIT = 3
QUOTA_EXCEEDED_MESSAGE = (
    f"이번 달 무료 이용 횟수({FREE_MONTHLY_LIMIT}회)를 모두 사용했어요. "
    "비용 처리 방법을 고민하고 있어요 — 준비되는 대로 정식 오픈할게요!"
)


def _monthly_usage_count(db: Session, user_id: str) -> int:
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    return (
        db.query(Meeting)
        .filter(Meeting.user_id == user_id, Meeting.created_at >= month_start)
        .count()
    )


class MeetingUpdateRequest(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    todos: Optional[list[dict]] = None  # [{id, text, done}]


def _get_member(db: Session, uid: str, company_id: str) -> Optional[CompanyMember]:
    return db.query(CompanyMember).filter(
        CompanyMember.user_id == uid,
        CompanyMember.company_id == company_id,
    ).first()


def _require_member(db: Session, uid: str, company_id: str) -> CompanyMember:
    member = _get_member(db, uid, company_id)
    if not member:
        raise HTTPException(status_code=403, detail="해당 회사 소속만 이용할 수 있어요")
    return member


def _can_view(db: Session, uid: str, meeting: Meeting) -> bool:
    """company_id가 있으면 같은 회사 소속 누구나, 없으면(개인 모드) 작성자 본인만."""
    if meeting.company_id:
        return _get_member(db, uid, meeting.company_id) is not None
    return meeting.user_id == uid


def _can_delete(db: Session, uid: str, meeting: Meeting) -> bool:
    if meeting.company_id:
        member = _get_member(db, uid, meeting.company_id)
        return meeting.user_id == uid or bool(member and member.is_admin)
    return meeting.user_id == uid


def _serialize_list(m: Meeting) -> dict:
    todos = m.todos or []
    return {
        "id": m.id,
        "title": m.title,
        "recorded_at": m.recorded_at.isoformat(),
        "user_id": m.user_id,
        "user_name": m.user_name,
        "status": m.status,
        "duration_seconds": m.duration_seconds,
        "todo_count": len(todos),
        "todo_done_count": sum(1 for t in todos if t.get("done")),
        "edited": m.summary != m.ai_summary,
        "created_at": m.created_at.isoformat(),
    }


def _todo_diffs(ai_todos: list[dict] | None, todos: list[dict] | None):
    ai_map = {t["id"]: t.get("text", "") for t in (ai_todos or [])}
    current_ids = {t["id"] for t in (todos or [])}

    result = []
    for t in (todos or []):
        baseline = ai_map.get(t["id"])
        text = t.get("text", "")
        if baseline is None:
            diff = [{"type": "insert", "text": text}] if text else []
        else:
            diff = word_diff(baseline, text)
        result.append({"id": t["id"], "text": text, "done": bool(t.get("done")), "diff": diff})

    deleted = [{"id": k, "text": v} for k, v in ai_map.items() if k not in current_ids]
    return result, deleted


def _serialize_detail(m: Meeting) -> dict:
    todo_diffs, deleted_todos = _todo_diffs(m.ai_todos, m.todos)
    return {
        "id": m.id,
        "company_id": m.company_id,
        "team_id": m.team_id,
        "title": m.title,
        "recorded_at": m.recorded_at.isoformat(),
        "duration_seconds": m.duration_seconds,
        "user_id": m.user_id,
        "user_name": m.user_name,
        "status": m.status,
        "error_message": m.error_message,
        "transcript": m.transcript,
        "summary": m.summary,
        "summary_diff": word_diff(m.ai_summary or "", m.summary or ""),
        "edited": m.summary != m.ai_summary,
        "todos": todo_diffs,
        "deleted_todos": deleted_todos,
        "created_at": m.created_at.isoformat(),
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
        "updated_by_name": m.updated_by_name,
    }


def _process_meeting_background(meeting_id: str, audio_bytes: bytes, filename: str, content_type: str | None):
    """STT + Claude 요약을 백그라운드에서 처리하고, 완료되면 결과 저장 + 푸시 알림."""
    db = SessionLocal()
    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            return

        try:
            transcript = transcribe_audio(audio_bytes, filename, content_type)
            if not transcript:
                raise ValueError("음성에서 텍스트를 인식하지 못했어요")
            summary, todos = summarize_meeting(transcript)

            meeting.transcript = transcript
            meeting.ai_summary = summary
            meeting.summary = summary
            meeting.ai_todos = todos
            meeting.todos = [{**t, "done": False} for t in todos]
            meeting.status = "completed"
            db.commit()

            send_push_to_users(
                db, [meeting.user_id],
                title="🎙️ 회의록이 준비됐어요",
                body=meeting.title,
                url=f"/meeting/{meeting.id}",
            )
        except Exception as e:
            print(f"[_process_meeting_background] 처리 실패: {e}")
            db.rollback()
            meeting.status = "failed"
            meeting.error_message = str(e)[:500]
            db.commit()
            send_push_to_users(
                db, [meeting.user_id],
                title="⚠️ 회의록 생성 실패",
                body=f"{meeting.title} 요약에 실패했어요. 다시 시도해주세요.",
                url=f"/meeting/{meeting.id}",
            )
    finally:
        db.close()


# ── 녹음 업로드 → 백그라운드로 STT+AI 요약 처리 시작 ──────────
@router.post("/upload")
async def upload_meeting(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    company_id: str = Form(""),  # 비어있으면 개인(비소속) 모드
    user_id: str = Form(...),
    user_name: str = Form(""),
    team_id: str = Form(""),
    title: str = Form(""),
    recorded_at: str = Form(""),
    duration_seconds: int = Form(0),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["uid"] != user_id:
        raise HTTPException(status_code=403, detail="본인만 회의록을 등록할 수 있어요")
    if company_id:
        _require_member(db, user_id, company_id)

    # 팀을 명시적으로 지정하지 않았으면 사용자의 소속 팀으로 자동 태깅 (진행 현황 화면의 팀별 집계에 사용)
    if company_id and not team_id:
        auto_team_id = get_user_team_id(db, company_id, user_id)
        if auto_team_id:
            team_id = auto_team_id

    if _monthly_usage_count(db, user_id) >= FREE_MONTHLY_LIMIT:
        raise HTTPException(status_code=403, detail=QUOTA_EXCEEDED_MESSAGE)
    if duration_seconds and duration_seconds > MAX_DURATION_SECONDS:
        raise HTTPException(status_code=400, detail="녹음은 최대 30분까지 가능해요")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="녹음 파일이 비어있어요")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="녹음 파일이 너무 커요 (최대 25MB)")

    try:
        recorded_dt = datetime.fromisoformat(recorded_at) if recorded_at else datetime.utcnow()
    except ValueError:
        recorded_dt = datetime.utcnow()

    meeting_title = title.strip() or f"{recorded_dt.strftime('%Y-%m-%d %H:%M')} 회의"

    meeting = Meeting(
        company_id=company_id or None,
        team_id=team_id or None,
        user_id=user_id,
        user_name=user_name,
        title=meeting_title,
        recorded_at=recorded_dt,
        duration_seconds=duration_seconds or None,
        status="processing",
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    background_tasks.add_task(
        _process_meeting_background, meeting.id, audio_bytes, file.filename or "recording.webm", file.content_type,
    )

    return _serialize_detail(meeting)


# ── 회사(팀) 회의록 목록 ──────────────────────────────────
@router.get("/company/{company_id}")
def list_meetings(
    company_id: str,
    team_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _require_member(db, current_user["uid"], company_id)

    q = db.query(Meeting).filter(Meeting.company_id == company_id)
    if team_id:
        q = q.filter(or_(Meeting.team_id == team_id, Meeting.team_id.is_(None)))
    meetings = q.order_by(Meeting.recorded_at.desc()).all()
    return {"meetings": [_serialize_list(m) for m in meetings]}


PROGRESS_MEETING_LIMIT = 30  # 진행 현황 재정리 시 반영할 최근 회의 수 (비용/토큰 제한)


def _progress_scope_meetings(db: Session, company_id: str, team_id: Optional[str]):
    """진행 현황 스코프에 해당하는 완료된 회의 쿼리. team_id 지정 시 해당 팀 + 팀 미지정 회의,
    미지정 시 팀 미지정 회의만 (list_meetings의 team_id 필터와 동일한 규칙)."""
    q = db.query(Meeting).filter(Meeting.company_id == company_id, Meeting.status == "completed")
    if team_id:
        q = q.filter(or_(Meeting.team_id == team_id, Meeting.team_id.is_(None)))
    else:
        q = q.filter(Meeting.team_id.is_(None))
    return q


def _serialize_progress(p: MeetingProgress, stale: bool) -> dict:
    return {
        "generated": True,
        "team_id": p.team_id,
        "overview": p.overview,
        "items": p.items or [],
        "based_on_meeting_count": p.based_on_meeting_count,
        "generated_at": p.generated_at.isoformat() if p.generated_at else None,
        "generated_by_name": p.generated_by_name,
        "stale": stale,
    }


# ── 팀별 진행 현황 조회 (캐시된 결과) ─────────────────────────
@router.get("/progress/{company_id}")
def get_progress(
    company_id: str,
    team_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _require_member(db, current_user["uid"], company_id)

    row = db.query(MeetingProgress).filter(
        MeetingProgress.company_id == company_id,
        MeetingProgress.team_id == team_id if team_id else MeetingProgress.team_id.is_(None),
    ).first()

    latest = _progress_scope_meetings(db, company_id, team_id).order_by(Meeting.recorded_at.desc()).first()

    if not row:
        return {"generated": False, "stale": latest is not None}

    stale = bool(latest and (not row.last_meeting_at or latest.recorded_at > row.last_meeting_at))
    return _serialize_progress(row, stale)


# ── 팀별 진행 현황 다시 정리 (회의 히스토리를 Claude로 재분석) ──
@router.post("/progress/{company_id}")
def regenerate_progress(
    company_id: str,
    team_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    member = _require_member(db, current_user["uid"], company_id)

    meetings = (
        _progress_scope_meetings(db, company_id, team_id)
        .order_by(Meeting.recorded_at.desc())
        .limit(PROGRESS_MEETING_LIMIT)
        .all()
    )
    if not meetings:
        raise HTTPException(status_code=400, detail="정리할 회의록이 아직 없어요")
    meetings = list(reversed(meetings))  # 오래된 것 → 최신 순으로 Claude에 전달

    blocks = []
    for m in meetings:
        todo_lines = "\n".join(
            f"  - {t.get('text', '')} ({'완료' if t.get('done') else '미완료'})" for t in (m.todos or [])
        )
        blocks.append(
            f"[{m.recorded_at.strftime('%Y-%m-%d')}] {m.title}\n"
            f"요약: {m.summary or '(요약 없음)'}\n"
            f"할일:\n{todo_lines or '  (없음)'}"
        )
    meetings_text = "\n\n".join(blocks)

    try:
        overview, items = analyze_progress(meetings_text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"진행 현황 정리에 실패했어요: {e}")

    row = db.query(MeetingProgress).filter(
        MeetingProgress.company_id == company_id,
        MeetingProgress.team_id == team_id if team_id else MeetingProgress.team_id.is_(None),
    ).first()
    if not row:
        row = MeetingProgress(company_id=company_id, team_id=team_id or None)
        db.add(row)

    row.overview = overview
    row.items = items
    row.based_on_meeting_count = len(meetings)
    row.last_meeting_at = meetings[-1].recorded_at
    row.generated_at = datetime.utcnow()
    row.generated_by = current_user["uid"]
    row.generated_by_name = (member.user_name if member else None) or current_user.get("name") or current_user.get("email")
    db.commit()
    db.refresh(row)

    return _serialize_progress(row, stale=False)


# ── 이번 달 베타 이용 한도 조회 ────────────────────────────
@router.get("/quota/{user_id}")
def get_quota(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["uid"] != user_id:
        raise HTTPException(status_code=403, detail="본인의 이용 한도만 조회할 수 있어요")
    used = _monthly_usage_count(db, user_id)
    return {
        "used": used,
        "limit": FREE_MONTHLY_LIMIT,
        "remaining": max(0, FREE_MONTHLY_LIMIT - used),
        "message": QUOTA_EXCEEDED_MESSAGE,
    }


# ── 개인(비소속) 회의록 목록 ─────────────────────────────
@router.get("/my/{user_id}")
def list_my_meetings(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["uid"] != user_id:
        raise HTTPException(status_code=403, detail="본인의 회의록만 조회할 수 있어요")

    meetings = (
        db.query(Meeting)
        .filter(Meeting.user_id == user_id, Meeting.company_id.is_(None))
        .order_by(Meeting.recorded_at.desc())
        .all()
    )
    return {"meetings": [_serialize_list(m) for m in meetings]}


# ── 회의록 상세 ──────────────────────────────────────────
@router.get("/{meeting_id}")
def get_meeting(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="회의록을 찾을 수 없어요")
    if not _can_view(db, current_user["uid"], meeting):
        raise HTTPException(status_code=403, detail="조회 권한이 없어요")
    return _serialize_detail(meeting)


# ── 회의록 수정 (요약/할일/제목) ───────────────────────────
@router.put("/{meeting_id}")
def update_meeting(
    meeting_id: str,
    req: MeetingUpdateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="회의록을 찾을 수 없어요")
    if not _can_view(db, current_user["uid"], meeting):
        raise HTTPException(status_code=403, detail="수정 권한이 없어요")
    member = _get_member(db, current_user["uid"], meeting.company_id) if meeting.company_id else None

    if req.title is not None:
        if not req.title.strip():
            raise HTTPException(status_code=400, detail="제목을 입력해주세요")
        meeting.title = req.title.strip()
    if req.summary is not None:
        meeting.summary = req.summary
    if req.todos is not None:
        meeting.todos = req.todos

    meeting.updated_by = current_user["uid"]
    meeting.updated_by_name = (member.user_name if member else None) or current_user.get("name") or current_user.get("email")
    meeting.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(meeting)
    return _serialize_detail(meeting)


# ── 회의록 삭제 (작성자 또는 관리자) ────────────────────────
@router.delete("/{meeting_id}")
def delete_meeting(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="회의록을 찾을 수 없어요")

    uid = current_user["uid"]
    if not _can_delete(db, uid, meeting):
        raise HTTPException(status_code=403, detail="작성자 또는 관리자만 삭제할 수 있어요")

    db.delete(meeting)
    db.commit()
    return {"success": True}
