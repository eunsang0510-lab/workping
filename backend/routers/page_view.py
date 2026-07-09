from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

from database.connection import get_db
from models.page_view import PageView
from routers.deps import get_current_user, SUPERADMIN_EMAIL

router = APIRouter()


class PageViewLogRequest(BaseModel):
    path: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None


def _require_superadmin(current_user: dict):
    if current_user.get("email") != SUPERADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="시스템 관리자만 접근할 수 있어요")


def _parse_range(start_date: Optional[str], end_date: Optional[str]):
    end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1) if end_date else datetime.now()
    start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else end - timedelta(days=30)
    return start, end


# ── 화면 접속 로그 기록 ────────────────────────────────
@router.post("/log")
def log_page_view(req: PageViewLogRequest, db: Session = Depends(get_db)):
    pv = PageView(
        path=req.path[:255],
        user_id=req.user_id,
        user_name=req.user_name,
        user_email=req.user_email,
    )
    db.add(pv)
    db.commit()
    return {"success": True}


# ── 접속 로그 조회 (시스템 관리자) ─────────────────────
@router.get("/logs")
def list_page_views(
    path: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _require_superadmin(current_user)
    start, end = _parse_range(start_date, end_date)

    q = db.query(PageView).filter(PageView.created_at >= start, PageView.created_at < end)
    if path:
        q = q.filter(PageView.path == path)

    total = q.count()
    rows = (
        q.order_by(PageView.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "logs": [
            {
                "id": r.id,
                "path": r.path,
                "user_id": r.user_id,
                "user_name": r.user_name,
                "user_email": r.user_email,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ],
    }


# ── 화면별 · 기간별 Hit수 요약 (시스템 관리자) ─────────
@router.get("/summary")
def summarize_page_views(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    group_by: str = Query("day", pattern="^(day|week|month)$"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _require_superadmin(current_user)
    start, end = _parse_range(start_date, end_date)

    period_col = func.date_trunc(group_by, PageView.created_at)
    rows = (
        db.query(PageView.path, period_col.label("period"), func.count(PageView.id))
        .filter(PageView.created_at >= start, PageView.created_at < end)
        .group_by(PageView.path, period_col)
        .all()
    )

    totals: dict[str, int] = {}
    periods_set: set[str] = set()
    matrix: dict[str, dict[str, int]] = {}

    for path, period, count in rows:
        period_label = period.strftime("%Y-%m-%d")
        periods_set.add(period_label)
        matrix.setdefault(path, {})[period_label] = count
        totals[path] = totals.get(path, 0) + count

    paths_sorted = sorted(totals.keys(), key=lambda p: totals[p], reverse=True)
    periods_sorted = sorted(periods_set)

    return {
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date": (end - timedelta(days=1)).strftime("%Y-%m-%d"),
        "group_by": group_by,
        "paths": paths_sorted,
        "periods": periods_sorted,
        "matrix": matrix,
        "totals": totals,
    }
