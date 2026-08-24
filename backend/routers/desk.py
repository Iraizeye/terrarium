"""
Desk router — The Range's seat roster (the-range-desk launchd seats).

Read-only view over ~/.the-range-desk/out/<date>/: each seat's schedule,
last run, and latest brief. The desk writes files; this router only reads.
"""
from datetime import date, datetime, timezone
from pathlib import Path

from fastapi import APIRouter

from ..config import DEMO

router = APIRouter()

OUT = Path.home() / ".the-range-desk" / "out"

SEATS = [
    {"name": "premarket", "role": "Pre-market", "schedule": "wkdays 07:30"},
    {"name": "ops", "role": "Ops", "schedule": "daily 07:40"},
    {"name": "content", "role": "Content", "schedule": "daily 07:45"},
    {"name": "projects", "role": "Projects", "schedule": "Mon 07:50"},
    {"name": "chief", "role": "Chief of staff", "schedule": "daily 08:05"},
]


def _seat_state(name: str, day_dir: Path) -> dict:
    md = day_dir / f"{name}.md"
    failed = day_dir / f"{name}.FAILED"
    if failed.exists():
        return {"status": "failed", "ran_at": _mtime(failed), "brief": failed.read_text()[:400]}
    if md.exists():
        return {"status": "ok", "ran_at": _mtime(md), "brief": md.read_text()[:4000]}
    return {"status": "pending", "ran_at": None, "brief": None}


def _mtime(p: Path) -> str:
    return datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc).isoformat()


@router.get("/api/desk")
async def desk():
    if DEMO:
        from ..demo import demo_desk
        return demo_desk()
    day_dir = OUT / date.today().isoformat()
    return {
        "date": date.today().isoformat(),
        "seats": [{**seat, **_seat_state(seat["name"], day_dir)} for seat in SEATS],
    }
