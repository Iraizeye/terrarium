# RANGEWATCH

**Mission control for one agent, one trader, one machine.**

![THE MESA — a compressed trading day in demo mode](docs/media/rangewatch-demo-day.gif)

*The sun is the market. It rises for the open, arcs while the session runs,
and sets after the close; nights get a cratered moon. The watchtower is
Claude — lit window, sweeping beacon, an owl on the roof. Above: demo mode
compressing a full trading day into five minutes.*

## Try it in 60 seconds — no accounts, no config

```bash
git clone https://github.com/iriseye931-ai/rangewatch && cd rangewatch
make demo        # -> http://127.0.0.1:3000
```

Demo mode (`RANGEWATCH_DEMO=1`) runs every panel on a **scripted synthetic
day** — a fictional trader working NOVA, RIDGE and CINDER through entries,
breakeven trails, a stop-out and a target, while a scripted agent works the
watchtower. A compressed 24h session loops every 5 minutes so you see dawn,
the open, the close and the stars without waiting for New York. Every line
is fiction and labeled `[demo]`; nothing on your machine is read.

## Skies

Three themes, same range. Cycle with the `SKY:` button in the header, pin
one with `?theme=mesa|observatory|embers`, preview any hour with
`?phase=night|dawn|day|dusk`.

| MESA *(flagship)* | OBSERVATORY | EMBERS |
|---|---|---|
| ![MESA](docs/media/theme-mesa.jpg) | ![OBSERVATORY](docs/media/theme-observatory.jpg) | ![EMBERS](docs/media/theme-embers.jpg) |
| First light — violet & gold | High-altitude steel & cyan | Fire watch — copper & coal |

A local-first dashboard that watches the three things that matter on this box:

- **Claude** — live activity via Claude Code hooks: every session, tool call,
  and finished turn lands on the stage in ~2s, plus a token/usage strip parsed
  incrementally from local transcripts (ccusage-style, nothing leaves the Mac)
- **The trader** — [range-trader](https://github.com/iriseye931-ai/robinhood-agentic-trader)
  paper + live daemons: heartbeat freshness, watchdog arming, kill-switch
  state, open positions with stop/target, realized P&L today, the engine's
  last decision and thesis, and a live alerts tail
- **The machine** — CPU / RAM / disk / uptime, the trading daemons' footprint,
  and TCP checks on the services that still exist

**The sky lives the trading day** — the FIRST LIGHT theme. Violet is the
agent's color; gold is the market's. Deep pre-dawn indigo while Claude works
the night, an amber glow climbing the horizon in the 90 minutes before the
open, a golden horizon under the range while the market trades, and an ember
fade after the close. Preview any phase with `?phase=night|dawn|day|dusk`.

The centerpiece is a flight-control **big board**: a market clock counting down to
the next open/close, and a GO/NO-GO grid over the *real* stack — PAPER, LIVE,
WDOG-P, WDOG-L, KILL, GLANCE, OPTICS, FEED. Red means something is actually
wrong; a healthy machine reads **ALL STATIONS GO**.

The stage is **THE MESA** — a silhouette landscape where the sun *is* the
market: it climbs toward the ridge as the open approaches, arcs across the
sky while the session runs, and sets after the close; off-hours get a
cratered violet moon and twinkling stars. Claude is the watchtower on the
range — a lit window and a sweeping beacon in status color, readable from
across the room — with a small owl silhouette on the roof, gold eyes
blinking. A finished turn sends a shooting star across the sky. Click the
tower: the owl waves.

## Architecture

```
backend/   FastAPI :8000 — 5 modules, read-only collectors, WebSocket push
frontend/  React + Vite :3000 — canvas stage, trading desk, ops log
```

Two API contracts are **frozen** (external hooks depend on them):

- `POST /api/crew/hook` — Claude Code hook receiver (`~/.claude/settings.json`)
- `POST /api/sessions/log` — session/alert log (`range-trader`'s alert hook)

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
| `RANGEWATCH_SESSIONS_DB` | session-log SQLite | `~/.claude/atlas-sessions.db` |

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

