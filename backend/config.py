"""
TERRARIUM configuration — every path and constant in one place.

The dashboard watches exactly three things: Claude, the vesper trading stack,
and this machine. Nothing else.
"""
import os
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

ET = ZoneInfo("America/New_York")

# ---------------------------------------------------------------------------
# Filesystem — the three things being watched
# ---------------------------------------------------------------------------

# Demo mode: every collector is swapped for a scripted synthetic day
# (backend/demo.py) — zero config, zero personal data, the full glasshouse.
DEMO = (os.getenv("TERRARIUM_DEMO") or os.getenv("RANGEWATCH_DEMO", "")) == "1"

# VESPER_DIR is the native name (system renamed 2026-08-26); RANGE_TRADER_DIR
# stays honored as an alias, same pattern as the RANGEWATCH_* -> TERRARIUM_* era.
RANGE_TRADER_DIR   = Path(os.getenv("VESPER_DIR") or os.getenv("RANGE_TRADER_DIR",
                                    str(Path.home() / ".vesper")))
CLAUDE_PROJECTS_DIR = Path(os.getenv("CLAUDE_PROJECTS_DIR",
                                     str(Path.home() / ".claude" / "projects")))
LAUNCH_AGENTS_DIR  = Path(os.getenv("LAUNCH_AGENTS_DIR",
                                    str(Path.home() / "Library" / "LaunchAgents")))

# Session log DB — long-lived local file; the name is historical. Demo mode
# keeps its fiction in a separate throwaway DB, never the real log.
_default_sessions_db = (
    "/tmp/terrarium-demo-sessions.db" if DEMO
    else str(Path.home() / ".claude" / "atlas-sessions.db")
)
SESSIONS_DB        = Path(os.getenv("TERRARIUM_SESSIONS_DB") or os.getenv("RANGEWATCH_SESSIONS_DB", _default_sessions_db))

# ---------------------------------------------------------------------------
# Services worth a GO/NO-GO cell (checked by TCP port, localhost only)
# ---------------------------------------------------------------------------

SERVICE_PORTS: list[tuple[str, str, int]] = [
    # key, display name, port
    ("glance",     "Glance",     8080),
    ("screenpipe", "Screenpipe", 3030),
    ("frontend",   "Frontend",   3000),
]

# ---------------------------------------------------------------------------
# Trading — market hours (ET) and heartbeat freshness
# ---------------------------------------------------------------------------

MARKET_OPEN_MIN    = 9 * 60 + 30    # 09:30 ET
MARKET_CLOSE_MIN   = 16 * 60        # 16:00 ET
HEARTBEAT_STALE_S  = 5 * 60         # matches range-trader's watchdog threshold

TRADING_MODES = ("paper", "live")

# ---------------------------------------------------------------------------
# Tuning
# ---------------------------------------------------------------------------

POLL_INTERVAL      = 10             # seconds between background polls
MAX_WS_CONNECTIONS = 50
ALERTS_TAIL_LINES  = 12
USAGE_MAX_FILE_MB  = 200            # skip absurdly large transcript files

# Claude Home — the agent's own page. All read-only, all optional: a missing
# path renders as an empty shelf, never an error.
CLAUDE_HOME_DIR    = Path(os.getenv("CLAUDE_HOME_DIR", str(Path.home() / ".claude")))
CLAUDE_MEMORY_DIR  = Path(os.getenv(
    "CLAUDE_MEMORY_DIR",
    str(Path.home() / ".claude" / "projects" / "-Users-iris" / "memory")))
EXPERIMENTS_MD     = Path(os.getenv(
    "EXPERIMENTS_MD",
    str(Path.home() / "Projects" / "vesper-trader" / "docs" / "EXPERIMENTS.md")))
