from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from database.connection import get_db
from models.company import Company, CompanyMember
from models.attendance import Attendance
from datetime import datetime
import requests
import os

router = APIRouter()

class CreateCompanyRequest(BaseModel):
    name: str
    admin_id: str

class AddMemberRequest(BaseModel):
    company_id: str
    user_id: str
    user_email: str
    user_name: str = ""

class RegisterMemberRequest(BaseModel):
    company_id: str
    email: str
    name: str
    birth_date: str

class BulkMemberItem(BaseModel):
    name: str
    email: str
    birth_date: str
    company_code: str = ""  # 시스템 관리자용 (선택)

class BulkRegisterRequest(BaseModel):
    company_id: str  # 일반 관리자용 기본값
    members: list[BulkMemberItem]

@router.post("/create")
def create_company(req: CreateCompanyRequest, db: Session = Depends(get_db)):
    company = Company(
        name=req.name,
        admin_id=req.admin_id
    )
    db.add(company)
    db.flush()

    member = CompanyMember(
        company_id=company.id,
        user_id=req.admin_id,
        user_email="",
        is_admin=True
    )
    db.add(member)
    db.commit()
    db.refresh(company)

    return {"message": "회사 생성 완료", "company_id": company.id, "company_code": company.id[:8]}

@router.get("/info/{admin_id}")
def get_company_info(admin_id: str, db: Session = Depends(get_db)):
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
            "member_count": len(members),
            "company_code": company.id[:8]  # 회사코드 (ID 앞 8자리)
        }
    }

@router.post("/members/add")
def add_member(req: AddMemberRequest, db: Session = Depends(get_db)):
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

@router.post("/members/register")
def register_member(req: RegisterMemberRequest, db: Session = Depends(get_db)):
    existing = db.query(CompanyMember).filter(
        CompanyMember.company_id == req.company_id,
        CompanyMember.user_email == req.email
    ).first()

    if existing:
        return {"message": "이미 등록된 직원이에요", "success": False}

    email_prefix = req.email.split("@")[0]
    initial_password = f"{email_prefix}{req.birth_date}"

    firebase_api_key = os.getenv("FIREBASE_API_KEY")
    print(f"Firebase API Key 존재: {'Yes' if firebase_api_key else 'No'}")
    print(f"등록 시도: {req.email}")

    response = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={firebase_api_key}",
        json={
            "email": req.email,
            "password": initial_password,
            "displayName": req.name
        }
    )

    print(f"Firebase 응답 코드: {response.status_code}")
    print(f"Firebase 응답: {response.json()}")

    if response.status_code != 200:
        error = response.json().get("error", {}).get("message", "알 수 없는 오류")
        if "EMAIL_EXISTS" in error:
            uid = ""
        else:
            raise HTTPException(status_code=400, detail=f"계정 생성 실패: {error}")
    else:
        uid = response.json().get("localId", "")

    member = CompanyMember(
        company_id=req.company_id,
        user_id=uid,
        user_email=req.email,
        user_name=req.name
    )
    db.add(member)
    db.commit()

    return {
        "message": "직원 등록 완료",
        "success": True,
        "email": req.email,
        "initial_password": initial_password
    }

@router.post("/members/bulk-register")
def bulk_register_members(req: BulkRegisterRequest, db: Session = Depends(get_db)):
    """직원 일괄 등록"""
    results = []
    for member_data in req.members:
        # 회사코드가 있으면 해당 회사로, 없으면 기본 company_id 사용
        if member_data.company_code:
            # 회사코드로 회사 찾기 (ID 앞 8자리)
            company = db.query(Company).filter(
                Company.id.like(f"{member_data.company_code}%")
            ).first()
            if not company:
                results.append({
                    "success": False,
                    "email": member_data.email,
                    "message": f"회사코드 {member_data.company_code} 를 찾을 수 없어요"
                })
                continue
            company_id = company.id
        else:
            company_id = req.company_id

        member_req = RegisterMemberRequest(
            company_id=company_id,
            email=member_data.email,
            name=member_data.name,
            birth_date=member_data.birth_date
        )
        result = register_member(member_req, db)
        results.append(result)

    success_count = len([r for r in results if r.get("success")])
    return {
        "message": f"{success_count}명 등록 완료",
        "results": results
    }

@router.get("/members/{company_id}")
def get_members(company_id: str, db: Session = Depends(get_db)):
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

@router.get("/search")
def search_company(name: str, db: Session = Depends(get_db)):
    companies = db.query(Company).filter(
        Company.name.ilike(f"%{name}%")
    ).limit(10).all()

    return {
        "companies": [
            {"id": c.id, "name": c.name}
            for c in companies
        ]
    }

@router.get("/attendance/{company_id}")
def get_company_attendance(company_id: str, db: Session = Depends(get_db)):
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