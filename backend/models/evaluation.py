from sqlalchemy import Column, String, DateTime, Float, Text, JSON, Index
from datetime import datetime
from database.connection import Base
import uuid


class EvaluatorAssignment(Base):
    """평가자-피평가자 매핑 (1:1). 조직도(팀장) 기준으로 자동 생성되고, 관리자가 개별 조정 가능."""
    __tablename__ = "evaluator_assignments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String, nullable=False, index=True)
    evaluatee_user_id = Column(String, nullable=False, index=True)
    evaluator_user_id = Column(String, nullable=False, index=True)
    source = Column(String, nullable=False, default="manual")  # auto(조직도 자동시드) / manual(관리자 조정)

    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String, nullable=True)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    updated_by = Column(String, nullable=True)

    __table_args__ = (
        Index("ix_evaluator_assignments_scope", "company_id", "evaluatee_user_id"),
    )


class EvaluationCycle(Base):
    """평가 코드(기준정보): 대상 기간, 계획/실적/평가 입력기간, 등급별 분포 비율."""
    __tablename__ = "evaluation_cycles"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String, nullable=False, index=True)
    code = Column(String, nullable=False)
    name = Column(String, nullable=False)

    plan_start = Column(String, nullable=True)     # "YYYY-MM-DD"
    plan_end = Column(String, nullable=True)
    actual_start = Column(String, nullable=True)
    actual_end = Column(String, nullable=True)
    review_start = Column(String, nullable=True)
    review_end = Column(String, nullable=True)

    grade_distribution = Column(JSON, nullable=True)  # [{"grade": "S", "ratio": 10}, ...]

    status = Column(String, nullable=False, default="draft")  # draft / active / closed

    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String, nullable=True)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    updated_by = Column(String, nullable=True)


class EvaluationEntry(Base):
    """사람 x 카테고리(성과/역량)별 계획-실적 1건."""
    __tablename__ = "evaluation_entries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    cycle_id = Column(String, nullable=False, index=True)
    company_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)          # 피평가자
    evaluator_id = Column(String, nullable=False, index=True)     # 평가자 (사이클 시작 시점 스냅샷)
    category = Column(String, nullable=False)                     # performance / competency

    plan_content = Column(Text, nullable=True)
    plan_status = Column(String, nullable=False, default="draft")  # draft/submitted/approved/feedback
    plan_feedback = Column(Text, nullable=True)
    plan_submitted_at = Column(DateTime, nullable=True)
    plan_reviewed_at = Column(DateTime, nullable=True)
    plan_reviewed_by = Column(String, nullable=True)

    actual_content = Column(Text, nullable=True)
    actual_status = Column(String, nullable=False, default="draft")
    actual_feedback = Column(Text, nullable=True)
    actual_submitted_at = Column(DateTime, nullable=True)
    actual_reviewed_at = Column(DateTime, nullable=True)
    actual_reviewed_by = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_evaluation_entries_cycle_user", "cycle_id", "user_id"),
        Index("ix_evaluation_entries_cycle_evaluator", "cycle_id", "evaluator_id"),
    )


class EvaluationResult(Base):
    """사람 x 사이클당 최종 점수/등급 1건. 두 EvaluationEntry(성과/역량)의 실적이 모두 승인돼야 부여 가능."""
    __tablename__ = "evaluation_results"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    cycle_id = Column(String, nullable=False, index=True)
    company_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    evaluator_id = Column(String, nullable=False, index=True)

    score = Column(Float, nullable=True)
    grade = Column(String, nullable=True)

    graded_at = Column(DateTime, nullable=True)
    graded_by = Column(String, nullable=True)

    ai_career_analysis = Column(Text, nullable=True)
    ai_career_generated_at = Column(DateTime, nullable=True)

    ai_growth_analysis = Column(Text, nullable=True)
    ai_competencies = Column(JSON, nullable=True)  # [{"axis": "...", "score": 0-100}, ...]
    ai_growth_generated_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_evaluation_results_cycle_user", "cycle_id", "user_id"),
    )


class OneOnOneSession(Base):
    """평가자-피평가자 1on1 면담 녹음. 분석 결과는 평가관리자(회사 관리자/상위 관리자)만 열람."""
    __tablename__ = "one_on_one_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    cycle_id = Column(String, nullable=False, index=True)
    company_id = Column(String, nullable=False, index=True)
    evaluator_id = Column(String, nullable=False, index=True)
    evaluatee_id = Column(String, nullable=False, index=True)

    transcript = Column(Text, nullable=True)
    ai_analysis = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="processing")  # processing / completed / failed
    error_message = Column(String, nullable=True)

    recorded_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    duration_seconds = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_one_on_one_sessions_cycle", "cycle_id"),
    )
