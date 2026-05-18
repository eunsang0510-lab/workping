"""
Railway PostgreSQL -> SQL 파일 생성 (CREATE TABLE + INSERT)
Supabase SQL Editor에 붙여넣어 실행하세요.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.schema import CreateTable

RAILWAY_URL = "postgresql://postgres:hJJVCfXzSzUuWGQYnNwPEddFaEeQkLkY@roundhouse.proxy.rlwy.net:52260/railway"

TABLE_ORDER = [
    "users", "companies", "subscriptions", "payments",
    "company_members", "company_locations",
    "teams", "team_members",
    "attendances", "locations",
    "notices", "notice_reads",
    "leave_balances", "leaves",
]

def escape(val):
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    s = str(val).replace("'", "''")
    return f"'{s}'"

print("Railway DB connecting...")
engine = create_engine(RAILWAY_URL)
inspector = inspect(engine)
existing = inspector.get_table_names()

# SQLAlchemy 모델 로드
from database.connection import Base
import models.user, models.location, models.attendance
import models.company, models.subscription, models.notice
import models.leave, models.team

output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "railway_export.sql")
total = 0

with open(output_path, "w", encoding="utf-8") as f:
    f.write("-- Railway -> Supabase migration\n")
    f.write("-- Supabase SQL Editor에 붙여넣고 Run 하세요\n\n")

    # 1. CREATE TABLE 구문 생성
    f.write("-- ===== CREATE TABLES =====\n")
    for table_obj in Base.metadata.sorted_tables:
        ddl = str(CreateTable(table_obj).compile(engine)).strip()
        f.write(f"{ddl};\n\n")
    print("  CREATE TABLE 구문 생성 완료")

    # 2. INSERT 구문 생성
    f.write("\n-- ===== INSERT DATA =====\n")
    with engine.connect() as conn:
        for table in TABLE_ORDER:
            if table not in existing:
                print(f"  SKIP: {table} (없음)")
                continue

            rows = conn.execute(text(f'SELECT * FROM "{table}"')).fetchall()
            if not rows:
                print(f"  SKIP: {table} (데이터 없음)")
                continue

            keys = list(conn.execute(text(f'SELECT * FROM "{table}" LIMIT 0')).keys())
            col_str = ", ".join(f'"{c}"' for c in keys)

            f.write(f"-- {table} ({len(rows)} rows)\n")
            for row in rows:
                vals = ", ".join(escape(v) for v in row)
                f.write(f'INSERT INTO "{table}" ({col_str}) VALUES ({vals});\n')
            f.write("\n")

            print(f"  OK: {table} ({len(rows)}행)")
            total += len(rows)

print(f"\n완료! -> {output_path}")
print(f"총 {total}행 + CREATE TABLE 포함")
