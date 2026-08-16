from datetime import datetime, timedelta


def get_work_day_range():
    """오늘(KST) 00:00~24:00을 UTC 구간으로 변환. DB는 UTC로 저장되므로 조회도 UTC 기준."""
    now_utc = datetime.utcnow()
    now_kst = now_utc + timedelta(hours=9)
    kst_start = datetime(now_kst.year, now_kst.month, now_kst.day, 0, 0, 0)
    utc_start = kst_start - timedelta(hours=9)
    utc_end = utc_start + timedelta(hours=24)
    return utc_start, utc_end


def kst_date_str(recorded_at: datetime) -> str:
    """UTC로 저장된 시각을 KST 기준 날짜 문자열로 변환 (자정 근처 기록의 날짜 오분류 방지)"""
    return (recorded_at + timedelta(hours=9)).date().isoformat()


def today_kst_str() -> str:
    return (datetime.utcnow() + timedelta(hours=9)).date().isoformat()
