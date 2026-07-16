from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.connection import get_db
from models.team import Team, TeamMember
from models.company import CompanyMember
from routers.deps import get_current_user
from datetime import datetime
from typing import Optional

router = APIRouter()


class TeamCreate(BaseModel):
    company_id: str
    name: str


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    manager_id: Optional[str] = None


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
    is_superadmin = current_user.get("email") == "eunsang0510@gmail.com"
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
    is_superadmin = current_user.get("email") == "eunsang0510@gmail.com"
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
    is_superadmin = current_user.get("email") == "eunsang0510@gmail.com"
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
    is_superadmin = current_user.get("email") == "eunsang0510@gmail.com"
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
    is_superadmin = current_user.get("email") == "eunsang0510@gmail.com"
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