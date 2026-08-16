from sqlalchemy import Column, String, DateTime, Float, Index
from datetime import datetime
from database.connection import Base
import uuid


class ReclockRequest(Base):
    """퇴근 후 재출근한 근무 세션. 팀장/관리자 승인이 끝난 시간만 근무시간에 합산된다."""
    __tablename__ = "reclock_requests"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    user_name = Column(String, nullable=True)
    work_date = Column(String, nullable=False, index=True)  # KST 기준 "YYYY-MM-DD" (checkin_at 시점)

    checkin_at = Column(DateTime, nullable=False)
    checkin_address = Column(String, nullable=True)
    checkin_latitude = Column(Float, nullable=True)
    checkin_longitude = Column(Float, nullable=True)

    checkout_at = Column(DateTime, nullable=True)
    checkout_address = Column(String, nullable=True)
    checkout_latitude = Column(Float, nullable=True)
    checkout_longitude = Column(Float, nullable=True)

    status = Column(String, default="in_progress", index=True)  # in_progress/pending/approved/rejected
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    reject_reason = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        Index("ix_reclock_user_date", "user_id", "work_date"),
        Index("ix_reclock_company_status", "company_id", "status"),
    )
