from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.connection import get_db
from models.business_trip import BusinessTrip
from models.company import CompanyMember
from models.team import Team, TeamMember
from routers.deps import get_current_user
from datetime import datetime
from typing import Optional
from utils.push import send_push_to_users


def _get_manager_ids_for_trip(db: Session, company_id: str, user_id: str) -> list[str]:
    teams = db.query(Team).filter(Team.company_id == company_id).all()
    result = []
    for team in teams:
        members = db.query(TeamMember).filter(TeamMember.team_id == team.id).all()
        if any(m.user_id == user_id for m in members) and team.manager_id:
            result.append(team.manager_id)
    if not result:
        admins = db.query(CompanyMember).filter(
            CompanyMember.company_id == company_id,
            CompanyMember.is_admin == True,
        ).all()
        result = [a.user_id for a in admins]
    return result

router = APIRouter()

SUPERADMIN = "eunsang0510@gmail.com"


class TripApplyRequest(BaseModel):
    company_id: str
    user_id: str
    user_name: str = ""
    destination: str
    purpose: str = ""
    start_date: str
    end_date: str


class TripApproveRequest(BaseModel):
    status: str          # approved / rejected
    reject_reason: str = ""


def _is_approver(db: Session, uid: str, company_id: str, email: str) -> bool:
    """팀장 또는 관리자 여부 확인"""
    if email == SUPERADMIN:
        return True
    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == uid,
        CompanyMember.company_id == company_id,
    ).first()
    return member is not None and (member.is_admin or member.is_manager)


def _managed_user_ids(db: Session, uid: str, company_id: str) -> Optional[list]:
    """팀장이면 담당 팀원 uid 목록, 관리자면 None(전체)"""
    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == uid,
        CompanyMember.company_id == company_id,
    ).first()
    if not member:
        return []
    if member.is_admin:
        return None  # 전체 조회
    # 팀장: 자신이 팀장인 팀의 팀원만
    teams = db.query(Team).filter(Team.manager_id == uid).all()
    if not teams:
        return []
    team_ids = [t.id for t in teams]
    rows = db.query(TeamMember.user_id).filter(TeamMember.team_id.in_(team_ids)).all()
    return [r for (r,) in rows]


