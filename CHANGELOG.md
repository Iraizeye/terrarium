# Changelog

## v0.8.1 - 2026-08-24 — the tank

- Center stage is a closed terrarium: brass-framed glass, soil, moss,
  ferns, condensation, fireflies at night. Agents work at stone slabs
  in the garden; the chief of staff is the inner cloche.
- Pending seats render as dim amber robots instead of empty desks.
  Canvas sky follows `?phase=` / the real session clock.
- Shell is responsive: the tank stays the hero on tablet and phone.
- Demo mode scripts the desk roster so `make demo` shows a full house.

## v0.8.0 - 2026-08-24 — TERRARIUM

- Renamed RANGEWATCH -> TERRARIUM ("your agents, under glass"); old
  RANGEWATCH_* env names still honored, saved theme prefs migrate.
- Floor scene rebuilt as a pixel glasshouse: glass back wall living the
  market day, hanging planters, fireflies at night; workers are now
  little AI robots; the chief of staff is a glass terrarium dome.
- Rails redesigned on a shared cool-dark design system (zinc + emerald);
  first-visit intro overlay; readable empty states; no more mid-word
  truncation.

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
- THE MESA stage: silhouette landscape where the sun IS the market — it
  tracks the session arc across the sky; moon + stars off-hours; Claude as
  the lit watchtower with status beacon; shooting-star celebrations; the
  owl remains as a roof silhouette with gold eyes
- (superseded same night) The watch-owl: Claude redesigned from scratch as a violet owl with golden
  iris eyes in a watchtower — status beacon sweeps the sky in state color,
  eyes track activity, prairie-grass range floor with a fence line
- FIRST LIGHT theme: the sky follows the session — night, dawn (90 min
  before open), day, dusk — violet for the agent, gold for the market
- Backend binds 127.0.0.1; 19 tests
