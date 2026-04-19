from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database.connection import get_db
from models.attendance import Attendance
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/summary/{user_id}")
def get_attendance_summary(user_id: str, db: Session = Depends(get_db)):
    """오늘 근태 요약"""
    today = datetime.now().date()

    records = db.query(Attendance).filter(
        Attendance.user_id == user_id,
        func.date(Attendance.recorded_at) == today
    ).order_by(Attendance.recorded_at).all()

    checkin = next((r for r in records if r.type == "checkin"), None)
    checkout = next((r for r in records if r.type == "checkout"), None)

    work_minutes = 0
    if checkin and checkout:
        diff = checkout.recorded_at - checkin.recorded_at
        work_minutes = int(diff.total_seconds() / 60)

    return {
        "date": str(today),
        "checkin": checkin.recorded_at.isoformat() if checkin else None,
        "checkout": checkout.recorded_at.isoformat() if checkout else None,
        "checkin_address": checkin.address if checkin else None,
        "checkout_address": checkout.address if checkout else None,
        "work_minutes": work_minutes,
        "work_hours": f"{work_minutes // 60}시간 {work_minutes % 60}분"
    }

@router.get("/weekly/{user_id}")
def get_weekly_report(user_id: str, db: Session = Depends(get_db)):
    """주간 리포트"""
    today = datetime.now().date()
    week_ago = today - timedelta(days=7)

    records = db.query(Attendance).filter(
        Attendance.user_id == user_id,
        Attendance.recorded_at >= week_ago
    ).order_by(Attendance.recorded_at).all()

    # 날짜별 그룹화
    daily = {}
    for r in records:
        date_str = r.recorded_at.date().isoformat()
        if date_str not in daily:
            daily[date_str] = {"checkin": None, "checkout": None, "work_minutes": 0}
        if r.type == "checkin" and not daily[date_str]["checkin"]:
            daily[date_str]["checkin"] = r.recorded_at.isoformat()
            daily[date_str]["checkin_address"] = r.address
        if r.type == "checkout":
            daily[date_str]["checkout"] = r.recorded_at.isoformat()
            daily[date_str]["checkout_address"] = r.address

    # 근무 시간 계산
    for date_str, data in daily.items():
        if data["checkin"] and data["checkout"]:
            checkin = datetime.fromisoformat(data["checkin"])
            checkout = datetime.fromisoformat(data["checkout"])
            diff = checkout - checkin
            data["work_minutes"] = int(diff.total_seconds() / 60)
            data["work_hours"] = f"{data['work_minutes'] // 60}시간 {data['work_minutes'] % 60}분"
        else:
            data["work_hours"] = "-"

    total_minutes = sum(d["work_minutes"] for d in daily.values())

    return {
        "user_id": user_id,
        "period": f"{week_ago} ~ {today}",
        "total_work_hours": f"{total_minutes // 60}시간 {total_minutes % 60}분",
        "daily": daily
    }

@router.get("/monthly/{user_id}")
def get_monthly_report(user_id: str, db: Session = Depends(get_db)):
    """월간 리포트"""
    today = datetime.now().date()
    month_ago = today - timedelta(days=30)

    records = db.query(Attendance).filter(
        Attendance.user_id == user_id,
        Attendance.recorded_at >= month_ago
    ).order_by(Attendance.recorded_at).all()

    daily = {}
    for r in records:
        date_str = r.recorded_at.date().isoformat()
        if date_str not in daily:
            daily[date_str] = {"checkin": None, "checkout": None, "work_minutes": 0}
        if r.type == "checkin" and not daily[date_str]["checkin"]:
            daily[date_str]["checkin"] = r.recorded_at.isoformat()
        if r.type == "checkout":
            daily[date_str]["checkout"] = r.recorded_at.isoformat()

    for date_str, data in daily.items():
        if data["checkin"] and data["checkout"]:
            checkin = datetime.fromisoformat(data["checkin"])
            checkout = datetime.fromisoformat(data["checkout"])
            diff = checkout - checkin
            data["work_minutes"] = int(diff.total_seconds() / 60)
            data["work_hours"] = f"{data['work_minutes'] // 60}시간 {data['work_minutes'] % 60}분"
        else:
            data["work_hours"] = "-"

    total_minutes = sum(d["work_minutes"] for d in daily.values())
    work_days = len([d for d in daily.values() if d["work_minutes"] > 0])

    return {
        "user_id": user_id,
        "period": f"{month_ago} ~ {today}",
        "total_work_hours": f"{total_minutes // 60}시간 {total_minutes % 60}분",
        "work_days": work_days,
        "avg_work_hours": f"{(total_minutes // work_days) // 60}시간 {(total_minutes // work_days) % 60}분" if work_days > 0 else "-",
        "daily": daily
    }