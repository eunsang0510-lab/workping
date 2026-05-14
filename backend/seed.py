"""
테스트용 임의 데이터 삽입 스크립트
실행: python seed.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from database.connection import SessionLocal, engine, Base
from models.company import Company, CompanyMember, CompanyLocation
from models.attendance import Attendance
from models.leave import LeaveBalance
import uuid
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))

def uid():
    return str(uuid.uuid4())

def new_id():
    return str(uuid.uuid4())

# ── 회사 & 멤버 정의 ─────────────────────────────────────
COMPANIES = [
    {
        "name": "테크스타트업",
        "leave_enabled": True,
        "location": {"name": "본사", "lat": 37.5040, "lng": 127.0248, "radius": 150, "address": "서울 강남구 역삼동"},
        "members": [
            {"name": "김민준", "email": "minjun.kim@techstartup.co.kr", "is_admin": True},
            {"name": "이서연", "email": "seoyeon.lee@techstartup.co.kr"},
            {"name": "박지호", "email": "jiho.park@techstartup.co.kr"},
            {"name": "최예린", "email": "yerin.choi@techstartup.co.kr"},
            {"name": "정우성", "email": "woosung.jung@techstartup.co.kr"},
        ],
    },
    {
        "name": "카페베이커리",
        "leave_enabled": False,
        "location": {"name": "홍대점", "lat": 37.5563, "lng": 126.9236, "radius": 100, "address": "서울 마포구 홍대입구"},
        "members": [
            {"name": "송하늘", "email": "haneul.song@cafebakery.kr", "is_admin": True},
            {"name": "윤도현", "email": "dohyun.yoon@cafebakery.kr"},
            {"name": "강소희", "email": "sohee.kang@cafebakery.kr"},
            {"name": "임재원", "email": "jaewon.lim@cafebakery.kr"},
        ],
    },
    {
        "name": "한국물류서비스",
        "leave_enabled": True,
        "location": {"name": "물류센터", "lat": 37.3947, "lng": 126.9785, "radius": 200, "address": "경기 안양시 동안구"},
        "members": [
            {"name": "조현우", "email": "hyunwoo.cho@kls.co.kr", "is_admin": True},
            {"name": "배성민", "email": "sungmin.bae@kls.co.kr"},
            {"name": "한지수", "email": "jisu.han@kls.co.kr"},
            {"name": "오승준", "email": "seungjun.oh@kls.co.kr"},
            {"name": "신다은", "email": "daeun.shin@kls.co.kr"},
            {"name": "류민혁", "email": "minhyuk.ryu@kls.co.kr"},
        ],
    },
]

def make_attendance(user_id, days_ago, checkin_hour, checkout_hour, lat, lng, address, is_remote=False):
    """days_ago일 전 출퇴근 레코드 생성"""
    base = datetime.now(KST).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days_ago)
    checkin_kst = base + timedelta(hours=checkin_hour, minutes=__import__("random").randint(0, 29))
    checkout_kst = base + timedelta(hours=checkout_hour, minutes=__import__("random").randint(0, 29))

    checkin_utc = checkin_kst.astimezone(timezone.utc).replace(tzinfo=None)
    checkout_utc = checkout_kst.astimezone(timezone.utc).replace(tzinfo=None)

    return [
        Attendance(id=new_id(), user_id=user_id, type="checkin",
                   latitude=lat, longitude=lng, address=address,
                   is_remote=is_remote, recorded_at=checkin_utc),
        Attendance(id=new_id(), user_id=user_id, type="checkout",
                   latitude=lat, longitude=lng, address=address,
                   is_remote=is_remote, recorded_at=checkout_utc),
    ]

# ── 실행 ─────────────────────────────────────────────────
import random
random.seed(42)

db = SessionLocal()
try:
    inserted_companies = 0
    inserted_members = 0
    inserted_attendances = 0

    for comp_data in COMPANIES:
        # 이미 존재하는 회사 건너뜀
        exists = db.query(Company).filter(Company.name == comp_data["name"]).first()
        if exists:
            print(f"SKIP: {comp_data['name']} (이미 존재)")
            continue

        # 관리자 UID
        admin_uid = uid()

        # 회사 생성
        company = Company(
            id=new_id(),
            name=comp_data["name"],
            admin_id=admin_uid,
            plan="team",
            leave_enabled=comp_data["leave_enabled"],
        )
        db.add(company)
        db.flush()

        # 근무지 위치 추가
        loc = comp_data["location"]
        db.add(CompanyLocation(
            id=new_id(),
            company_id=company.id,
            name=loc["name"],
            latitude=loc["lat"],
            longitude=loc["lng"],
            radius=loc["radius"],
            address=loc["address"],
            is_active=True,
        ))

        # 멤버 생성
        member_uids = []
        for i, m in enumerate(comp_data["members"]):
            member_uid = admin_uid if i == 0 else uid()
            member_uids.append(member_uid)

            db.add(CompanyMember(
                id=new_id(),
                company_id=company.id,
                user_id=member_uid,
                user_email=m["email"],
                user_name=m["name"],
                is_admin=m.get("is_admin", False),
                birth_date="19900101",
            ))

            # 연차 잔액 (leave_enabled 회사만)
            if comp_data["leave_enabled"]:
                db.add(LeaveBalance(
                    id=new_id(),
                    company_id=company.id,
                    user_id=member_uid,
                    total_days=15,
                    used_days=random.choice([0, 1, 2, 3, 5]),
                    year=datetime.now().year,
                ))

            inserted_members += 1

        # 출퇴근 기록 생성 (최근 7일, 주말 제외)
        lat, lng = loc["lat"], loc["lng"]
        addr = loc["address"]
        for member_uid in member_uids:
            for days_ago in range(0, 8):
                day = datetime.now(KST) - timedelta(days=days_ago)
                if day.weekday() >= 5:   # 토·일 스킵
                    continue
                if days_ago == 0:        # 오늘은 출근만
                    checkin_kst = day.replace(hour=random.randint(8, 9), minute=random.randint(0, 30), second=0, microsecond=0)
                    checkin_utc = checkin_kst.astimezone(timezone.utc).replace(tzinfo=None)
                    is_remote = random.random() < 0.2
                    db.add(Attendance(
                        id=new_id(), user_id=member_uid, type="checkin",
                        latitude=lat, longitude=lng, address=addr,
                        is_remote=is_remote, recorded_at=checkin_utc,
                    ))
                    inserted_attendances += 1
                else:
                    records = make_attendance(
                        member_uid, days_ago,
                        checkin_hour=random.randint(8, 9),
                        checkout_hour=random.randint(17, 19),
                        lat=lat, lng=lng, address=addr,
                        is_remote=random.random() < 0.2,
                    )
                    db.add_all(records)
                    inserted_attendances += len(records)

        db.commit()
        inserted_companies += 1
        print(f"OK: {comp_data['name']} (멤버 {len(comp_data['members'])}명)")

    print(f"\n✅ 완료!")
    print(f"   회사: {inserted_companies}개")
    print(f"   멤버: {inserted_members}명")
    print(f"   출퇴근 기록: {inserted_attendances}건")

except Exception as e:
    db.rollback()
    print(f"❌ 오류: {e}")
    raise
finally:
    db.close()
