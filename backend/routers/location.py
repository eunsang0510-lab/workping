from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from database.connection import get_db
from models.attendance import Attendance
from models.location import Location
from models.company import CompanyMember, CompanyLocation
from routers.deps import get_current_user
import requests
import re
import os
import math

load_dotenv()

router = APIRouter()

KST = timezone(timedelta(hours=9))

_COORD_RE = re.compile(r"^-?\d+\.\d+,\s*-?\d+\.\d+$")


def _calc_distance(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _kakao_address(lat: float, lng: float) -> str:
    try:
        kakao_key = os.getenv("KAKAO_REST_API_KEY")
        resp = requests.get(
            f"https://dapi.kakao.com/v2/local/geo/coord2address.json?x={lng}&y={lat}",
            headers={"Authorization": f"KakaoAK {kakao_key}"},
            timeout=8,
        )
        data = resp.json()
        if data.get("documents"):
            doc = data["documents"][0]
            road = doc.get("road_address")
            if road:
                addr = road.get("address_name", "")
                building = road.get("building_name", "")
                if building and building in addr:
                    addr = addr.replace(" " + building, "").strip()
                return addr
            address = doc.get("address")
            if address:
                return address.get("address_name", "")
    except Exception as e:
        print(f"[WARN] Kakao 주소 조회 실패: {e}")
    return ""


class LocationData(BaseModel):
    user_id: str
    latitude: float
    longitude: float
    timestamp: datetime = None
    type: str = "checkin"
    address: str = ""
    is_remote: bool = False

@router.post("/record")
def record_location(
    data: LocationData,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["uid"] != data.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인의 기록만 저장할 수 있어요"
        )

    # 출근 시 백엔드에서 위치 검증 (프론트 우회 방지)
    is_remote = False
    if data.type == "checkin":
        member = db.query(CompanyMember).filter(
            CompanyMember.user_id == data.user_id
        ).first()
        if member:
            locations = db.query(CompanyLocation).filter(
                CompanyLocation.company_id == member.company_id,
                CompanyLocation.is_active == True,
            ).all()

            # 재택 주소 확인 (300m 이내)
            if member.home_latitude and member.home_longitude:
                home_dist = _calc_distance(data.latitude, data.longitude, member.home_latitude, member.home_longitude)
                if home_dist <= 300:
                    is_remote = True
                elif locations:
                    if not any(_calc_distance(data.latitude, data.longitude, l.latitude, l.longitude) <= l.radius for l in locations):
                        nearest = min(locations, key=lambda l: _calc_distance(data.latitude, data.longitude, l.latitude, l.longitude))
                        raise HTTPException(status_code=403, detail=f"출근 가능 위치가 아니에요 (출근 가능 주소: {nearest.address or nearest.name})")
            elif locations:
                if not any(_calc_distance(data.latitude, data.longitude, l.latitude, l.longitude) <= l.radius for l in locations):
                    nearest = min(locations, key=lambda l: _calc_distance(data.latitude, data.longitude, l.latitude, l.longitude))
                    raise HTTPException(status_code=403, detail=f"출근 가능 위치가 아니에요 (출근 가능 주소: {nearest.address or nearest.name})")

    if data.timestamp:
     ts = data.timestamp.astimezone(timezone.utc).replace(tzinfo=None)
    else:
     ts = datetime.utcnow()

    # 프론트에서 주소 조회 실패(좌표 문자열) or 빈값이면 백엔드에서 직접 조회
    address = data.address.strip()
    if not address or _COORD_RE.match(address):
        resolved = _kakao_address(data.latitude, data.longitude)
        if resolved:
            address = resolved
            print(f"[INFO] 백엔드 주소 보정: {data.address!r} → {address!r}")

    location = Location(
        user_id=data.user_id,
        latitude=data.latitude,
        longitude=data.longitude,
        place_name=address,
        recorded_at=ts,
    )
    db.add(location)

    attendance = Attendance(
        user_id=data.user_id,
        type=data.type,
        latitude=data.latitude,
        longitude=data.longitude,
        address=address,
        is_remote=is_remote if data.type == "checkin" else data.is_remote,
        recorded_at=ts,
    )
    db.add(attendance)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[ERROR] DB 저장 실패: {e}")
        raise HTTPException(status_code=500, detail=f"DB 저장 실패: {str(e)}")

    print(f"[OK] DB 저장 완료: {data.user_id} - {data.type} - {address} - {ts}")

    return {"message": "위치 기록 완료", "data": data}


@router.get("/address")
def get_address(lat: float, lng: float):
    try:
        kakao_key = os.getenv("KAKAO_REST_API_KEY")
        response = requests.get(
            f"https://dapi.kakao.com/v2/local/geo/coord2address.json?x={lng}&y={lat}",
            headers={"Authorization": f"KakaoAK {kakao_key}"},
        )
        data = response.json()
        if data.get("documents"):
            doc = data["documents"][0]
            road = doc.get("road_address")
            if road:
                addr = road.get("address_name", "")
                building = road.get("building_name", "")
                if building and building in addr:
                    addr = addr.replace(" " + building, "").strip()
                return {"address": addr}
            address = doc.get("address")
            if address:
                return {"address": address.get("address_name", f"{lat:.4f}, {lng:.4f}")}
        return {"address": f"{lat:.4f}, {lng:.4f}"}
    except Exception as e:
        print(f"오류: {e}")
        return {"address": f"{lat:.4f}, {lng:.4f}"}


@router.get("/history/{user_id}")
def get_location_history(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["uid"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인의 기록만 조회할 수 있어요"
        )

    records = (
        db.query(Attendance)
        .filter(Attendance.user_id == user_id)
        .order_by(Attendance.recorded_at.desc())
        .limit(20)
        .all()
    )

    return {
        "user_id": user_id,
        "history": [
            {
                "id": r.id,
                "type": r.type,
                "address": r.address,
                "recorded_at": r.recorded_at.isoformat(),
            }
            for r in records
        ],
    }