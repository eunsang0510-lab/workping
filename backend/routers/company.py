from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from database.connection import get_db
from models.company import Company, CompanyMember, CompanyLocation
from models.attendance import Attendance
from models.subscription import Subscription
from datetime import datetime

FREE_MEMBER_LIMIT = 20
import requests
import os
import math
import json
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from routers.deps import get_current_user

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
    is_admin: bool = False


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
    address: str = ""


class CheckInValidateRequest(BaseModel):
    company_id: str
    latitude: float
    longitude: float
    user_id: str = ""


class HomeLocationRequest(BaseModel):
    home_address: str
    home_latitude: float
    home_longitude: float


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

@router.get("/list")
def list_all_companies(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    is_superadmin = current_user.get("email") == "eunsang0510@gmail.com"
    if not is_superadmin:
        raise HTTPException(status_code=403, detail="시스템 관리자만 조회할 수 있어요")

    companies = db.query(Company).all()
    member_counts = dict(
        db.query(CompanyMember.company_id, func.count(CompanyMember.id))
        .group_by(CompanyMember.company_id)
        .all()
    )
    result = [
        {
            "id": c.id,
            "name": c.name,
            "member_count": member_counts.get(c.id, 0),
            "company_code": c.id[:8],
            "leave_enabled": c.leave_enabled,
        }
        for c in companies
    ]
    return {"companies": result}


@router.get("/info/{admin_id}")
def get_company_info(admin_id: str, db: Session = Depends(get_db)):
    # 먼저 company 생성자(admin_id)로 찾기
    company = db.query(Company).filter(Company.admin_id == admin_id).first()
    
    # 없으면 CompanyMember에서 is_admin=True인 경우로 찾기
    if not company:
        member = db.query(CompanyMember).filter(
            CompanyMember.user_id == admin_id,
            CompanyMember.is_admin == True
        ).first()
        if member:
            company = db.query(Company).filter(Company.id == member.company_id).first()
    
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
def register_member(req: RegisterMemberRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # 플랜별 멤버 수 제한 체크
    current_count = db.query(CompanyMember).filter(CompanyMember.company_id == req.company_id).count()
    sub = db.query(Subscription).filter(Subscription.company_id == req.company_id).first()
    is_paid = sub and sub.status == "active" and (not sub.expires_at or sub.expires_at > datetime.now())
    if not is_paid and current_count >= FREE_MEMBER_LIMIT:
        return {
            "message": f"무료 플랜은 최대 {FREE_MEMBER_LIMIT}명까지 등록할 수 있어요. 유료 플랜으로 업그레이드해주세요.",
            "success": False,
            "limit_exceeded": True,
        }

    existing = db.query(CompanyMember).filter(
        CompanyMember.company_id == req.company_id,
        CompanyMember.user_email == req.email,
    ).first()

    if existing:
        return {"message": "이미 등록된 직원이에요", "success": False}

    email_prefix = req.email.strip().split("@")[0]
    initial_password = f"{email_prefix}{req.birth_date.strip()}"

    firebase_api_key = os.getenv("FIREBASE_API_KEY")

    response = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={firebase_api_key}",
        json={
            "email": req.email.strip(),
            "password": initial_password,
            "displayName": req.name.strip(),
        },
    )

    print(f"🔍 Firebase 계정 생성 응답: {response.status_code} {response.text}")

    SYSTEM_ADMIN_EMAIL = os.getenv("SYSTEM_ADMIN_EMAIL", "eunsang0510@gmail.com")
    if response.status_code != 200:
        error = response.json().get("error", {}).get("message", "알 수 없는 오류")
        if "EMAIL_EXISTS" in error:
            if req.email.strip().lower() == SYSTEM_ADMIN_EMAIL.lower():
                raise HTTPException(status_code=400, detail="시스템 관리자 계정은 직원으로 등록할 수 없어요")
            fb_user = firebase_auth.get_user_by_email(req.email.strip())
            uid = fb_user.uid
            # 기존 계정의 비밀번호를 초기 비밀번호로 강제 리셋
            firebase_auth.update_user(uid, password=initial_password)
            print(f"🔍 기존 Firebase 계정 비밀번호 리셋: {uid}")
        else:
            raise HTTPException(status_code=400, detail=f"계정 생성 실패: {error}")
    else:
        uid = response.json().get("localId", "")
        print(f"🔍 새 Firebase 계정 uid: {uid}")

    member = CompanyMember(
        company_id=req.company_id,
        user_id=uid,
        user_email=req.email,
        user_name=req.name,
        birth_date=req.birth_date,
        is_admin=req.is_admin,
        force_password_change=True,
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
    # 플랜별 멤버 수 제한 사전 체크
    if req.company_id:
        current_count = db.query(CompanyMember).filter(CompanyMember.company_id == req.company_id).count()
        sub = db.query(Subscription).filter(Subscription.company_id == req.company_id).first()
        is_paid = sub and sub.status == "active" and (not sub.expires_at or sub.expires_at > datetime.now())
        if not is_paid and current_count + len(req.members) > FREE_MEMBER_LIMIT:
            remaining = max(0, FREE_MEMBER_LIMIT - current_count)
            return {
                "message": f"무료 플랜 한도 초과예요. 현재 {current_count}명 등록됨, 최대 {FREE_MEMBER_LIMIT}명까지 가능해요. (추가 가능: {remaining}명)",
                "results": [],
                "limit_exceeded": True,
            }

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
    if not members:
        return {"date": str(start.date()), "attendance": []}

    user_ids = [m.user_id for m in members]
    all_records = (
        db.query(Attendance)
        .filter(
            Attendance.user_id.in_(user_ids),
            Attendance.recorded_at >= start,
            Attendance.recorded_at < end,
        )
        .order_by(Attendance.recorded_at)
        .all()
    )

    records_by_user: dict = {}
    for r in all_records:
        records_by_user.setdefault(r.user_id, []).append(r)

    result = []
    for member in members:
        records = records_by_user.get(member.user_id, [])
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
            "is_admin": bool(member.is_admin),
            "checkin": checkin.recorded_at.isoformat() if checkin else None,
            "checkin_address": checkin.address if checkin else None,
            "is_remote": bool(checkin.is_remote) if checkin else False,
            "checkout": checkout.recorded_at.isoformat() if checkout else None,
            "work_minutes": work_minutes,
            "work_hours": f"{work_minutes // 60}시간 {work_minutes % 60}분" if work_minutes > 0 else "-",
            "status": status,
            "is_missing_checkout": is_missing_checkout,
            "home_address": member.home_address or "",
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
                "address": l.address or "",
            }
            for l in locations
        ]
    }


