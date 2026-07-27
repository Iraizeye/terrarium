"""
Collectors — everything RANGEWATCH knows, gathered read-only.

Four collectors, one per panel:
  system_metrics()   CPU / RAM / disk / uptime + trading-daemon footprint
  service_checks()   TCP port probes for the services worth a GO/NO-GO cell
  trading_status()   ~/.range-trader: heartbeats, ledgers, decisions, alerts
  claude_usage()     ~/.claude/projects transcripts: tokens + sessions today

All collectors are best-effort and side-effect-free: a missing file is a
status, never an exception. Nothing here writes anywhere.
"""
from __future__ import annotations

import json
import socket
import sqlite3
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import psutil

from .config import (
    ALERTS_TAIL_LINES, CLAUDE_PROJECTS_DIR, ET, HEARTBEAT_STALE_S,
    LAUNCH_AGENTS_DIR, MARKET_CLOSE_MIN, MARKET_OPEN_MIN, RANGE_TRADER_DIR,
    SERVICE_PORTS, TRADING_MODES, USAGE_MAX_FILE_MB,
)

# ---------------------------------------------------------------------------
# System
# ---------------------------------------------------------------------------

def system_metrics() -> dict[str, Any]:
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    uptime_s = int(datetime.now(UTC).timestamp() - psutil.boot_time())
    load_1m = round(psutil.getloadavg()[0], 2) if hasattr(psutil, "getloadavg") else 0.0

    # The processes that trade — their combined footprint gets a vitals-bar spot.
    trader_rss = 0
    trader_procs = 0
    for proc in psutil.process_iter(["cmdline", "memory_info"]):
        try:
            cmdline = " ".join(proc.info["cmdline"] or [])
            if "range-trader" in cmdline and "daemon" in cmdline:
                trader_rss += proc.info["memory_info"].rss
                trader_procs += 1
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    return {
        "cpu_pct": round(psutil.cpu_percent(interval=None), 1),
        "ram_pct": round(mem.percent, 1),
        "ram_used_gb": round(mem.used / 1e9, 1),
        "ram_total_gb": round(mem.total / 1e9, 1),
        "disk_pct": round(disk.percent, 1),
        "disk_used_gb": round(disk.used / 1e9, 1),
        "disk_total_gb": round(disk.total / 1e9, 1),
        "uptime_seconds": uptime_s,
        "load_1m": load_1m,
        "trader_procs": trader_procs,
        "trader_ram_mb": round(trader_rss / 1e6),
    }


# ---------------------------------------------------------------------------
# Services
# ---------------------------------------------------------------------------

def _port_open(port: int, timeout: float = 0.6) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=timeout):
            return True
    except OSError:
        return False


def service_checks() -> dict[str, dict[str, Any]]:
    return {
        key: {
            "name": name,
            "port": port,
            "status": "up" if _port_open(port) else "down",
        }
        for key, name, port in SERVICE_PORTS
    }


# ---------------------------------------------------------------------------
# Trading
# ---------------------------------------------------------------------------

def market_clock(now_et: datetime | None = None) -> dict[str, Any]:
    """Is the market open, and how long until it opens/closes (regular hours)."""
    now = now_et or datetime.now(ET)
    minutes = now.hour * 60 + now.minute
    weekday = now.weekday() < 5
    is_open = weekday and MARKET_OPEN_MIN <= minutes < MARKET_CLOSE_MIN

    if is_open:
        close_at = now.replace(hour=MARKET_CLOSE_MIN // 60, minute=MARKET_CLOSE_MIN % 60,
                               second=0, microsecond=0)
        seconds_to_change = int((close_at - now).total_seconds())
    else:
        candidate = now.replace(hour=MARKET_OPEN_MIN // 60, minute=MARKET_OPEN_MIN % 60,
                                second=0, microsecond=0)
        if minutes >= MARKET_OPEN_MIN:          # after today's open -> tomorrow
            candidate += timedelta(days=1)
        while candidate.weekday() >= 5:          # skip the weekend
            candidate += timedelta(days=1)
        seconds_to_change = int((candidate - now).total_seconds())

    return {
        "is_open": is_open,
        "seconds_to_change": max(0, seconds_to_change),
        "et": now.strftime("%H:%M:%S"),
    }


def _heartbeat_age(mode: str) -> int | None:
    path = RANGE_TRADER_DIR / f"heartbeat_{mode}"
    try:
        beat = datetime.fromisoformat(path.read_text().strip())
    except (FileNotFoundError, ValueError, OSError):
        return None
    return max(0, int((datetime.now(beat.tzinfo or UTC) - beat).total_seconds()))


def _positions(db: Path) -> tuple[list[dict], list[dict], float]:
    """(open positions, today's closed, realized P&L today) from one ledger."""
    if not db.exists():
        return [], [], 0.0
    today = date.today().isoformat()
    try:
        with sqlite3.connect(f"file:{db}?mode=ro", uri=True, timeout=1.0) as conn:
            conn.row_factory = sqlite3.Row
            open_rows = conn.execute(
                "SELECT symbol, quantity, entry_price, stop, target, state, origin,"
                " stop_order_id FROM positions WHERE state IN ('open','exiting') ORDER BY id"
            ).fetchall()
            closed_rows = conn.execute(
                "SELECT symbol, quantity, entry_price, exit_price, exit_reason"
                " FROM positions WHERE state='closed' AND closed_at LIKE ? ORDER BY id",
                (f"{today}%",),
            ).fetchall()
    except sqlite3.Error:
        return [], [], 0.0

    opens = [
        {
            "symbol": r["symbol"], "quantity": r["quantity"],
            "entry": r["entry_price"], "stop": r["stop"], "target": r["target"],
            "state": r["state"], "adopted": r["origin"] == "adopted",
            "broker_stop": bool(r["stop_order_id"]),
        }
        for r in open_rows
    ]
    closed, realized = [], 0.0
    for r in closed_rows:
        pnl = ((r["exit_price"] or r["entry_price"]) - r["entry_price"]) * r["quantity"]
        realized += pnl
        closed.append({
            "symbol": r["symbol"], "quantity": r["quantity"],
            "entry": r["entry_price"], "exit": r["exit_price"],
            "reason": r["exit_reason"], "pnl": round(pnl, 2),
        })
    return opens, closed, round(realized, 2)


