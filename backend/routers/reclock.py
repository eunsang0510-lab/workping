from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import os

from database.connection import get_db
from models.reclock import ReclockRequest
from models.attendance import Attendance
from models.company import CompanyMember
from models.team import Team, TeamMember
from routers.deps import get_current_user
from utils.workday import get_work_day_range, today_kst_str
from utils.push import send_push_to_users
from utils.team import get_managers_and_admins

router = APIRouter()

SUPERADMIN_EMAIL = os.getenv("SYSTEM_ADMIN_EMAIL", "eunsang0510@gmail.com")


class ReclockStartRequest(BaseModel):
    user_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None


class ReclockFinishRequest(BaseModel):
    user_id: str
    reclock_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None


class ReclockApproveRequest(BaseModel):
    status: str  # approved / rejected
    reject_reason: Optional[str] = None


def _serialize(r: ReclockRequest) -> dict:
    return {
        "id": r.id,
        "user_id": r.user_id,
        "user_name": r.user_name,
        "work_date": r.work_date,
        "checkin_at": r.checkin_at.isoformat() if r.checkin_at else None,
        "checkin_address": r.checkin_address,
        "checkin_latitude": r.checkin_latitude,
        "checkin_longitude": r.checkin_longitude,
        "checkout_at": r.checkout_at.isoformat() if r.checkout_at else None,
        "checkout_address": r.checkout_address,
        "checkout_latitude": r.checkout_latitude,
        "checkout_longitude": r.checkout_longitude,
        "status": r.status,
        "reject_reason": r.reject_reason,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


# ── 재출근 시작 (GPS 검증 없음 — 위치는 참고용으로만 기록) ──────────
@router.post("/start")
def start_reclock(
    req: ReclockStartRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["uid"] != req.user_id:
        raise HTTPException(status_code=403, detail="본인만 재출근을 기록할 수 있어요")

    member = db.query(CompanyMember).filter(CompanyMember.user_id == req.user_id).first()
    if not member:
        raise HTTPException(status_code=400, detail="소속된 회사가 없어요")

    start, end = get_work_day_range()
    today_checkout = db.query(Attendance).filter(
        Attendance.user_id == req.user_id,
        Attendance.type == "checkout",
        Attendance.recorded_at >= start,
        Attendance.recorded_at < end,
    ).first()
    if not today_checkout:
        raise HTTPException(status_code=400, detail="오늘 정상 퇴근 기록이 있어야 재출근할 수 있어요")

    existing = db.query(ReclockRequest).filter(
        ReclockRequest.user_id == req.user_id,
        ReclockRequest.work_date == today_kst_str(),
        ReclockRequest.status.in_(["in_progress", "pending"]),
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 진행 중인 재출근 세션이 있어요")

    reclock = ReclockRequest(
        company_id=member.company_id,
        user_id=req.user_id,
        user_name=member.user_name,
        work_date=today_kst_str(),
        checkin_at=datetime.utcnow(),
        checkin_address=req.address,
        checkin_latitude=req.latitude,
        checkin_longitude=req.longitude,
        status="in_progress",
    )
    db.add(reclock)
    db.commit()
    db.refresh(reclock)
    return _serialize(reclock)


# ── 재퇴근 (완료 → 팀장/관리자에게 승인 요청) ──────────────────────
@router.post("/finish")
def finish_reclock(
    req: ReclockFinishRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["uid"] != req.user_id:
        raise HTTPException(status_code=403, detail="본인만 재퇴근을 기록할 수 있어요")

    reclock = db.query(ReclockRequest).filter(ReclockRequest.id == req.reclock_id).first()
    if not reclock or reclock.user_id != req.user_id:
        raise HTTPException(status_code=404, detail="재출근 세션을 찾을 수 없어요")
    if reclock.status != "in_progress":
        raise HTTPException(status_code=400, detail="진행 중인 재출근 세션이 아니에요")

    reclock.checkout_at = datetime.utcnow()
    reclock.checkout_address = req.address
    reclock.checkout_latitude = req.latitude
    reclock.checkout_longitude = req.longitude
    reclock.status = "pending"
    db.commit()
    db.refresh(reclock)

    minutes = max(0, int((reclock.checkout_at - reclock.checkin_at).total_seconds() / 60))
    try:
        targets = get_managers_and_admins(db, reclock.company_id, reclock.user_id)
        if targets:
            send_push_to_users(
                db, targets,
                title="⏰ 재근무 승인 요청",
                body=f"{reclock.user_name or reclock.user_id}님이 재근무 {minutes // 60}시간 {minutes % 60}분 승인을 요청했어요.",
                url="/manager?tab=reclock",
            )
    except Exception as e:
        print(f"[finish_reclock] 알림 전송 실패: {e}")

    return _serialize(reclock)


# ── 오늘의 재출근 세션 (새로고침 시 버튼 상태 복원용) ───────────────
@router.get("/today/{user_id}")
def get_today_reclock(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["uid"] != user_id:
        raise HTTPException(status_code=403, detail="본인의 기록만 조회할 수 있어요")

    rows = (
        db.query(ReclockRequest)
        .filter(ReclockRequest.user_id == user_id, ReclockRequest.work_date == today_kst_str())
        .order_by(ReclockRequest.created_at.desc())
        .all()
    )
    return {"sessions": [_serialize(r) for r in rows]}


# ── 매니저 승인 탭용 목록 ──────────────────────────────────────
@router.get("/company/{company_id}")
def get_company_reclock(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    is_superadmin = current_user.get("email") == SUPERADMIN_EMAIL
    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == current_user["uid"],
        CompanyMember.company_id == company_id,
    ).first()
    if not is_superadmin and (not member or (not member.is_admin and not member.is_manager)):
        raise HTTPException(status_code=403, detail="팀장 또는 관리자만 조회할 수 있어요")

    query = db.query(ReclockRequest).filter(ReclockRequest.company_id == company_id)

    # 팀장(관리자 아님)이면 본인 팀원 신청만
    is_manager_only = member and member.is_manager and not member.is_admin
    if is_manager_only and not is_superadmin:
        managed_teams = db.query(Team).filter(Team.manager_id == current_user["uid"]).all()
        managed_team_ids = [t.id for t in managed_teams]
        team_member_rows = db.query(TeamMember.user_id).filter(
            TeamMember.team_id.in_(managed_team_ids)
        ).all()
        managed_user_ids = [uid for (uid,) in team_member_rows]
        query = query.filter(ReclockRequest.user_id.in_(managed_user_ids))

    rows = query.order_by(ReclockRequest.created_at.desc()).all()
    return {"requests": [_serialize(r) for r in rows]}


# ── 승인/반려 ──────────────────────────────────────────────
@router.put("/approve/{reclock_id}")
def approve_reclock(
    reclock_id: str,
    req: ReclockApproveRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    reclock = db.query(ReclockRequest).filter(ReclockRequest.id == reclock_id).first()
    if not reclock:
        raise HTTPException(status_code=404, detail="재출근 신청을 찾을 수 없어요")

    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == current_user["uid"],
        CompanyMember.company_id == reclock.company_id,
    ).first()
    is_superadmin = current_user.get("email") == SUPERADMIN_EMAIL
    if not is_superadmin and (not member or (not member.is_admin and not member.is_manager)):
        raise HTTPException(status_code=403, detail="팀장 또는 관리자만 승인할 수 있어요")

    if req.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="status는 approved 또는 rejected만 가능해요")
    if reclock.status != "pending":
        raise HTTPException(status_code=400, detail="대기 중인 신청만 처리할 수 있어요")

    reclock.status = req.status
    reclock.approved_by = current_user["uid"]
    reclock.approved_at = datetime.utcnow()
    if req.status == "rejected":
        reclock.reject_reason = req.reject_reason
    db.commit()

    minutes = 0
    if reclock.checkout_at:
        minutes = max(0, int((reclock.checkout_at - reclock.checkin_at).total_seconds() / 60))
    status_text = "승인" if req.status == "approved" else "반려"
    try:
        send_push_to_users(
            db, [reclock.user_id],
            title=f"⏰ 재근무 {status_text}",
            body=f"재근무 {minutes // 60}시간 {minutes % 60}분 신청이 {status_text}됐어요.",
            url="/dashboard",
        )
    except Exception as e:
        print(f"[approve_reclock] 알림 전송 실패: {e}")

    return {"success": True, "status": req.status}
