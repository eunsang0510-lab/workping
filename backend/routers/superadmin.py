from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from database.connection import get_db
from models.company import Company, CompanyMember
from models.page_view import PageView
from models.meeting import Meeting, MeetingUsageLog
from routers.deps import get_current_user, get_superadmin
from routers.meeting import _serialize_list, _serialize_detail
from models.system_admin import SystemAdmin
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import uuid
import os
import firebase_admin
from firebase_admin import auth as firebase_auth

router = APIRouter()


# ── 시스템 관리자 목록 관리 ─────────────────────────────
class SystemAdminCreate(BaseModel):
    email: str


@router.get("/admins")
def list_system_admins(db: Session = Depends(get_db), _: dict = Depends(get_superadmin)):
    admins = db.query(SystemAdmin).order_by(SystemAdmin.created_at).all()
    return {
        "admins": [
            {"id": a.id, "email": a.email, "created_at": a.created_at, "created_by": a.created_by}
            for a in admins
        ]
    }


@router.post("/admins")
def add_system_admin(
    body: SystemAdminCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_superadmin)
):
    email = body.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="이메일을 입력해주세요")
    if db.query(SystemAdmin).filter(SystemAdmin.email == email).first():
        raise HTTPException(status_code=400, detail="이미 시스템 관리자예요")

    admin = SystemAdmin(email=email, created_by=current_user.get("uid"))
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return {"success": True, "id": admin.id, "email": admin.email}


@router.delete("/admins/{admin_id}")
def remove_system_admin(
    admin_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_superadmin)
):
    admin = db.query(SystemAdmin).filter(SystemAdmin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="시스템 관리자를 찾을 수 없어요")

    total = db.query(SystemAdmin).count()
    if total <= 1:
        raise HTTPException(status_code=400, detail="마지막 남은 시스템 관리자는 삭제할 수 없어요")
    if admin.email == (current_user.get("email") or "").strip().lower():
        raise HTTPException(status_code=400, detail="본인 계정은 삭제할 수 없어요")

    db.delete(admin)
    db.commit()
    return {"success": True}


class AdminPasswordResetRequest(BaseModel):
    email: str
    new_password: str

@router.get("/member-debug")
def debug_member(email: str, x_admin_secret: str = Header(...), db: Session = Depends(get_db)):
    expected = os.getenv("SYSTEM_ADMIN_RESET_SECRET")
    if not expected or x_admin_secret != expected:
        raise HTTPException(status_code=403, detail="권한 없음")
    members = db.query(CompanyMember).filter(CompanyMember.user_email == email).all()
    companies = {c.id: c.name for c in db.query(Company).all()}
    return {
        "email": email,
        "records": [
            {
                "id": m.id,
                "company_id": m.company_id,
                "company_name": companies.get(m.company_id, "?"),
                "user_id": m.user_id,
                "user_name": m.user_name,
                "is_admin": m.is_admin,
                "force_password_change": m.force_password_change,
            }
            for m in members
        ]
    }

@router.post("/reset-firebase-password")
def reset_firebase_password(req: AdminPasswordResetRequest, x_admin_secret: str = Header(...)):
    expected = os.getenv("SYSTEM_ADMIN_RESET_SECRET")
    if not expected or x_admin_secret != expected:
        raise HTTPException(status_code=403, detail="권한 없음")
    try:
        user = firebase_auth.get_user_by_email(req.email)
        firebase_auth.update_user(user.uid, password=req.new_password)
        return {"success": True, "message": f"{req.email} 비밀번호 업데이트 완료"}
    except Exception as e:
        print(f"[SUPERADMIN] Firebase 비밀번호 변경 실패: {e}")
        raise HTTPException(status_code=500, detail="비밀번호 변경에 실패했어요")


# 회사 생성 스키마
class CompanyCreate(BaseModel):
    name: str
    plan: Optional[str] = "team"


# 멤버 추가 스키마
class MemberCreate(BaseModel):
    company_id: str
    user_email: str
    user_name: Optional[str] = None
    is_admin: Optional[bool] = False


