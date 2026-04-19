from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from database.connection import get_db
from models.company import Company, CompanyMember
from models.attendance import Attendance
from datetime import datetime, timedelta

router = APIRouter()

class CreateCompanyRequest(BaseModel):
    name: str
    admin_id: str

class AddMemberRequest(BaseModel):
    company_id: str
    user_id: str
    user_email: str
    user_name: str = ""

@router.post("/create")
def create_company(req: CreateCompanyRequest, db: Session = Depends(get_db)):
    """회사 생성"""
    company = Company(
        name=req.name,
        admin_id=req.admin_id
    )
    db.add(company)
    db.flush()  # company.id 확정

    member = CompanyMember(
        company_id=company.id,
        user_id=req.admin_id,
        user_email="",
        is_admin=True
    )
    db.add(member)
    db.commit()
    db.refresh(company)

    return {"message": "회사 생성 완료", "company_id": company.id}

@router.get("/info/{admin_id}")
def get_company_info(admin_id: str, db: Session = Depends(get_db)):
    """관리자 ID로 회사 정보 조회"""
    company = db.query(Company).filter(Company.admin_id == admin_id).first()
    if not company:
        return {"company": None}

    members = db.query(CompanyMember).filter(
        CompanyMember.company_id == company.id
    ).all()

    return {
        "company": {
            "id": company.id,
            "name": company.name,
            "member_count": len(members)
        }
    }

@router.post("/members/add")
def add_member(req: AddMemberRequest, db: Session = Depends(get_db)):
    """팀원 추가"""
    existing = db.query(CompanyMember).filter(
        CompanyMember.company_id == req.company_id,
        CompanyMember.user_id == req.user_id
    ).first()

    if existing:
        return {"message": "이미 등록된 팀원이에요"}

    member = CompanyMember(
        company_id=req.company_id,
        user_id=req.user_id,
        user_email=req.user_email,
        user_name=req.user_name
    )
    db.add(member)
    db.commit()

    return {"message": "팀원 추가 완료"}

@router.get("/members/{company_id}")
def get_members(company_id: str, db: Session = Depends(get_db)):
    """팀원 목록 조회"""
    members = db.query(CompanyMember).filter(
        CompanyMember.company_id == company_id
    ).all()

    return {
        "members": [
            {
                "user_id": m.user_id,
                "user_email": m.user_email,
                "user_name": m.user_name,
                "is_admin": m.is_admin
            }
            for m in members
        ]
    }

@router.get("/attendance/{company_id}")
def get_company_attendance(company_id: str, db: Session = Depends(get_db)):
    """회사 전체 근태 현황"""
    today = datetime.now().date()

    members = db.query(CompanyMember).filter(
        CompanyMember.company_id == company_id
    ).all()

    result = []
    for member in members:
        records = db.query(Attendance).filter(
            Attendance.user_id == member.user_id,
            func.date(Attendance.recorded_at) == today
        ).order_by(Attendance.recorded_at).all()

        checkin = next((r for r in records if r.type == "checkin"), None)
        checkout = next((r for r in records if r.type == "checkout"), None)

        work_minutes = 0
        if checkin and checkout:
            diff = checkout.recorded_at - checkin.recorded_at
            work_minutes = int(diff.total_seconds() / 60)

        result.append({
            "user_id": member.user_id,
            "user_name": member.user_name or member.user_email,
            "user_email": member.user_email,
            "checkin": checkin.recorded_at.isoformat() if checkin else None,
            "checkin_address": checkin.address if checkin else None,
            "checkout": checkout.recorded_at.isoformat() if checkout else None,
            "work_minutes": work_minutes,
            "work_hours": f"{work_minutes // 60}시간 {work_minutes % 60}분" if work_minutes > 0 else "-",
            "status": "퇴근" if checkout else ("출근중" if checkin else "미출근")
        })

    return {"date": str(today), "attendance": result}