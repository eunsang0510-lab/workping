from sqlalchemy.orm import Session
from models.team import Team, TeamMember
from models.company import CompanyMember


def get_user_team_id(db: Session, company_id: str, user_id: str) -> str | None:
    """회사 내 사용자가 소속된 팀 id. 여러 팀에 소속돼 있으면 가장 먼저 매칭된 팀, 없으면 None."""
    team_ids = [t.id for t in db.query(Team.id).filter(Team.company_id == company_id).all()]
    if not team_ids:
        return None
    membership = db.query(TeamMember.team_id).filter(
        TeamMember.team_id.in_(team_ids),
        TeamMember.user_id == user_id,
    ).first()
    return membership[0] if membership else None


def get_managed_user_ids(db: Session, company_id: str, manager_uid: str) -> list[str]:
    """이 사람이 팀장으로 있는 팀들의 팀원 uid 목록 (본인이 관리하는 팀원만 승인/조회 범위를 좁힐 때 사용)."""
    managed_team_ids = [
        t.id for t in db.query(Team.id).filter(Team.company_id == company_id, Team.manager_id == manager_uid).all()
    ]
    if not managed_team_ids:
        return []
    rows = db.query(TeamMember.user_id).filter(TeamMember.team_id.in_(managed_team_ids)).all()
    return [uid for (uid,) in rows]


def get_manager_ids(db: Session, company_id: str, user_id: str) -> list[str]:
    """신청자 팀의 팀장 uid 목록. 팀 없으면 회사 admin."""
    teams = db.query(Team).filter(Team.company_id == company_id).all()
    manager_by_team = {t.id: t.manager_id for t in teams}
    result = []
    if manager_by_team:
        memberships = db.query(TeamMember.team_id).filter(
            TeamMember.team_id.in_(manager_by_team.keys()),
            TeamMember.user_id == user_id,
        ).all()
        result = [
            manager_by_team[team_id] for (team_id,) in memberships
            if manager_by_team.get(team_id)
        ]
    if not result:
        admins = db.query(CompanyMember).filter(
            CompanyMember.company_id == company_id,
            CompanyMember.is_admin == True,
        ).all()
        result = [a.user_id for a in admins]
    return result


def get_managers_and_admins(db: Session, company_id: str, user_id: str) -> list[str]:
    """신청자 팀의 팀장 + 회사 전체 관리자를 합쳐서 반환 (fallback 아님, 합집합, 중복 제거)."""
    teams = db.query(Team).filter(Team.company_id == company_id).all()
    manager_by_team = {t.id: t.manager_id for t in teams}
    manager_ids: list[str] = []
    if manager_by_team:
        memberships = db.query(TeamMember.team_id).filter(
            TeamMember.team_id.in_(manager_by_team.keys()),
            TeamMember.user_id == user_id,
        ).all()
        manager_ids = [
            manager_by_team[team_id] for (team_id,) in memberships
            if manager_by_team.get(team_id)
        ]

    admins = db.query(CompanyMember).filter(
        CompanyMember.company_id == company_id,
        CompanyMember.is_admin == True,
    ).all()
    admin_ids = [a.user_id for a in admins]

    return list(dict.fromkeys(manager_ids + admin_ids))