# 전체 통계
@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _: dict = Depends(get_superadmin)):
    total_companies = db.query(func.count(Company.id)).scalar()
    total_members = db.query(func.count(CompanyMember.id)).scalar()
    return {
        "total_companies": total_companies,
        "total_members": total_members,
    }


# 전체 회사 목록
@router.get("/companies")
def get_companies(db: Session = Depends(get_db), _: dict = Depends(get_superadmin)):
    companies = db.query(Company).order_by(Company.created_at.desc()).all()
    result = []
    for c in companies:
        member_count = (
            db.query(func.count(CompanyMember.id))
            .filter(CompanyMember.company_id == c.id)
            .scalar()
        )
        result.append(
            {
                "id": c.id,
                "name": c.name,
                "admin_id": c.admin_id,
                "plan": c.plan,
                "member_count": member_count,
                 "leave_enabled": c.leave_enabled,
                "created_at": c.created_at,
            }
        )
    return result


# 회사 생성
@router.post("/company")
def create_company(body: CompanyCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_superadmin)):
    company = Company(
        id=str(uuid.uuid4()),
        name=body.name,
        admin_id="superadmin",
        plan=body.plan,
        created_by=current_user.get("uid"),
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return {"success": True, "company": {"id": company.id, "name": company.name}}


# 회사 삭제
@router.delete("/company/{company_id}")
def delete_company(company_id: str, db: Session = Depends(get_db), _: dict = Depends(get_superadmin)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="회사를 찾을 수 없습니다")
    db.query(CompanyMember).filter(CompanyMember.company_id == company_id).delete()
    db.delete(company)
    db.commit()
    return {"message": "삭제 완료"}


def _last_access_map(db: Session) -> dict:
    """user_id별 마지막 화면 접속일시"""
    rows = (
        db.query(PageView.user_id, func.max(PageView.created_at))
        .filter(PageView.user_id.isnot(None))
        .group_by(PageView.user_id)
        .all()
    )
    return dict(rows)


# 전체 직원 목록
@router.get("/members")
def get_members(db: Session = Depends(get_db), _: dict = Depends(get_superadmin)):
    members = db.query(CompanyMember).order_by(CompanyMember.created_at.desc()).all()
    last_access = _last_access_map(db)

    company_ids = {m.company_id for m in members if m.company_id}
    companies = db.query(Company).filter(Company.id.in_(company_ids)).all() if company_ids else []
    company_name_by_id = {c.id: c.name for c in companies}

    result = []
    for m in members:
        last_seen = last_access.get(m.user_id)
        result.append(
            {
                "id": m.id,
                "company_id": m.company_id,
                "company_name": company_name_by_id.get(m.company_id, "알 수 없음"),
                "user_id": m.user_id,
                "user_email": m.user_email,
                "user_name": m.user_name,
                "is_admin": m.is_admin,
                "created_at": m.created_at,
                "last_access_at": last_seen.isoformat() if last_seen else None,
            }
        )
    return result


# 멤버 추가 스키마
class MemberCreate(BaseModel):
    company_id: str
    user_email: str
    user_name: Optional[str] = None
    birth_date: Optional[str] = "00000000"
    is_admin: Optional[bool] = False

# 멤버 추가
@router.post("/member")
def create_member(body: MemberCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_superadmin)):
    from routers.company import register_member, RegisterMemberRequest

    company = db.query(Company).filter(Company.id == body.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="회사를 찾을 수 없습니다")

    req = RegisterMemberRequest(
        company_id=body.company_id,
        email=body.user_email,
        name=body.user_name or "",
        birth_date=body.birth_date or "00000000",
    )
    result = register_member(req, db, current_user)
    if result.get("success") is False:
        return {"success": False, "message": result.get("message"), "email": body.user_email}

    if body.is_admin:
        member = db.query(CompanyMember).filter(
            CompanyMember.company_id == body.company_id,
            CompanyMember.user_email == body.user_email,
        ).first()
        if member:
            member.is_admin = True
            member.updated_by = current_user.get("uid")
            db.commit()

    return {"success": True, "message": result.get("message"), "email": body.user_email}