def _last_decision() -> dict[str, Any] | None:
    path = RANGE_TRADER_DIR / "decisions.jsonl"
    try:
        with path.open("rb") as f:
            f.seek(0, 2)
            f.seek(max(0, f.tell() - 16_384))
            lines = f.read().decode(errors="replace").splitlines()
    except OSError:
        return None
    for line in reversed(lines):
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        decision = row.get("decision") or {}
        return {
            "at": row.get("at"),
            "action": decision.get("action"),
            "symbol": decision.get("symbol"),
            "thesis": str(decision.get("thesis") or "")[:280],
        }
    return None


def _alerts_tail() -> list[str]:
    path = RANGE_TRADER_DIR / "alerts.log"
    try:
        with path.open("rb") as f:
            f.seek(0, 2)
            f.seek(max(0, f.tell() - 8_192))
            lines = f.read().decode(errors="replace").splitlines()
    except OSError:
        return []
    return [line for line in lines if line.strip()][-ALERTS_TAIL_LINES:]


def _watchdog_armed(mode: str) -> bool:
    """A watchdog counts as armed when its launchd plist is installed."""
    names = (
        f"com.range-trader.watchdog{'' if mode == 'paper' else '-live'}.plist",
        f"com.range-trader.watchdog-{mode}.plist",
    )
    return any((LAUNCH_AGENTS_DIR / n).exists() for n in names)


def trading_status() -> dict[str, Any]:
    clock = market_clock()
    kill = (RANGE_TRADER_DIR / "KILL").exists()
    modes: dict[str, Any] = {}
    for mode in TRADING_MODES:
        age = _heartbeat_age(mode)
        if age is None:
            status = "unknown"
        elif age <= HEARTBEAT_STALE_S:
            status = "alive"
        else:
            status = "stale"
        opens, closed, realized = _positions(RANGE_TRADER_DIR / f"{mode}.sqlite")
        modes[mode] = {
            "status": status,
            "heartbeat_age_s": age,
            "watchdog_armed": _watchdog_armed(mode),
            "open_positions": opens,
            "closed_today": closed,
            "realized_today": realized,
        }
    return {
        "market": clock,
        "kill_switch": kill,
        "modes": modes,
        "last_decision": _last_decision(),
        "alerts": _alerts_tail(),
    }


# ---------------------------------------------------------------------------
# Claude usage — ccusage-style local transcript parsing, incremental
# ---------------------------------------------------------------------------

# path -> (offset consumed, running totals for THIS file)
_usage_offsets: dict[Path, tuple[int, dict[str, int]]] = {}


def _blank_counts() -> dict[str, int]:
    return {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0, "turns": 0}


def _consume_usage_lines(chunk: str, counts: dict[str, int]) -> None:
    for line in chunk.splitlines():
        if '"usage"' not in line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        usage = (row.get("message") or {}).get("usage") or {}
        if not usage:
            continue
        counts["input"] += int(usage.get("input_tokens") or 0)
        counts["output"] += int(usage.get("output_tokens") or 0)
        counts["cache_read"] += int(usage.get("cache_read_input_tokens") or 0)
        counts["cache_write"] += int(usage.get("cache_creation_input_tokens") or 0)
        counts["turns"] += 1


def claude_usage() -> dict[str, Any]:
    """Tokens and sessions across every transcript touched today.

    Incremental: each file is read once from its last consumed offset, so the
    10s poll costs only the bytes appended since the previous poll.
    """
    if not CLAUDE_PROJECTS_DIR.exists():
        return {"available": False}

    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
    sessions = 0
    totals = _blank_counts()

    for path in CLAUDE_PROJECTS_DIR.glob("*/*.jsonl"):
        try:
            stat = path.stat()
        except OSError:
            continue
        if stat.st_mtime < today_start or stat.st_size > USAGE_MAX_FILE_MB * 1e6:
            continue
        sessions += 1
        offset, counts = _usage_offsets.get(path, (0, _blank_counts()))
        if stat.st_size < offset:            # truncated/rotated — start over
            offset, counts = 0, _blank_counts()
        if stat.st_size > offset:
            try:
                with path.open("r", errors="replace") as f:
                    f.seek(offset)
                    _consume_usage_lines(f.read(), counts)
                    offset = f.tell()
            except OSError:
                continue
        _usage_offsets[path] = (offset, counts)
        for key in totals:
            totals[key] += counts[key]

    return {
        "available": True,
        "sessions_today": sessions,
        "turns_today": totals["turns"],
        "input_tokens": totals["input"],
        "output_tokens": totals["output"],
        "cache_read_tokens": totals["cache_read"],
        "cache_write_tokens": totals["cache_write"],
    }
