from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.connection import get_db
from models.push_subscription import PushSubscription
from routers.deps import get_current_user
from utils.push import get_public_key
from uuid import uuid4
from typing import Optional

router = APIRouter()


class SubscribeRequest(BaseModel):
    company_id: Optional[str] = None
    endpoint: str
    p256dh: str
    auth: str


@router.get("/vapid-public-key")
def vapid_public_key():
    return {"publicKey": get_public_key()}


@router.post("/subscribe")
def subscribe(data: SubscribeRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    uid = current_user["uid"]

    # company_id를 보낸 경우 해당 회사 소속인지 검증
    if data.company_id:
        from models.company import CompanyMember
        membership = db.query(CompanyMember).filter(
            CompanyMember.user_id == uid,
            CompanyMember.company_id == data.company_id,
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="해당 회사 소속이 아니에요")

    existing = db.query(PushSubscription).filter_by(endpoint=data.endpoint).first()
    if existing:
        existing.user_id = uid
        existing.company_id = data.company_id
    else:
        db.add(PushSubscription(
            id=str(uuid4()),
            user_id=uid,
            company_id=data.company_id,
            endpoint=data.endpoint,
            p256dh=data.p256dh,
            auth=data.auth,
        ))
    db.commit()
    return {"ok": True}


@router.delete("/unsubscribe")
def unsubscribe(endpoint: str, db: Session = Depends(get_db)):
    db.query(PushSubscription).filter_by(endpoint=endpoint).delete()
    db.commit()
    return {"ok": True}
