from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.connection import get_db
from models.user import User
from models.company import CompanyMember
from limiter import limiter
import os

router = APIRouter()

SYSTEM_ADMIN_EMAIL = "eunsang0510@gmail.com"


class UpsertUserRequest(BaseModel):
    uid: str
    email: str
    name: str = ""


class FindEmailRequest(BaseModel):
    company_id: str
    user_name: str
    birth_date: str


class ResetPasswordSelfRequest(BaseModel):
    email: str
    birth_date: str


@router.post("/upsert")
def upsert_user(req: UpsertUserRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()

    if not user:
        user = User(
            id=req.uid,
            email=req.email,
            name=req.name,
        )
        db.add(user)
    else:
        user.name = req.name or user.name

    db.commit()

    member = (
        db.query(CompanyMember)
        .filter(CompanyMember.user_id == req.uid, CompanyMember.is_admin == True)
        .first()
    )

    is_admin = member is not None or req.email == SYSTEM_ADMIN_EMAIL

    return {
        "success": True,
        "user_id": user.id,
        "email": user.email,
        "name": user.name,
        "is_admin": is_admin,
    }


@router.get("/admin-check/{user_id}")
def check_admin(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user and user.email == SYSTEM_ADMIN_EMAIL:
        return {"is_admin": True}

    member = (
        db.query(CompanyMember)
        .filter(CompanyMember.user_id == user_id, CompanyMember.is_admin == True)
        .first()
    )
    return {"is_admin": member is not None}


@router.post("/find-email")
@limiter.limit("5/minute")
def find_email(request: Request, req: FindEmailRequest, db: Session = Depends(get_db)):
    member = db.query(CompanyMember).filter(
        CompanyMember.company_id == req.company_id,
        CompanyMember.user_name == req.user_name,
        CompanyMember.birth_date == req.birth_date,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="일치하는 회원 정보가 없어요")
    email = member.user_email
    at_idx = email.index("@")
    masked = email[0] + "***" + email[at_idx:]
    return {"masked_email": masked}


@router.post("/reset-password-self")
@limiter.limit("3/minute")
def reset_password_self(request: Request, req: ResetPasswordSelfRequest, db: Session = Depends(get_db)):
    import random
    import string
    from firebase_admin import auth as firebase_auth

    member = db.query(CompanyMember).filter(
        CompanyMember.user_email == req.email,
        CompanyMember.birth_date == req.birth_date,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="이메일 또는 생년월일이 일치하지 않아요")

    chars = string.ascii_letters + string.digits
    new_password = "".join(random.choices(chars, k=8))

    try:
        if member.user_id:
            firebase_auth.update_user(member.user_id, password=new_password)
        else:
            user = firebase_auth.get_user_by_email(req.email)
            firebase_auth.update_user(user.uid, password=new_password)
            member.user_id = user.uid
            db.commit()
    except Exception as e:
        print(f"[AUTH] 비밀번호 변경 실패: {e}")
        raise HTTPException(status_code=400, detail="비밀번호 변경에 실패했어요")

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h1 style="font-size: 24px; font-weight: 900; margin-bottom: 4px;">
            Work<span style="color: #5b5ef4;">Ping</span>
          </h1>
          <p style="color: #6b6b6b; font-size: 14px; margin-bottom: 32px;">GPS 기반 스마트 근태관리</p>
          <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">임시 비밀번호 안내</h2>
          <p style="color: #6b6b6b; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            안녕하세요, <strong>{member.user_name or req.email}</strong>님.<br/>
            임시 비밀번호가 발급됐어요. 로그인 후 반드시 비밀번호를 변경해주세요.
          </p>
          <div style="background: #f0f0ff; border: 1px solid #c7c8fa; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <p style="color: #a0a0a0; font-size: 12px; margin-bottom: 8px;">임시 비밀번호</p>
            <p style="color: #5b5ef4; font-size: 28px; font-weight: 900; letter-spacing: 4px; margin: 0;">{new_password}</p>
          </div>
          <a href="https://workping-kappa.vercel.app/login"
             style="display: block; background: #5b5ef4; color: white; text-align: center; padding: 16px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 14px; margin-bottom: 24px;">
            WorkPing 로그인하기 →
          </a>
          <p style="color: #a0a0a0; font-size: 12px; text-align: center;">
            본 메일은 발신 전용이에요. 문의: eunsang0510@gmail.com
          </p>
        </div>
        """

        message = Mail(
            from_email="eunsang0510@gmail.com",
            to_emails=req.email,
            subject="[WorkPing] 임시 비밀번호 안내",
            html_content=html,
        )
        sg = SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))
        sg.send(message)
    except Exception as e:
        print(f"이메일 발송 실패: {str(e)}")

    member.force_password_change = True
    db.commit()

    return {"success": True}


@router.get("/test")
def test():
    return {"message": "auth router 작동 중"}
