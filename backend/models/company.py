from sqlalchemy import Column, String, DateTime, Boolean
from datetime import datetime
from database.connection import Base
import uuid

class Company(Base):
    __tablename__ = "companies"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name       = Column(String, nullable=False)
    admin_id   = Column(String, nullable=False)
    plan       = Column(String, default="team")
    created_at = Column(DateTime, default=datetime.now)

class CompanyMember(Base):
    __tablename__ = "company_members"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String, nullable=False)
    user_id    = Column(String, nullable=False)
    user_email = Column(String, nullable=False)
    user_name  = Column(String, nullable=True)
    is_admin   = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)