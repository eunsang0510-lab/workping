from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from routers import auth, location, attendance, company, superadmin, payment, notice, leave, team, business_trip, company_request, push
from database.connection import engine, Base, SessionLocal
from models import user, location as location_model
from models import attendance as attendance_model
from models import company as company_model
from models import subscription as subscription_model
from models import notice as notice_model
from models import leave as leave_model
from models import team as team_model
from models import business_trip as business_trip_model
from models import company_request as company_request_model
from models import push_subscription as push_subscription_model
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import asyncio

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
            # 성능 인덱스
            "CREATE INDEX IF NOT EXISTS ix_attendances_user_id ON attendances (user_id)",
            "CREATE INDEX IF NOT EXISTS ix_attendances_recorded_at ON attendances (recorded_at)",
            "CREATE INDEX IF NOT EXISTS ix_attendances_user_recorded ON attendances (user_id, recorded_at)",
            "CREATE INDEX IF NOT EXISTS ix_company_members_company_id ON company_members (company_id)",
            "CREATE INDEX IF NOT EXISTS ix_company_members_user_id ON company_members (user_id)",
            "CREATE INDEX IF NOT EXISTS ix_companies_admin_id ON companies (admin_id)",
            "CREATE INDEX IF NOT EXISTS ix_business_trips_company_id ON business_trips (company_id)",
            "CREATE INDEX IF NOT EXISTS ix_business_trips_user_id ON business_trips (user_id)",
            "CREATE TABLE IF NOT EXISTS company_registration_requests (id VARCHAR PRIMARY KEY, company_name VARCHAR NOT NULL, representative_name VARCHAR NOT NULL, business_number VARCHAR NOT NULL, phone VARCHAR, email VARCHAR NOT NULL, status VARCHAR DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW())",
            "ALTER TABLE company_members ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE",
            # is_admin NULL 보정: 나머지 NULL → FALSE
            "UPDATE company_members SET is_admin = FALSE WHERE is_admin IS NULL",
            # companies.admin_id 기준으로 해당 회사의 관리자 멤버 is_admin=TRUE 동기화
            "UPDATE company_members cm SET is_admin = TRUE FROM companies c WHERE cm.user_id = c.admin_id AND cm.company_id = c.id AND cm.is_admin = FALSE",
        ]
        for sql in migrations:
            try:
                conn.execute(text(sql))
            except Exception as e:
                print(f"Migration skipped: {e}")
        conn.commit()

run_migrations()


async def _keep_db_alive():
    from sqlalchemy import text
    while True:
        await asyncio.sleep(240)
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception as e:
            print(f"[keep-alive] DB ping failed: {e}")


def _send_checkin_reminders():
    """매일 09:00 KST — 오늘 미출근 직원에게 알림."""
    from utils.push import send_push_to_users
    from models.push_subscription import PushSubscription
    from models.attendance import Attendance
    from models.leave import Leave
    from sqlalchemy import func, cast, Date
    from datetime import date, timezone, timedelta

    KST = timezone(timedelta(hours=9))
    today_kst = date.today()  # 스케줄러가 KST 기준으로 실행되므로 date.today() 사용

    db = SessionLocal()
    try:
        # 오늘 출근 기록 있는 user_id
        checked_in = {
            r.user_id for r in db.query(Attendance.user_id).filter(
                Attendance.type == "checkin",
                cast(Attendance.recorded_at, Date) == today_kst,
            ).all()
        }
        # 오늘 연차 승인된 user_id
        on_leave = {
            r.user_id for r in db.query(Leave.user_id).filter(
                Leave.status == "approved",
                Leave.start_date <= str(today_kst),
                Leave.end_date >= str(today_kst),
                Leave.is_half == False,
            ).all()
        }
        # 구독 중이고 출근 안 했고 연차도 아닌 직원
        subs = db.query(PushSubscription).all()
        target_ids = [
            s.user_id for s in subs
            if s.user_id not in checked_in and s.user_id not in on_leave
        ]
        if target_ids:
            send_push_to_users(db, target_ids,
                title="⏰ 출근 알림",
                body="출근하셨나요? 출근 버튼을 눌러주세요!",
                url="/dashboard")
    finally:
        db.close()


def _send_checkout_reminders():
    """매일 18:30 KST — 출근했지만 퇴근 미기록 직원에게 알림."""
    from utils.push import send_push_to_users
    from models.push_subscription import PushSubscription
    from models.attendance import Attendance
    from sqlalchemy import cast, Date
    from datetime import date

    today_kst = date.today()

    db = SessionLocal()
    try:
        checked_in = {
            r.user_id for r in db.query(Attendance.user_id).filter(
                Attendance.type == "checkin",
                cast(Attendance.recorded_at, Date) == today_kst,
            ).all()
        }
        checked_out = {
            r.user_id for r in db.query(Attendance.user_id).filter(
                Attendance.type == "checkout",
                cast(Attendance.recorded_at, Date) == today_kst,
            ).all()
        }
        still_in = checked_in - checked_out
        subs = db.query(PushSubscription).filter(
            PushSubscription.user_id.in_(still_in)
        ).all()
        target_ids = [s.user_id for s in subs]
        if target_ids:
            send_push_to_users(db, target_ids,
                title="🏠 퇴근 알림",
                body="아직 퇴근 처리가 안 됐어요. 퇴근 버튼을 눌러주세요!",
                url="/dashboard")
    finally:
        db.close()


scheduler = AsyncIOScheduler(timezone="Asia/Seoul")
scheduler.add_job(_send_checkin_reminders, CronTrigger(hour=9, minute=0))
scheduler.add_job(_send_checkout_reminders, CronTrigger(hour=18, minute=30))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # VAPID 키 초기화
    db = SessionLocal()
    try:
        from utils.push import init_vapid
        init_vapid(db)
    finally:
        db.close()

    scheduler.start()
    task = asyncio.create_task(_keep_db_alive())
    yield
    scheduler.shutdown(wait=False)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

app = FastAPI(
    title="WorkPing API", description="GPS 기반 근태관리 서비스", version="1.0.0",
    lifespan=lifespan,
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
app.include_router(business_trip.router, prefix="/api/business-trip", tags=["출장관리"])
app.include_router(company_request.router, prefix="/api/company-request", tags=["회사등록신청"])
app.include_router(push.router, prefix="/api/push", tags=["푸시알림"])


@app.get("/")
def root():
    return {"message": "WorkPing API 서버 실행 중 🚀"}


@app.get("/health")
def health():
    return {"status": "ok"}