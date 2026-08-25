"""TERRARIUM backend tests — collectors and the two frozen API contracts."""
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


class TestDemoMode:
    """Demo collectors must be indistinguishable in shape from the real ones —
    the frontend has exactly one code path."""

    def test_full_loop_covers_every_phase(self):
        from backend.demo import DEMO_DAY_S, _demo_minute, demo_market_clock

        seen = set()
        for i in range(0, DEMO_DAY_S, 2):
            clock = demo_market_clock(now=float(i))
            minute = _demo_minute(float(i))
            if clock["is_open"]:
                seen.add("day")
            elif 8 * 60 <= minute < 9 * 60 + 30:
                seen.add("dawn")
            elif 16 * 60 <= minute < 19 * 60:
                seen.add("dusk")
            else:
                seen.add("night")
        assert seen == {"dawn", "day", "dusk", "night"}

    def test_trading_shape_matches_real_collector(self):
        from backend.demo import demo_trading_status

        t = demo_trading_status()
        assert set(t) == {"market", "kill_switch", "modes", "last_decision", "alerts"}
        for mode in ("paper", "live"):
            m = t["modes"][mode]
            assert set(m) == {"status", "heartbeat_age_s", "watchdog_armed",
                              "open_positions", "closed_today", "realized_today"}
            for p in m["open_positions"]:
                assert set(p) == {"symbol", "quantity", "entry", "stop", "target",
                                  "state", "adopted", "broker_stop"}

    def test_demo_is_deterministic(self):
        from backend.demo import demo_market_clock

        assert demo_market_clock(now=123.0) == demo_market_clock(now=123.0)

    def test_system_and_usage_shapes(self):
        from backend.demo import demo_claude_usage, demo_system_metrics
        from backend.collectors import system_metrics

        assert set(demo_system_metrics()) == set(system_metrics())
        usage = demo_claude_usage()
        assert usage["available"] is True
        assert usage["output_tokens"] >= 0

    def test_demo_fiction_is_labeled(self):
        from backend.demo import demo_trading_status

        # Every synthetic alert self-identifies; nobody mistakes fiction for a fill.
        for line in demo_trading_status()["alerts"]:
            assert line.startswith("[demo]")

    def test_demo_home_matches_shape_and_reads_nothing(self):
        from backend.demo import demo_home

        home = demo_home()
        # Same top-level shape as /api/home so the frontend can't tell.
        assert set(home) == {"memory", "doctor", "watch", "experiments", "toolbox"}
        assert set(home["watch"]) == {"token_expires_at", "positions", "kill",
                                      "last_broker_contact"}
        # Every scripted line self-identifies as fiction.
        for m in home["memory"]:
            assert m["title"].startswith("[demo]")
        for e in home["experiments"]:
            assert e["title"].startswith("[demo]")
        assert home["doctor"]["line"].startswith("[demo]")

    def test_demo_desk_is_clock_driven_and_labeled(self):
        from backend.demo import demo_desk

        dawn = demo_desk(now=0.0)  # loop start = 08:15 ET
        names = [s["name"] for s in dawn["seats"]]
        assert names == ["premarket", "ops", "content", "projects", "chief"]
        # Premarket fires at 08:15; the rest of the roster is still waiting.
        assert dawn["seats"][0]["status"] == "ok"
        assert all(s["status"] == "pending" for s in dawn["seats"][1:])
        from backend.demo import DEMO_DAY_S
        day = demo_desk(now=DEMO_DAY_S * 0.5)
        for seat in day["seats"]:
            assert seat["status"] == "ok"
            assert seat["brief"].startswith("[demo]")
            assert seat["ran_at"].endswith("+00:00") or seat["ran_at"].endswith("Z")
        # ran_at is wall-relative so the floor's 20-minute activity lights
        # actually light in demo: most seats recent, premarket off shift.
        from datetime import datetime, timezone
        ages = {
            s["name"]: (datetime.now(timezone.utc) - datetime.fromisoformat(s["ran_at"])).total_seconds() / 60
            for s in day["seats"]
        }
        assert ages["premarket"] > 20
        assert all(ages[n] < 20 for n in ("ops", "content", "projects", "chief"))


# ---------------------------------------------------------------------------
# Agent fleet
# ---------------------------------------------------------------------------

