from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from database.connection import get_db
from models.company import Company, CompanyMember, CompanyLocation
from models.attendance import Attendance
from datetime import datetime
import requests
import os
import math
import json
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

if not firebase_admin._apps:
    try:
        firebase_creds = os.getenv("FIREBASE_ADMIN_CREDENTIALS")
        print(f"🔍 환경변수 존재: {firebase_creds is not None}")
        print(f"🔍 환경변수 길이: {len(firebase_creds) if firebase_creds else 0}")
        print(f"🔍 첫 20자: {firebase_creds[:20] if firebase_creds else 'NONE'}")
        if firebase_creds:
            cred_dict = json.loads(firebase_creds.strip())
            cred_dict["private_key"] = cred_dict["private_key"].replace("\\n", "\n")
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            print("✅ Firebase Admin 초기화 성공 (환경변수)")
        else:
            print("❌ 환경변수 없음")
    except Exception as e:
        print(f"❌ Firebase Admin 초기화 실패: {e}")

router = APIRouter()


def calc_distance(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


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
    company_code: str = ""


class BulkRegisterRequest(BaseModel):
    company_id: str
    members: list[BulkMemberItem]


class LocationCreateRequest(BaseModel):
    company_id: str
    name: str
    latitude: float
    longitude: float
    radius: int = 100


class CheckInValidateRequest(BaseModel):
    company_id: str
    latitude: float
    longitude: float


class ResetPasswordRequest(BaseModel):
    user_id: str = ""
    email: str


class UpdateMemberRequest(BaseModel):
    user_name: str = ""
    user_email: str = ""
    is_admin: bool = False
    company_id: str = ""


@router.post("/create")
def create_company(req: CreateCompanyRequest, db: Session = Depends(get_db)):
    company = Company(name=req.name, admin_id=req.admin_id)
    db.add(company)
    db.flush()

    member = CompanyMember(
        company_id=company.id, user_id=req.admin_id, user_email="", is_admin=True
    )
    db.add(member)
    db.commit()
    db.refresh(company)

    return {
        "message": "회사 생성 완료",
        "company_id": company.id,
        "company_code": company.id[:8],
    }


@router.get("/info/{admin_id}")
def get_company_info(admin_id: str, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.admin_id == admin_id).first()
    if not company:
        return {"company": None}

    members = db.query(CompanyMember).filter(CompanyMember.company_id == company.id).all()

    return {
        "company": {
            "id": company.id,
            "name": company.name,
            "member_count": len(members),
            "company_code": company.id[:8],
        }
    }


@router.post("/members/add")
def add_member(req: AddMemberRequest, db: Session = Depends(get_db)):
    existing = db.query(CompanyMember).filter(
        CompanyMember.company_id == req.company_id,
        CompanyMember.user_id == req.user_id,
    ).first()

    if existing:
        return {"message": "이미 등록된 팀원이에요"}

    member = CompanyMember(
        company_id=req.company_id,
        user_id=req.user_id,
        user_email=req.user_email,
        user_name=req.user_name,
    )
    db.add(member)
    db.commit()
    return {"message": "팀원 추가 완료"}


@router.post("/members/register")
def register_member(req: RegisterMemberRequest, db: Session = Depends(get_db)):
    existing = db.query(CompanyMember).filter(
        CompanyMember.company_id == req.company_id,
        CompanyMember.user_email == req.email,
    ).first()

    if existing:
        return {"message": "이미 등록된 직원이에요", "success": False}

    email_prefix = req.email.split("@")[0]
    initial_password = f"{email_prefix}{req.birth_date}"

    firebase_api_key = os.getenv("FIREBASE_API_KEY")

    response = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={firebase_api_key}",
        json={
            "email": req.email,
            "password": initial_password,
            "displayName": req.name,
        },
    )

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
        user_name=req.name,
        birth_date=req.birth_date,
    )
    db.add(member)
    db.commit()

    return {
        "message": "직원 등록 완료",
        "success": True,
        "email": req.email,
        "initial_password": initial_password,
    }


