from sqlalchemy import Column, String, DateTime, Boolean, Float, Integer, Index
from datetime import datetime
from database.connection import Base
import uuid

class Company(Base):
    __tablename__ = "companies"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name       = Column(String, nullable=False)
    admin_id   = Column(String, nullable=False, index=True)
    plan       = Column(String, default="team")
    leave_enabled           = Column(Boolean, default=False)
    leave_approval_required = Column(Boolean, default=True)
    evaluation_enabled      = Column(Boolean, default=False)
    max_weekly_minutes      = Column(Integer, default=52 * 60)  # 주 최대 근로시간 기준(분), 근로시간 패턴 알림에 사용
    max_monthly_minutes     = Column(Integer, nullable=True)    # 월 최대 근로시간 기준(분), 미설정 시 월 기준 검사 안 함
    created_at = Column(DateTime, default=datetime.now)
    created_by = Column(String, nullable=True)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.now)
    updated_by = Column(String, nullable=True)

class CompanyMember(Base):
    __tablename__ = "company_members"

    id             = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id     = Column(String, nullable=False, index=True)
    user_id        = Column(String, nullable=False, index=True)
    user_email     = Column(String, nullable=False)
    user_name      = Column(String, nullable=True)
    birth_date     = Column(String, nullable=True)
    phone          = Column(String, nullable=True)
    job_title      = Column(String, nullable=True)  # 본인이 직접 입력하는 직무 (평가 AI 분석용)
    org_level      = Column(Integer, nullable=True)  # 조직도 레벨 (숫자, 평가자 엑셀 업로드로 설정)
    is_admin              = Column(Boolean, default=False)
    is_manager            = Column(Boolean, default=False)
    force_password_change = Column(Boolean, default=False)
    home_address   = Column(String, nullable=True)
    home_latitude  = Column(Float, nullable=True)
    home_longitude = Column(Float, nullable=True)
    created_at     = Column(DateTime, default=datetime.now)
    created_by     = Column(String, nullable=True)
    updated_at     = Column(DateTime, nullable=True, onupdate=datetime.now)
    updated_by     = Column(String, nullable=True)

class CompanyLocation(Base):
    __tablename__ = "company_locations"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String, nullable=False, index=True)
    name       = Column(String, nullable=False)
    latitude   = Column(Float, nullable=False)
    longitude  = Column(Float, nullable=False)
    radius     = Column(Integer, default=100)
    is_active  = Column(Boolean, default=True)
    address    = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    created_by = Column(String, nullable=True)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.now)
    updated_by = Column(String, nullable=True)
