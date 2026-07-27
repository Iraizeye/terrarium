# Changelog

## v0.7.0 - 2026-07-26 — RANGEWATCH

First public cut under this name. One agent, one trader, one machine:

- Read-only collectors: system vitals, TCP service checks, the range-trader
  stack (heartbeats, ro-mode ledgers, decisions/alerts tails), and Claude
  token usage parsed incrementally from local transcripts
- Big board: market clock (ET countdown to open/close) + GO/NO-GO grid
  (PAPER, LIVE, WDOG-P, WDOG-L, KILL, GLANCE, OPTICS, FEED)
- Trading desk rail: positions with stop/target and protection type,
  realized P&L today, last decision thesis, live alerts tail
- Frozen contracts: `POST /api/crew/hook`, `POST /api/sessions/log`
- FIRST LIGHT theme: the sky follows the session — night, dawn (90 min
  before open), day, dusk — violet for the agent, gold for the market
- Backend binds 127.0.0.1; 19 tests
