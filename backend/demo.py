"""
Demo mode — a synthetic trading day, so a visitor sees the full glasshouse in
five minutes with zero configuration and zero personal data.

TERRARIUM_DEMO=1 swaps every collector for the scripted versions below.
The "day" is a pure function of the wall clock: a full 24h ET session is
compressed into DEMO_DAY_S seconds and weighted toward the interesting
parts (the market-open sun arc gets 60% of the loop). Nothing is random
per-request and nothing is stored — refresh mid-day and the day is exactly
where you left it.

Every ticker, trade, and log line here is fiction. NOVA, RIDGE, CINDER,
HELIO do not exist; resemblance to real symbols is accidental.
"""
from __future__ import annotations

import asyncio
import os
import sqlite3
import time
from datetime import UTC, datetime, timedelta
from typing import Any

DEMO_DAY_S = int(os.getenv("TERRARIUM_DEMO_DAY_S") or os.getenv("RANGEWATCH_DEMO_DAY_S", "300"))

# TERRARIUM_DEMO_AT freezes the demo at one instant (epoch seconds) — for
# deterministic screenshots and visual-regression tests. Unset = live loop.
_DEMO_AT = os.getenv("TERRARIUM_DEMO_AT")


def _demo_now() -> float:
    return float(_DEMO_AT) if _DEMO_AT else time.time()


def _demo_wall() -> datetime:
    return datetime.fromtimestamp(_demo_now(), tz=UTC)

# Loop segments: (fraction of loop, start ET minute, end ET minute)
_SEGMENTS = [
    (0.10, 8 * 60 + 15, 9 * 60 + 30),    # dawn  08:15 -> 09:30
    (0.60, 9 * 60 + 30, 16 * 60),        # day   09:30 -> 16:00
    (0.15, 16 * 60, 19 * 60),            # dusk  16:00 -> 19:00
    (0.15, 19 * 60, 24 * 60 + 8 * 60 + 15),  # night 19:00 -> 08:15 (+1d)
]


def _demo_minute(now: float | None = None) -> float:
    """Synthetic ET minute-of-day for this instant of the loop."""
    frac = ((now if now is not None else _demo_now()) % DEMO_DAY_S) / DEMO_DAY_S
    for i, (seg_frac, start_min, end_min) in enumerate(_SEGMENTS):
        if frac <= seg_frac or i == len(_SEGMENTS) - 1:
            minute = start_min + min(1.0, frac / seg_frac) * (end_min - start_min)
            return minute % (24 * 60)
        frac -= seg_frac
    return 0.0


def demo_market_clock(now: float | None = None) -> dict[str, Any]:
    minute = _demo_minute(now)
    is_open = 9 * 60 + 30 <= minute < 16 * 60
    # seconds_to_change is only used for the dawn window and countdowns; scale
    # synthetic minutes to synthetic seconds so the frontend math reads right.
    if is_open:
        change_min = 16 * 60 - minute
    elif minute < 9 * 60 + 30:
        change_min = 9 * 60 + 30 - minute
    else:
        change_min = (24 * 60 - minute) + 9 * 60 + 30
    return {
        "is_open": is_open,
        "seconds_to_change": int(change_min * 60),
        "et": f"{int(minute) // 60:02d}:{int(minute) % 60:02d}:{int((minute % 1) * 60):02d}",
    }


# ---------------------------------------------------------------------------
# The scripted book. Times are ET minutes; prices are fiction.
# ---------------------------------------------------------------------------

_OPEN = 9 * 60 + 30

# (mode, symbol, open_min, close_min|None, qty, entry, stop, target,
#  trail_min|None, exit, reason)  — close_min None = still open at EOD
_TRADES = [
    ("live", "NOVA", _OPEN + 35, _OPEN + 190, 2.0, 41.20, 40.35, 43.80,
     _OPEN + 120, 43.80, "target"),
    ("live", "RIDGE", _OPEN + 225, _OPEN + 300, 1.0, 67.10, 65.90, 70.70,
     None, 65.90, "stop"),
    ("live", "CINDER", _OPEN + 320, None, 3.0, 28.44, 27.80, 30.10,
     None, None, None),
    ("paper", "HELIO", _OPEN + 20, _OPEN + 150, 4.0, 22.05, 21.40, 23.30,
     _OPEN + 90, 23.30, "target"),
    ("paper", "VELA", _OPEN + 170, _OPEN + 260, 1.0, 88.60, 86.90, 91.40,
     None, 91.40, "target"),
    ("paper", "SABLE", _OPEN + 280, None, 2.0, 34.72, 33.95, 36.60,
     None, None, None),
]