@router.post("/members/bulk-register")
def bulk_register_members(req: BulkRegisterRequest, db: Session = Depends(get_db)):
    results = []
    for member_data in req.members:
        if member_data.company_code:
            company = db.query(Company).filter(
                Company.id.like(f"{member_data.company_code}%")
            ).first()
            if not company:
                results.append({
                    "success": False,
                    "email": member_data.email,
                    "message": f"회사코드 {member_data.company_code} 를 찾을 수 없어요",
                })
                continue
            company_id = company.id
        else:
            company_id = req.company_id

        member_req = RegisterMemberRequest(
            company_id=company_id,
            email=member_data.email,
            name=member_data.name,
            birth_date=member_data.birth_date,
        )
        result = register_member(member_req, db)
        results.append(result)

    success_count = len([r for r in results if r.get("success")])
    return {"message": f"{success_count}명 등록 완료", "results": results}


@router.get("/members/{company_id}")
def get_members(company_id: str, db: Session = Depends(get_db)):
    members = db.query(CompanyMember).filter(CompanyMember.company_id == company_id).all()
    return {
        "members": [
            {
                "user_id": m.user_id,
                "user_email": m.user_email,
                "user_name": m.user_name,
                "is_admin": m.is_admin,
            }
            for m in members
        ]
    }


@router.get("/search")
def search_company(name: str, db: Session = Depends(get_db)):
    companies = db.query(Company).filter(Company.name.ilike(f"%{name}%")).limit(10).all()
    return {"companies": [{"id": c.id, "name": c.name} for c in companies]}


@router.get("/attendance/{company_id}")
def get_company_attendance(company_id: str, db: Session = Depends(get_db)):
    from routers.attendance import get_work_day_range

    start, end = get_work_day_range()
    now = datetime.now()

    members = db.query(CompanyMember).filter(CompanyMember.company_id == company_id).all()

    result = []
    for member in members:
        records = db.query(Attendance).filter(
            Attendance.user_id == member.user_id,
            Attendance.recorded_at >= start,
            Attendance.recorded_at < end,
        ).order_by(Attendance.recorded_at).all()

        checkin = next((r for r in records if r.type == "checkin"), None)
        checkout = next((r for r in records if r.type == "checkout"), None)

        is_missing_checkout = checkin is not None and checkout is None and now >= end

        work_minutes = 0
        if checkin and checkout:
            diff = checkout.recorded_at - checkin.recorded_at
            work_minutes = int(diff.total_seconds() / 60)

        if checkin and not checkout and not is_missing_checkout:
            status = "출근중"
        elif checkout:
            status = "퇴근"
        elif is_missing_checkout:
            status = "미퇴근"
        else:
            status = "미출근"

        result.append({
            "user_id": member.user_id,
            "user_name": member.user_name or member.user_email,
            "user_email": member.user_email,
            "checkin": checkin.recorded_at.isoformat() if checkin else None,
            "checkin_address": checkin.address if checkin else None,
            "checkout": checkout.recorded_at.isoformat() if checkout else None,
            "work_minutes": work_minutes,
            "work_hours": f"{work_minutes // 60}시간 {work_minutes % 60}분" if work_minutes > 0 else "-",
            "status": status,
            "is_missing_checkout": is_missing_checkout,
        })

    return {"date": str(start.date()), "attendance": result}


@router.get("/locations/{company_id}")
def get_locations(company_id: str, db: Session = Depends(get_db)):
    locations = db.query(CompanyLocation).filter(
        CompanyLocation.company_id == company_id,
        CompanyLocation.is_active == True
    ).all()
    return {
        "locations": [
            {
                "id": l.id,
                "name": l.name,
                "latitude": l.latitude,
                "longitude": l.longitude,
                "radius": l.radius,
                "is_active": l.is_active,
            }
            for l in locations
        ]
    }