@router.get("/geocode")
def geocode_address(address: str):
    try:
        kakao_key = os.getenv("KAKAO_REST_API_KEY")
        response = requests.get(
            "https://dapi.kakao.com/v2/local/search/address.json",
            params={"query": address},
            headers={"Authorization": f"KakaoAK {kakao_key}"},
        )
        data = response.json()
        if data.get("documents"):
            doc = data["documents"][0]
            return {
                "success": True,
                "latitude": float(doc["y"]),
                "longitude": float(doc["x"]),
                "address": doc.get("address_name", address),
            }
        return {"success": False, "message": "주소를 찾을 수 없어요"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.post("/locations/add")
def add_location(req: LocationCreateRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    location = CompanyLocation(
        company_id=req.company_id,
        name=req.name,
        latitude=req.latitude,
        longitude=req.longitude,
        radius=req.radius,
        address=req.address,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return {"success": True, "id": location.id, "message": "위치 등록 완료"}


@router.delete("/locations/{location_id}")
def delete_location(location_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
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

    # 개인 재택 주소 확인 (지오코딩 오차를 감안해 300m 허용)
    home_radius = 300
    if req.user_id:
        try:
            member = db.query(CompanyMember).filter(
                CompanyMember.user_id == req.user_id,
                CompanyMember.company_id == req.company_id,
            ).first()
            if member and member.home_latitude and member.home_longitude:
                home_dist = calc_distance(req.latitude, req.longitude, member.home_latitude, member.home_longitude)
                print(f"🏠 재택 거리 체크: {int(home_dist)}m (허용: {home_radius}m)")
                if home_dist <= home_radius:
                    return {
                        "allowed": True,
                        "is_remote": True,
                        "message": f"재택근무 위치 범위 내 ({int(home_dist)}m)",
                        "location_name": "재택근무",
                        "distance": int(home_dist),
                    }
        except Exception as e:
            print(f"⚠️ 재택 위치 확인 오류: {e}")

    if not locations:
        return {"allowed": True, "is_remote": False, "message": "위치 제한 없음"}

    for loc in locations:
        distance = calc_distance(req.latitude, req.longitude, loc.latitude, loc.longitude)
        if distance <= loc.radius:
            return {
                "allowed": True,
                "is_remote": False,
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
        "is_remote": False,
        "message": f"출근 가능 위치가 아니에요 (가장 가까운 위치: {nearest.name}, {nearest_distance}m)",
        "nearest_location": nearest.name,
        "distance": nearest_distance,
    }


@router.get("/members/{user_id}/home-location")
def get_home_location(user_id: str, company_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == user_id,
        CompanyMember.company_id == company_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")
    return {
        "home_address": member.home_address or "",
        "home_latitude": member.home_latitude,
        "home_longitude": member.home_longitude,
    }


@router.put("/members/{user_id}/home-location")
def set_home_location(user_id: str, req: HomeLocationRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == user_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")
    member.home_address = req.home_address
    member.home_latitude = req.home_latitude
    member.home_longitude = req.home_longitude
    db.commit()
    return {"success": True, "message": "재택 주소 저장 완료"}


@router.delete("/members/{user_id}/home-location")
def delete_home_location(user_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == user_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")
    member.home_address = None
    member.home_latitude = None
    member.home_longitude = None
    db.commit()
    return {"success": True, "message": "재택 주소 삭제 완료"}


@router.get("/admin-check/{user_id}")
def check_admin(user_id: str, db: Session = Depends(get_db)):
    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == user_id,
        CompanyMember.is_admin == True
    ).first()
    return {"is_admin": member is not None}


@router.post("/members/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    import random
    import string

    member = db.query(CompanyMember).filter(
        CompanyMember.user_email == req.email
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")

    # 랜덤 비밀번호 생성
    chars = string.ascii_letters + string.digits
    new_password = "".join(random.choices(chars, k=8))

    # Firebase 비밀번호 변경
    try:
        if member.user_id:
            firebase_auth.update_user(member.user_id, password=new_password)
        else:
            user = firebase_auth.get_user_by_email(req.email)
            firebase_auth.update_user(user.uid, password=new_password)
            member.user_id = user.uid
            db.commit()
        print(f"Firebase 비밀번호 변경 성공: {req.email}")
    except Exception as e:
        print(f"Firebase 비밀번호 변경 실패: {str(e)}")
        raise HTTPException(status_code=400, detail=f"비밀번호 변경 실패: {str(e)}")

    # SendGrid 이메일 발송
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
        response = sg.send(message)
        print(f"이메일 발송 성공: {req.email} / 상태: {response.status_code}")

    except Exception as e:
        print(f"이메일 발송 실패: {str(e)}")

    # force_password_change 플래그 설정
    member.force_password_change = True
    db.commit()

    return {"success": True, "message": f"임시 비밀번호가 {req.email}로 발송됐어요", "new_password": new_password}


@router.put("/members/{member_id}")
def update_member(member_id: str, req: UpdateMemberRequest, db: Session = Depends(get_db)):
    member = db.query(CompanyMember).filter(CompanyMember.user_id == member_id).first()
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
        "is_manager": member.is_manager,
        "leave_enabled": company.leave_enabled if company else False,
        "force_password_change": member.force_password_change or False,
    }

@router.put("/members/{user_id}/password-changed")
def mark_password_changed(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["uid"] != user_id:
        raise HTTPException(status_code=403, detail="본인만 변경할 수 있어요")
    member = db.query(CompanyMember).filter(CompanyMember.user_id == user_id).first()
    if member:
        member.force_password_change = False
        db.commit()
    return {"success": True}


@router.delete("/members/by-user/{user_id}")
def delete_member_by_user_id(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    # 관리자 또는 superadmin 확인
    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")

    requester = db.query(CompanyMember).filter(
        CompanyMember.user_id == current_user["uid"],
        CompanyMember.company_id == member.company_id,
        CompanyMember.is_admin == True,
    ).first()
    is_superadmin = current_user.get("email") == "eunsang0510@gmail.com"

    if not requester and not is_superadmin:
        raise HTTPException(status_code=403, detail="관리자만 삭제할 수 있어요")

    db.delete(member)
    db.commit()
    return {"success": True, "message": "삭제 완료"}