_DECISIONS = [
    (_OPEN + 15, "pass", None,
     "Opening tape is still deciding. HELIO has the only dated catalyst on "
     "the board but sits 1.8% above session VWAP with no pullback yet — the "
     "stop the structure demands is inside the noise. Patience costs nothing."),
    (_OPEN + 35, "buy", "NOVA",
     "Fresh guidance raise dated today, reclaimed VWAP on rvol 2.1, and the "
     "stop below the pullback low at 40.35 risks 0.85 against 2.60 of room to "
     "yesterday's high — 3.1:1. One catalyst, one structure, one trade."),
    (_OPEN + 120, "pass", None,
     "NOVA is +1.0R and trails to breakeven — the trade now pays for itself. "
     "Nothing new qualifies: RIDGE's move is sector sympathy without its own "
     "news, and chasing sympathy is how mornings are given back."),
    (_OPEN + 225, "buy", "RIDGE",
     "The sector driver finally got RIDGE-specific confirmation at 13:0x. "
     "Stop under the midday shelf at 65.90; 1.2 risk against 3.6 to the "
     "measured move. If the shelf breaks the thesis is simply wrong."),
    (_OPEN + 320, "buy", "CINDER",
     "Afternoon range break on a contract announcement dated today. Risk "
     "0.64 to the breakout shelf, 1.66 to the prior high — and the book has "
     "settled cash freed by this morning's NOVA exit to pay for it."),
    (_OPEN + 355, "pass", None,
     "Final window. CINDER is working and needs nothing. The last half hour "
     "belongs to management, not new risk — EOD flatten runs at 15:50."),
]

_ALERT_SCRIPT = [
    (_OPEN - 20, "preflight: broker session OK, scanners armed, risk kernel loaded"),
    (_OPEN + 35, "LIVE opened NOVA x2 @ 41.20, stop 40.35 (structure: pullback low)"),
    (_OPEN + 120, "LIVE trailed NOVA to breakeven at +1.0R"),
    (_OPEN + 190, "LIVE closed NOVA @ 43.80 — target, +$5.20 (+3.1R)"),
    (_OPEN + 225, "LIVE opened RIDGE x1 @ 67.10, stop 65.90"),
    (_OPEN + 300, "LIVE stopped RIDGE @ 65.90 — -$1.20 (-1.0R), thesis invalidated"),
    (_OPEN + 320, "LIVE opened CINDER x3 @ 28.44, stop 27.80"),
    (16 * 60 + 5, "daily report: +$4.00 live, +$7.68 paper — outcomes table updated"),
]


def _mode_book(mode: str, minute: float) -> dict[str, Any]:
    opens: list[dict] = []
    closed: list[dict] = []
    realized = 0.0
    for m, sym, o, c, qty, entry, stop, target, trail, exit_px, reason in _TRADES:
        if m != mode or minute < o:
            continue
        if c is not None and minute >= c:
            pnl = round((exit_px - entry) * qty, 2)
            realized += pnl
            closed.append({"symbol": sym, "quantity": qty, "entry": entry,
                           "exit": exit_px, "reason": reason, "pnl": pnl})
        else:
            live_stop = entry if (trail is not None and minute >= trail) else stop
            opens.append({"symbol": sym, "quantity": qty, "entry": entry,
                          "stop": live_stop, "target": target, "state": "open",
                          "adopted": False, "broker_stop": True})
    return {
        "status": "alive",
        "heartbeat_age_s": int(minute * 7) % 41 + 4,
        "watchdog_armed": True,
        "open_positions": opens,
        "closed_today": closed,
        "realized_today": round(realized, 2),
    }


def demo_trading_status() -> dict[str, Any]:
    clock = demo_market_clock()
    minute = _demo_minute()
    last = None
    for at, action, symbol, thesis in _DECISIONS:
        if minute >= at:
            last = {
                "at": _demo_wall().isoformat(),
                "action": action, "symbol": symbol, "thesis": thesis,
            }
    return {
        "market": clock,
        "kill_switch": False,
        "modes": {"paper": _mode_book("paper", minute),
                  "live": _mode_book("live", minute)},
        "last_decision": last,
        "alerts": [f"[demo] {text}" for at, text in _ALERT_SCRIPT if minute >= at][-12:],
    }


