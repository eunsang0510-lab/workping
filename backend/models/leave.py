from sqlalchemy import Column, String, DateTime, Boolean, Integer, Float, Text, ForeignKey
from datetime import datetime
from database.connection import Base
import uuid

class LeaveBalance(Base):
    """직원별 연차 잔여일수"""
    __tablename__ = "leave_balances"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String, nullable=False)
    user_id    = Column(String, nullable=False)
    total_days = Column(Integer, default=15)
    used_days  = Column(Float, default=0)
    year       = Column(Integer, default=lambda: datetime.now().year)
    created_at = Column(DateTime, default=datetime.now)
    created_by = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    updated_by = Column(String, nullable=True)

class Leave(Base):
    """연차 신청"""
    __tablename__ = "leaves"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id  = Column(String, nullable=True)
    user_id     = Column(String, nullable=False)
    user_name   = Column(String, nullable=True)
    leave_type  = Column(String, default="annual")
    start_date  = Column(String, nullable=False)
    end_date    = Column(String, nullable=False)
    days        = Column(Integer, default=1)
    is_half     = Column(Boolean, default=False)
    reason      = Column(Text, nullable=True)
    status      = Column(String, default="pending")  # pending/approved/rejected/cancelled/cancel_requested
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at  = Column(DateTime, default=datetime.now)
    created_by  = Column(String, nullable=True)
    updated_at  = Column(DateTime, nullable=True, onupdate=datetime.now)
    updated_by  = Column(String, nullable=True)
