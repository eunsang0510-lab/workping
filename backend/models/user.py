from sqlalchemy import Column, String, DateTime, Boolean
from datetime import datetime
from database.connection import Base
import uuid


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False)
    name = Column(String)
    company_id = Column(String, nullable=True)
    is_admin = Column(Boolean, default=False)
    plan = Column(String, default="free")
    created_at = Column(DateTime, default=datetime.now)
