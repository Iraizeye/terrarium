# Changelog

## v0.10.0 - 2026-08-24 — the building

- The office is now a three-storey cutaway, ant-farm style: the board
  room up top (chief presenting on his rug), three private offices on
  the middle floor, and a ground-floor lobby — house clock, TERRARIUM
  letters, bench plants, and the LIVE bot on patrol — joined by an
  elevator shaft with floor doors and an indicator light.
- Bots scaled down again; every office keeps its own status monitor,
  pinned notes, and a personal floor accessory.

## v0.9.2 - 2026-08-24 — the crew, drawn in code

- Robot sprites retired; the copper crew is now drawn procedurally in the
  room's own art language. Chibi proportions, big status-lit visor eyes,
  per-bot copper tints, and real animation: typing hands, walking legs,
  blinks, bobs, a pointing chief with his red marker.
- Zero raster assets remain — the whole stage is code, crisp at any DPI.

## v0.9.1 - 2026-08-24 — the room, drawn in code

- The painted backdrop is retired; the room is now drawn on canvas around
  the robot sprites. Crisp at any aspect ratio, no cover-crop drift.
- Everything in the room works: the big board houses the live tape, the
  LED sign and analog wall clock tell real session time, desk monitors
  glow with each seat's actual status, and the walls re-light with the
  market phase (dawn / open / dusk / night).

## v0.9.0 - 2026-08-24 — the office

- Center stage is a hand-drawn night trading office (art by a guest
  agent; wiring by the house). Copper robots are the real cast: four desk
  seats, both trading books, and the chief of staff pointing at the wall
  when the morning brief is in.
- Every painted screen that showed data now shows real data: desk CRTs
  and two wall monitors render the live tape, and the office sign is a
  live LED with the actual session phase and clock.
- A time-of-day grade tints the painting with the real market phase.
- Sky variants and the toggle removed; the office is the one stage.

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
