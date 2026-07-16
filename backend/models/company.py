from sqlalchemy import Column, String, DateTime, Boolean, Float, Integer, Index
from datetime import datetime
from database.connection import Base
import uuid

class Company(Base):
    __tablename__ = "companies"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name       = Column(String, nullable=False)
    admin_id   = Column(String, nullable=False, index=True)
    plan       = Column(String, default="team")
    leave_enabled           = Column(Boolean, default=False)
    leave_approval_required = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    created_by = Column(String, nullable=True)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.now)
    updated_by = Column(String, nullable=True)

class CompanyMember(Base):
    __tablename__ = "company_members"

    id             = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id     = Column(String, nullable=False, index=True)
    user_id        = Column(String, nullable=False, index=True)
    user_email     = Column(String, nullable=False)
    user_name      = Column(String, nullable=True)
    birth_date     = Column(String, nullable=True)
    phone          = Column(String, nullable=True)
    is_admin              = Column(Boolean, default=False)
    is_manager            = Column(Boolean, default=False)
    force_password_change = Column(Boolean, default=False)
    home_address   = Column(String, nullable=True)
    home_latitude  = Column(Float, nullable=True)
    home_longitude = Column(Float, nullable=True)
    created_at     = Column(DateTime, default=datetime.now)
    created_by     = Column(String, nullable=True)
    updated_at     = Column(DateTime, nullable=True, onupdate=datetime.now)
    updated_by     = Column(String, nullable=True)

class CompanyLocation(Base):
    __tablename__ = "company_locations"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String, nullable=False, index=True)
    name       = Column(String, nullable=False)
    latitude   = Column(Float, nullable=False)
    longitude  = Column(Float, nullable=False)
    radius     = Column(Integer, default=100)
    is_active  = Column(Boolean, default=True)
    address    = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    created_by = Column(String, nullable=True)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.now)
    updated_by = Column(String, nullable=True)
