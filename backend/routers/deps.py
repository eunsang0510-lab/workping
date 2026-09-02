from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from firebase_admin import auth as firebase_auth
from database.connection import get_db
from utils.admin import is_superadmin_email

security = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증 토큰이 필요해요",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        token = credentials.credentials
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except Exception as e:
        print(f"[AUTH] 토큰 검증 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증에 실패했어요",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_superadmin(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not is_superadmin_email(db, current_user.get("email")):
        raise HTTPException(status_code=403, detail="슈퍼어드민만 접근 가능해요")
    return current_user


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict | None:
    if not credentials:
        return None
    try:
        token = credentials.credentials
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except:
        return None