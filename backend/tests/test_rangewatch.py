"""RANGEWATCH backend tests — collectors and the two frozen API contracts."""
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from backend import collectors
from backend.collectors import (
    _consume_usage_lines, _blank_counts, market_clock,
)
from backend.config import ET


# ---------------------------------------------------------------------------
# Market clock
# ---------------------------------------------------------------------------

def et(y, mo, d, h, mi):
    return datetime(y, mo, d, h, mi, tzinfo=ET)


class TestMarketClock:
    def test_open_midday_weekday(self):
        clock = market_clock(et(2026, 7, 23, 12, 0))  # Thursday noon
        assert clock["is_open"] is True
        assert clock["seconds_to_change"] == 4 * 3600  # until 16:00

    def test_closed_before_open_counts_down_to_open(self):
        clock = market_clock(et(2026, 7, 23, 9, 0))
        assert clock["is_open"] is False
        assert clock["seconds_to_change"] == 30 * 60

    def test_after_close_rolls_to_next_day(self):
        clock = market_clock(et(2026, 7, 23, 16, 30))  # Thursday after close
        assert clock["is_open"] is False
        assert clock["seconds_to_change"] == ((24 - 16) * 60 - 30 + 9 * 60 + 30) * 60

    def test_friday_evening_rolls_over_the_weekend(self):
        clock = market_clock(et(2026, 7, 24, 17, 0))  # Friday 5pm
        # next open is Monday 09:30 — more than 2 days out
        assert clock["is_open"] is False
        assert clock["seconds_to_change"] > 2 * 86400

    def test_weekend_is_closed(self):
        assert market_clock(et(2026, 7, 25, 12, 0))["is_open"] is False


# ---------------------------------------------------------------------------
# Trading collector against a fixture ~/.range-trader
# ---------------------------------------------------------------------------

@pytest.fixture
def trader_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(collectors, "RANGE_TRADER_DIR", tmp_path)
    monkeypatch.setattr(collectors, "LAUNCH_AGENTS_DIR", tmp_path / "agents")
    (tmp_path / "agents").mkdir()
    return tmp_path


def seed_ledger(db: Path, closed_today: bool = True):
    today = datetime.now().strftime("%Y-%m-%d")
    with sqlite3.connect(db) as conn:
        conn.execute("""CREATE TABLE positions (
            id INTEGER PRIMARY KEY, symbol TEXT, quantity REAL, entry_price REAL,
            stop REAL, target REAL, state TEXT, origin TEXT, stop_order_id TEXT,
            exit_price REAL, exit_reason TEXT, closed_at TEXT)""")
        conn.execute(
            "INSERT INTO positions VALUES (1,'SLB',1.12,52.4,50.8,0,'open','adopted',NULL,NULL,NULL,NULL)"
        )
        conn.execute(
            "INSERT INTO positions VALUES (2,'KTOS',2,50.0,48.0,55.0,'open','decision','ord9',NULL,NULL,NULL)"
        )
        if closed_today:
            conn.execute(
                "INSERT INTO positions VALUES (3,'TMO',1,100.0,95.0,112.0,'closed','decision',NULL,"
                f"104.5,'target','{today}T13:10:00')"
            )


