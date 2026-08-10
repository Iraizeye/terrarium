"""Claude Home endpoints: every reader survives missing files, and no
secret material ever crosses the boundary."""

import json
import sqlite3
from pathlib import Path

from backend.routers import home


def test_memory_shelf_parses_index_and_sorts_by_mtime(tmp_path):
    (tmp_path / "MEMORY.md").write_text(
        "- [Old fact](old.md) — an old hook\n"
        "- [New fact](new.md) — a new hook\n"
        "not a memory line\n"
    )
    (tmp_path / "old.md").write_text("x")
    (tmp_path / "new.md").write_text("x")
    import os, time
    os.utime(tmp_path / "old.md", (time.time() - 9000, time.time() - 9000))
    shelf = home.read_memory_shelf(tmp_path)
    assert [e["title"] for e in shelf] == ["New fact", "Old fact"]
    assert shelf[0]["hook"] == "a new hook"


def test_memory_shelf_missing_dir_is_empty_not_error(tmp_path):
    assert home.read_memory_shelf(tmp_path / "nope") == []


def test_doctor_line_finds_latest_and_reads_green(tmp_path):
    log = tmp_path / "alerts.log"
    log.write_text(
        "2026-08-08T07:39:54+00:00 range-trader DOCTOR: 17 problem(s) — stuff\n"
        "2026-08-08T09:00:00+00:00 range-trader other alert\n"
        "2026-08-09T13:15:00+00:00 range-trader DOCTOR: all green (flat)\n"
    )
    d = home.read_doctor_line(log)
    assert d["green"] is True and "all green" in d["line"]


def test_watch_items_exposes_expiry_but_never_tokens(tmp_path):
    (tmp_path / "oauth.json").write_text(json.dumps({
        "tokens": {"access_token": "SECRET", "refresh_token": "ALSO-SECRET"},
        "expires_at": 1234567890.0,
    }))
    items = home.read_watch_items(tmp_path)
    assert items["token_expires_at"] == 1234567890.0
    assert "SECRET" not in json.dumps(items)


def test_watch_items_reads_open_positions_readonly(tmp_path):
    db = tmp_path / "live.sqlite"
    conn = sqlite3.connect(db)
    conn.execute("CREATE TABLE positions (symbol TEXT, quantity REAL,"
                 " stop REAL, horizon TEXT, state TEXT)")
    conn.execute("INSERT INTO positions VALUES ('FIVN', 1.0, 31.9, 'day', 'open')")
    conn.execute("INSERT INTO positions VALUES ('ZLAB', 4.0, 20.2, 'day', 'closed')")
    conn.commit(); conn.close()
    items = home.read_watch_items(tmp_path)
    assert [p["symbol"] for p in items["positions"]] == ["FIVN"]


def test_experiments_parse_titles_sample_and_pass(tmp_path):
    md = tmp_path / "EXPERIMENTS.md"
    md.write_text(
        "# Pre-registered\n\n"
        "## 1. Swing sleeve (PR #69)\n\n"
        "- **Sample**: first 15 swing trades.\n"
        "- **PASS**: expectancy >= +0.25R.\n\n"
        "## Grading log\n\n| a | b |\n"
    )
    exps = home.read_experiments(md, state_dir=tmp_path)
    assert len(exps) == 1
    assert exps[0]["title"].startswith("1. Swing")
    assert "15 swing" in exps[0]["sample"]
    assert exps[0]["pass_bar"].startswith("expectancy")


def test_toolbox_counts_or_null(tmp_path):
    (tmp_path / "skills" / "one").mkdir(parents=True)
    box = home.read_toolbox(tmp_path, tmp_path / "no-mem")
    assert box["skills"] == 1
    assert box["agents"] is None and box["memories"] is None
