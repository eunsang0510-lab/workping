from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from routers import auth, location, attendance, company, superadmin, payment
from database.connection import engine, Base
from models import user, location as location_model
from models import attendance as attendance_model
from models import company as company_model
from models import subscription as subscription_model
from dotenv import load_dotenv

load_dotenv()

Base.metadata.create_all(bind=engine)

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


@app.get("/")
def root():
    return {"message": "WorkPing API 서버 실행 중 🚀"}


@app.get("/health")
def health():
    return {"status": "ok"}