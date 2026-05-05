from sqlalchemy import Column, String, DateTime, Boolean, Integer, Text, Date, ForeignKey
from datetime import datetime
from database.connection import Base
import uuid

class LeaveBalance(Base):
    """직원별 연차 잔여일수"""
    __tablename__ = "leave_balances"

    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id    = Column(String, nullable=False)
    user_id       = Column(String, nullable=False)
    total_days    = Column(Integer, default=15)   # 부여된 총 연차
    used_days     = Column(Integer, default=0)    # 사용한 연차
    year          = Column(Integer, default=lambda: datetime.now().year)
    created_at    = Column(DateTime, default=datetime.now)
    updated_at    = Column(DateTime, default=datetime.now, onupdate=datetime.now)

class Leave(Base):
    """연차 신청"""
    __tablename__ = "leaves"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id  = Column(String, nullable=False)
    user_id     = Column(String, nullable=False)
    user_name   = Column(String, nullable=True)
    leave_type  = Column(String, default="annual")   # annual(연차), half(반차)
    start_date  = Column(String, nullable=False)     # YYYY-MM-DD
    end_date    = Column(String, nullable=False)     # YYYY-MM-DD
    days        = Column(Integer, default=1)         # 사용 일수 (반차=0.5 → 1로 처리)
    is_half     = Column(Boolean, default=False)     # 반차 여부
    reason      = Column(Text, nullable=True)        # 사유
    status      = Column(String, default="pending")  # pending/approved/rejected
    approved_by = Column(String, nullable=True)      # 승인자 uid
    approved_at = Column(DateTime, nullable=True)
    created_at  = Column(DateTime, default=datetime.now)