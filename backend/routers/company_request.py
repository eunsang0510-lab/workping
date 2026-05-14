from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.connection import get_db
from models.company_request import CompanyRegistrationRequest
from models.company import Company, CompanyMember
from models.user import User
from routers.deps import get_current_user
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


def _send_welcome_email(email: str, company_name: str, rep_name: str, initial_password: str):
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h1 style="font-size: 24px; font-weight: 900; margin-bottom: 4px;">
            Work<span style="color: #5b5ef4;">Ping</span>
          </h1>
          <p style="color: #6b6b6b; font-size: 14px; margin-bottom: 32px;">GPS 기반 스마트 근태관리</p>
          <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">🎉 회사 등록이 완료됐어요!</h2>
          <p style="color: #6b6b6b; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            안녕하세요, <strong>{rep_name}</strong>님.<br/>
            <strong>{company_name}</strong>의 WorkPing 관리자 계정이 생성됐어요.<br/>
            아래 정보로 로그인 후 반드시 비밀번호를 변경해주세요.
          </p>
          <div style="background: #f0f0ff; border: 1px solid #c7c8fa; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <p style="color: #a0a0a0; font-size: 12px; margin-bottom: 4px;">아이디 (이메일)</p>
            <p style="color: #0a0a0a; font-size: 16px; font-weight: 700; margin: 0 0 16px 0;">{email}</p>
            <p style="color: #a0a0a0; font-size: 12px; margin-bottom: 4px;">초기 비밀번호 (사업자등록번호)</p>
            <p style="color: #5b5ef4; font-size: 22px; font-weight: 900; letter-spacing: 2px; margin: 0;">{initial_password}</p>
          </div>
          <div style="background: #fef9c3; border: 1px solid #fde047; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <p style="color: #854d0e; font-size: 13px; margin: 0;">
              ⚠️ 로그인 후 반드시 비밀번호를 변경해주세요.<br/>사업자등록번호가 비밀번호로 노출되지 않도록 주의하세요.
            </p>
          </div>
          <a href="https://workping-kappa.vercel.app/login"
             style="display: block; background: #5b5ef4; color: white; text-align: center; padding: 16px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 14px; margin-bottom: 24px;">
            WorkPing 로그인하기 →
          </a>
          <p style="color: #a0a0a0; font-size: 12px; text-align: center;">
            본 메일은 발신 전용이에요. 문의: workpingofficial@gmail.com
          </p>
        </div>
        """
        message = Mail(
            from_email="eunsang0510@gmail.com",
            to_emails=email,
            subject=f"[WorkPing] {company_name} 관리자 계정이 생성됐어요",
            html_content=html,
        )
        sg = SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))
        res = sg.send(message)
        print(f"환영 이메일 발송 성공: {email} / {res.status_code}")
    except Exception as e:
        print(f"환영 이메일 발송 실패: {e}")


# ── 회사 등록 신청 → 즉시 계정 생성 ─────────────────────
@router.post("/apply")
def apply_registration(req: RegistrationRequestCreate, db: Session = Depends(get_db)):
    if not req.company_name.strip():
        raise HTTPException(status_code=400, detail="회사명을 입력해주세요")
    if not req.representative_name.strip():
        raise HTTPException(status_code=400, detail="대표자명을 입력해주세요")
    if not req.business_number.strip():
        raise HTTPException(status_code=400, detail="사업자등록번호를 입력해주세요")
    if not req.email.strip():
        raise HTTPException(status_code=400, detail="이메일을 입력해주세요")

    # 이미 등록된 이메일 체크
    existing_member = db.query(CompanyMember).filter(
        CompanyMember.user_email == req.email.strip()
    ).first()
    if existing_member:
        raise HTTPException(status_code=400, detail="이미 등록된 이메일이에요")

    initial_password = req.business_number.strip()
    firebase_api_key = os.getenv("FIREBASE_API_KEY")

    # Firebase 계정 생성
    response = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={firebase_api_key}",
        json={
            "email": req.email.strip(),
            "password": initial_password,
            "displayName": req.representative_name.strip(),
        },
    )
    if response.status_code != 200:
        error = response.json().get("error", {}).get("message", "알 수 없는 오류")
        if "EMAIL_EXISTS" in error:
            fb_user = firebase_auth.get_user_by_email(req.email.strip())
            uid = fb_user.uid
        else:
            raise HTTPException(status_code=400, detail=f"계정 생성 실패: {error}")
    else:
        uid = response.json().get("localId", "")

    # 회사 생성
    company = Company(
        id=str(uuid.uuid4()),
        name=req.company_name.strip(),
        admin_id=uid,
        plan="team",
    )
    db.add(company)
    db.flush()

    # 관리자 멤버 생성 (force_password_change=True)
    member = CompanyMember(
        id=str(uuid.uuid4()),
        company_id=company.id,
        user_id=uid,
        user_email=req.email.strip(),
        user_name=req.representative_name.strip(),
        is_admin=True,
        birth_date="",
        force_password_change=True,
    )
    db.add(member)

    # 유저 레코드 생성
    user_record = db.query(User).filter(User.email == req.email.strip()).first()
    if not user_record:
        db.add(User(id=uid, email=req.email.strip(), name=req.representative_name.strip()))

    # 신청 이력 저장 (approved 상태로)
    reg = CompanyRegistrationRequest(
        company_name=req.company_name.strip(),
        representative_name=req.representative_name.strip(),
        business_number=req.business_number.strip(),
        phone=req.phone.strip(),
        email=req.email.strip(),
        status="approved",
    )
    db.add(reg)
    db.commit()

    # 환영 이메일 발송 (실패해도 계정 생성은 성공)
    _send_welcome_email(req.email.strip(), req.company_name.strip(), req.representative_name.strip(), initial_password)

    return {
        "success": True,
        "email": req.email.strip(),
        "initial_password": initial_password,
        "company_name": req.company_name.strip(),
        "company_id": company.id,
    }


# ── 신청 이력 조회 (슈퍼어드민) ────────────────────────
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
