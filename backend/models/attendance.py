from sqlalchemy import Column, String, DateTime, Float, Boolean, Integer, Index
from datetime import datetime
from database.connection import Base
import uuid


class Attendance(Base):
    __tablename__ = "attendances"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    type = Column(String, nullable=False)  # checkin / checkout
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String, nullable=True)
    is_remote = Column(Boolean, default=False)
    recorded_at = Column(DateTime, default=datetime.now, index=True)

    # 외출 상태 — checkin 타입 레코드에만 의미 있음 (해당 근무일의 외출 누계를 이 행에 보관)
    is_outing = Column(Boolean, default=False)
    outing_minutes = Column(Integer, default=0)

    __table_args__ = (
        Index("ix_attendances_user_recorded", "user_id", "recorded_at"),
    )
