from fastapi import APIRouter, Depends
from pydantic import BaseModel
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from database.connection import get_db
from models.attendance import Attendance
from models.location import Location
import requests
import os

load_dotenv()

router = APIRouter()


class LocationData(BaseModel):
    user_id: str
    latitude: float
    longitude: float
    timestamp: datetime = None
    type: str = "checkin"
    address: str = ""


@router.post("/record")
def record_location(data: LocationData, db: Session = Depends(get_db)):
    """위치 기록 및 DB 저장"""

    # Location 테이블 저장
    location = Location(
        user_id=data.user_id,
        latitude=data.latitude,
        longitude=data.longitude,
        place_name=data.address,
        recorded_at=data.timestamp or datetime.now(),
    )
    db.add(location)

    # Attendance 테이블 저장
    attendance = Attendance(
        user_id=data.user_id,
        type=data.type,
        latitude=data.latitude,
        longitude=data.longitude,
        address=data.address,
        recorded_at=data.timestamp or datetime.now(),
    )
    db.add(attendance)
    db.commit()

    print(f"✅ DB 저장 완료: {data.user_id} - {data.type} - {data.address}")

    return {"message": "위치 기록 완료", "data": data}


@router.get("/address")
def get_address(lat: float, lng: float):
    """좌표 → 주소 변환 (카카오 API)"""
    try:
        kakao_key = os.getenv("KAKAO_REST_API_KEY")
        response = requests.get(
            f"https://dapi.kakao.com/v2/local/geo/coord2address.json?x={lng}&y={lat}",
            headers={"Authorization": f"KakaoAK {kakao_key}"},
        )
        data = response.json()
        if data.get("documents"):
            address = data["documents"][0].get("address")
            if address:
                return {
                    "address": f"{address['region_2depth_name']} {address['region_3depth_name']}"
                }
        return {"address": f"{lat:.4f}, {lng:.4f}"}
    except Exception as e:
        print(f"오류: {e}")
        return {"address": f"{lat:.4f}, {lng:.4f}"}


@router.get("/history/{user_id}")
def get_location_history(user_id: str, db: Session = Depends(get_db)):
    """사용자 위치 기록 조회"""
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
