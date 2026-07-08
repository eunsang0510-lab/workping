from sqlalchemy import Column, String, DateTime
from datetime import datetime
from database.connection import Base
import uuid


class CompanyRegistrationRequest(Base):
    __tablename__ = "company_registration_requests"

    id                  = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_name        = Column(String, nullable=False)
    representative_name = Column(String, nullable=False)
    business_number     = Column(String, nullable=False)
    phone               = Column(String, nullable=True)
    email               = Column(String, nullable=False)
    status              = Column(String, default="pending")  # pending / approved / rejected
    created_at          = Column(DateTime, default=datetime.now)
    created_by          = Column(String, nullable=True)
    updated_at          = Column(DateTime, nullable=True, onupdate=datetime.now)
    updated_by          = Column(String, nullable=True)
