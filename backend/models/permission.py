from sqlalchemy import Column, String, DateTime, JSON
from datetime import datetime
from database.connection import Base
import uuid


class CustomPermission(Base):
    __tablename__ = "custom_permissions"

    id              = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id      = Column(String, nullable=False, index=True)
    name            = Column(String, nullable=False)
    description     = Column(String, nullable=True)
    allowed_screens = Column(JSON, default=list)
    created_at      = Column(DateTime, default=datetime.now)


class UserPermission(Base):
    __tablename__ = "user_permissions"

    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id    = Column(String, nullable=False, index=True)
    user_id       = Column(String, nullable=False, index=True)
    permission_id = Column(String, nullable=False, index=True)
    granted_by    = Column(String, nullable=False)
    granted_at    = Column(DateTime, default=datetime.now)
