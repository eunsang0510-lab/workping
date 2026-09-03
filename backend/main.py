from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from limiter import limiter
from routers import auth, location, attendance, company, superadmin, payment, notice, leave, team, business_trip, company_request, push, notification, permission, internal, page_view, reclock, outing, meeting, evaluation
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
from models import notification as notification_model
from models import permission as permission_model
from models import page_view as page_view_model
from models import reclock as reclock_model
from models import attendance_reset_log as attendance_reset_log_model
from models import member_deletion_log as member_deletion_log_model
from models import outing as outing_model
from models import meeting as meeting_model
from models import meeting_progress as meeting_progress_model
from models import evaluation as evaluation_model
from models import system_admin as system_admin_model
import os
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
    migrations = [
        "ALTER TABLE company_locations ADD COLUMN IF NOT EXISTS address VARCHAR",
        "ALTER TABLE company_members ADD COLUMN IF NOT EXISTS home_address VARCHAR",
        "ALTER TABLE company_members ADD COLUMN IF NOT EXISTS home_latitude FLOAT",
        "ALTER TABLE company_members ADD COLUMN IF NOT EXISTS home_longitude FLOAT",
        "ALTER TABLE attendances ADD COLUMN IF NOT EXISTS is_remote BOOLEAN DEFAULT FALSE",
        "ALTER TABLE attendances ADD COLUMN IF NOT EXISTS is_outing BOOLEAN DEFAULT FALSE",
        "ALTER TABLE attendances ADD COLUMN IF NOT EXISTS outing_minutes INTEGER DEFAULT 0",
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
        # 권한 관리 테이블
        "CREATE TABLE IF NOT EXISTS custom_permissions (id VARCHAR PRIMARY KEY, company_id VARCHAR NOT NULL, name VARCHAR NOT NULL, description VARCHAR, allowed_screens JSON, created_at TIMESTAMP DEFAULT NOW())",
        "CREATE INDEX IF NOT EXISTS ix_custom_permissions_company_id ON custom_permissions (company_id)",
        "CREATE TABLE IF NOT EXISTS user_permissions (id VARCHAR PRIMARY KEY, company_id VARCHAR NOT NULL, user_id VARCHAR NOT NULL, permission_id VARCHAR NOT NULL, granted_by VARCHAR NOT NULL, granted_at TIMESTAMP DEFAULT NOW())",
        "CREATE INDEX IF NOT EXISTS ix_user_permissions_company_id ON user_permissions (company_id)",
        "CREATE INDEX IF NOT EXISTS ix_user_permissions_user_id ON user_permissions (user_id)",
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS leave_approval_required BOOLEAN DEFAULT TRUE",
        # business_trips: 승인/반려 관련 컬럼 (모델에만 있고 기존 테이블에 없을 수 있음)
        "ALTER TABLE business_trips ADD COLUMN IF NOT EXISTS approved_by VARCHAR",
        "ALTER TABLE business_trips ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP",
        "ALTER TABLE business_trips ADD COLUMN IF NOT EXISTS reject_reason VARCHAR",
        # company_members: 팀장 여부 컬럼
        "ALTER TABLE company_members ADD COLUMN IF NOT EXISTS is_manager BOOLEAN DEFAULT FALSE",
        "ALTER TABLE company_members ADD COLUMN IF NOT EXISTS phone VARCHAR",
        # ── 감사 컬럼 (입력자/입력시간/수정자/수정시간) ──────────────────────
        # companies
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_by VARCHAR",
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS updated_by VARCHAR",
        # company_members
        "ALTER TABLE company_members ADD COLUMN IF NOT EXISTS created_by VARCHAR",
        "ALTER TABLE company_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE company_members ADD COLUMN IF NOT EXISTS updated_by VARCHAR",
        # company_locations
        "ALTER TABLE company_locations ADD COLUMN IF NOT EXISTS created_by VARCHAR",
        "ALTER TABLE company_locations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE company_locations ADD COLUMN IF NOT EXISTS updated_by VARCHAR",
        # leaves
        "ALTER TABLE leaves ADD COLUMN IF NOT EXISTS created_by VARCHAR",
        "ALTER TABLE leaves ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE leaves ADD COLUMN IF NOT EXISTS updated_by VARCHAR",
        # leave_balances
        "ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS created_by VARCHAR",
        "ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS updated_by VARCHAR",
        # business_trips
        "ALTER TABLE business_trips ADD COLUMN IF NOT EXISTS created_by VARCHAR",
        "ALTER TABLE business_trips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE business_trips ADD COLUMN IF NOT EXISTS updated_by VARCHAR",
        # teams
        "ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_by VARCHAR",
        "ALTER TABLE teams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE teams ADD COLUMN IF NOT EXISTS updated_by VARCHAR",
        # team_members
        "ALTER TABLE team_members ADD COLUMN IF NOT EXISTS created_by VARCHAR",
        "ALTER TABLE team_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE team_members ADD COLUMN IF NOT EXISTS updated_by VARCHAR",
        # custom_permissions
        "ALTER TABLE custom_permissions ADD COLUMN IF NOT EXISTS created_by VARCHAR",
        "ALTER TABLE custom_permissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE custom_permissions ADD COLUMN IF NOT EXISTS updated_by VARCHAR",
        # user_permissions
        "ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS updated_by VARCHAR",
        # notices
        "ALTER TABLE notices ADD COLUMN IF NOT EXISTS updated_by VARCHAR",
        # subscriptions
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_by VARCHAR",
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_by VARCHAR",
        # payments
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_by VARCHAR",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_by VARCHAR",
        # users
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by VARCHAR",
        # company_registration_requests
        "ALTER TABLE company_registration_requests ADD COLUMN IF NOT EXISTS created_by VARCHAR",
        "ALTER TABLE company_registration_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE company_registration_requests ADD COLUMN IF NOT EXISTS updated_by VARCHAR",
        # 화면 접속 로그
        "CREATE TABLE IF NOT EXISTS page_views (id VARCHAR PRIMARY KEY, path VARCHAR NOT NULL, user_id VARCHAR, user_name VARCHAR, user_email VARCHAR, created_at TIMESTAMP DEFAULT NOW())",
        "CREATE INDEX IF NOT EXISTS ix_page_views_path ON page_views (path)",
        "CREATE INDEX IF NOT EXISTS ix_page_views_user_id ON page_views (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_page_views_created_at ON page_views (created_at)",
        # 조회 성능 개선 — 그동안 인덱스가 없던 테이블 보강
        "CREATE INDEX IF NOT EXISTS ix_company_locations_company_id ON company_locations (company_id)",
        "CREATE INDEX IF NOT EXISTS ix_leaves_company_id ON leaves (company_id)",
        "CREATE INDEX IF NOT EXISTS ix_leaves_user_id ON leaves (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_leaves_status ON leaves (status)",
        "CREATE INDEX IF NOT EXISTS ix_leaves_start_date ON leaves (start_date)",
        "CREATE INDEX IF NOT EXISTS ix_leave_balances_company_id ON leave_balances (company_id)",
        "CREATE INDEX IF NOT EXISTS ix_leave_balances_user_id ON leave_balances (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_leave_balances_year ON leave_balances (year)",
        "CREATE INDEX IF NOT EXISTS ix_teams_company_id ON teams (company_id)",
        "CREATE INDEX IF NOT EXISTS ix_teams_manager_id ON teams (manager_id)",
        "CREATE INDEX IF NOT EXISTS ix_team_members_team_id ON team_members (team_id)",
        "CREATE INDEX IF NOT EXISTS ix_team_members_user_id ON team_members (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_notices_company_id ON notices (company_id)",
        "CREATE INDEX IF NOT EXISTS ix_notice_reads_notice_id ON notice_reads (notice_id)",
        "CREATE INDEX IF NOT EXISTS ix_notice_reads_user_id ON notice_reads (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_subscriptions_company_id ON subscriptions (company_id)",
        "CREATE INDEX IF NOT EXISTS ix_payments_company_id ON payments (company_id)",
        "CREATE INDEX IF NOT EXISTS ix_locations_user_id ON locations (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_reset_logs_company_id ON attendance_reset_logs (company_id)",
        "CREATE INDEX IF NOT EXISTS ix_reset_logs_performed_by ON attendance_reset_logs (performed_by)",
        "CREATE INDEX IF NOT EXISTS ix_member_del_logs_performed_by ON member_deletion_logs (performed_by)",
        "CREATE INDEX IF NOT EXISTS ix_outings_user_id ON outings (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_outings_company_id ON outings (company_id)",
        # Supabase 보안 권고: public 스키마 테이블이 PostgREST로 노출되는데 RLS 미설정
        # (백엔드는 postgres 소유자 role로 직접 연결해 앱 레벨에서 인가를 처리하므로 RLS를 켜도 영향 없음.
        #  정책을 별도로 만들지 않아 anon/authenticated의 PostgREST 접근만 기본 차단됨)
        "ALTER TABLE users ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE companies ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE payments ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE company_members ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE company_locations ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE teams ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE team_members ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE attendances ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE locations ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE notices ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE notice_reads ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE leaves ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE business_trips ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE company_registration_requests ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE custom_permissions ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE page_views ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE notifications ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE reclock_requests ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE attendance_reset_logs ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE member_deletion_logs ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE outings ENABLE ROW LEVEL SECURITY",
        # 평가(인사평가) 기능 — 기존 테이블에 추가된 컬럼
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS evaluation_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE company_members ADD COLUMN IF NOT EXISTS job_title VARCHAR",
        "ALTER TABLE company_members ADD COLUMN IF NOT EXISTS org_level INTEGER",
        "ALTER TABLE teams ADD COLUMN IF NOT EXISTS parent_team_id VARCHAR",
        # 평가자 매핑을 사이클(평가코드)별로 관리하도록 변경 — 기존 회사 전체 공용 매핑 행은
        # cycle_id가 NULL로 남아 더 이상 조회되지 않는(사실상 폐기되는) 테스트 데이터임
        "ALTER TABLE evaluator_assignments ADD COLUMN IF NOT EXISTS cycle_id VARCHAR",
        # 평가/회의록 관련 신규 테이블 RLS (Supabase 권고 — 앱은 postgres 소유자 role로 연결해 영향 없음)
        "ALTER TABLE evaluator_assignments ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE evaluation_cycles ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE evaluation_entries ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE evaluation_results ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE one_on_one_sessions ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE meetings ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE meeting_progress ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE meeting_usage_logs ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY",
    ]
    # 각 migration을 개별 트랜잭션으로 실행 — 한 건 실패해도 다음 건은 정상 실행
    for sql in migrations:
        try:
            with engine.begin() as conn:
                conn.execute(text(sql))
        except Exception as e:
            print(f"Migration skipped: {e}")

