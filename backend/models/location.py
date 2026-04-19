from sqlalchemy import Column, String, Float, DateTime
from datetime import datetime
from database.connection import Base
import uuid

class Location(Base):
    __tablename__ = "locations"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id    = Column(String, nullable=False)
    latitude   = Column(Float, nullable=False)
    longitude  = Column(Float, nullable=False)
    place_name = Column(String, nullable=True)
    place_type = Column(String, nullable=True)
    recorded_at = Column(DateTime, default=datetime.now)