class TestTradingStatus:
    def test_fresh_heartbeat_is_alive(self, trader_dir):
        (trader_dir / "heartbeat_paper").write_text(datetime.now(ET).isoformat())
        status = collectors.trading_status()
        assert status["modes"]["paper"]["status"] == "alive"
        assert status["modes"]["paper"]["heartbeat_age_s"] <= 2

    def test_missing_heartbeat_is_unknown_and_old_is_stale(self, trader_dir):
        (trader_dir / "heartbeat_live").write_text("2026-07-20T09:00:00-04:00")
        status = collectors.trading_status()
        assert status["modes"]["paper"]["status"] == "unknown"
        assert status["modes"]["live"]["status"] == "stale"

    def test_ledger_positions_and_realized_pnl(self, trader_dir):
        seed_ledger(trader_dir / "paper.sqlite")
        modes = collectors.trading_status()["modes"]["paper"]
        symbols = {p["symbol"] for p in modes["open_positions"]}
        assert symbols == {"SLB", "KTOS"}
        adopted = next(p for p in modes["open_positions"] if p["symbol"] == "SLB")
        assert adopted["adopted"] is True and adopted["broker_stop"] is False
        protected = next(p for p in modes["open_positions"] if p["symbol"] == "KTOS")
        assert protected["broker_stop"] is True
        assert modes["realized_today"] == pytest.approx(4.5)

    def test_kill_switch_is_reported(self, trader_dir):
        assert collectors.trading_status()["kill_switch"] is False
        (trader_dir / "KILL").write_text("")
        assert collectors.trading_status()["kill_switch"] is True

    def test_last_decision_reads_the_tail(self, trader_dir):
        rows = [
            {"at": "2026-07-24T10:00:00", "decision": {"action": "pass", "thesis": "old"}},
            {"at": "2026-07-24T10:30:00",
             "decision": {"action": "buy", "symbol": "NVDA", "thesis": "fresh catalyst"}},
        ]
        (trader_dir / "decisions.jsonl").write_text(
            "\n".join(json.dumps(r) for r in rows) + "\n"
        )
        last = collectors.trading_status()["last_decision"]
        assert last["action"] == "buy" and last["symbol"] == "NVDA"

    def test_alerts_tail_returns_recent_lines(self, trader_dir):
        lines = [f"2026-07-26T0{i}:00:00Z alert {i}" for i in range(20)]
        (trader_dir / "alerts.log").write_text("\n".join(lines) + "\n")
        tail = collectors.trading_status()["alerts"]
        assert len(tail) == 12
        assert tail[-1].endswith("alert 19")

    def test_a_corrupt_ledger_degrades_to_empty(self, trader_dir):
        (trader_dir / "paper.sqlite").write_text("not a database")
        modes = collectors.trading_status()["modes"]["paper"]
        assert modes["open_positions"] == [] and modes["realized_today"] == 0.0


# ---------------------------------------------------------------------------
# Usage parser
# ---------------------------------------------------------------------------

class TestUsageParsing:
    def test_usage_lines_accumulate(self):
        counts = _blank_counts()
        line = json.dumps({"message": {"usage": {
            "input_tokens": 120, "output_tokens": 45,
            "cache_read_input_tokens": 9000, "cache_creation_input_tokens": 300,
        }}})
        _consume_usage_lines(f"{line}\n{line}\nnot json\n", counts)
        assert counts == {"input": 240, "output": 90, "cache_read": 18000,
                          "cache_write": 600, "turns": 2}

    def test_lines_without_usage_are_free(self):
        counts = _blank_counts()
        _consume_usage_lines('{"type":"summary"}\n{"message":{}}\n', counts)
        assert counts["turns"] == 0


# ---------------------------------------------------------------------------
# API contracts — frozen: external hooks depend on these routes and shapes
# ---------------------------------------------------------------------------

@pytest.fixture
def client(tmp_path, monkeypatch):
    import backend.main as main_mod
    monkeypatch.setattr(main_mod, "SESSIONS_DB", tmp_path / "sessions.db")
    monkeypatch.setattr("backend.routers.sessions.SESSIONS_DB", tmp_path / "sessions.db")
    with TestClient(main_mod.app) as c:
        yield c


class TestFrozenContracts:
    def test_sessions_log_roundtrip(self, client):
        r = client.post("/api/sessions/log", json={"role": "note", "content": "PR merged"})
        assert r.status_code == 200 and r.json()["ok"] is True
        entries = client.get("/api/sessions/today").json()["entries"]
        assert entries[-1]["content"] == "PR merged"

    def test_sessions_log_rejects_bad_role(self, client):
        r = client.post("/api/sessions/log", json={"role": "claude", "content": "x"})
        assert r.status_code == 422

    def test_crew_hook_tool_event(self, client):
        r = client.post("/api/crew/hook", json={
            "hook_event_name": "PreToolUse", "tool_name": "Bash",
            "tool_input": {"description": "Run tests"}, "cwd": "/Users/iris/Projects/range-trader",
        })
        assert r.status_code == 200
        crew = client.get("/api/crew").json()
        assert crew["crew"]["claude"]["status"] == "working"
        assert crew["crew"]["claude"]["task"] == "range-trader"
        assert crew["events"][-1]["text"] == "Run tests"

    def test_crew_hook_stop_goes_idle(self, client):
        client.post("/api/crew/hook", json={"hook_event_name": "Stop"})
        assert client.get("/api/crew").json()["crew"]["claude"]["status"] == "idle"

    def test_status_endpoint_shape(self, client):
        body = client.get("/api/status").json()
        for key in ("services", "system", "trading", "usage", "timestamp"):
            assert key in body
