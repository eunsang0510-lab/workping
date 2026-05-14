from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.connection import get_db
from models.company_request import CompanyRegistrationRequest
from models.company import Company, CompanyMember
from models.user import User
from routers.deps import get_current_user
from datetime import datetime
import uuid
import os
import requests
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
import json

router = APIRouter()
SUPERADMIN = "eunsang0510@gmail.com"

if not firebase_admin._apps:
    try:
        firebase_creds = os.getenv("FIREBASE_ADMIN_CREDENTIALS")
        if firebase_creds:
            cred_dict = json.loads(firebase_creds.strip())
            cred_dict["private_key"] = cred_dict["private_key"].replace("\\n", "\n")
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
    except Exception as e:
        print(f"Firebase Admin 초기화 실패: {e}")


class RegistrationRequestCreate(BaseModel):
    company_name: str
    representative_name: str
    business_number: str
    phone: str = ""
    email: str


# ── 회사 등록 신청 (공개, 인증 불필요) ─────────────────
@router.post("/apply")
def apply_registration(req: RegistrationRequestCreate, db: Session = Depends(get_db)):
    if not req.company_name.strip():
        raise HTTPException(status_code=400, detail="회사명을 입력해주세요")
    if not req.email.strip():
        raise HTTPException(status_code=400, detail="이메일을 입력해주세요")
    if not req.business_number.strip():
        raise HTTPException(status_code=400, detail="사업자등록번호를 입력해주세요")

    existing = db.query(CompanyRegistrationRequest).filter(
        CompanyRegistrationRequest.email == req.email.strip(),
        CompanyRegistrationRequest.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 신청 중인 이메일이에요")

    reg = CompanyRegistrationRequest(
        company_name=req.company_name.strip(),
        representative_name=req.representative_name.strip(),
        business_number=req.business_number.strip(),
        phone=req.phone.strip(),
        email=req.email.strip(),
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return {"success": True, "request_id": reg.id}


# ── 신청 목록 조회 (슈퍼어드민) ────────────────────────
@router.get("/list")
def list_requests(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("email") != SUPERADMIN:
        raise HTTPException(status_code=403, detail="슈퍼어드민만 접근할 수 있어요")

    regs = db.query(CompanyRegistrationRequest).order_by(
        CompanyRegistrationRequest.created_at.desc()
    ).all()

    return {
        "requests": [
            {
                "id": r.id,
                "company_name": r.company_name,
                "representative_name": r.representative_name,
                "business_number": r.business_number,
                "phone": r.phone,
                "email": r.email,
                "status": r.status,
                "created_at": r.created_at.isoformat(),
            }
            for r in regs
        ]
    }


# ── 신청 승인 (슈퍼어드민) → 회사 + 관리자 계정 생성 ──
@router.put("/approve/{request_id}")
def approve_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("email") != SUPERADMIN:
        raise HTTPException(status_code=403, detail="슈퍼어드민만 접근할 수 있어요")

    reg = db.query(CompanyRegistrationRequest).filter(
        CompanyRegistrationRequest.id == request_id
    ).first()
    if not reg:
        raise HTTPException(status_code=404, detail="신청을 찾을 수 없어요")
    if reg.status != "pending":
        raise HTTPException(status_code=400, detail="이미 처리된 신청이에요")

    initial_password = reg.business_number
    firebase_api_key = os.getenv("FIREBASE_API_KEY")

    response = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={firebase_api_key}",
        json={
            "email": reg.email,
            "password": initial_password,
            "displayName": reg.representative_name,
        },
    )

    if response.status_code != 200:
        error = response.json().get("error", {}).get("message", "알 수 없는 오류")
        if "EMAIL_EXISTS" in error:
            fb_user = firebase_auth.get_user_by_email(reg.email)
            uid = fb_user.uid
        else:
            raise HTTPException(status_code=400, detail=f"계정 생성 실패: {error}")
    else:
        uid = response.json().get("localId", "")

    company = Company(
        id=str(uuid.uuid4()),
        name=reg.company_name,
        admin_id=uid,
        plan="team",
    )
    db.add(company)
    db.flush()

    member = CompanyMember(
        id=str(uuid.uuid4()),
        company_id=company.id,
        user_id=uid,
        user_email=reg.email,
        user_name=reg.representative_name,
        is_admin=True,
        birth_date="",
    )
    db.add(member)

    user_record = db.query(User).filter(User.email == reg.email).first()
    if not user_record:
        db.add(User(id=uid, email=reg.email, name=reg.representative_name))

    reg.status = "approved"
    db.commit()

    return {
        "success": True,
        "company_id": company.id,
        "company_name": company.name,
        "email": reg.email,
        "initial_password": initial_password,
    }


# ── 신청 반려 (슈퍼어드민) ─────────────────────────────
@router.delete("/{request_id}")
def reject_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("email") != SUPERADMIN:
        raise HTTPException(status_code=403, detail="슈퍼어드민만 접근할 수 있어요")

    reg = db.query(CompanyRegistrationRequest).filter(
        CompanyRegistrationRequest.id == request_id
    ).first()
    if not reg:
        raise HTTPException(status_code=404, detail="신청을 찾을 수 없어요")

    reg.status = "rejected"
    db.commit()
    return {"success": True}
