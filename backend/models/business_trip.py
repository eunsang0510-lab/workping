from sqlalchemy import Column, String, DateTime, Index
from datetime import datetime
from database.connection import Base
import uuid


class BusinessTrip(Base):
    __tablename__ = "business_trips"

    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id    = Column(String, nullable=False, index=True)
    user_id       = Column(String, nullable=False, index=True)
    user_name     = Column(String, nullable=True)
    destination   = Column(String, nullable=False)
    purpose       = Column(String, nullable=True)
    start_date    = Column(String, nullable=False)
    end_date      = Column(String, nullable=False)
    status        = Column(String, default="pending")  # pending / approved / rejected
    approved_by   = Column(String, nullable=True)
    approved_at   = Column(DateTime, nullable=True)
    reject_reason = Column(String, nullable=True)
    created_at    = Column(DateTime, default=datetime.now)
    created_by    = Column(String, nullable=True)
    updated_at    = Column(DateTime, nullable=True, onupdate=datetime.now)
    updated_by    = Column(String, nullable=True)
