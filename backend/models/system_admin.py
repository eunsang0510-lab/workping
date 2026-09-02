from sqlalchemy import Column, String, DateTime
from datetime import datetime
from database.connection import Base
import uuid


class SystemAdmin(Base):
    """시스템 관리자(슈퍼어드민) 이메일 목록. 특정 이메일 하드코딩 대신 DB로 관리하며,
    시스템 관리자가 /superadmin 화면에서 다른 관리자를 추가/삭제할 수 있다."""
    __tablename__ = "system_admins"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String, nullable=True)
