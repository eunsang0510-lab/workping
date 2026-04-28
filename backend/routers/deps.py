from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth as firebase_auth

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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"유효하지 않은 토큰이에요: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

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