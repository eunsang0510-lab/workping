from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database.connection import Base
from datetime import datetime
import uuid

class Notice(Base):
    __tablename__ = "notices"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    notice_type = Column(String, default="system")  # "system" or "company"
    company_id = Column(String, nullable=True)       # 회사 공지면 company_id, 시스템이면 None
    created_by = Column(String, nullable=False)      # 작성자 uid
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class NoticeRead(Base):
    __tablename__ = "notice_reads"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    notice_id = Column(String, ForeignKey("notices.id"), nullable=False)
    user_id = Column(String, nullable=False)
    read_at = Column(DateTime, default=datetime.utcnow)