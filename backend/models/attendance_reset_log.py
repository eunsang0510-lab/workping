from sqlalchemy import Column, String, DateTime, Integer, Index
from datetime import datetime
from database.connection import Base
import uuid


class AttendanceResetLog(Base):
    """관리자/슈퍼관리자가 특정 직원의 근태(출퇴근·재출근) 기록을 초기화한 이력."""
    __tablename__ = "attendance_reset_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String, nullable=True, index=True)

    target_user_id = Column(String, nullable=False, index=True)
    target_user_name = Column(String, nullable=True)

    performed_by = Column(String, nullable=False, index=True)
    performed_by_name = Column(String, nullable=True)
    performed_by_role = Column(String, nullable=False)  # self / admin / superadmin

    reset_date = Column(String, nullable=False, index=True)  # 초기화 대상 근무일(KST) "YYYY-MM-DD"

    attendance_count = Column(Integer, default=0)
    location_count = Column(Integer, default=0)
    reclock_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index("ix_reset_log_target_date", "target_user_id", "reset_date"),
    )
