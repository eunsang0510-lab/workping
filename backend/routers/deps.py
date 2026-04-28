from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth as firebase_auth
from slowapi import Limiter
from slowapi.util import get_remote_address

security = HTTPBearer(auto_error=False)

# 공유 limiter
limiter = Limiter(key_func=get_remote_address)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    print(f"🔍 인증 시도: credentials={credentials}")
    if not credentials or not credentials.credentials:
        print("❌ 토큰 없음 - 401 반환")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증 토큰이 필요해요",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        token = credentials.credentials
        print(f"🔍 토큰 검증 시도: {token[:20]}...")
        decoded = firebase_auth.verify_id_token(token)
        print(f"✅ 토큰 검증 성공: {decoded['uid']}")
        return decoded
    except Exception as e:
        print(f"❌ 토큰 검증 실패: {str(e)}")
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