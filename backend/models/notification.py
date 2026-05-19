from sqlalchemy import Column, String, Boolean, DateTime, Text
from database.connection import Base
from datetime import datetime
from uuid import uuid4


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    url = Column(String, default="/dashboard")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
