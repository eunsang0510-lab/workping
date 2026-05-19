from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database.connection import get_db
from models.notification import Notification
from routers.deps import get_current_user

router = APIRouter()


@router.get("/{user_id}")
def get_notifications(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["uid"] != user_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="본인의 알림만 조회할 수 있어요")

    items = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    unread_count = sum(1 for n in items if not n.is_read)
    return {
        "notifications": [_serialize(n) for n in items],
        "unread_count": unread_count,
    }


@router.post("/read/{notification_id}")
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    n = db.query(Notification).filter(Notification.id == notification_id).first()
    if n and n.user_id == current_user["uid"]:
        n.is_read = True
        db.commit()
    return {"success": True}


@router.post("/read-all/{user_id}")
def mark_all_read(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["uid"] != user_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="본인의 알림만 처리할 수 있어요")
    db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"success": True}


def _serialize(n: Notification) -> dict:
    return {
        "id": n.id,
        "title": n.title,
        "body": n.body,
        "url": n.url,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat(),
    }
