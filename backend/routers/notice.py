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
    import os
    SUPERADMIN_EMAIL = os.getenv("SYSTEM_ADMIN_EMAIL", "eunsang0510@gmail.com")
    is_superadmin = current_user.get("email") == SUPERADMIN_EMAIL

    if req.notice_type == "system":
        if not is_superadmin:
            raise HTTPException(status_code=403, detail="시스템 공지는 시스템 관리자만 작성할 수 있어요")
    elif req.notice_type == "company":
        if not is_superadmin:
            admin_member = db.query(CompanyMember).filter(
                CompanyMember.user_id == current_user["uid"],
                CompanyMember.company_id == req.company_id,
                CompanyMember.is_admin == True,
            ).first()
            if not admin_member:
                raise HTTPException(status_code=403, detail="해당 회사의 관리자만 공지를 작성할 수 있어요")

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
    if current_user["uid"] != user_id:
        raise HTTPException(status_code=403, detail="본인의 공지만 조회할 수 있어요")

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
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    uid = current_user["uid"]
    existing = db.query(NoticeRead).filter(
        NoticeRead.notice_id == notice_id,
        NoticeRead.user_id == uid
    ).first()
    if not existing:
        read = NoticeRead(notice_id=notice_id, user_id=uid)
        db.add(read)
        db.commit()
    return {"success": True}

@router.get("/list/{user_id}")
def get_notice_list(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    import os
    SUPERADMIN_EMAIL = os.getenv("SYSTEM_ADMIN_EMAIL", "eunsang0510@gmail.com")
    is_superadmin = current_user.get("email") == SUPERADMIN_EMAIL

    if not is_superadmin and current_user["uid"] != user_id:
        raise HTTPException(status_code=403, detail="본인의 공지만 조회할 수 있어요")

    if is_superadmin:
        # 슈퍼어드민은 company_id를 직접 전달
        company_id = user_id
        read_ids: list = []
    else:
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
    import os
    SUPERADMIN_EMAIL = os.getenv("SYSTEM_ADMIN_EMAIL", "eunsang0510@gmail.com")
    is_superadmin = current_user.get("email") == SUPERADMIN_EMAIL

    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="공지를 찾을 수 없습니다")

    is_creator = notice.created_by == current_user["uid"]
    is_company_admin = False
    if notice.company_id:
        is_company_admin = db.query(CompanyMember).filter(
            CompanyMember.user_id == current_user["uid"],
            CompanyMember.company_id == notice.company_id,
            CompanyMember.is_admin == True,
        ).first() is not None

    if not (is_superadmin or is_creator or is_company_admin):
        raise HTTPException(status_code=403, detail="공지를 삭제할 권한이 없어요")

    notice.is_active = False
    db.commit()
    return {"success": True}