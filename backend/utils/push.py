import json
import base64
from pywebpush import webpush, WebPushException
from py_vapid import Vapid
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

VAPID_CLAIMS = {"sub": "mailto:admin@workping.kr"}

_private_key: str | None = None
_public_key: str | None = None


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def init_vapid(db):
    """앱 시작 시 VAPID 키를 DB에서 로드하거나 새로 생성."""
    global _private_key, _public_key
    from models.push_subscription import SystemSetting

    priv_row = db.query(SystemSetting).filter_by(key="vapid_private_key").first()
    pub_row = db.query(SystemSetting).filter_by(key="vapid_public_key").first()

    if priv_row and pub_row:
        _private_key = priv_row.value
        _public_key = pub_row.value
        print("[Push] VAPID 키 로드 완료")
        return

    vapid = Vapid()
    vapid.generate_keys()
    _private_key = vapid.private_pem().decode()
    _public_key = _b64url(
        vapid.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    )

    db.add(SystemSetting(key="vapid_private_key", value=_private_key))
    db.add(SystemSetting(key="vapid_public_key", value=_public_key))
    db.commit()
    print("[Push] VAPID 키 생성 및 저장 완료")


def get_public_key() -> str | None:
    return _public_key


def send_push(endpoint: str, p256dh: str, auth: str, title: str, body: str, url: str = "/dashboard"):
    if not _private_key:
        return
    try:
        webpush(
            subscription_info={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}},
            data=json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key=_private_key,
            vapid_claims=VAPID_CLAIMS,
        )
    except WebPushException as e:
        print(f"[Push] 전송 실패 ({endpoint[:40]}...): {e}")


def send_push_to_users(db, user_ids: list[str], title: str, body: str, url: str = "/dashboard"):
    """여러 user_id에게 푸시 알림 전송 및 DB 저장."""
    from models.push_subscription import PushSubscription
    from models.notification import Notification

    subs = db.query(PushSubscription).filter(PushSubscription.user_id.in_(user_ids)).all()
    sent_user_ids = set()
    for sub in subs:
        send_push(sub.endpoint, sub.p256dh, sub.auth, title, body, url)
        sent_user_ids.add(sub.user_id)

    # 푸시 구독 없는 유저도 알림 기록 저장
    for uid in user_ids:
        db.add(Notification(user_id=uid, title=title, body=body, url=url))
    db.commit()