run_migrations()


def seed_system_admins():
    """system_admins 테이블이 비어있으면 부트스트랩 관리자 계정을 시드한다.
    이후로는 /superadmin 화면에서 시스템 관리자가 직접 추가/삭제한다."""
    from models.system_admin import SystemAdmin
    from utils.admin import BOOTSTRAP_SUPERADMIN_EMAILS

    db = SessionLocal()
    try:
        if db.query(SystemAdmin).count() == 0:
            for email in BOOTSTRAP_SUPERADMIN_EMAILS:
                db.add(SystemAdmin(email=email.strip().lower(), created_by="bootstrap"))
            db.commit()
    except Exception as e:
        print(f"System admin seed skipped: {e}")
    finally:
        db.close()

seed_system_admins()


async def _keep_db_alive():
    from sqlalchemy import text
    while True:
        await asyncio.sleep(50)   # 50초마다 — DB idle timeout보다 훨씬 짧게
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


_warned_managers_this_week: dict = {}  # user_id -> week_start(ISO) — 주 1회만 팀장/관리자에게 경고


def _send_52h_warning():
    """30분마다 — 주 52시간까지 3시간 이내로 남은(또는 이미 초과한) 근무 중인 직원에게 반복 알림,
    해당 조직 팀장 + 회사 관리자에게는 주 1회 경고."""
    from utils.push import send_push_to_users
    from utils.team import get_managers_and_admins
    from models.attendance import Attendance
    from models.company import CompanyMember
    from models.reclock import ReclockRequest
    from routers.attendance import compute_weekly_report
    from sqlalchemy import cast, Date
    from datetime import date

    KST = timezone(timedelta(hours=9))
    today_kst = date.today()
    now_utc = datetime.utcnow()

    db = SessionLocal()
    try:
        # 오늘 출근했지만 아직 퇴근 안 한 사용자 (정상 근무 중)
        checked_in = {
            r.user_id: r.recorded_at for r in db.query(Attendance).filter(
                Attendance.type == "checkin",
                cast(Attendance.recorded_at, Date) == today_kst,
            ).all()
        }
        checked_out_ids = {
            r.user_id for r in db.query(Attendance.user_id).filter(
                Attendance.type == "checkout",
                cast(Attendance.recorded_at, Date) == today_kst,
            ).all()
        }
        still_working = {uid: t for uid, t in checked_in.items() if uid not in checked_out_ids}

        # 재출근 중(in_progress)인 사용자
        active_reclocks = db.query(ReclockRequest).filter(ReclockRequest.status == "in_progress").all()

        target_user_ids = set(still_working.keys()) | {r.user_id for r in active_reclocks}
        if not target_user_ids:
            return

        week_start = today_kst - timedelta(days=today_kst.weekday())
        week_key = week_start.isoformat()

        for user_id in target_user_ids:
            report = compute_weekly_report(db, user_id, week_start)
            projected_minutes = report["total_minutes"]

            # 진행 중인 세션의 현재까지 경과 시간을 더해 임박 여부를 미리 체크
            if user_id in still_working:
                elapsed = int((now_utc - still_working[user_id]).total_seconds() / 60)
                projected_minutes += max(0, elapsed)
            for r in active_reclocks:
                if r.user_id == user_id:
                    elapsed = int((now_utc - r.checkin_at).total_seconds() / 60)
                    projected_minutes += max(0, elapsed)

            remaining = 52 * 60 - projected_minutes
            if remaining > 180:
                continue  # 3시간 이내로 임박하지 않음

            member = db.query(CompanyMember).filter(CompanyMember.user_id == user_id).first()

            if remaining <= 0:
                body = "⚠️ 주 52시간을 초과했어요. 근무를 마무리해주세요."
            else:
                body = f"⚠️ 주 52시간까지 {remaining // 60}시간 {remaining % 60}분 남았어요."
            send_push_to_users(db, [user_id], title="⏰ 주간 근무시간 안내", body=body, url="/dashboard")

            if member and _warned_managers_this_week.get(user_id) != week_key:
                targets = get_managers_and_admins(db, member.company_id, user_id)
                targets = [t for t in targets if t != user_id]
                if targets:
                    send_push_to_users(
                        db, targets,
                        title="🚨 주 52시간 초과 위험",
                        body=f"{member.user_name or user_id}님이 주 52시간을 초과할 가능성이 있어요.",
                        url="/manager",
                    )
                _warned_managers_this_week[user_id] = week_key
    finally:
        db.close()


