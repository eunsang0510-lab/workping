from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.connection import get_db
from models.subscription import Subscription, Payment
from datetime import datetime, timedelta
import requests
import os
import uuid

router = APIRouter()

TOSS_SECRET_KEY = os.getenv("TOSS_SECRET_KEY")

PLAN_PRICES = {
    "starter": 9900,
    "business": 29900,
}

PLAN_LIMITS = {
    "free": {
        "max_members": 5,
        "location_limit": False,
        "excel": False,
        "report": False,
    },
    "starter": {
        "max_members": 20,
        "location_limit": True,
        "excel": True,
        "report": True,
    },
    "business": {
        "max_members": 999,
        "location_limit": True,
        "excel": True,
        "report": True,
    },
}


class PreparePaymentRequest(BaseModel):
    company_id: str
    plan: str


class ConfirmPaymentRequest(BaseModel):
    payment_key: str
    order_id: str
    amount: int
    company_id: str
    plan: str


# 현재 구독 조회
@router.get("/subscription/{company_id}")
def get_subscription(company_id: str, db: Session = Depends(get_db)):
    sub = (
        db.query(Subscription)
        .filter(Subscription.company_id == company_id)
        .order_by(Subscription.created_at.desc())
        .first()
    )

    if not sub:
        return {
            "plan": "free",
            "status": "active",
            "expires_at": None,
            "limits": PLAN_LIMITS["free"],
        }

    # 만료 체크
    if sub.expires_at and sub.expires_at < datetime.now():
        sub.status = "expired"
        db.commit()
        return {
            "plan": "free",
            "status": "expired",
            "expires_at": sub.expires_at.isoformat(),
            "limits": PLAN_LIMITS["free"],
        }

    return {
        "plan": sub.plan,
        "status": sub.status,
        "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
        "limits": PLAN_LIMITS.get(sub.plan, PLAN_LIMITS["free"]),
    }


# 결제 준비 (주문 ID 생성)
@router.post("/prepare")
def prepare_payment(req: PreparePaymentRequest, db: Session = Depends(get_db)):
    if req.plan not in PLAN_PRICES:
        raise HTTPException(status_code=400, detail="잘못된 플랜이에요")

    order_id = f"workping-{req.company_id[:8]}-{uuid.uuid4().hex[:8]}"
    amount = PLAN_PRICES[req.plan]

    payment = Payment(
        company_id=req.company_id,
        order_id=order_id,
        plan=req.plan,
        amount=amount,
        status="pending",
    )
    db.add(payment)
    db.commit()

    return {"order_id": order_id, "amount": amount, "plan": req.plan}


# 결제 승인
@router.post("/confirm")
def confirm_payment(req: ConfirmPaymentRequest, db: Session = Depends(get_db)):
    # 토스페이먼츠 결제 승인 API 호출
    import base64

    secret = base64.b64encode(f"{TOSS_SECRET_KEY}:".encode()).decode()

    response = requests.post(
        f"https://api.tosspayments.com/v1/payments/confirm",
        headers={
            "Authorization": f"Basic {secret}",
            "Content-Type": "application/json",
        },
        json={
            "paymentKey": req.payment_key,
            "orderId": req.order_id,
            "amount": req.amount,
        },
    )

    if response.status_code != 200:
        error = response.json().get("message", "결제 승인 실패")
        raise HTTPException(status_code=400, detail=error)

    # 결제 기록 업데이트
    payment = db.query(Payment).filter(Payment.order_id == req.order_id).first()
    if payment:
        payment.payment_key = req.payment_key
        payment.status = "done"

    # 구독 생성/업데이트 (30일)
    sub = Subscription(
        company_id=req.company_id,
        plan=req.plan,
        status="active",
        started_at=datetime.now(),
        expires_at=datetime.now() + timedelta(days=30),
    )
    db.add(sub)
    db.commit()

    return {"success": True, "plan": req.plan, "expires_at": sub.expires_at.isoformat()}


# 플랜 한도 체크
@router.get("/limits/{company_id}")
def get_limits(company_id: str, db: Session = Depends(get_db)):
    sub = (
        db.query(Subscription)
        .filter(Subscription.company_id == company_id, Subscription.status == "active")
        .order_by(Subscription.created_at.desc())
        .first()
    )

    plan = "free"
    if sub and (not sub.expires_at or sub.expires_at > datetime.now()):
        plan = sub.plan

    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
