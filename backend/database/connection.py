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

# Supabase Transaction pooler(PgBouncer) 호환: NullPool로 이중 풀링 방지
is_supabase_pooler = "pooler.supabase.com" in DATABASE_URL
engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool if is_supabase_pooler else None,
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
