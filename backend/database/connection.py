from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")

# SQLAlchemy는 postgresql:// 필요 (Supabase/Heroku는 postgres:// 반환)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Supabase pooler는 두 모드가 있고 안전하게 다뤄야 하는 방식이 다르다.
# - Transaction 모드(포트 6543): 커넥션이 쿼리마다 다른 서버로 라우팅될 수 있어
#   앱 레벨 풀링과 같이 쓰면 세션 상태가 꼬일 수 있음 → NullPool 필요.
# - Session 모드(포트 5432, 지금 운영 환경): 커넥션 하나가 세션 전체 동안 유지되므로
#   SQLAlchemy 풀로 커넥션을 재사용해도 안전함. 매 요청마다 새 TCP+TLS+인증 핸드셰이크를
#   맺는 비용(리전이 멀수록 더 큼)을 없애기 위해 실제 풀링을 사용한다.
# uvicorn을 단일 워커로 띄우므로(Dockerfile) 워커당 최대 커넥션 수는 pool_size+max_overflow로 고정된다.
is_transaction_pooler = "pooler.supabase.com" in DATABASE_URL and ":6543" in DATABASE_URL

if is_transaction_pooler:
    engine = create_engine(
        DATABASE_URL,
        poolclass=NullPool,
        pool_pre_ping=True,
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,   # 5분마다 연결 갱신 (idle timeout 방지)
        pool_size=10,
        max_overflow=10,
    )
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
