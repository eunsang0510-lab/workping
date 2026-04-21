from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.connection import get_db
from models.user import User
from models.company import CompanyMember

router = APIRouter()

SYSTEM_ADMIN_EMAIL = "eunsang0510@gmail.com"

class UpsertUserRequest(BaseModel):
    uid: str
    email: str
    name: str = ""

@router.post("/upsert")
def upsert_user(req: UpsertUserRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()

    if not user:
        user = User(
            id=req.uid,
            email=req.email,
            name=req.name,
        )
        db.add(user)
    else:
        user.name = req.name or user.name

    db.commit()

    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == req.uid,
        CompanyMember.is_admin == True
    ).first()

    is_admin = member is not None or req.email == SYSTEM_ADMIN_EMAIL

    return {
        "success": True,
        "user_id": user.id,
        "email": user.email,
        "name": user.name,
        "is_admin": is_admin,
    }

@router.get("/admin-check/{user_id}")
def check_admin(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user and user.email == SYSTEM_ADMIN_EMAIL:
        return {"is_admin": True}

    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == user_id,
        CompanyMember.is_admin == True
    ).first()
    return {"is_admin": member is not None}

@router.get("/test")
def test():
    return {"message": "auth router 작동 중"}