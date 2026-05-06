from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.connection import get_db
from models.leave import Leave, LeaveBalance
from models.company import Company, CompanyMember
from routers.deps import get_current_user
from datetime import datetime
from typing import Optional
from models.team import Team, TeamMember

router = APIRouter()


class LeaveRequest(BaseModel):
    company_id: str
    user_id: str
    user_name: str = ""
    leave_type: str = "annual"
    start_date: str
    end_date: str
    is_half: bool = False
    reason: str = ""


class LeaveApproveRequest(BaseModel):
    status: str  # approved / rejected


class LeaveBalanceRequest(BaseModel):
    company_id: str
    user_id: str
    total_days: int = 15
    year: Optional[int] = None


class ToggleLeaveRequest(BaseModel):
    leave_enabled: bool


def calc_days(start_date: str, end_date: str, is_half: bool) -> float:
    if is_half:
        return 0.5
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    return float((end - start).days + 1)


# ── 연차 신청 ──────────────────────────────────────────
@router.post("/apply")
def apply_leave(
    req: LeaveRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["uid"] != req.user_id:
        raise HTTPException(status_code=403, detail="본인만 신청할 수 있어요")

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

    days = calc_days(req.start_date, req.end_date, req.is_half)
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
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)

    return {"success": True, "leave_id": leave.id, "days": days}


# ── 내 연차 목록 ───────────────────────────────────────
@router.get("/my/{user_id}")
def get_my_leaves(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["uid"] != user_id:
        raise HTTPException(status_code=403, detail="본인의 기록만 조회할 수 있어요")

    leaves = db.query(Leave).filter(
        Leave.user_id == user_id
    ).order_by(Leave.created_at.desc()).all()

    return {
        "leaves": [
            {
                "id": l.id,
                "leave_type": l.leave_type,
                "start_date": l.start_date,
                "end_date": l.end_date,
                "days": l.days,
                "is_half": l.is_half,
                "reason": l.reason,
                "status": l.status,
                "created_at": l.created_at.isoformat(),
            }
            for l in leaves
        ]
    }


# ── 내 연차 잔여 ───────────────────────────────────────
@router.get("/balance/{user_id}")
def get_my_balance(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["uid"] != user_id:
        raise HTTPException(status_code=403, detail="본인의 기록만 조회할 수 있어요")

    year = datetime.now().year
    member = db.query(CompanyMember).filter(CompanyMember.user_id == user_id).first()
    if not member:
        return {"balance": None}

    balance = db.query(LeaveBalance).filter(
        LeaveBalance.user_id == user_id,
        LeaveBalance.year == year,
    ).first()

    if not balance:
        return {"balance": None}

    return {
        "balance": {
            "total_days": balance.total_days,
            "used_days": balance.used_days,
            "remaining_days": balance.total_days - balance.used_days,
            "year": balance.year,
        }
    }


# ── 회사 연차 신청 목록 (팀장/관리자용) ────────────────
@router.get("/company/{company_id}")
def get_company_leaves(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == current_user["uid"],
        CompanyMember.company_id == company_id,
    ).first()

    is_superadmin = current_user.get("email") == "eunsang0510@gmail.com"

    if not is_superadmin and (not member or (not member.is_admin and not member.is_manager)):
        raise HTTPException(status_code=403, detail="팀장 또는 관리자만 조회할 수 있어요")

    # 팀장이면 본인 팀원만 조회
    is_manager_only = member and member.is_manager and not member.is_admin

    if is_manager_only and not is_superadmin:
        managed_teams = db.query(Team).filter(
            Team.manager_id == current_user["uid"]
        ).all()
        managed_team_ids = [t.id for t in managed_teams]
        team_member_rows = db.query(TeamMember.user_id).filter(
            TeamMember.team_id.in_(managed_team_ids)
        ).all()
        managed_user_ids = [uid for (uid,) in team_member_rows]
        leaves = db.query(Leave).filter(
            Leave.company_id == company_id,
            Leave.user_id.in_(managed_user_ids)
        ).order_by(Leave.created_at.desc()).all()
    else:
        leaves = db.query(Leave).filter(
            Leave.company_id == company_id
        ).order_by(Leave.created_at.desc()).all()

    return {
        "leaves": [
            {
                "id": l.id,
                "user_id": l.user_id,
                "user_name": l.user_name,
                "leave_type": l.leave_type,
                "start_date": l.start_date,
                "end_date": l.end_date,
                "days": l.days,
                "is_half": l.is_half,
                "reason": l.reason,
                "status": l.status,
                "created_at": l.created_at.isoformat(),
            }
            for l in leaves
        ]
    }


# ── 연차 승인/반려 (팀장/관리자용) ────────────────────
@router.put("/approve/{leave_id}")
def approve_leave(
    leave_id: str,
    req: LeaveApproveRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="연차 신청을 찾을 수 없어요")

    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == current_user["uid"],
        CompanyMember.company_id == leave.company_id,
    ).first()

    is_superadmin = current_user.get("email") == "eunsang0510@gmail.com"

    if not is_superadmin and (not member or (not member.is_admin and not member.is_manager)):
        raise HTTPException(status_code=403, detail="팀장 또는 관리자만 승인할 수 있어요")

    if req.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="status는 approved 또는 rejected만 가능해요")

    prev_status = leave.status
    leave.status = req.status
    leave.approved_by = current_user["uid"]
    leave.approved_at = datetime.now()

    year = datetime.now().year
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.user_id == leave.user_id,
        LeaveBalance.company_id == leave.company_id,
        LeaveBalance.year == year,
    ).first()

    # 승인 시 연차 차감
    if req.status == "approved" and prev_status != "approved":
        if balance:
            balance.used_days = balance.used_days + (0.5 if leave.is_half else leave.days)

    # 반려 시 연차 복구 (이전에 승인됐다가 반려된 경우)
    if req.status == "rejected" and prev_status == "approved":
        if balance:
            balance.used_days = max(0, balance.used_days - (0.5 if leave.is_half else leave.days))

    db.commit()
    return {"success": True, "status": req.status}


