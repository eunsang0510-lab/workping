from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database.connection import get_db
from models.company import Company, CompanyMember
from models.user import User
from models.attendance import Attendance

router = APIRouter()


# 전체 통계
@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_companies = db.query(func.count(Company.id)).scalar()
    total_members = db.query(func.count(CompanyMember.id)).scalar()
    return {
        "total_companies": total_companies,
        "total_members": total_members,
    }


# 전체 회사 목록
@router.get("/companies")
def get_companies(db: Session = Depends(get_db)):
    companies = db.query(Company).order_by(Company.created_at.desc()).all()
    result = []
    for c in companies:
        member_count = db.query(func.count(CompanyMember.id)).filter(
            CompanyMember.company_id == c.id
        ).scalar()
        result.append({
            "id": c.id,
            "name": c.name,
            "admin_id": c.admin_id,
            "plan": c.plan,
            "member_count": member_count,
            "created_at": c.created_at,
        })
    return result


# 회사 삭제
@router.delete("/company/{company_id}")
def delete_company(company_id: str, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="회사를 찾을 수 없습니다")
    db.query(CompanyMember).filter(CompanyMember.company_id == company_id).delete()
    db.delete(company)
    db.commit()
    return {"message": "삭제 완료"}


# 전체 직원 목록
@router.get("/members")
def get_members(db: Session = Depends(get_db)):
    members = db.query(CompanyMember).order_by(CompanyMember.created_at.desc()).all()
    result = []
    for m in members:
        company = db.query(Company).filter(Company.id == m.company_id).first()
        result.append({
            "id": m.id,
            "company_id": m.company_id,
            "company_name": company.name if company else "알 수 없음",
            "user_id": m.user_id,
            "user_email": m.user_email,
            "user_name": m.user_name,
            "is_admin": m.is_admin,
            "created_at": m.created_at,
        })
    return result


# 직원 삭제
@router.delete("/member/{member_id}")
def delete_member(member_id: str, db: Session = Depends(get_db)):
    member = db.query(CompanyMember).filter(CompanyMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")
    db.delete(member)
    db.commit()
    return {"message": "삭제 완료"}