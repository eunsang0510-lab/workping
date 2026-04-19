from fastapi import APIRouter

router = APIRouter()

@router.get("/test")
def test():
    return {"message": "auth router 작동 중"}