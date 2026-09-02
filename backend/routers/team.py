from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.connection import get_db
from models.team import Team, TeamMember
from models.company import CompanyMember
from models.leave import Leave
from models.business_trip import BusinessTrip
from models.reclock import ReclockRequest
from routers.deps import get_current_user
from utils.admin import is_superadmin_email
from utils.team import get_managed_user_ids
from datetime import datetime
from typing import Optional

router = APIRouter()


class TeamCreate(BaseModel):
    company_id: str
    name: str


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    manager_id: Optional[str] = None
    parent_team_id: Optional[str] = None


class TeamMemberAdd(BaseModel):
    team_id: str
    user_id: str


# ── 팀 생성 (관리자) ───────────────────────────────────
@router.post("/create")
def create_team(
    req: TeamCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == current_user["uid"],
        CompanyMember.company_id == req.company_id,
        CompanyMember.is_admin == True,
    ).first()
    is_superadmin = is_superadmin_email(db, current_user.get("email"))
    if not member and not is_superadmin:
        raise HTTPException(status_code=403, detail="관리자만 팀을 생성할 수 있어요")

    team = Team(
        company_id=req.company_id,
        name=req.name,
        created_by=current_user.get("uid") if isinstance(current_user, dict) else None,
    )
    db.add(team)
    db.commit()
    db.refresh(team)
    return {"success": True, "team_id": team.id, "name": team.name}


