from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from database.connection import get_db
from models.attendance import Attendance
from models.outing import Outing
from models.company import CompanyMember
from routers.deps import get_current_user
from utils.workday import get_work_day_range

router = APIRouter()


class OutingRequest(BaseModel):
    user_id: str


def _get_today_checkin(db: Session, user_id: str) -> Attendance | None:
    start, end = get_work_day_range()
    return (
        db.query(Attendance)
        .filter(
            Attendance.user_id == user_id,
            Attendance.type == "checkin",
            Attendance.recorded_at >= start,
            Attendance.recorded_at < end,
        )
        .order_by(Attendance.recorded_at.desc())
        .first()
    )


def _get_today_checkout(db: Session, user_id: str) -> Attendance | None:
    start, end = get_work_day_range()
    return (
        db.query(Attendance)
        .filter(
            Attendance.user_id == user_id,
            Attendance.type == "checkout",
            Attendance.recorded_at >= start,
            Attendance.recorded_at < end,
        )
        .order_by(Attendance.recorded_at.desc())
        .first()
    )


# ── 외출 시작 ──────────────────────────────────────────────
@router.post("/start")
def start_outing(
    req: OutingRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["uid"] != req.user_id:
        raise HTTPException(status_code=403, detail="본인만 외출을 기록할 수 있어요")

    checkin = _get_today_checkin(db, req.user_id)
    if not checkin:
        raise HTTPException(status_code=400, detail="오늘 출근 기록이 있어야 외출할 수 있어요")

    if _get_today_checkout(db, req.user_id):
        raise HTTPException(status_code=400, detail="이미 퇴근했어요")

    if checkin.is_outing:
        raise HTTPException(status_code=400, detail="이미 외출 중이에요")

    member = db.query(CompanyMember).filter(CompanyMember.user_id == req.user_id).first()

    outing = Outing(
        attendance_id=checkin.id,
        user_id=req.user_id,
        company_id=member.company_id if member else None,
        start_at=datetime.utcnow(),
    )
    db.add(outing)
    checkin.is_outing = True
    db.commit()
    db.refresh(outing)

    return {"id": outing.id, "start_at": outing.start_at.isoformat()}


# ── 복귀 ──────────────────────────────────────────────────
@router.post("/return")
def return_outing(
    req: OutingRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["uid"] != req.user_id:
        raise HTTPException(status_code=403, detail="본인만 복귀를 기록할 수 있어요")

    checkin = _get_today_checkin(db, req.user_id)
    if not checkin:
        raise HTTPException(status_code=400, detail="오늘 출근 기록이 없어요")

    outing = (
        db.query(Outing)
        .filter(Outing.attendance_id == checkin.id, Outing.end_at.is_(None))
        .order_by(Outing.start_at.desc())
        .first()
    )
    if not outing:
        raise HTTPException(status_code=400, detail="진행 중인 외출이 없어요")

    now = datetime.utcnow()
    minutes = max(0, int((now - outing.start_at).total_seconds() / 60))
    outing.end_at = now
    outing.duration_minutes = minutes

    checkin.outing_minutes = (checkin.outing_minutes or 0) + minutes
    checkin.is_outing = False
    db.commit()

    return {
        "id": outing.id,
        "end_at": outing.end_at.isoformat(),
        "duration_minutes": minutes,
        "total_outing_minutes": checkin.outing_minutes,
    }


# ── 외출 상태 조회 (새로고침 시 버튼 상태 복원용) ──────────────
@router.get("/status/{user_id}")
def get_outing_status(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["uid"] != user_id:
        raise HTTPException(status_code=403, detail="본인의 외출 상태만 조회할 수 있어요")

    checkin = _get_today_checkin(db, user_id)
    if not checkin:
        return {"is_outing": False, "start_at": None, "total_outing_minutes": 0}

    active = (
        db.query(Outing)
        .filter(Outing.attendance_id == checkin.id, Outing.end_at.is_(None))
        .order_by(Outing.start_at.desc())
        .first()
    )

    return {
        "is_outing": bool(checkin.is_outing),
        "start_at": active.start_at.isoformat() if active else None,
        "total_outing_minutes": checkin.outing_minutes or 0,
    }


# ── 오늘의 외출 기록 목록 (오늘의 기록 카드용) ──────────────────
@router.get("/today/{user_id}")
def get_today_outings(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["uid"] != user_id:
        raise HTTPException(status_code=403, detail="본인의 외출 기록만 조회할 수 있어요")

    checkin = _get_today_checkin(db, user_id)
    if not checkin:
        return {"outings": []}

    outings = (
        db.query(Outing)
        .filter(Outing.attendance_id == checkin.id)
        .order_by(Outing.start_at)
        .all()
    )

    return {
        "outings": [
            {
                "id": o.id,
                "start_at": o.start_at.isoformat(),
                "end_at": o.end_at.isoformat() if o.end_at else None,
                "duration_minutes": o.duration_minutes,
            }
            for o in outings
        ]
    }
