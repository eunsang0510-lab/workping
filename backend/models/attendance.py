from sqlalchemy import Column, String, DateTime, Float, Boolean
from datetime import datetime
from database.connection import Base
import uuid


class Attendance(Base):
    __tablename__ = "attendances"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False)
    type = Column(String, nullable=False)  # checkin / checkout
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String, nullable=True)
    is_remote = Column(Boolean, default=False)
    recorded_at = Column(DateTime, default=datetime.now)
