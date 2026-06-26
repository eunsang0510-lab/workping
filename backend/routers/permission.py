from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from database.connection import get_db
from models.permission import CustomPermission, UserPermission
from models.company import CompanyMember
from routers.deps import get_current_user, SUPERADMIN_EMAIL
import uuid

router = APIRouter()

AVAILABLE_SCREENS = [
    {"path": "/dashboard", "label": "출퇴근 대시보드"},
    {"path": "/leave", "label": "연차 관리"},
    {"path": "/business-trip", "label": "출장 관리"},
    {"path": "/calendar", "label": "근무 달력"},
    {"path": "/report", "label": "리포트"},
    {"path": "/notice", "label": "공지사항"},
    {"path": "/manager", "label": "팀장 페이지"},
]


def _require_admin(user_id: str, company_id: str, email: str, db: Session):
    if email == SUPERADMIN_EMAIL:
        return
    member = db.query(CompanyMember).filter(
        CompanyMember.user_id == user_id,
        CompanyMember.company_id == company_id,
        CompanyMember.is_admin == True,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="관리자만 접근 가능해요")


class CreatePermissionRequest(BaseModel):
    company_id: str
    name: str
    description: Optional[str] = None
    allowed_screens: List[str] = []


class UpdatePermissionRequest(BaseModel):
    name: str
    description: Optional[str] = None
    allowed_screens: List[str] = []


class AssignPermissionRequest(BaseModel):
    company_id: str
    user_id: str
    permission_id: str


@router.get("/screens")
def get_available_screens():
    return {"screens": AVAILABLE_SCREENS}


@router.get("/company/{company_id}")
def list_company_permissions(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _require_admin(current_user["uid"], company_id, current_user.get("email", ""), db)
    permissions = db.query(CustomPermission).filter(
        CustomPermission.company_id == company_id
    ).all()
    return {
        "permissions": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "allowed_screens": p.allowed_screens or [],
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in permissions
        ]
    }


@router.post("/")
def create_permission(
    req: CreatePermissionRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _require_admin(current_user["uid"], req.company_id, current_user.get("email", ""), db)
    perm = CustomPermission(
        company_id=req.company_id,
        name=req.name,
        description=req.description,
        allowed_screens=req.allowed_screens,
    )
    db.add(perm)
    db.commit()
    db.refresh(perm)
    return {"success": True, "permission": {"id": perm.id, "name": perm.name}}


@router.put("/{permission_id}")
def update_permission(
    permission_id: str,
    req: UpdatePermissionRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    perm = db.query(CustomPermission).filter(CustomPermission.id == permission_id).first()
    if not perm:
        raise HTTPException(status_code=404, detail="권한을 찾을 수 없어요")
    _require_admin(current_user["uid"], perm.company_id, current_user.get("email", ""), db)
    perm.name = req.name
    perm.description = req.description
    perm.allowed_screens = req.allowed_screens
    db.commit()
    return {"success": True}


@router.delete("/{permission_id}")
def delete_permission(
    permission_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    perm = db.query(CustomPermission).filter(CustomPermission.id == permission_id).first()
    if not perm:
        raise HTTPException(status_code=404, detail="권한을 찾을 수 없어요")
    _require_admin(current_user["uid"], perm.company_id, current_user.get("email", ""), db)
    db.query(UserPermission).filter(UserPermission.permission_id == permission_id).delete()
    db.delete(perm)
    db.commit()
    return {"success": True}


@router.get("/users/{company_id}")
def list_users_with_permissions(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _require_admin(current_user["uid"], company_id, current_user.get("email", ""), db)
    members = db.query(CompanyMember).filter(CompanyMember.company_id == company_id).all()
    perms = db.query(CustomPermission).filter(CustomPermission.company_id == company_id).all()
    perm_map = {p.id: p for p in perms}
    user_perms = db.query(UserPermission).filter(UserPermission.company_id == company_id).all()

    up_by_user: dict[str, list] = {}
    for up in user_perms:
        p = perm_map.get(up.permission_id)
        if not p:
            continue
        up_by_user.setdefault(up.user_id, []).append({
            "user_permission_id": up.id,
            "permission_id": up.permission_id,
            "permission_name": p.name,
            "allowed_screens": p.allowed_screens or [],
        })

    return {
        "members": [
            {
                "user_id": m.user_id,
                "user_name": m.user_name,
                "user_email": m.user_email,
                "is_admin": m.is_admin,
                "is_manager": m.is_manager,
                "permissions": up_by_user.get(m.user_id, []),
            }
            for m in members
        ]
    }


@router.post("/assign")
def assign_permission(
    req: AssignPermissionRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _require_admin(current_user["uid"], req.company_id, current_user.get("email", ""), db)
    existing = db.query(UserPermission).filter(
        UserPermission.user_id == req.user_id,
        UserPermission.permission_id == req.permission_id,
        UserPermission.company_id == req.company_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 부여된 권한이에요")
    up = UserPermission(
        company_id=req.company_id,
        user_id=req.user_id,
        permission_id=req.permission_id,
        granted_by=current_user["uid"],
    )
    db.add(up)
    db.commit()
    return {"success": True}


@router.delete("/assign/{user_permission_id}")
def revoke_permission(
    user_permission_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    up = db.query(UserPermission).filter(UserPermission.id == user_permission_id).first()
    if not up:
        raise HTTPException(status_code=404, detail="권한 할당을 찾을 수 없어요")
    _require_admin(current_user["uid"], up.company_id, current_user.get("email", ""), db)
    db.delete(up)
    db.commit()
    return {"success": True}


@router.get("/my/{user_id}/{company_id}")
def get_my_permissions(
    user_id: str,
    company_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    current_uid = current_user["uid"]
    if current_uid != user_id:
        _require_admin(current_uid, company_id, current_user.get("email", ""), db)

    user_perms = db.query(UserPermission).filter(
        UserPermission.user_id == user_id,
        UserPermission.company_id == company_id,
    ).all()
    perm_ids = [up.permission_id for up in user_perms]
    perms = db.query(CustomPermission).filter(CustomPermission.id.in_(perm_ids)).all() if perm_ids else []

    all_allowed: set[str] = set()
    for p in perms:
        for s in (p.allowed_screens or []):
            all_allowed.add(s)

    return {
        "permissions": [
            {"id": p.id, "name": p.name, "allowed_screens": p.allowed_screens or []}
            for p in perms
        ],
        "allowed_screens": list(all_allowed),
    }
