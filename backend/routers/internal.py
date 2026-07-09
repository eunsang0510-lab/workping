import os
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from database.connection import get_db
from models.leave import Leave, LeaveBalance
from models.company import Company, CompanyMember
from models.team import Team, TeamMember
from utils.push import send_push_to_users

router = APIRouter()

INTERNAL_KEY = os.getenv("INTERNAL_API_KEY", "")


def verify_internal_key(x_internal_key: str = Header(...)):
    if not INTERNAL_KEY or x_internal_key != INTERNAL_KEY:
        raise HTTPException(status_code=403, detail="내부 서비스 키가 유효하지 않아요")


class InternalLeaveRequest(BaseModel):
    user_id: str
    company_id: str
    user_name: Optional[str] = ""
    start_date: str
    end_date: str
    is_half: bool = False
    reason: Optional[str] = ""
    leave_type: str = "annual"


class InternalLeaveBalanceRequest(BaseModel):
    user_id: str
    company_id: str


def _calc_days(start_date: str, end_date: str, is_half: bool) -> float:
    if is_half:
        return 0.5
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    return float((end - start).days + 1)


def _get_manager_ids(db: Session, company_id: str, user_id: str) -> list[str]:
    teams = db.query(Team).filter(Team.company_id == company_id).all()
    result = []
    for team in teams:
        members = db.query(TeamMember).filter(TeamMember.team_id == team.id).all()
        if any(m.user_id == user_id for m in members) and team.manager_id:
            result.append(team.manager_id)
    if not result:
        admins = db.query(CompanyMember).filter(
            CompanyMember.company_id == company_id,
            CompanyMember.is_admin == True,
        ).all()
        result = [a.user_id for a in admins]
    return result


@router.post("/leave/apply")
def internal_apply_leave(
    req: InternalLeaveRequest,
    db: Session = Depends(get_db),
    _: str = Depends(verify_internal_key),
):
    company = db.query(Company).filter(Company.id == req.company_id).first()
    if not company or not company.leave_enabled:
        raise HTTPException(status_code=400, detail="연차 기능이 비활성화되어 있어요")

    year = datetime.now().year
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.company_id == req.company_id,
        LeaveBalance.user_id == req.user_id,
        LeaveBalance.year == year,
    ).first()

    if not balance:
        raise HTTPException(status_code=400, detail="연차 정보가 없어요. 관리자에게 문의하세요")

    days = _calc_days(req.start_date, req.end_date, req.is_half)
    remaining = balance.total_days - balance.used_days

    if remaining < days:
        raise HTTPException(status_code=400, detail=f"잔여 연차가 부족해요 (잔여: {remaining}일)")

    leave = Leave(
        company_id=req.company_id,
        user_id=req.user_id,
        user_name=req.user_name,
        leave_type=req.leave_type,
        start_date=req.start_date,
        end_date=req.end_date,
        days=days,
        is_half=req.is_half,
        reason=req.reason,
        status="pending",
        created_by=req.user_id,
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)

    manager_ids = _get_manager_ids(db, req.company_id, req.user_id)
    if manager_ids:
        send_push_to_users(
            db, manager_ids,
            title="📋 연차 신청",
            body=f"{req.user_name or req.user_id}님이 {req.start_date} 연차를 AI Agent로 신청했어요.",
            url="/manager",
        )

    return {"success": True, "leave_id": leave.id, "days": days}


@router.post("/leave/balance")
def internal_get_balance(
    req: InternalLeaveBalanceRequest,
    db: Session = Depends(get_db),
    _: str = Depends(verify_internal_key),
):
    year = datetime.now().year
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.user_id == req.user_id,
        LeaveBalance.company_id == req.company_id,
        LeaveBalance.year == year,
    ).first()

    if not balance:
        raise HTTPException(status_code=404, detail="연차 정보가 없어요")

    return {
        "total_days": balance.total_days,
        "used_days": balance.used_days,
        "remaining_days": balance.total_days - balance.used_days,
        "year": year,
    }
