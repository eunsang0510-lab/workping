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