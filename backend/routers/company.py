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

router = APIRouter()


# 거리 계산 함수 (하버사인 공식)
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

    members = (
        db.query(CompanyMember).filter(CompanyMember.company_id == company.id).all()
    )

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
    existing = (
        db.query(CompanyMember)
        .filter(
            CompanyMember.company_id == req.company_id,
            CompanyMember.user_id == req.user_id,
        )
        .first()
    )

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
    existing = (
        db.query(CompanyMember)
        .filter(
            CompanyMember.company_id == req.company_id,
            CompanyMember.user_email == req.email,
        )
        .first()
    )

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
        company_id=req.company_id, user_id=uid, user_email=req.email, user_name=req.name
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
            company = (
                db.query(Company)
                .filter(Company.id.like(f"{member_data.company_code}%"))
                .first()
            )
            if not company:
                results.append(
                    {
                        "success": False,
                        "email": member_data.email,
                        "message": f"회사코드 {member_data.company_code} 를 찾을 수 없어요",
                    }
                )
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
    members = (
        db.query(CompanyMember).filter(CompanyMember.company_id == company_id).all()
    )
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
    companies = (
        db.query(Company).filter(Company.name.ilike(f"%{name}%")).limit(10).all()
    )
    return {"companies": [{"id": c.id, "name": c.name} for c in companies]}


@router.get("/attendance/{company_id}")
def get_company_attendance(company_id: str, db: Session = Depends(get_db)):
    from routers.attendance import get_work_day_range

    start, end = get_work_day_range()
    now = datetime.now()

    members = (
        db.query(CompanyMember).filter(CompanyMember.company_id == company_id).all()
    )

    result = []
    for member in members:
        records = (
            db.query(Attendance)
            .filter(
                Attendance.user_id == member.user_id,
                Attendance.recorded_at >= start,
                Attendance.recorded_at < end,
            )
            .order_by(Attendance.recorded_at)
            .all()
        )

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

        result.append(
            {
                "user_id": member.user_id,
                "user_name": member.user_name or member.user_email,
                "user_email": member.user_email,
                "checkin": checkin.recorded_at.isoformat() if checkin else None,
                "checkin_address": checkin.address if checkin else None,
                "checkout": checkout.recorded_at.isoformat() if checkout else None,
                "work_minutes": work_minutes,
                "work_hours": (
                    f"{work_minutes // 60}시간 {work_minutes % 60}분"
                    if work_minutes > 0
                    else "-"
                ),
                "status": status,
                "is_missing_checkout": is_missing_checkout,
            }
        )

    return {"date": str(start.date()), "attendance": result}


# 회사 출근 위치 목록 조회
@router.get("/locations/{company_id}")
def get_locations(company_id: str, db: Session = Depends(get_db)):
    locations = (
        db.query(CompanyLocation)
        .filter(
            CompanyLocation.company_id == company_id, CompanyLocation.is_active == True
        )
        .all()
    )
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


# 출근 위치 추가
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


# 출근 위치 삭제
@router.delete("/locations/{location_id}")
def delete_location(location_id: str, db: Session = Depends(get_db)):
    location = (
        db.query(CompanyLocation).filter(CompanyLocation.id == location_id).first()
    )
    if not location:
        raise HTTPException(status_code=404, detail="위치를 찾을 수 없습니다")
    db.delete(location)
    db.commit()
    return {"message": "삭제 완료"}


# 출근 가능 여부 검증
@router.post("/locations/validate")
def validate_checkin_location(
    req: CheckInValidateRequest, db: Session = Depends(get_db)
):
    locations = (
        db.query(CompanyLocation)
        .filter(
            CompanyLocation.company_id == req.company_id,
            CompanyLocation.is_active == True,
        )
        .all()
    )

    if not locations:
        return {"allowed": True, "message": "위치 제한 없음"}

    for loc in locations:
        distance = calc_distance(
            req.latitude, req.longitude, loc.latitude, loc.longitude
        )
        if distance <= loc.radius:
            return {
                "allowed": True,
                "message": f"{loc.name} 범위 내 ({int(distance)}m)",
                "location_name": loc.name,
                "distance": int(distance),
            }

    nearest = min(
        locations,
        key=lambda l: calc_distance(
            req.latitude, req.longitude, l.latitude, l.longitude
        ),
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
    member = (
        db.query(CompanyMember)
        .filter(CompanyMember.user_id == user_id, CompanyMember.is_admin == True)
        .first()
    )
    return {"is_admin": member is not None}

class ResetPasswordRequest(BaseModel):
    user_id: str
    email: str
    birth_date: str = ""

@router.post("/members/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """비밀번호를 초기값으로 초기화"""
    firebase_api_key = os.getenv("FIREBASE_API_KEY")

    # 이메일 앞부분 + 생년월일로 초기 비밀번호 생성
    # 생년월일 없으면 email prefix + "00000000"
    email_prefix = req.email.split("@")[0]
    initial_password = f"{email_prefix}{req.birth_date or '00000000'}"

    # Firebase에서 비밀번호 변경
    # 먼저 로그인해서 idToken 얻기
    sign_in_res = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={firebase_api_key}",
        json={"email": req.email, "password": initial_password, "returnSecureToken": True}
    )

    # 비밀번호 초기화는 관리자 SDK 없이 못하므로 새 비밀번호 직접 설정
    # sendOobCode 사용 (비밀번호 재설정 이메일 발송)
    response = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key={firebase_api_key}",
        json={
            "requestType": "PASSWORD_RESET",
            "email": req.email
        }
    )

    if response.status_code == 200:
        return {"success": True, "message": f"{req.email}로 비밀번호 재설정 이메일을 발송했어요"}
    else:
        error = response.json().get("error", {}).get("message", "발송 실패")
        raise HTTPException(status_code=400, detail=error)