from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.connection import get_db
from models.push_subscription import PushSubscription
from utils.push import get_public_key
from uuid import uuid4
from typing import Optional

router = APIRouter()


class SubscribeRequest(BaseModel):
    user_id: str
    company_id: Optional[str] = None
    endpoint: str
    p256dh: str
    auth: str


@router.get("/vapid-public-key")
def vapid_public_key():
    return {"publicKey": get_public_key()}


@router.post("/subscribe")
def subscribe(data: SubscribeRequest, db: Session = Depends(get_db)):
    existing = db.query(PushSubscription).filter_by(endpoint=data.endpoint).first()
    if existing:
        existing.user_id = data.user_id
        existing.company_id = data.company_id
    else:
        db.add(PushSubscription(
            id=str(uuid4()),
            user_id=data.user_id,
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