def _write_transcript(dir_: Path, session: str, rows: list[dict], age_s: float = 0) -> Path:
    import os, time
    dir_.mkdir(parents=True, exist_ok=True)
    path = dir_ / f"{session}.jsonl"
    path.write_text("\n".join(json.dumps(r) for r in rows) + "\n")
    if age_s:
        stamp = time.time() - age_s
        os.utime(path, (stamp, stamp))
    return path


def _assistant_row(tool: str | None = None, file_path: str | None = None,
                   text: str | None = None) -> dict:
    content = []
    if tool:
        block = {"type": "tool_use", "name": tool, "input": {}}
        if file_path:
            block["input"]["file_path"] = file_path
        content.append(block)
    if text:
        content.append({"type": "text", "text": text})
    return {"type": "assistant",
            "message": {"role": "assistant", "model": "claude-opus-5",
                        "content": content,
                        "usage": {"input_tokens": 10, "output_tokens": 5}}}


class TestAgentFleet:
    def _fleet(self, monkeypatch, projects_dir):
        monkeypatch.setattr(collectors, "CLAUDE_PROJECTS_DIR", projects_dir)
        return collectors.agent_fleet()

    def test_states_split_by_recency(self, tmp_path, monkeypatch):
        base = tmp_path / "projects"
        _write_transcript(base / "-Users-iris-Projects-range-trader", "aaaa1111",
                          [_assistant_row(tool="Edit", file_path="/x/engine.py")], age_s=10)
        _write_transcript(base / "-Users-iris-Projects-terrarium", "bbbb2222",
                          [_assistant_row(text="ok")], age_s=600)
        fleet = self._fleet(monkeypatch, base)

        assert fleet["available"]
        by = {a["session"]: a for a in fleet["agents"]}
        assert by["aaaa1111"]["state"] == "live"
        assert by["bbbb2222"]["state"] == "idle"
        # live sorts before idle regardless of glob order
        assert fleet["agents"][0]["session"] == "aaaa1111"

    def test_project_name_decodes_from_dir(self, tmp_path, monkeypatch):
        base = tmp_path / "projects"
        _write_transcript(base / "-Users-iris-Projects-range-trader", "aaaa1111",
                          [_assistant_row(text="x")])
        _write_transcript(base / "-Users-iris", "bbbb2222", [_assistant_row(text="x")])
        fleet = self._fleet(monkeypatch, base)
        names = {a["session"]: a["project"] for a in fleet["agents"]}
        assert names["aaaa1111"] == "range-trader"
        assert names["bbbb2222"] == "iris"

    def test_action_is_tool_and_basename_never_content(self, tmp_path, monkeypatch):
        """The privacy guarantee: prompt/command text must be structurally
        unable to reach the payload — the dashboard gets screenshotted."""
        secret = "SUPER_SECRET_PROMPT_TEXT"
        rows = [
            {"type": "user", "message": {"role": "user", "content": secret}},
            _assistant_row(tool="Bash", text=secret),
            _assistant_row(tool="Edit", file_path="/deep/path/engine.py"),
        ]
        base = tmp_path / "projects"
        _write_transcript(base / "-Users-iris-Projects-range-trader", "aaaa1111", rows)
        fleet = self._fleet(monkeypatch, base)

        assert fleet["agents"][0]["action"] == "Edit engine.py"
        assert secret not in json.dumps(fleet)

    def test_done_sessions_carry_no_action(self, tmp_path, monkeypatch):
        base = tmp_path / "projects"
        _write_transcript(base / "-Users-iris-Projects-old", "cccc3333",
                          [_assistant_row(tool="Bash")], age_s=5000)
        fleet = self._fleet(monkeypatch, base)
        agent = fleet["agents"][0]
        assert agent["state"] == "done" and agent["action"] is None

    def test_yesterdays_sessions_are_excluded(self, tmp_path, monkeypatch):
        base = tmp_path / "projects"
        _write_transcript(base / "-Users-iris-Projects-x", "dddd4444",
                          [_assistant_row(text="x")], age_s=86400 * 2)
        assert self._fleet(monkeypatch, base)["agents"] == []

    def test_missing_dir_is_a_status_not_an_exception(self, tmp_path, monkeypatch):
        fleet = self._fleet(monkeypatch, tmp_path / "nope")
        assert fleet == {"available": False, "agents": []}

    def test_fleet_is_capped(self, tmp_path, monkeypatch):
        base = tmp_path / "projects"
        for i in range(collectors.FLEET_MAX_AGENTS + 5):
            _write_transcript(base / f"-Users-iris-Projects-p{i}", f"sess{i:04d}",
                              [_assistant_row(text="x")])
        fleet = self._fleet(monkeypatch, base)
        assert len(fleet["agents"]) == collectors.FLEET_MAX_AGENTS

    def test_corrupt_lines_do_not_break_the_tail(self, tmp_path, monkeypatch):
        base = tmp_path / "projects"
        d = base / "-Users-iris-Projects-x"
        d.mkdir(parents=True)
        (d / "eeee5555.jsonl").write_text('{"broken\nnot json at all\n')
        fleet = self._fleet(monkeypatch, base)
        assert fleet["agents"][0]["action"] is None  # degraded, not dead