# ── 팀 목록 조회 ───────────────────────────────────────
@router.get("/company/{company_id}")
def get_teams(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    teams = db.query(Team).filter(
        Team.company_id == company_id
    ).order_by(Team.created_at).all()

    team_ids = [t.id for t in teams]
    all_members = (
        db.query(TeamMember).filter(TeamMember.team_id.in_(team_ids)).all()
        if team_ids else []
    )
    members_by_team: dict = {}
    for m in all_members:
        members_by_team.setdefault(m.team_id, []).append(m.user_id)

    manager_ids = {t.manager_id for t in teams if t.manager_id}
    managers = (
        db.query(CompanyMember).filter(CompanyMember.user_id.in_(manager_ids)).all()
        if manager_ids else []
    )
    manager_name_by_user = {m.user_id: m.user_name for m in managers}

    result = []
    for t in teams:
        member_ids = members_by_team.get(t.id, [])
        result.append({
            "id": t.id,
            "name": t.name,
            "manager_id": t.manager_id,
            "manager_name": manager_name_by_user.get(t.manager_id) if t.manager_id else None,
            "parent_team_id": t.parent_team_id,
            "member_count": len(member_ids),
            "members": member_ids,
        })

    return {"teams": result}


# ── 팀 수정 (이름, 팀장 변경) ──────────────────────────
@router.put("/{team_id}")
def update_team(
    team_id: str,
    req: TeamUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없어요")

    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == current_user["uid"],
        CompanyMember.company_id == team.company_id,
        CompanyMember.is_admin == True,
    ).first()
    is_superadmin = is_superadmin_email(db, current_user.get("email"))
    if not member and not is_superadmin:
        raise HTTPException(status_code=403, detail="관리자만 수정할 수 있어요")

    if req.name:
        team.name = req.name

    if req.manager_id is not None:
        team.manager_id = req.manager_id
        # 팀장에게 is_manager 권한 부여
        target = db.query(CompanyMember).filter(
            CompanyMember.user_id == req.manager_id,
            CompanyMember.company_id == team.company_id,
        ).first()
        if target:
            target.is_manager = True
            target.updated_by = current_user["uid"]

    if req.parent_team_id is not None:
        if req.parent_team_id == team_id:
            raise HTTPException(status_code=400, detail="자기 자신을 상위 조직으로 지정할 수 없어요")
        team.parent_team_id = req.parent_team_id or None

    team.updated_by = current_user["uid"]
    db.commit()
    return {"success": True}


# ── 팀 삭제 ────────────────────────────────────────────
@router.delete("/{team_id}")
def delete_team(
    team_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없어요")

    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == current_user["uid"],
        CompanyMember.company_id == team.company_id,
        CompanyMember.is_admin == True,
    ).first()
    is_superadmin = is_superadmin_email(db, current_user.get("email"))
    if not member and not is_superadmin:
        raise HTTPException(status_code=403, detail="관리자만 삭제할 수 있어요")

    # 팀원 매핑도 삭제
    db.query(TeamMember).filter(TeamMember.team_id == team_id).delete()
    db.delete(team)
    db.commit()
    return {"success": True}


# ── 팀원 추가 ──────────────────────────────────────────
@router.post("/member/add")
def add_team_member(
    req: TeamMemberAdd,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    team = db.query(Team).filter(Team.id == req.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없어요")

    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == current_user["uid"],
        CompanyMember.company_id == team.company_id,
        CompanyMember.is_admin == True,
    ).first()
    is_superadmin = is_superadmin_email(db, current_user.get("email"))
    if not member and not is_superadmin:
        raise HTTPException(status_code=403, detail="관리자만 팀원을 추가할 수 있어요")

    # 이미 있는지 확인
    existing = db.query(TeamMember).filter(
        TeamMember.team_id == req.team_id,
        TeamMember.user_id == req.user_id,
    ).first()
    if existing:
        return {"success": False, "message": "이미 팀에 속해있어요"}

    team_member = TeamMember(
        team_id=req.team_id,
        user_id=req.user_id,
        created_by=current_user.get("uid") if isinstance(current_user, dict) else None,
    )
    db.add(team_member)
    db.commit()
    return {"success": True}


# ── 팀원 제거 ──────────────────────────────────────────
@router.delete("/member/{team_id}/{user_id}")
def remove_team_member(
    team_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없어요")

    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == current_user["uid"],
        CompanyMember.company_id == team.company_id,
        CompanyMember.is_admin == True,
    ).first()
    is_superadmin = is_superadmin_email(db, current_user.get("email"))
    if not member and not is_superadmin:
        raise HTTPException(status_code=403, detail="관리자만 팀원을 제거할 수 있어요")

    db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == user_id,
    ).delete()
    db.commit()
    return {"success": True}


# ── 내 팀 조회 (팀장/팀원용) ──────────────────────────
@router.get("/my/{user_id}")
def get_my_team(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["uid"] != user_id:
        raise HTTPException(status_code=403, detail="본인 정보만 조회할 수 있어요")

    # 팀장으로 있는 팀
    managed_teams = db.query(Team).filter(Team.manager_id == user_id).all()

    # 팀원으로 있는 팀
    team_memberships = db.query(TeamMember).filter(TeamMember.user_id == user_id).all()
    member_team_ids = [tm.team_id for tm in team_memberships]
    member_teams = db.query(Team).filter(Team.id.in_(member_team_ids)).all()

    return {
        "managed_teams": [{"id": t.id, "name": t.name} for t in managed_teams],
        "member_teams": [{"id": t.id, "name": t.name} for t in member_teams],
    }


# ── 팀장 메뉴 배지용 대기 결재건 수 ────────────────────────
@router.get("/pending-count/{company_id}")
def get_pending_count(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """연차/출장/재출근 중 팀장(또는 관리자)의 결재를 기다리는 건수 합계.
    대시보드의 '팀장 권한' 메뉴 배지에 쓴다 — 목록 전체를 안 받고 개수만 세서 가볍게 유지."""
    is_superadmin = is_superadmin_email(db, current_user.get("email"))
    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == current_user["uid"], CompanyMember.company_id == company_id,
    ).first()
    if not is_superadmin and (not member or (not member.is_admin and not member.is_manager)):
        raise HTTPException(status_code=403, detail="팀장 또는 관리자만 조회할 수 있어요")

    is_manager_only = bool(member and member.is_manager and not member.is_admin) and not is_superadmin
    scope_user_ids = get_managed_user_ids(db, company_id, current_user["uid"]) if is_manager_only else None

    def _count(model, company_col, user_col, statuses):
        q = db.query(model).filter(company_col == company_id, model.status.in_(statuses))
        if scope_user_ids is not None:
            q = q.filter(user_col.in_(scope_user_ids))
        return q.count()

    leave_count = _count(Leave, Leave.company_id, Leave.user_id, ("pending", "cancel_requested"))
    trip_count = _count(BusinessTrip, BusinessTrip.company_id, BusinessTrip.user_id, ("pending", "cancel_requested"))
    reclock_count = _count(ReclockRequest, ReclockRequest.company_id, ReclockRequest.user_id, ("pending",))

    return {
        "total": leave_count + trip_count + reclock_count,
        "leave": leave_count,
        "business_trip": trip_count,
        "reclock": reclock_count,
    }