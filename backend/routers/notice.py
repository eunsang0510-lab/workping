from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.connection import get_db
from models.notice import Notice, NoticeRead
from models.company import CompanyMember
from routers.deps import get_current_user
from datetime import datetime
from typing import Optional

router = APIRouter()

class NoticeCreate(BaseModel):
    title: str
    content: str
    notice_type: str = "system"  # "system" or "company"
    company_id: Optional[str] = None

@router.post("/create")
def create_notice(
    req: NoticeCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    notice = Notice(
        title=req.title,
        content=req.content,
        notice_type=req.notice_type,
        company_id=req.company_id,
        created_by=current_user["uid"],
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return {"success": True, "notice_id": notice.id}

@router.get("/unread/{user_id}")
def get_unread_notices(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    # 읽은 공지 ID 목록
    read_ids = [
        r.notice_id for r in
        db.query(NoticeRead).filter(NoticeRead.user_id == user_id).all()
    ]

    # 소속 회사 찾기
    member = db.query(CompanyMember).filter(CompanyMember.user_id == user_id).first()
    company_id = member.company_id if member else None

    # 안 읽은 공지 조회 (시스템 공지 + 내 회사 공지)
    from sqlalchemy import or_, and_
    notices = db.query(Notice).filter(
        Notice.is_active == True,
        Notice.id.notin_(read_ids),
        or_(
            Notice.notice_type == "system",
            and_(Notice.notice_type == "company", Notice.company_id == company_id)
        )
    ).order_by(Notice.created_at.desc()).all()

    return {
        "notices": [
            {
                "id": n.id,
                "title": n.title,
                "content": n.content,
                "notice_type": n.notice_type,
                "created_at": n.created_at.isoformat(),
            }
            for n in notices
        ]
    }

@router.post("/read/{notice_id}")
def mark_as_read(
    notice_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    existing = db.query(NoticeRead).filter(
        NoticeRead.notice_id == notice_id,
        NoticeRead.user_id == user_id
    ).first()
    if not existing:
        read = NoticeRead(notice_id=notice_id, user_id=user_id)
        db.add(read)
        db.commit()
    return {"success": True}

@router.get("/list/{user_id}")
def get_notice_list(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    member = db.query(CompanyMember).filter(CompanyMember.user_id == user_id).first()
    company_id = member.company_id if member else None

    read_ids = [
        r.notice_id for r in
        db.query(NoticeRead).filter(NoticeRead.user_id == user_id).all()
    ]

    from sqlalchemy import or_, and_
    notices = db.query(Notice).filter(
        Notice.is_active == True,
        or_(
            Notice.notice_type == "system",
            and_(Notice.notice_type == "company", Notice.company_id == company_id)
        )
    ).order_by(Notice.created_at.desc()).all()

    return {
        "notices": [
            {
                "id": n.id,
                "title": n.title,
                "content": n.content,
                "notice_type": n.notice_type,
                "created_at": n.created_at.isoformat(),
                "is_read": n.id in read_ids,
            }
            for n in notices
        ]
    }

@router.delete("/{notice_id}")
def delete_notice(
    notice_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="공지를 찾을 수 없습니다")
    notice.is_active = False
    db.commit()
    return {"success": True}