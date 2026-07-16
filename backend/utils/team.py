from sqlalchemy.orm import Session
from models.team import Team, TeamMember
from models.company import CompanyMember


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
