# TERRARIUM

**Your AI agents, under glass.**

![Terrarium at dawn — live telemetry, real agents](docs/media/terrarium-hero.jpg)

*Dawn run, live: agents at their desks under the glass wall, the trading
books flat before the open, a PASS ruling fresh off the engine, and the
ops log streaming the very session that took this screenshot.*

## What am I looking at?

Terrarium is a local-first mission control for the AI agents running on one
machine. Every agent session is a figure on the floor; the sky lives the
real market day; the rails carry live telemetry — sessions, scheduled
seats, both trading books, an ops log, machine vitals. Everything on screen
is real (except demo mode, which says so on every line).

## Try it in 60 seconds — no accounts, no config

```bash
git clone https://github.com/Iraizeye/terrarium && cd terrarium
make demo        # -> http://127.0.0.1:3000
```

Demo mode (`TERRARIUM_DEMO=1`) runs every panel on a **scripted synthetic
day** — a fictional trader working NOVA, RIDGE and CINDER through entries,
breakeven trails, a stop-out and a target, while scripted agent sessions
stream the ops log. A compressed 24h session loops every 5 minutes so you
see the glasshouse at dawn, through the open, past the close and into the
firefly night without waiting for New York. Every line is fiction and
labeled `[demo]`; nothing on your machine is read.

First visit, an intro overlay walks you through the four zones; reopen it
any time with the `?` button in the header. Preview any hour of the sky
with `?phase=night|dawn|day|dusk`.

A local-first dashboard that watches the three things that matter on the box:

- **The agents** — live activity via Claude Code hooks: every session, tool
  call, and finished turn lands on the stage in ~2s, plus a token/usage strip
  parsed incrementally from local transcripts (nothing leaves the machine)
- **The trader** — [an autonomous trading agent's](https://github.com/Iraizeye/robinhood-agentic-trader)
  paper + live daemons: heartbeat freshness, watchdog arming, kill-switch
  state, open positions with stop/target, realized P&L today, the engine's
  last decision and thesis, and a live alerts tail
- **The machine** — CPU / RAM / disk / uptime, the trading daemons' footprint,
  and TCP checks on the services that still exist

Health checks run over the *real* stack — daemons, watchdogs, heartbeats,
kill switch, disk — and feed the header status bar. Red means something is
actually wrong; a healthy machine reads **ALL STATIONS GO**.

The stage is a pixel glasshouse: the market day is the light through the
panes — deep green night with fireflies outside the glass, amber climbing
at dawn, warm gold while the session runs. Agents work at wooden desks
among hanging planters; the ticker runs across the glass; a quiet floor
looks quiet, because nothing on it is simulated.

## Architecture

```
backend/   FastAPI :8000 — 5 modules, read-only collectors, WebSocket push
frontend/  React + Vite :3000 — canvas stage, trading desk, ops log
```

Two API contracts are **frozen** (external hooks depend on them):

- `POST /api/crew/hook` — Claude Code hook receiver (`~/.claude/settings.json`)
- `POST /api/sessions/log` — session/alert log (the trading agent's alert hook)

Everything the backend watches, it watches read-only: ledgers open in SQLite
ro-mode, transcripts and logs are tail-read from byte offsets, and the only
thing it ever writes is its own session-log DB.

## Run it for real

```bash
make dev         # backend :8000 + frontend :3000 against YOUR machine
```

Point it at your own stack with env vars (all optional — a panel with
nothing to watch renders quietly instead of breaking):

| Env | Watches | Default |
|---|---|---|
| `RANGE_TRADER_DIR` | trader heartbeats, ledgers, alerts | `~/.range-trader` |
| `CLAUDE_PROJECTS_DIR` | Claude Code transcripts (token usage) | `~/.claude/projects` |
| `TERRARIUM_SESSIONS_DB` | session-log SQLite | `~/.claude/atlas-sessions.db` |

Everything binds to localhost only. This is a local-first, host-path-bound
tool by design — it reads local state directly, so there is deliberately no
hosted version.

## Tests

```bash
make test
```

Covers the market clock (including weekend rollover), the trading collector
against fixture ledgers, incremental usage parsing, demo-mode shape parity,
and both frozen contracts.
