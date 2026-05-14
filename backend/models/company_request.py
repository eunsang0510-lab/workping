from sqlalchemy import Column, String, DateTime
from datetime import datetime
from database.connection import Base
import uuid


class CompanyRegistrationRequest(Base):
    __tablename__ = "company_registration_requests"

    id                  = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_name        = Column(String, nullable=False)
    representative_name = Column(String, nullable=False)
    business_number     = Column(String, nullable=False)  # 사업자등록번호 → 초기비밀번호
    phone               = Column(String, nullable=True)
    email               = Column(String, nullable=False)  # 관리자 계정 이메일
    status              = Column(String, default="pending")  # pending / approved / rejected
    created_at          = Column(DateTime, default=datetime.now)
