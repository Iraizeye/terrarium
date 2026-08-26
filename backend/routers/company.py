"""Company router — the on-call departments' telemetry.

Strategy and Build are on-call, not always-on, so their lights are driven
by ARTIFACTS, never by guesses: Strategy worked iff an RFC file changed
(~/Projects/vesper/rfcs), Build worked iff a commit landed in a hub repo.
A session that only talks lights nothing — which is the company's token
discipline made visible.

Read-only like every collector; missing dirs are empty results.
"""

import os
import re
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()

RFC_DIR = Path(os.getenv("VESPER_RFC_DIR", str(Path.home() / "Projects" / "vesper" / "rfcs")))
HUB_REPOS = [Path.home() / "Projects" / p for p in
             ("vesper", "vesper-desk", "mission-control-dashboard", "nightbell")]
_VERDICT = re.compile(r"(?:\*\*)?Verdict:?(?:\*\*)?:?\s*(add|later|no)", re.I)

_build_cache: tuple[float, str | None] = (0.0, None)


def rfc_shelf(rfc_dir: Path = RFC_DIR) -> list[dict]:
    """Newest-first RFCs: name, verdict, mtime. Template excluded."""
    try:
        files = sorted((p for p in rfc_dir.glob("*.md") if not p.name.startswith("0000")),
                       key=lambda p: p.stat().st_mtime, reverse=True)
    except OSError:
        return []
    out = []
    for p in files[:6]:
        verdict = None
        try:
            m = _VERDICT.search(p.read_text()[:2000])
            verdict = m.group(1).lower() if m else None
        except OSError:
            pass
        out.append({
            "name": p.stem,
            "verdict": verdict,
            "at": datetime.fromtimestamp(p.stat().st_mtime, tz=UTC).isoformat(),
        })
    return out


def last_build_at(repos: list[Path] = HUB_REPOS) -> str | None:
    """Newest commit time across hub repos — Build's lamp. Cached 30s."""
    global _build_cache
    now = time.time()
    if now - _build_cache[0] < 30:
        return _build_cache[1]
    newest = 0
    for repo in repos:
        try:
            out = subprocess.run(
                ["git", "-C", str(repo), "log", "-1", "--format=%ct"],
                capture_output=True, text=True, timeout=5)
            if out.returncode == 0 and out.stdout.strip():
                newest = max(newest, int(out.stdout.strip()))
        except (OSError, ValueError, subprocess.TimeoutExpired):
            continue
    at = datetime.fromtimestamp(newest, tz=UTC).isoformat() if newest else None
    _build_cache = (now, at)
    return at


@router.get("/api/company")
async def api_company():
    from ..config import DEMO
    if DEMO:
        from ..demo import demo_company
        return demo_company()
    rfcs = rfc_shelf()
    return {
        "strategy_at": rfcs[0]["at"] if rfcs else None,
        "strategy_verdict": (f"{rfcs[0]['name']}: {rfcs[0]['verdict']}"
                             if rfcs and rfcs[0]["verdict"] else None),
        "build_at": last_build_at(),
        "rfcs": rfcs,
    }