# ---------------------------------------------------------------------------
# The Board
# ---------------------------------------------------------------------------

class TestBoardState:
    def _setup(self, tmp_path, monkeypatch):
        import json as _json

        logs = tmp_path / "logs"
        logs.mkdir()
        monkeypatch.setattr(collectors, "RANGE_TRADER_DIR", tmp_path)
        monkeypatch.setattr(collectors, "BOARD_LOG", {
            "paper": logs / "daemon.log", "live": logs / "daemon-live.log",
        })
        board = {"CAKE": {"tech": "RSI 64; ADX(10,5m) 31",
                          "earn": "reported yesterday pm: +26% beat",
                          "last": 100.77, "rvol": 3.7}}
        funnel = {"scanned": 8, "to_engine": 5, "unaffordable_filtered": 2}
        (logs / "daemon-live.log").write_text(
            "noise line\n"
            f"[board] {_json.dumps(board)}\n"
            f"[funnel] {_json.dumps(funnel)}\n"
        )
        (logs / "daemon.log").write_text("")
        (tmp_path / "decisions_live.jsonl").write_text(_json.dumps({
            "at": "2026-08-03T11:20:04-04:00",
            "decision": {"action": "pass", "pass_reason": "rr_below_min",
                         "symbol": None,
                         "thesis": "CAKE is clean but 1.3:1 after the spread. " + "x" * 400},
        }) + "\n")
        (tmp_path / "shadow_live.json").write_text(_json.dumps({
            "day": "2026-08-03",
            "tickets": {"CAKE": {"symbol": "CAKE", "mark": 98.70, "last": 100.77,
                                 "high": 101.0, "low": 98.5, "cycles": 3,
                                 "affordable": True,
                                 "first_seen": "2026-08-03T09:51:00"}},
        }))
        return collectors.board_state()

    def test_candidates_carry_instruments_and_moves(self, tmp_path, monkeypatch):
        state = self._setup(tmp_path, monkeypatch)
        live = state["arms"]["live"]
        cake = live["candidates"][0]
        assert cake["tech"].endswith("ADX(10,5m) 31")
        assert "+26% beat" in cake["earn"]
        assert round(cake["move_pct"], 4) == round((100.77 - 98.70) / 98.70, 4)
        assert live["funnel"]["unaffordable_filtered"] == 2
        assert live["pass_reason"] == "rr_below_min"

    def test_gist_is_capped_never_full_reasoning(self, tmp_path, monkeypatch):
        """The dashboard is screenshotted; a sentence of why, never the model's
        full chain of thought."""
        state = self._setup(tmp_path, monkeypatch)
        assert len(state["arms"]["live"]["gist"]) <= 180

    def test_missing_files_degrade_to_empty_arm(self, tmp_path, monkeypatch):
        monkeypatch.setattr(collectors, "RANGE_TRADER_DIR", tmp_path / "nope")
        monkeypatch.setattr(collectors, "BOARD_LOG", {
            "paper": tmp_path / "nope" / "a.log", "live": tmp_path / "nope" / "b.log",
        })
        state = collectors.board_state()
        assert state["available"] is True
        assert state["arms"]["live"]["candidates"] == []
