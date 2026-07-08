from sqlalchemy import Column, String, DateTime
from datetime import datetime
from database.connection import Base
import uuid

class Team(Base):
    __tablename__ = "teams"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String, nullable=False)
    name       = Column(String, nullable=False)
    manager_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    created_by = Column(String, nullable=True)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.now)
    updated_by = Column(String, nullable=True)

class TeamMember(Base):
    __tablename__ = "team_members"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id    = Column(String, nullable=False)
    user_id    = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    created_by = Column(String, nullable=True)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.now)
    updated_by = Column(String, nullable=True)