@router.post("/locations/add")
def add_location(req: LocationCreateRequest, db: Session = Depends(get_db)):
    location = CompanyLocation(
        company_id=req.company_id,
        name=req.name,
        latitude=req.latitude,
        longitude=req.longitude,
        radius=req.radius,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return {"success": True, "id": location.id, "message": "위치 등록 완료"}


@router.delete("/locations/{location_id}")
def delete_location(location_id: str, db: Session = Depends(get_db)):
    location = db.query(CompanyLocation).filter(CompanyLocation.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="위치를 찾을 수 없습니다")
    db.delete(location)
    db.commit()
    return {"message": "삭제 완료"}


@router.post("/locations/validate")
def validate_checkin_location(req: CheckInValidateRequest, db: Session = Depends(get_db)):
    locations = db.query(CompanyLocation).filter(
        CompanyLocation.company_id == req.company_id,
        CompanyLocation.is_active == True,
    ).all()

    if not locations:
        return {"allowed": True, "message": "위치 제한 없음"}

    for loc in locations:
        distance = calc_distance(req.latitude, req.longitude, loc.latitude, loc.longitude)
        if distance <= loc.radius:
            return {
                "allowed": True,
                "message": f"{loc.name} 범위 내 ({int(distance)}m)",
                "location_name": loc.name,
                "distance": int(distance),
            }

    nearest = min(
        locations,
        key=lambda l: calc_distance(req.latitude, req.longitude, l.latitude, l.longitude),
    )
    nearest_distance = int(
        calc_distance(req.latitude, req.longitude, nearest.latitude, nearest.longitude)
    )

    return {
        "allowed": False,
        "message": f"출근 가능 위치가 아니에요 (가장 가까운 위치: {nearest.name}, {nearest_distance}m)",
        "nearest_location": nearest.name,
        "distance": nearest_distance,
    }


@router.get("/admin-check/{user_id}")
def check_admin(user_id: str, db: Session = Depends(get_db)):
    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == user_id,
        CompanyMember.is_admin == True
    ).first()
    return {"is_admin": member is not None}


@router.post("/members/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    import random
    import string
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    member = db.query(CompanyMember).filter(
        CompanyMember.user_email == req.email
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")

    # 랜덤 비밀번호 생성 (영문 대소문자 + 숫자 8자리)
    chars = string.ascii_letters + string.digits
    new_password = "".join(random.choices(chars, k=8))

   # Firebase 비밀번호 변경 (REST API 방식)
    try:
        firebase_api_key = os.getenv("FIREBASE_API_KEY")

        # 이메일로 비밀번호 재설정 링크 발송 대신 직접 변경
        # 먼저 임시로 로그인해서 uid 확인
        sign_in_res = requests.post(
            f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={firebase_api_key}",
            json={"email": req.email, "password": "dummy", "returnSecureToken": True}
        )
        
        # uid로 비밀번호 변경 (Admin SDK)
        if member.user_id:
            firebase_auth.update_user(member.user_id, password=new_password)
        else:
            # uid 없으면 이메일로 계정 찾아서 변경
            user = firebase_auth.get_user_by_email(req.email)
            firebase_auth.update_user(user.uid, password=new_password)
            # DB에 uid 저장
            member.user_id = user.uid
            db.commit()
            
    except Exception as e:
        print(f"❌ 비밀번호 변경 실패: {str(e)}")
        raise HTTPException(status_code=400, detail=f"비밀번호 변경 실패: {str(e)}")

    # Gmail SMTP로 이메일 발송
    try:
        gmail_user = os.getenv("GMAIL_USER")
        gmail_password = os.getenv("GMAIL_PASSWORD")

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "[WorkPing] 임시 비밀번호 안내"
        msg["From"] = gmail_user
        msg["To"] = req.email

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

        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(gmail_user, gmail_password)
            server.sendmail(gmail_user, req.email, msg.as_string())

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"이메일 발송 실패: {str(e)}")

    return {
        "success": True,
        "message": f"임시 비밀번호가 {req.email}로 발송됐어요",
    }


@router.put("/members/{member_id}")
def update_member(member_id: str, req: UpdateMemberRequest, db: Session = Depends(get_db)):
    member = db.query(CompanyMember).filter(CompanyMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")

    if req.user_name:
        member.user_name = req.user_name
    if req.user_email:
        member.user_email = req.user_email
    if req.company_id:
        member.company_id = req.company_id
    member.is_admin = req.is_admin

    db.commit()
    return {"success": True, "message": "수정 완료"}

@router.get("/my/{user_id}")
def get_my_company(user_id: str, db: Session = Depends(get_db)):
    """유저 ID로 소속 회사 정보 반환"""
    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == user_id
    ).first()

    if not member:
        return {"company_id": None, "company_name": None}

    company = db.query(Company).filter(Company.id == member.company_id).first()

    return {
        "company_id": member.company_id,
        "company_name": company.name if company else None,
        "is_admin": member.is_admin,
    }