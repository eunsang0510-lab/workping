from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth as firebase_auth
import firebase_admin

security = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Firebase 토큰 검증 의존성"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증 토큰이 필요해요"
        )
    try:
        token = credentials.credentials
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰이에요"
        )

async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict | None:
    """토큰이 없어도 허용 (선택적 인증)"""
    if not credentials:
        return None
    try:
        token = credentials.credentials
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except:
        return None