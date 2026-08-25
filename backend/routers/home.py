"""Claude Home — the agent's own page on the dashboard.

Iris's framing: "your little home, that I can see." Everything here is a
window into state the agent already keeps as files — memories, the morning
doctor line, standing watch-items, the pre-registered experiment board, the
toolbox. Read-only like the rest of the backend, and defensive everywhere:
a missing file renders as an empty shelf, never a 500. No secrets cross
this boundary — the token file contributes exactly one number (expiry).
"""

import json
import re
import sqlite3
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter

from ..config import CLAUDE_HOME_DIR, CLAUDE_MEMORY_DIR, EXPERIMENTS_MD, RANGE_TRADER_DIR

router = APIRouter()

_MEMORY_LINE = re.compile(r"^- \[(?P<title>[^\]]+)\]\((?P<file>[^)]+)\)\s*(?:—|-)?\s*(?P<hook>.*)$")


def read_memory_shelf(memory_dir: Path = CLAUDE_MEMORY_DIR) -> list[dict]:
    """MEMORY.md, newest-file-first, each line paired with its file's mtime."""
    index = memory_dir / "MEMORY.md"
    try:
        lines = index.read_text().splitlines()
    except OSError:
        return []
    shelf = []
    for line in lines:
        m = _MEMORY_LINE.match(line.strip())
        if not m:
            continue
        entry = {"title": m["title"], "hook": m["hook"].strip(), "updated": None}
        try:
            mtime = (memory_dir / m["file"]).stat().st_mtime
            entry["updated"] = datetime.fromtimestamp(mtime).isoformat(timespec="minutes")
        except OSError:
            pass
        shelf.append(entry)
    shelf.sort(key=lambda e: e["updated"] or "", reverse=True)
    return shelf


def read_doctor_line(alerts_log: Path | None = None) -> dict:
    """The most recent DOCTOR line — the morning's one-line diagnosis."""
    path = alerts_log or (RANGE_TRADER_DIR / "alerts.log")
    try:
        text = path.read_text().splitlines()
    except OSError:
        return {"line": None, "at": None, "green": None}
    for raw in reversed(text):
        if "DOCTOR:" in raw:
            ts, _, rest = raw.partition(" ")
            body = rest.split("DOCTOR:", 1)[-1].strip()
            return {"line": body, "at": ts, "green": body.startswith("all green")}
    return {"line": None, "at": None, "green": None}


def read_watch_items(state_dir: Path | None = None) -> dict:
    """Standing threads: token runway, open positions, KILL, broker contact.

    The answers to "how's it going" that used to need a human to ask.
    """
    base = state_dir or RANGE_TRADER_DIR
    items: dict = {"token_expires_at": None, "positions": [], "kill": False,
                   "last_broker_contact": None}
    try:
        # Only the expiry leaves the file; tokens never cross this boundary.
        items["token_expires_at"] = json.loads(
            (base / "oauth.json").read_text()).get("expires_at")
    except (OSError, json.JSONDecodeError):
        pass
    items["kill"] = (base / "KILL").exists()
    try:
        items["last_broker_contact"] = (base / "last_mcp_success").read_text().strip()
    except OSError:
        pass
    for mode, db in (("live", "live.sqlite"), ("paper", "paper.sqlite")):
        path = base / db
        if not path.exists():
            continue
        try:
            conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
            rows = conn.execute(
                "SELECT symbol, quantity, stop, horizon FROM positions"
                " WHERE state IN ('open','exiting')").fetchall()
            conn.close()
            items["positions"] += [
                {"mode": mode, "symbol": r[0], "quantity": r[1],
                 "stop": r[2], "horizon": r[3] or "day"} for r in rows]
        except sqlite3.Error:
            continue
    return items


def read_experiments(md_path: Path = EXPERIMENTS_MD,
                     state_dir: Path | None = None) -> list[dict]:
    """The pre-registered board: each experiment's pass bar, plus the one
    sample count we can measure cheaply and honestly (swing trades graded).
    Counts we cannot derive without guessing render as null, not zero."""
    base = state_dir or RANGE_TRADER_DIR
    try:
        text = md_path.read_text()
    except OSError:
        return []
    experiments = []
    for section in re.split(r"^## ", text, flags=re.M)[1:]:
        title = section.splitlines()[0].strip()
        if title.lower().startswith("grading"):
            continue
        pass_match = re.search(r"\*\*PASS[^*]*\*\*:?\s*(.+)", section)
        sample_match = re.search(r"\*\*Sample\*\*:?\s*(.+)", section)
        experiments.append({
            "title": title,
            "sample": sample_match.group(1).strip() if sample_match else None,
            "pass_bar": pass_match.group(1).strip() if pass_match else None,
            "n": None,
        })
    # Swing is the one arm with a clean queryable count.
    paper_db = base / "paper.sqlite"
    if paper_db.exists():
        try:
            conn = sqlite3.connect(f"file:{paper_db}?mode=ro", uri=True)
            n = conn.execute(
                "SELECT COUNT(*) FROM outcomes o JOIN positions p"
                " ON p.id = o.position_id WHERE p.horizon = 'swing'"
            ).fetchone()[0]
            conn.close()
            for exp in experiments:
                if exp["title"].lower().startswith("1. swing"):
                    exp["n"] = n
        except sqlite3.Error:
            pass
    return experiments


def read_toolbox(home: Path = CLAUDE_HOME_DIR,
                 memory_dir: Path = CLAUDE_MEMORY_DIR) -> dict:
    def _count(sub: str, suffix: str | None = None) -> int | None:
        d = home / sub
        if not d.is_dir():
            return None
        entries = list(d.iterdir())
        if suffix:
            entries = [e for e in entries if e.name.endswith(suffix)]
        return len(entries)

    memories = None
    if memory_dir.is_dir():
        memories = len([p for p in memory_dir.glob("*.md") if p.name != "MEMORY.md"])
    return {
        "skills": _count("skills"),
        "agents": _count("agents", ".md"),
        "commands": _count("commands"),
        "memories": memories,
    }


@router.get("/api/home")
async def api_home():
    from ..config import DEMO
    if DEMO:
        from ..demo import demo_home
        return demo_home()
    return {
        "memory": read_memory_shelf(),
        "doctor": read_doctor_line(),
        "watch": read_watch_items(),
        "experiments": read_experiments(),
        "toolbox": read_toolbox(),
    }
