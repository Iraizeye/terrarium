"""Unified search — one question, answered with receipts.

The machine's history lives in five places: the session log (SQLite), the
trader's alerts.log and decisions.jsonl, the agent's memory shelf, and the
Argus mailbox. This router fans a query out across all of them read-only
and returns dated, source-tagged hits, newest first. The idea is borrowed
from block/buzz's unified event log — ours is a search across the logs we
already keep, not a new place to write.

House rules apply: read-only everywhere, a missing file is an empty result
set (never a 500), and demo mode searches a scripted corpus instead of the
visitor's machine.
"""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter

from ..config import CLAUDE_MEMORY_DIR, RANGE_TRADER_DIR, SESSIONS_DB

router = APIRouter()

MAX_PER_SOURCE = 8
MAX_LINE = 220
# Alerts/decisions are append-forever; cap how much tail is scanned so the
# endpoint stays O(recent history), not O(all history).
TAIL_BYTES = 512 * 1024


def _clip(text: str) -> str:
    text = " ".join(text.split())
    return text[:MAX_LINE] + "…" if len(text) > MAX_LINE else text


def _hit(source: str, at: str | None, text: str, where: str) -> dict:
    return {"source": source, "at": at, "text": _clip(text), "where": where}


def _tail_lines(path: Path) -> list[str]:
    try:
        with open(path, "rb") as f:
            f.seek(0, 2)
            f.seek(max(0, f.tell() - TAIL_BYTES))
            return f.read().decode("utf-8", "replace").splitlines()
    except OSError:
        return []


def search_sessions(q: str, db_path: Path = SESSIONS_DB) -> list[dict]:
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        with conn:
            rows = conn.execute(
                "SELECT ts, role, content FROM session_log "
                "WHERE content LIKE ? ORDER BY id DESC LIMIT ?",
                (f"%{q}%", MAX_PER_SOURCE),
            ).fetchall()
        conn.close()
    except sqlite3.Error:
        return []
    return [_hit("sessions", ts, f"[{role}] {content}", "session log")
            for ts, role, content in rows]


def search_alerts(q: str, state_dir: Path = RANGE_TRADER_DIR) -> list[dict]:
    ql = q.lower()
    hits = []
    last_ts = None
    for line in _tail_lines(state_dir / "alerts.log"):
        # Dated lines carry their own ISO stamp; indented context lines
        # inherit the stamp of the entry they belong to.
        head = line.split(" ", 1)[0]
        if len(head) >= 19 and head[:4].isdigit():
            last_ts = head
        if ql in line.lower():
            hits.append(_hit("alerts", last_ts, line, "alerts.log"))
    return hits[-MAX_PER_SOURCE:][::-1]


def search_decisions(q: str, state_dir: Path = RANGE_TRADER_DIR) -> list[dict]:
    ql = q.lower()
    hits = []
    for line in _tail_lines(state_dir / "decisions.jsonl"):
        if ql not in line.lower():
            continue
        try:
            row = json.loads(line)
            d = row.get("decision") or {}
            text = " ".join(filter(None, [
                d.get("action"), d.get("symbol"), d.get("thesis")]))
            hits.append(_hit("decisions", row.get("at"),
                             text or line, "decisions.jsonl"))
        except (json.JSONDecodeError, AttributeError):
            hits.append(_hit("decisions", None, line, "decisions.jsonl"))
    return hits[-MAX_PER_SOURCE:][::-1]


def search_memory(q: str, memory_dir: Path = CLAUDE_MEMORY_DIR) -> list[dict]:
    ql = q.lower()
    hits = []
    try:
        files = sorted(memory_dir.glob("*.md"),
                       key=lambda p: p.stat().st_mtime, reverse=True)
    except OSError:
        return []
    for path in files:
        if path.name == "MEMORY.md":
            continue
        try:
            body = path.read_text()
        except OSError:
            continue
        for line in body.splitlines():
            if ql in line.lower() and not line.startswith(("---", "name:", "description:", "metadata", "  type:")):
                at = datetime.fromtimestamp(
                    path.stat().st_mtime, tz=timezone.utc).isoformat()
                hits.append(_hit("memory", at, line, path.stem))
                break  # one hit per memory file — the file is the unit
        if len(hits) >= MAX_PER_SOURCE:
            break
    return hits


def search_argus(q: str, mailbox: Path | None = None) -> list[dict]:
    mailbox = mailbox or Path.home() / ".argus" / "mailbox.jsonl"
    ql = q.lower()
    hits = []
    for line in _tail_lines(mailbox):
        if ql not in line.lower():
            continue
        try:
            row = json.loads(line)
            hits.append(_hit("argus", row.get("at") or row.get("ts"),
                             str(row.get("body") or row.get("content") or line),
                             "argus mailbox"))
        except json.JSONDecodeError:
            hits.append(_hit("argus", None, line, "argus mailbox"))
    return hits[-MAX_PER_SOURCE:][::-1]


@router.get("/api/search")
async def api_search(q: str = ""):
    q = q.strip()
    if len(q) < 2:
        return {"q": q, "hits": []}
    from ..config import DEMO
    if DEMO:
        from ..demo import demo_search
        return {"q": q, "hits": demo_search(q)}
    hits = (search_sessions(q) + search_alerts(q)
            + search_decisions(q) + search_memory(q) + search_argus(q))
    # Newest first across sources; undated hits sink to the bottom.
    hits.sort(key=lambda h: h["at"] or "", reverse=True)
    return {"q": q, "hits": hits}
