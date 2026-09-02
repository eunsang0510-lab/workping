"""시스템 관리자(슈퍼어드민) 권한 체크. DB(system_admins 테이블) 기반이며,
특정 이메일을 코드에 하드코딩하지 않는다. 최초 관리자 계정은 main.py 부팅 시 시드된다."""
from sqlalchemy.orm import Session

BOOTSTRAP_SUPERADMIN_EMAILS = ("eunsang0510@gmail.com", "hiddink12345@naver.com")


def is_superadmin_email(db: Session, email: str | None) -> bool:
    if not email:
        return False
    from models.system_admin import SystemAdmin
    return db.query(SystemAdmin).filter(SystemAdmin.email == email.strip().lower()).first() is not None