def demo_system_metrics() -> dict[str, Any]:
    minute = _demo_minute()
    wobble = (minute * 13) % 17 / 17          # deterministic, gently moving
    return {
        "cpu_pct": round(9 + 14 * wobble, 1),
        "ram_pct": round(58 + 7 * wobble, 1),
        "ram_used_gb": round(18.6 + 2.2 * wobble, 1),
        "ram_total_gb": 32.0,
        "disk_pct": 41.3,
        "disk_used_gb": 383.2,
        "disk_total_gb": 926.4,
        "uptime_seconds": 11 * 86400 + int(minute * 60),
        "load_1m": round(1.1 + 1.4 * wobble, 2),
        "trader_procs": 2,
        "trader_ram_mb": 96 + int(18 * wobble),
    }


def demo_service_checks() -> dict[str, dict[str, Any]]:
    return {
        "glance": {"name": "Glance", "port": 8080, "status": "up"},
        "screenpipe": {"name": "Screenpipe", "port": 3030, "status": "up"},
        "frontend": {"name": "Frontend", "port": 3000, "status": "up"},
    }


def demo_claude_usage() -> dict[str, Any]:
    minute = _demo_minute()
    day_frac = min(1.0, max(0.0, (minute - 7 * 60) / (13 * 60)))
    return {
        "available": True,
        "sessions_today": 1 + int(3 * day_frac),
        "turns_today": int(310 * day_frac),
        "input_tokens": int(1_840_000 * day_frac),
        "output_tokens": int(214_000 * day_frac),
        "cache_read_tokens": int(9_600_000 * day_frac),
        "cache_write_tokens": int(1_150_000 * day_frac),
    }


def demo_board_state() -> dict[str, Any]:
    """A scripted cycle for both arms, fiction like every other panel."""
    arm = {
        "cycle_at": "2026-08-03T11:20:04-04:00", "action": "pass",
        "action_symbol": None, "pass_reason": "rr_below_min",
        "bear_veto": False,
        "gist": "CAKE has the cleanest catalyst but 1.3:1 after the spread",
        "funnel": {"scanned": 8, "to_engine": 5, "unaffordable_filtered": 2,
                   "untradable": 1, "held": 1},
        "candidates": [
            {"symbol": "CAKE", "last": 100.77, "rvol": 3.7,
             "tech": "ATR(5m) 0.42; RSI(14,5m) 64; above VWAP 99.80; ADX(10,5m) 31",
             "earn": "reported yesterday pm: EPS 1.44 vs 1.14 est (+26% beat)",
             "affordable": True, "move_pct": 0.021},
            {"symbol": "TEVA", "last": 34.60, "rvol": 2.1,
             "tech": "RSI(14,5m) 52; BELOW VWAP 34.75", "earn": None,
             "affordable": True, "move_pct": -0.004},
        ],
        "shadows": [
            {"symbol": "CAKE", "mark": 98.70, "last": 100.77, "move_pct": 0.021,
             "affordable": True, "first_seen": "09:51"},
            {"symbol": "TEVA", "mark": 34.74, "last": 34.60, "move_pct": -0.004,
             "affordable": True, "first_seen": "10:12"},
        ],
    }
    import copy
    live = copy.deepcopy(arm)
    live["pass_reason"] = None
    live["action"] = "buy"
    live["action_symbol"] = "CAKE"
    live["gist"] = "CAKE: earnings beat + above VWAP; stop 99.75 under structure"
    return {"available": True, "arms": {"paper": arm, "live": live}}


def demo_agent_fleet() -> dict[str, Any]:
    """A believable three-agent afternoon; fiction like every other panel."""
    minute = _demo_minute()
    day_frac = min(1.0, max(0.0, (minute - 7 * 60) / (13 * 60)))
    return {
        "available": True,
        "agents": [
            {"project": "vesper", "session": "a197e4ec", "state": "live",
             "age_s": 12, "action": "Edit reconcile.py", "model": "claude-opus-5",
             "tokens": int(96_000 * day_frac), "turns": int(41 * day_frac)},
            {"project": "terrarium", "session": "0e2d77f7", "state": "idle",
             "age_s": 1240, "action": "responding", "model": "claude-opus-5",
             "tokens": int(31_000 * day_frac), "turns": int(17 * day_frac)},
            {"project": "worldmonitor", "session": "9f940eb0", "state": "done",
             "age_s": 9800, "action": None, "model": "claude-sonnet-5",
             "tokens": 12_400, "turns": 9},
        ],
    }


