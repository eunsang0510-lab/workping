from sqlalchemy import Column, String, DateTime, Boolean, Index
from datetime import datetime
from database.connection import Base
import uuid


class MemberDeletionLog(Base):
    """관리자/슈퍼관리자가 회사에서 직원(멤버십)을 삭제한 이력. 삭제 시점의 직원 정보를 스냅샷으로 남긴다."""
    __tablename__ = "member_deletion_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String, nullable=True, index=True)

    deleted_user_id = Column(String, nullable=False, index=True)
    deleted_user_name = Column(String, nullable=True)
    deleted_user_email = Column(String, nullable=True)
    deleted_phone = Column(String, nullable=True)
    was_admin = Column(Boolean, default=False)
    was_manager = Column(Boolean, default=False)

    performed_by = Column(String, nullable=False, index=True)
    performed_by_name = Column(String, nullable=True)
    performed_by_role = Column(String, nullable=False)  # admin / superadmin

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index("ix_member_del_log_company", "company_id"),
    )
