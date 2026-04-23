from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database.connection import get_db
from models.attendance import Attendance
from models.location import Location
from models.company import CompanyMember
from datetime import datetime, timedelta
from urllib.parse import quote

router = APIRouter()


def get_work_day_range():
    """새벽 4시 기준으로 오늘의 근무일 시작/끝 반환"""
    now = datetime.now()
    if now.hour < 4:
        # 새벽 4시 이전이면 어제가 근무일
        start = (
            datetime(now.year, now.month, now.day)
            - timedelta(days=1)
            + timedelta(hours=4)
        )
    else:
        start = datetime(now.year, now.month, now.day) + timedelta(hours=4)
    end = start + timedelta(hours=24)
    return start, end


@router.get("/summary/{user_id}")
def get_attendance_summary(user_id: str, db: Session = Depends(get_db)):
    start, end = get_work_day_range()

    records = (
        db.query(Attendance)
        .filter(
            Attendance.user_id == user_id,
            Attendance.recorded_at >= start,
            Attendance.recorded_at < end,
        )
        .order_by(Attendance.recorded_at)
        .all()
    )

    checkin = next((r for r in records if r.type == "checkin"), None)
    checkout = next((r for r in records if r.type == "checkout"), None)

    work_minutes = 0
    if checkin and checkout:
        diff = checkout.recorded_at - checkin.recorded_at
        work_minutes = int(diff.total_seconds() / 60)

    return {
        "date": start.date().isoformat(),
        "checkin": checkin.recorded_at.isoformat() if checkin else None,
        "checkout": checkout.recorded_at.isoformat() if checkout else None,
        "checkin_address": checkin.address if checkin else None,
        "checkout_address": checkout.address if checkout else None,
        "work_minutes": work_minutes,
        "work_hours": f"{work_minutes // 60}시간 {work_minutes % 60}분",
    }


@router.get("/company/{company_id}")
def get_company_attendance(company_id: str, db: Session = Depends(get_db)):
    """회사 전체 근태 현황 (미퇴근자 포함)"""
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

        # 미퇴근 감지: 출근은 했는데 퇴근 안 했고 현재 새벽 4시 이후
        is_missing_checkout = (
            checkin is not None
            and checkout is None
            and now >= end  # 근무일 종료(다음날 새벽 4시) 이후
        )

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
                "user_name": member.user_name,
                "user_email": member.user_email,
                "checkin": checkin.recorded_at.isoformat() if checkin else None,
                "checkout": checkout.recorded_at.isoformat() if checkout else None,
                "work_hours": (
                    f"{work_minutes // 60}h {work_minutes % 60}m"
                    if work_minutes
                    else "-"
                ),
                "status": status,
                "is_missing_checkout": is_missing_checkout,
            }
        )

    return {"attendance": result}


@router.get("/weekly/{user_id}")
def get_weekly_report(user_id: str, db: Session = Depends(get_db)):
    today = datetime.now().date()
    week_ago = today - timedelta(days=7)

    records = (
        db.query(Attendance)
        .filter(Attendance.user_id == user_id, Attendance.recorded_at >= week_ago)
        .order_by(Attendance.recorded_at)
        .all()
    )

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

    for date_str, data in daily.items():
        if data["checkin"] and data["checkout"]:
            checkin = datetime.fromisoformat(data["checkin"])
            checkout = datetime.fromisoformat(data["checkout"])
            diff = checkout - checkin
            data["work_minutes"] = int(diff.total_seconds() / 60)
            data["work_hours"] = (
                f"{data['work_minutes'] // 60}시간 {data['work_minutes'] % 60}분"
            )
        else:
            data["work_hours"] = "-"

    total_minutes = sum(d["work_minutes"] for d in daily.values())

    return {
        "user_id": user_id,
        "period": f"{week_ago} ~ {today}",
        "total_work_hours": f"{total_minutes // 60}시간 {total_minutes % 60}분",
        "daily": daily,
    }


@router.get("/monthly/{user_id}")
def get_monthly_report(user_id: str, db: Session = Depends(get_db)):
    today = datetime.now().date()
    month_ago = today - timedelta(days=30)

    records = (
        db.query(Attendance)
        .filter(Attendance.user_id == user_id, Attendance.recorded_at >= month_ago)
        .order_by(Attendance.recorded_at)
        .all()
    )

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
            data["work_hours"] = (
                f"{data['work_minutes'] // 60}시간 {data['work_minutes'] % 60}분"
            )
        else:
            data["work_hours"] = "-"

    total_minutes = sum(d["work_minutes"] for d in daily.values())
    work_days = len([d for d in daily.values() if d["work_minutes"] > 0])

    return {
        "user_id": user_id,
        "period": f"{month_ago} ~ {today}",
        "total_work_hours": f"{total_minutes // 60}시간 {total_minutes % 60}분",
        "work_days": work_days,
        "avg_work_hours": (
            f"{(total_minutes // work_days) // 60}시간 {(total_minutes // work_days) % 60}분"
            if work_days > 0
            else "-"
        ),
        "daily": daily,
    }


