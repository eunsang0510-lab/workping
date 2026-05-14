"""
회사 등록 신청 샘플 데이터 삽입
실행: python seed_company_requests.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from database.connection import SessionLocal
from models.company_request import CompanyRegistrationRequest

SAMPLES = [
    {
        "company_name": "스마트솔루션즈",
        "representative_name": "김철수",
        "business_number": "123-45-67890",
        "phone": "02-1234-5678",
        "email": "admin@smartsolutions.co.kr",
    },
    {
        "company_name": "그린에너지",
        "representative_name": "박영희",
        "business_number": "234-56-78901",
        "phone": "031-234-5678",
        "email": "ceo@greenenergy.kr",
    },
    {
        "company_name": "퓨처텍코리아",
        "representative_name": "이민수",
        "business_number": "345-67-89012",
        "phone": "010-9876-5432",
        "email": "lee@futuretech.co.kr",
    },
]

db = SessionLocal()
try:
    inserted = 0
    for s in SAMPLES:
        exists = db.query(CompanyRegistrationRequest).filter(
            CompanyRegistrationRequest.email == s["email"]
        ).first()
        if exists:
            print(f"SKIP: {s['company_name']} (이미 존재)")
            continue
        db.add(CompanyRegistrationRequest(**s))
        inserted += 1
        print(f"OK: {s['company_name']}")
    db.commit()
    print(f"\n완료: {inserted}건 삽입")
except Exception as e:
    db.rollback()
    print(f"오류: {e}")
    raise
finally:
    db.close()
