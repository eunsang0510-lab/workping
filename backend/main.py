from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from routers import auth, location, attendance, company, superadmin, payment, notice, leave, team
from database.connection import engine, Base
from models import user, location as location_model
from models import attendance as attendance_model
from models import company as company_model
from models import subscription as subscription_model
from models import notice as notice_model
from models import leave as leave_model
from models import team as team_model
from dotenv import load_dotenv

load_dotenv()

Base.metadata.create_all(bind=engine)

# 기존 테이블에 새 컬럼 추가 (없을 경우에만)
def run_migrations():
    from sqlalchemy import text
    with engine.connect() as conn:
        migrations = [
            "ALTER TABLE company_locations ADD COLUMN IF NOT EXISTS address VARCHAR",
            "ALTER TABLE company_members ADD COLUMN IF NOT EXISTS home_address VARCHAR",
            "ALTER TABLE company_members ADD COLUMN IF NOT EXISTS home_latitude FLOAT",
            "ALTER TABLE company_members ADD COLUMN IF NOT EXISTS home_longitude FLOAT",
            "ALTER TABLE attendances ADD COLUMN IF NOT EXISTS is_remote BOOLEAN DEFAULT FALSE",
        ]
        for sql in migrations:
            try:
                conn.execute(text(sql))
            except Exception as e:
                print(f"Migration skipped: {e}")
        conn.commit()

run_migrations()

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

app = FastAPI(
    title="WorkPing API", description="GPS 기반 근태관리 서비스", version="1.0.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://workping-kappa.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["인증"])
app.include_router(location.router, prefix="/api/location", tags=["위치"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["근태"])
app.include_router(company.router, prefix="/api/company", tags=["기업"])
app.include_router(superadmin.router, prefix="/api/superadmin", tags=["시스템관리자"])
app.include_router(payment.router, prefix="/api/payment", tags=["결제"])
app.include_router(notice.router, prefix="/api/notice", tags=["공지사항"])
app.include_router(leave.router, prefix="/api/leave", tags=["연차관리"])
app.include_router(team.router, prefix="/api/team", tags=["팀관리"])


@app.get("/")
def root():
    return {"message": "WorkPing API 서버 실행 중 🚀"}


@app.get("/health")
def health():
    return {"status": "ok"}