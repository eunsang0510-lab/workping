from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, location, attendance, company
from database.connection import engine, Base
from models import user, location as location_model
from models import attendance as attendance_model
from models import company as company_model
from dotenv import load_dotenv

load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="WorkPing API",
    description="GPS 기반 근태관리 서비스",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://workping-kappa.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["인증"])
app.include_router(location.router, prefix="/api/location", tags=["위치"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["근태"])
app.include_router(company.router, prefix="/api/company", tags=["기업"])

@app.get("/")
def root():
    return {"message": "WorkPing API 서버 실행 중 🚀"}

@app.get("/health")
def health():
    return {"status": "ok"}