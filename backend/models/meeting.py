from sqlalchemy import Column, String, DateTime, Integer, Text, JSON, Index
from datetime import datetime
from database.connection import Base
import uuid


class Meeting(Base):
    """회의록. transcript/ai_summary/ai_todos는 AI가 생성한 원본(수정 불가, diff 비교 기준).
    summary/todos는 사용자가 수정 가능한 현재 버전."""
    __tablename__ = "meetings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String, nullable=True, index=True)  # None이면 개인(비소속) 회의록
    team_id = Column(String, nullable=True, index=True)

    user_id = Column(String, nullable=False, index=True)      # 녹음한 사람
    user_name = Column(String, nullable=True)

    title = Column(String, nullable=False)
    recorded_at = Column(DateTime, nullable=False)             # 회의 일시
    duration_seconds = Column(Integer, nullable=True)

    transcript = Column(Text, nullable=True)                   # STT 원문

    ai_summary = Column(Text, nullable=True)                   # Claude 원본 요약 (불변, diff 기준선)
    summary = Column(Text, nullable=True)                      # 현재 요약 (사용자 수정 가능)

    ai_todos = Column(JSON, nullable=True)                     # [{id, text}] Claude 원본 (불변)
    todos = Column(JSON, nullable=True)                        # [{id, text, done}] 현재 버전

    status = Column(String, nullable=False, default="processing")  # processing / completed / failed
    error_message = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    updated_by = Column(String, nullable=True)
    updated_by_name = Column(String, nullable=True)

    __table_args__ = (
        Index("ix_meetings_company_recorded", "company_id", "recorded_at"),
    )
