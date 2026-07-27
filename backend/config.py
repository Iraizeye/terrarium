"""
RANGEWATCH configuration — every path and constant in one place.

The dashboard watches exactly three things: Claude, the range-trader stack,
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

RANGE_TRADER_DIR   = Path(os.getenv("RANGE_TRADER_DIR", str(Path.home() / ".range-trader")))
CLAUDE_PROJECTS_DIR = Path.home() / ".claude" / "projects"
LAUNCH_AGENTS_DIR  = Path.home() / "Library" / "LaunchAgents"

# Session log DB — long-lived local file; the name is historical.
SESSIONS_DB        = Path.home() / ".claude" / "atlas-sessions.db"

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