# ── 출장 신청 ──────────────────────────────────────────
@router.post("/apply")
def apply_trip(
    req: TripApplyRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["uid"] != req.user_id:
        raise HTTPException(status_code=403, detail="본인만 신청할 수 있어요")
    if not req.destination.strip():
        raise HTTPException(status_code=400, detail="출장지를 입력해주세요")
    if req.start_date > req.end_date:
        raise HTTPException(status_code=400, detail="종료일이 시작일보다 빠를 수 없어요")

    trip = BusinessTrip(
        company_id=req.company_id,
        user_id=req.user_id,
        user_name=req.user_name,
        destination=req.destination.strip(),
        purpose=req.purpose.strip(),
        start_date=req.start_date,
        end_date=req.end_date,
        status="pending",
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)

    try:
        manager_ids = _get_manager_ids_for_trip(db, req.company_id, req.user_id)
        if manager_ids:
            send_push_to_users(
                db, manager_ids,
                title="✈️ 출장 신청",
                body=f"{req.user_name or req.user_id}님이 {req.start_date} 출장을 신청했어요.",
                url="/manager",
            )
    except Exception as e:
        print(f"[apply_trip] 알림 전송 실패: {e}")

    return {"success": True, "trip_id": trip.id}


# ── 내 출장 신청 목록 ──────────────────────────────────
@router.get("/my/{user_id}")
def get_my_trips(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["uid"] != user_id:
        raise HTTPException(status_code=403, detail="본인의 기록만 조회할 수 있어요")

    trips = (
        db.query(BusinessTrip)
        .filter(BusinessTrip.user_id == user_id)
        .order_by(BusinessTrip.created_at.desc())
        .all()
    )
    return {"trips": [_serialize(t) for t in trips]}


# ── 회사 전체 출장 목록 (팀장/관리자) ─────────────────
@router.get("/company/{company_id}")
def get_company_trips(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["uid"]
    email = current_user.get("email", "")

    if not _is_approver(db, uid, company_id, email):
        raise HTTPException(status_code=403, detail="팀장 또는 관리자만 조회할 수 있어요")

    if email == SUPERADMIN:
        trips = db.query(BusinessTrip).filter(BusinessTrip.company_id == company_id).order_by(BusinessTrip.created_at.desc()).all()
    else:
        managed = _managed_user_ids(db, uid, company_id)
        if managed is None:
            trips = db.query(BusinessTrip).filter(BusinessTrip.company_id == company_id).order_by(BusinessTrip.created_at.desc()).all()
        else:
            trips = db.query(BusinessTrip).filter(
                BusinessTrip.company_id == company_id,
                BusinessTrip.user_id.in_(managed),
            ).order_by(BusinessTrip.created_at.desc()).all()

    return {"trips": [_serialize(t) for t in trips]}


# ── 출장 승인 / 반려 (팀장/관리자) ───────────────────
@router.put("/approve/{trip_id}")
def approve_trip(
    trip_id: str,
    req: TripApproveRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if req.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status는 approved 또는 rejected만 가능해요")

    trip = db.query(BusinessTrip).filter(BusinessTrip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="출장 신청을 찾을 수 없어요")

    uid = current_user["uid"]
    email = current_user.get("email", "")

    if not _is_approver(db, uid, trip.company_id, email):
        raise HTTPException(status_code=403, detail="팀장 또는 관리자만 승인할 수 있어요")

    # 팀장은 자신의 팀원만 승인 가능
    if email != SUPERADMIN:
        managed = _managed_user_ids(db, uid, trip.company_id)
        if managed is not None and trip.user_id not in managed:
            raise HTTPException(status_code=403, detail="담당 팀원의 신청만 승인할 수 있어요")

    prev_status = trip.status

    # 취소 신청 처리 (cancel_requested)
    if prev_status == "cancel_requested":
        trip.approved_by = uid
        trip.approved_at = datetime.now()
        if req.status == "approved":
            trip.status = "cancelled"
            db.commit()
            send_push_to_users(db, [trip.user_id],
                title="✈️ 출장 취소 승인",
                body=f"{trip.start_date} 출장 취소가 승인됐어요.",
                url="/business-trip")
            return {"success": True, "status": "cancelled"}
        else:
            trip.status = "approved"
            db.commit()
            send_push_to_users(db, [trip.user_id],
                title="✈️ 출장 취소 반려",
                body=f"{trip.start_date} 출장 취소 신청이 반려됐어요.",
                url="/business-trip")
            return {"success": True, "status": "approved"}

    # 일반 승인/반려 처리 (pending)
    if prev_status != "pending":
        raise HTTPException(status_code=400, detail="대기 중인 신청만 처리할 수 있어요")

    trip.status = req.status
    trip.approved_by = uid
    trip.approved_at = datetime.now()
    trip.reject_reason = req.reject_reason.strip() if req.status == "rejected" else None
    db.commit()

    status_text = "승인" if req.status == "approved" else "반려"
    send_push_to_users(
        db, [trip.user_id],
        title=f"✈️ 출장 {status_text}",
        body=f"{trip.start_date} 출장 신청이 {status_text}됐어요.",
        url="/business-trip",
    )

    return {"success": True, "status": req.status}


# ── 출장 신청취소 (본인) ──────────────────────────────
@router.post("/cancel/{trip_id}")
def cancel_trip(
    trip_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    trip = db.query(BusinessTrip).filter(BusinessTrip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="출장 신청을 찾을 수 없어요")
    if trip.user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="본인의 신청만 취소할 수 있어요")

    if trip.status == "pending":
        trip.status = "cancelled"
        db.commit()
        return {"success": True, "action": "cancelled"}

    if trip.status == "approved":
        trip.status = "cancel_requested"
        db.commit()
        manager_ids = _get_manager_ids_for_trip(db, trip.company_id, trip.user_id)
        if manager_ids:
            send_push_to_users(
                db, manager_ids,
                title="✈️ 출장 취소 신청",
                body=f"{trip.user_name or trip.user_id}님이 {trip.start_date} 출장 취소를 신청했어요.",
                url="/manager",
            )
        return {"success": True, "action": "cancel_requested"}

    raise HTTPException(status_code=400, detail="취소할 수 없는 상태예요")


def _serialize(t: BusinessTrip) -> dict:
    return {
        "id": t.id,
        "user_id": t.user_id,
        "user_name": t.user_name,
        "destination": t.destination,
        "purpose": t.purpose,
        "start_date": t.start_date,
        "end_date": t.end_date,
        "status": t.status,
        "reject_reason": t.reject_reason,
        "approved_by": t.approved_by,
        "approved_at": t.approved_at.isoformat() if t.approved_at else None,
        "created_at": t.created_at.isoformat(),
    }