# ---------------------------------------------------------------------------
# Crew — feed the watchtower through the real pipeline so the art animates.
# ---------------------------------------------------------------------------

_CREW_SCRIPT = [
    ("lifecycle", "session started in vesper", "thinking", None),
    ("thought", "reading the morning tape", "thinking", None),
    ("tool", "Read daemon.py", "working", "Read"),
    ("tool", "run tests: 373 passed", "working", "Bash"),
    ("tool", "Edit engine.py", "working", "Edit"),
    ("thought", "weighing the 2:1 experiment arm", "thinking", None),
    ("tool", "web: verify catalyst for NOVA", "working", "WebSearch"),
    ("tool", "Grep structure_stop", "working", "Grep"),
    ("lifecycle", "finished turn", "idle", None),
    ("tool", "tail decisions.jsonl", "working", "Bash"),
]


async def run_demo_crew() -> None:
    """Emit a scripted activity loop so the stage is alive for visitors."""
    from .routers.crew import _emit

    step = 0
    while True:
        kind, text, status, tool = _CREW_SCRIPT[step % len(_CREW_SCRIPT)]
        try:
            await _emit(kind, f"[demo] {text}", status=status, tool=tool)
        except Exception as exc:
            print(f"[demo] crew emit error: {exc}", flush=True)
        step += 1
        await asyncio.sleep(9 + (step * 7) % 8)


_DESK_RUNS = {
    "premarket": (8 * 60 + 15, "[demo] Tape is thin. HELIO is the only dated name — watching VWAP."),
    "ops": (8 * 60 + 40, "[demo] All stations green. Watchdogs armed. Disk 41%."),
    "content": (8 * 60 + 45, "[demo] Queue has 4 clips. Nothing posts until you say so."),
    "projects": (8 * 60 + 50, "[demo] No Monday ship. PRs quiet."),
    "chief": (9 * 60 + 5, "[demo] Dawn brief sent. Floor is yours."),
}


# Minutes-ago offsets for finished demo seats. The floor lights an office when
# its seat ran inside the last 20 real minutes, so the spread is chosen to show
# the feature: most offices lit, premarket already off shift (it ran at dawn).
_DESK_RECENCY_MIN = {
    "premarket": 26,
    "ops": 6,
    "content": 12,
    "projects": 17,
    "chief": 3,
}


def demo_home() -> dict[str, Any]:
    """A fictional agent's home page — memories, watch, experiments.

    Demo mode must never read the visitor's real ~/.claude; this payload is
    the same shape as /api/home with every line scripted and labeled.
    """
    wall = datetime.now(UTC)
    mem = [
        ("[demo] The morning routine", "premarket brief before the open; doctor line is the day's first truth", 2),
        ("[demo] NOVA follow-through", "guidance-raise entries have held VWAP 3/3 times; keep the stop structural", 26),
        ("[demo] Never trade the last half hour", "EOD flatten runs 15:50 — the close belongs to management, not new risk", 49),
        ("[demo] RIDGE post-mortem", "sector sympathy without own news = no trade; waited for confirmation, still stopped", 72),
        ("[demo] Watchdog cadence", "heartbeats every 60s, watchdog restarts a silent daemon after 5 misses", 95),
    ]
    return {
        "memory": [
            {"title": t, "hook": h,
             "updated": (wall - timedelta(hours=age)).isoformat()}
            for t, h, age in mem
        ],
        "doctor": {
            "line": "[demo] DOCTOR: all green — broker session fresh, ledgers reconciled, disk 12%, flat into the open",
            "at": wall.isoformat(),
            "green": True,
        },
        "watch": {
            "token_expires_at": wall.timestamp() + 6.5 * 86400,
            "positions": [
                {"mode": "live", "symbol": "CINDER", "quantity": 3.0,
                 "stop": 27.80, "horizon": "day"},
            ],
            "kill": False,
            "last_broker_contact": wall.isoformat(),
        },
        "experiments": [
            {"title": "[demo] Breakeven trail at +1.0R", "sample": "live entries",
             "pass_bar": "expectancy >= +0.25R/trade over the untrailed baseline", "n": 14},
            {"title": "[demo] Afternoon range breaks", "sample": "paper arm",
             "pass_bar": "hit rate >= 40% AND avg winner >= 2R", "n": None},
            {"title": "[demo] Sympathy-move veto", "sample": "shadow tickets",
             "pass_bar": "vetoed names underperform entries by >= 0.5R median", "n": 22},
        ],
        "toolbox": {"skills": 12, "agents": 5, "commands": 9, "memories": len(mem)},
    }


