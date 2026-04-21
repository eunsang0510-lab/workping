from sqlalchemy import Column, String, DateTime, Boolean, Integer
from datetime import datetime
from database.connection import Base
import uuid

class Subscription(Base):
    __tablename__ = "subscriptions"

    id           = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id   = Column(String, nullable=False)
    plan         = Column(String, default="free")   # free / starter / business
    status       = Column(String, default="active") # active / cancelled / expired
    started_at   = Column(DateTime, default=datetime.now)
    expires_at   = Column(DateTime, nullable=True)
    created_at   = Column(DateTime, default=datetime.now)

class Payment(Base):
    __tablename__ = "payments"

    id              = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id      = Column(String, nullable=False)
    order_id        = Column(String, nullable=False, unique=True)
    payment_key     = Column(String, nullable=True)
    plan            = Column(String, nullable=False)
    amount          = Column(Integer, nullable=False)
    status          = Column(String, default="pending")  # pending / done / failed
    created_at      = Column(DateTime, default=datetime.now)