# ── 연차 잔여 부여 (관리자용) ──────────────────────────
@router.post("/balance/set")
def set_leave_balance(
    req: LeaveBalanceRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == current_user["uid"],
        CompanyMember.company_id == req.company_id,
        CompanyMember.is_admin == True,
    ).first()

    is_superadmin = current_user.get("email") == "eunsang0510@gmail.com"

    if not member and not is_superadmin:
        raise HTTPException(status_code=403, detail="관리자만 연차를 부여할 수 있어요")

    year = req.year or datetime.now().year
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.company_id == req.company_id,
        LeaveBalance.user_id == req.user_id,
        LeaveBalance.year == year,
    ).first()

    if balance:
        balance.total_days = req.total_days
    else:
        balance = LeaveBalance(
            company_id=req.company_id,
            user_id=req.user_id,
            total_days=req.total_days,
            used_days=0,
            year=year,
        )
        db.add(balance)

    db.commit()
    return {"success": True, "total_days": req.total_days, "year": year}


# ── 회사 직원별 연차 현황 (관리자/팀장용) ─────────────
@router.get("/balance/company/{company_id}")
def get_company_balances(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == current_user["uid"],
        CompanyMember.company_id == company_id,
    ).first()

    is_superadmin = current_user.get("email") == "eunsang0510@gmail.com"

    if not is_superadmin and (not member or (not member.is_admin and not member.is_manager)):
        raise HTTPException(status_code=403, detail="팀장 또는 관리자만 조회할 수 있어요")

    year = datetime.now().year
    # 팀장이면 본인 팀원만 조회
    is_manager_only = member and member.is_manager and not member.is_admin

    if is_manager_only and not is_superadmin:
        managed_teams = db.query(Team).filter(
            Team.manager_id == current_user["uid"]
        ).all()
        managed_team_ids = [t.id for t in managed_teams]
        team_member_rows = db.query(TeamMember.user_id).filter(
            TeamMember.team_id.in_(managed_team_ids)
        ).all()
        managed_user_ids = [uid for (uid,) in team_member_rows]
        members = db.query(CompanyMember).filter(
            CompanyMember.company_id == company_id,
            CompanyMember.user_id.in_(managed_user_ids)
        ).all()
    else:
        members = db.query(CompanyMember).filter(
            CompanyMember.company_id == company_id
        ).all()

    result = []
    for m in members:
        balance = db.query(LeaveBalance).filter(
            LeaveBalance.user_id == m.user_id,
            LeaveBalance.company_id == company_id,
            LeaveBalance.year == year,
        ).first()
        result.append({
            "user_id": m.user_id,
            "user_name": m.user_name or m.user_email,
            "user_email": m.user_email,
            "is_manager": m.is_manager,
            "total_days": balance.total_days if balance else 0,
            "used_days": balance.used_days if balance else 0,
            "remaining_days": (balance.total_days - balance.used_days) if balance else 0,
        })

    return {"year": year, "balances": result}


# ── 연차 기능 ON/OFF (관리자/superadmin) ──────────────
@router.put("/toggle/{company_id}")
def toggle_leave(
    company_id: str,
    req: ToggleLeaveRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="회사를 찾을 수 없어요")

    is_superadmin = current_user.get("email") == "eunsang0510@gmail.com"

    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == current_user["uid"],
        CompanyMember.company_id == company_id,
        CompanyMember.is_admin == True,
    ).first()

    if not member and not is_superadmin:
        raise HTTPException(status_code=403, detail="관리자만 설정할 수 있어요")

    company.leave_enabled = req.leave_enabled
    db.commit()
    return {"success": True, "leave_enabled": req.leave_enabled}


# ── 팀장 지정/해제 (관리자/superadmin) ────────────────
@router.put("/manager/{user_id}")
def set_manager(
    user_id: str,
    is_manager: bool,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    target = db.query(CompanyMember).filter(CompanyMember.user_id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없어요")

    is_superadmin = current_user.get("email") == "eunsang0510@gmail.com"

    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == current_user["uid"],
        CompanyMember.company_id == target.company_id,
        CompanyMember.is_admin == True,
    ).first()

    if not member and not is_superadmin:
        raise HTTPException(status_code=403, detail="관리자만 팀장을 지정할 수 있어요")

    target.is_manager = is_manager
    db.commit()
    return {"success": True, "is_manager": is_manager}