# 직원 삭제
@router.delete("/member/{member_id}")
def delete_member(member_id: str, db: Session = Depends(get_db), _: dict = Depends(get_superadmin)):
    member = db.query(CompanyMember).filter(CompanyMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")
    db.delete(member)
    db.commit()
    return {"message": "삭제 완료"}


from models.user import User

# 회사 미소속 개인 유저 목록
@router.get("/users")
def get_individual_users(db: Session = Depends(get_db), _: dict = Depends(get_superadmin)):
    # company_members에 없는 유저들
    subquery = db.query(CompanyMember.user_id).subquery()
    users = db.query(User).filter(
        User.id.notin_(subquery)
    ).order_by(User.created_at.desc()).all()

    last_access = _last_access_map(db)

    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "name": u.name,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_access_at": last_access[u.id].isoformat() if last_access.get(u.id) else None,
            }
            for u in users
        ]
    }

# 개인 유저 계정 삭제
@router.delete("/user/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db), _: dict = Depends(get_superadmin)):
    from models.attendance import Attendance
    from models.location import Location
    from firebase_admin import auth as firebase_auth

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다")

    db.query(Attendance).filter(Attendance.user_id == user_id).delete()
    db.query(Location).filter(Location.user_id == user_id).delete()
    db.delete(user)
    db.commit()

    try:
        firebase_auth.delete_user(user_id)
    except Exception as e:
        print(f"Firebase 계정 삭제 실패 (무시): {e}")

    return {"message": "삭제 완료"}


# 개인 유저 근태 초기화
@router.delete("/user/attendance/{user_id}")
def reset_user_attendance(user_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_superadmin)):
    from routers.attendance import get_work_day_range
    from models.attendance import Attendance
    from models.location import Location
    from models.reclock import ReclockRequest
    from models.attendance_reset_log import AttendanceResetLog
    from utils.workday import today_kst_str

    target_member = db.query(CompanyMember).filter(CompanyMember.user_id == user_id).first()

    start, end = get_work_day_range()

    attendance_count = db.query(Attendance).filter(
        Attendance.user_id == user_id,
        Attendance.recorded_at >= start,
        Attendance.recorded_at < end,
    ).delete()

    location_count = db.query(Location).filter(
        Location.user_id == user_id,
        Location.recorded_at >= start,
        Location.recorded_at < end,
    ).delete()

    reclock_count = db.query(ReclockRequest).filter(
        ReclockRequest.user_id == user_id,
        ReclockRequest.work_date == today_kst_str(),
    ).delete()

    db.add(AttendanceResetLog(
        company_id=target_member.company_id if target_member else None,
        target_user_id=user_id,
        target_user_name=target_member.user_name if target_member else None,
        performed_by=current_user["uid"],
        performed_by_name=current_user.get("name") or current_user.get("email"),
        performed_by_role="superadmin",
        reset_date=today_kst_str(),
        attendance_count=attendance_count,
        location_count=location_count,
        reclock_count=reclock_count,
    ))

    db.commit()
    return {"message": "초기화 완료"}


