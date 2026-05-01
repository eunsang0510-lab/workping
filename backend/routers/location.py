from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from database.connection import get_db
from models.attendance import Attendance
from models.location import Location
from routers.deps import get_current_user
import requests
import os

load_dotenv()

router = APIRouter()

KST = timezone(timedelta(hours=9))


class LocationData(BaseModel):
    user_id: str
    latitude: float
    longitude: float
    timestamp: datetime = None
    type: str = "checkin"
    address: str = ""

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

    if data.timestamp:
        ts = data.timestamp.astimezone(KST)
    else:
        ts = datetime.now(KST)

    location = Location(
        user_id=data.user_id,
        latitude=data.latitude,
        longitude=data.longitude,
        place_name=data.address,
        recorded_at=ts,
    )
    db.add(location)

    attendance = Attendance(
        user_id=data.user_id,
        type=data.type,
        latitude=data.latitude,
        longitude=data.longitude,
        address=data.address,
        recorded_at=ts,
    )
    db.add(attendance)
    db.commit()

    print(f"✅ DB 저장 완료: {data.user_id} - {data.type} - {data.address} - {ts}")

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