@router.delete("/reset/{user_id}")
def reset_attendance(user_id: str, db: Session = Depends(get_db)):
    start, end = get_work_day_range()

    db.query(Attendance).filter(
        Attendance.user_id == user_id,
        Attendance.recorded_at >= start,
        Attendance.recorded_at < end,
    ).delete()

    db.query(Location).filter(
        Location.user_id == user_id,
        Location.recorded_at >= start,
        Location.recorded_at < end,
    ).delete()

    db.commit()
    return {"message": "오늘 기록 초기화 완료"}


from fastapi.responses import StreamingResponse
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
import io


@router.get("/export/{company_id}")
def export_attendance_excel(company_id: str, db: Session = Depends(get_db)):
    from models.company import Company, CompanyMember

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="회사를 찾을 수 없습니다")

    members = (
        db.query(CompanyMember).filter(CompanyMember.company_id == company_id).all()
    )

    # 최근 30일
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=30)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "근무기록"

    # 헤더 스타일
    header_fill = PatternFill(
        start_color="6366F1", end_color="6366F1", fill_type="solid"
    )
    header_font = Font(color="FFFFFF", bold=True)

    headers = [
        "이름",
        "이메일",
        "날짜",
        "출근시간",
        "퇴근시간",
        "근무시간(분)",
        "출근위치",
        "퇴근위치",
    ]
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")
        ws.column_dimensions[cell.column_letter].width = 18

    row = 2
    for member in members:
        records = (
            db.query(Attendance)
            .filter(
                Attendance.user_id == member.user_id,
                Attendance.recorded_at
                >= datetime.combine(start_date, datetime.min.time()),
                Attendance.recorded_at
                <= datetime.combine(end_date, datetime.max.time()),
            )
            .order_by(Attendance.recorded_at)
            .all()
        )

        # 날짜별 그룹핑
        daily = {}
        for r in records:
            date_str = r.recorded_at.date().isoformat()
            if date_str not in daily:
                daily[date_str] = {"checkin": None, "checkout": None}
            if r.type == "checkin" and not daily[date_str]["checkin"]:
                daily[date_str]["checkin"] = r
            if r.type == "checkout":
                daily[date_str]["checkout"] = r

        for date_str, data in sorted(daily.items()):
            checkin = data["checkin"]
            checkout = data["checkout"]
            work_minutes = 0
            if checkin and checkout:
                diff = checkout.recorded_at - checkin.recorded_at
                work_minutes = int(diff.total_seconds() / 60)

            ws.cell(row=row, column=1, value=member.user_name or "-")
            ws.cell(row=row, column=2, value=member.user_email)
            ws.cell(row=row, column=3, value=date_str)
            ws.cell(
                row=row,
                column=4,
                value=checkin.recorded_at.strftime("%H:%M") if checkin else "-",
            )
            ws.cell(
                row=row,
                column=5,
                value=checkout.recorded_at.strftime("%H:%M") if checkout else "-",
            )
            ws.cell(row=row, column=6, value=work_minutes if work_minutes > 0 else "-")
            ws.cell(row=row, column=7, value=checkin.address if checkin else "-")
            ws.cell(row=row, column=8, value=checkout.address if checkout else "-")
            row += 1

    # 파일 스트림으로 반환
    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    filename = f"{company.name}_근무기록_{start_date}_{end_date}.xlsx"
    encoded_filename = quote(filename)

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
        },
    )

@router.get("/month/{user_id}")
def get_month_dates(user_id: str, year: int, month: int, db: Session = Depends(get_db)):
    """해당 월에 기록 있는 날짜 목록 반환"""
    from datetime import date
    start = datetime(year, month, 1)
    if month == 12:
        end = datetime(year + 1, 1, 1)
    else:
        end = datetime(year, month + 1, 1)

    records = (
        db.query(Attendance)
        .filter(
            Attendance.user_id == user_id,
            Attendance.recorded_at >= start,
            Attendance.recorded_at < end,
        )
        .all()
    )

    dates = {}
    for r in records:
        date_str = r.recorded_at.date().isoformat()
        dates[date_str] = True

    return {"dates": dates}


@router.get("/day/{user_id}")
def get_day_record(user_id: str, date: str, db: Session = Depends(get_db)):
    """특정 날짜의 출퇴근 기록 반환 (date: YYYY-MM-DD)"""
    try:
        target = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return {"error": "날짜 형식 오류"}

    # 새벽 4시 기준
    start = target + timedelta(hours=4)
    end = start + timedelta(hours=24)

    records = (
        db.query(Attendance)
        .filter(
            Attendance.user_id == user_id,
            Attendance.recorded_at >= start,
            Attendance.recorded_at < end,
        )
        .order_by(Attendance.recorded_at)
        .all()
    )

    checkin = next((r for r in records if r.type == "checkin"), None)
    checkout = next((r for r in records if r.type == "checkout"), None)

    work_minutes = None
    if checkin and checkout:
        diff = checkout.recorded_at - checkin.recorded_at
        work_minutes = int(diff.total_seconds() / 60)

    return {
        "date": date,
        "checkin": checkin.recorded_at.isoformat() if checkin else None,
        "checkout": checkout.recorded_at.isoformat() if checkout else None,
        "checkin_address": checkin.address if checkin else None,
        "checkout_address": checkout.address if checkout else None,
        "work_minutes": work_minutes,
    }