from sqlalchemy import Column, String, DateTime
from datetime import datetime
from database.connection import Base
import uuid


class PageView(Base):
    """화면별 접속 로그 (접속자/접속시간)"""
    __tablename__ = "page_views"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    path       = Column(String, nullable=False, index=True)
    user_id    = Column(String, nullable=True, index=True)
    user_name  = Column(String, nullable=True)
    user_email = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now, index=True)