# ── AI 회의록 이용 현황 (시스템 관리자) ─────────────────────
@router.get("/meetings/stats")
def get_meeting_stats(db: Session = Depends(get_db), _: dict = Depends(get_superadmin)):
    """전체 AI 회의록 이용 현황. 삭제된 회의록도 MeetingUsageLog 기준으로는 카운트에 남는다
    (평가 화면과 동일하게 '삭제해도 이용 횟수는 복구 안 됨' 정책과 일치)."""
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)

    total_usage = db.query(func.count(MeetingUsageLog.id)).scalar() or 0
    month_usage = db.query(func.count(MeetingUsageLog.id)).filter(MeetingUsageLog.created_at >= month_start).scalar() or 0
    unique_users_total = db.query(func.count(func.distinct(MeetingUsageLog.user_id))).scalar() or 0
    unique_users_month = (
        db.query(func.count(func.distinct(MeetingUsageLog.user_id)))
        .filter(MeetingUsageLog.created_at >= month_start)
        .scalar() or 0
    )

    meeting_counts = dict(
        db.query(Meeting.status, func.count(Meeting.id)).group_by(Meeting.status).all()
    )

    # 최근 6개월 월별 이용 추이
    six_months_ago = (month_start - timedelta(days=150)).replace(day=1)
    monthly_rows = (
        db.query(
            func.date_trunc("month", MeetingUsageLog.created_at).label("month"),
            func.count(MeetingUsageLog.id),
        )
        .filter(MeetingUsageLog.created_at >= six_months_ago)
        .group_by("month")
        .order_by("month")
        .all()
    )
    monthly_trend = [{"month": m.strftime("%Y-%m"), "count": c} for m, c in monthly_rows]

    # 이번 달 이용자 상위 목록
    top_rows = (
        db.query(MeetingUsageLog.user_id, func.count(MeetingUsageLog.id).label("cnt"))
        .filter(MeetingUsageLog.created_at >= month_start)
        .group_by(MeetingUsageLog.user_id)
        .order_by(func.count(MeetingUsageLog.id).desc())
        .limit(10)
        .all()
    )
    top_user_ids = [uid for uid, _ in top_rows]
    members_by_uid = {
        m.user_id: m for m in db.query(CompanyMember).filter(CompanyMember.user_id.in_(top_user_ids)).all()
    } if top_user_ids else {}
    top_users = [
        {
            "user_id": uid,
            "user_name": members_by_uid[uid].user_name if uid in members_by_uid else None,
            "user_email": members_by_uid[uid].user_email if uid in members_by_uid else None,
            "company_name": None,
            "count": cnt,
        }
        for uid, cnt in top_rows
    ]
    company_ids = {m.company_id for m in members_by_uid.values() if m.company_id}
    company_name_by_id = {
        c.id: c.name for c in db.query(Company).filter(Company.id.in_(company_ids)).all()
    } if company_ids else {}
    for row in top_users:
        member = members_by_uid.get(row["user_id"])
        if member and member.company_id:
            row["company_name"] = company_name_by_id.get(member.company_id)

    return {
        "total_usage": total_usage,
        "month_usage": month_usage,
        "unique_users_total": unique_users_total,
        "unique_users_month": unique_users_month,
        "meeting_counts_by_status": meeting_counts,
        "monthly_trend": monthly_trend,
        "top_users_this_month": top_users,
    }


@router.get("/meetings")
def list_all_meetings(db: Session = Depends(get_db), _: dict = Depends(get_superadmin)):
    """전체 회사의 회의록 목록 (회사명 포함)."""
    meetings = db.query(Meeting).order_by(Meeting.recorded_at.desc()).all()
    company_ids = {m.company_id for m in meetings if m.company_id}
    company_name_by_id = {
        c.id: c.name for c in db.query(Company).filter(Company.id.in_(company_ids)).all()
    } if company_ids else {}

    result = []
    for m in meetings:
        row = _serialize_list(m)
        row["company_id"] = m.company_id
        row["company_name"] = company_name_by_id.get(m.company_id) if m.company_id else "개인(비소속)"
        result.append(row)
    return {"meetings": result}


@router.get("/meetings/{meeting_id}")
def get_meeting_detail_admin(meeting_id: str, db: Session = Depends(get_db), _: dict = Depends(get_superadmin)):
    """회의록 상세(원문/요약/할일 포함) — 시스템 관리자는 회사 소속 여부와 무관하게 열람 가능."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="회의록을 찾을 수 없어요")
    detail = _serialize_detail(meeting)
    company = db.query(Company).filter(Company.id == meeting.company_id).first() if meeting.company_id else None
    detail["company_name"] = company.name if company else "개인(비소속)"
    return detail