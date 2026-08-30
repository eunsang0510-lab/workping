from sqlalchemy import Column, String, DateTime, Integer, Text, JSON, Index
from datetime import datetime
from database.connection import Base
import uuid


class MeetingProgress(Base):
    """팀(또는 팀 미지정 회사 전체)의 회의 히스토리를 AI가 다시 읽고 정리한 진행 현황 캐시.
    team_id가 None이면 팀이 지정되지 않은 회의들을 모은 결과."""
    __tablename__ = "meeting_progress"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String, nullable=False, index=True)
    team_id = Column(String, nullable=True, index=True)

    overview = Column(Text, nullable=True)              # 전체 진행 개요
    items = Column(JSON, nullable=True)                 # [{topic, status, description}]

    based_on_meeting_count = Column(Integer, nullable=True)
    last_meeting_at = Column(DateTime, nullable=True)    # 반영된 마지막 회의 시각 (새 회의록 여부 판단용)

    generated_at = Column(DateTime, default=datetime.utcnow)
    generated_by = Column(String, nullable=True)
    generated_by_name = Column(String, nullable=True)

    __table_args__ = (
        # team_id가 NULL인 행은 DB 단에서 유일성이 보장되지 않으므로(Postgres는 NULL을 서로 다른 값으로 취급),
        # "스코프당 한 행" 규칙은 라우터에서 조회 후 갱신하는 방식으로 보장한다.
        Index("ix_meeting_progress_scope", "company_id", "team_id"),
    )
