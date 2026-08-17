from sqlalchemy import Column, String, DateTime, Integer, Index
from datetime import datetime
from database.connection import Base
import uuid


class Outing(Base):
    """근무 중 외출 기록. 복귀 시각이 없으면 진행 중인 외출."""
    __tablename__ = "outings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    attendance_id = Column(String, nullable=False, index=True)  # 연결된 출근(checkin) Attendance.id
    user_id = Column(String, nullable=False, index=True)
    company_id = Column(String, nullable=True, index=True)

    start_at = Column(DateTime, nullable=False)
    end_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_outings_attendance_end", "attendance_id", "end_at"),
    )