_SEARCH_CORPUS = [
    ("sessions", 30, "[note] [demo] LIVE closed NOVA @ 43.80 — target, +3.1R", "session log"),
    ("alerts", 95, "[demo] LIVE trailed NOVA to breakeven at +1.0R", "alerts.log"),
    ("decisions", 140, "[demo] buy NOVA — fresh guidance raise, reclaimed VWAP on rvol 2.1, 3.1:1", "decisions.jsonl"),
    ("memory", 60 * 26, "[demo] guidance-raise entries have held VWAP 3/3 times; keep the stop structural", "nova-follow-through"),
    ("sessions", 200, "[note] [demo] preflight green: broker session, scanners, risk kernel", "session log"),
    ("decisions", 220, "[demo] pass — RIDGE move is sector sympathy without its own news", "decisions.jsonl"),
    ("memory", 60 * 49, "[demo] EOD flatten runs 15:50 — the close belongs to management, not new risk", "never-trade-the-last-half-hour"),
]


def demo_search(q: str) -> list[dict[str, Any]]:
    """Scripted hits over the demo day — same shape as the real fan-out."""
    ql = q.lower()
    wall = _demo_wall()
    return [
        {"source": src, "at": (wall - timedelta(minutes=age)).isoformat(),
         "text": text, "where": where}
        for src, age, text, where in _SEARCH_CORPUS
        if ql in text.lower()
    ]


def demo_company(now: float | None = None) -> dict[str, Any]:
    """The upstairs beat: Strategy verdict lands mid-morning, Build lamp
    blinks after, Chief already spoke at dawn. All fiction, all labeled."""
    minute = _demo_minute(now)
    wall = _demo_wall()
    verdict_in = minute >= 10 * 60 + 40      # 10:40 ET: RFC lands
    build_in = minute >= 11 * 60             # 11:00 ET: the fix ships
    rfcs = []
    if verdict_in:
        rfcs.append({"name": "[demo] 0007-brighter-premarket-lamp",
                     "verdict": "add",
                     "at": (wall - timedelta(minutes=3)).isoformat()})
    rfcs.append({"name": "[demo] 0006-second-espresso-machine",
                 "verdict": "later",
                 "at": (wall - timedelta(hours=22)).isoformat()})
    return {
        "strategy_at": rfcs[0]["at"] if verdict_in else None,
        "strategy_verdict": "[demo] brighter premarket lamp: add" if verdict_in else None,
        "build_at": (wall - timedelta(minutes=2)).isoformat() if build_in else None,
        "rfcs": rfcs,
    }


def demo_desk(now: float | None = None) -> dict[str, Any]:
    """Scheduled seats for the synthetic day — labeled fiction, clock-driven."""
    from .routers.desk import SEATS

    minute = _demo_minute(now)
    wall = _demo_wall()
    seats = []
    for seat in SEATS:
        run_min, brief = _DESK_RUNS[seat["name"]]
        done = minute >= run_min
        ran_at = (wall - timedelta(minutes=_DESK_RECENCY_MIN[seat["name"]])).isoformat()
        seats.append({
            **seat,
            "status": "ok" if done else "pending",
            "ran_at": ran_at if done else None,
            "brief": brief if done else None,
        })
    return {"date": _demo_wall().strftime("%Y-%m-%d"), "seats": seats}


def seed_demo_sessions(db_path) -> None:
    """A believable session log for the day panel. Fiction, clearly tagged."""
    today = datetime.now().strftime("%Y-%m-%d")
    rows = [
        ("note", "[demo] preflight green: broker session, scanners, risk kernel"),
        ("note", "[demo] PR merged: trailing-to-breakeven armed at +1R"),
        ("note", "[demo] LIVE closed NOVA +3.1R at target — outcomes table updated"),
        ("note", "[demo] paper arm leads the week 4.2R to 2.9R — promotion review Friday"),
    ]
    with sqlite3.connect(db_path) as conn:
        existing = conn.execute(
            "SELECT COUNT(*) FROM session_log WHERE date = ?", (today,)
        ).fetchone()[0]
        if existing:
            return
        for role, content in rows:
            conn.execute(
                "INSERT INTO session_log (date, ts, role, content) VALUES (?, ?, ?, ?)",
                (today, datetime.now().astimezone().isoformat(), role, content),
            )