scheduler = AsyncIOScheduler(timezone="Asia/Seoul")
scheduler.add_job(_send_checkin_reminders, CronTrigger(hour=9, minute=0))
scheduler.add_job(_send_checkout_reminders, CronTrigger(hour=18, minute=30))
scheduler.add_job(_send_52h_warning, CronTrigger(minute="*/30"))


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


app = FastAPI(
    title="WorkPing API", description="GPS 기반 근태관리 서비스", version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

_allowed_origins = ["https://workping-kappa.vercel.app"]
if os.getenv("ENV") == "development":
    _allowed_origins += ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
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
app.include_router(notification.router, prefix="/api/notifications", tags=["알림"])
app.include_router(permission.router, prefix="/api/permissions", tags=["권한관리"])
app.include_router(internal.router, prefix="/internal", tags=["내부서비스"])
app.include_router(page_view.router, prefix="/api/page-view", tags=["접속로그"])
app.include_router(reclock.router, prefix="/api/reclock", tags=["재출근"])
app.include_router(outing.router, prefix="/api/outing", tags=["외출"])
app.include_router(meeting.router, prefix="/api/meeting", tags=["회의록"])
app.include_router(evaluation.router, prefix="/api/evaluation", tags=["평가"])


@app.get("/")
def root():
    return {"message": "WorkPing API 서버 실행 중 🚀"}


@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}
    except Exception as e:
        print(f"[HEALTH] DB 오류: {e}")
        return {"status": "ok", "db": "error"}