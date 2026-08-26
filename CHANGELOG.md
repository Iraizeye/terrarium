# Changelog

## v0.16.0 - 2026-08-26 — WARM EMBER TERRARIUM A

- The stage reborn to the marked-favorite reference: rounded mahogany
  shell in a pine night, three tiers — the 3F hall (Strategy desk, house
  plaque, hall meet), 2F systems (Build's tablet, the Chief with
  Nightbell + binder), 1F PIT PATROL (KERNEL · LIVE · PAPER, locker,
  charts, PASS stamp, orange emblem). ELEVATOR RFC spans the shaft; a
  real RFC rides it as a yellow folder.
- New cast: ivory-cream robots with round amber-gold glowing eyes; the
  Chief stays the only red. Candle-warm light everywhere.
- The in-stage banner carries the doctor's full state matrix — it cannot
  say GO while the doctor is amber.
- Every law kept: artifact lamps, sleep at night, one patrol, meet only
  on live handoff, read-only always. Goldens regenerated (all 4,
  intentional). Rollback: tag v0.15.1 / branch checkpoint/pre-ember.

## v0.15.1 - 2026-08-26 — the chrome catches up to the bell

First pass by the new UI/UX seat, scoped to three fixes:
- The status strip now follows the full state matrix: GO only when the
  doctor agrees; DEGRADED/NOT READY carry their cause; KILL and missing
  telemetry are named; a quiet night reads "NIGHT WATCH · all quiet"
  instead of implying it.
- The tape stops at night: "TAPE CLOSED · reopens 09:30 ET" — no more
  scrolling yesterday's prices at 5am.
- The left rail scrolls inside its row instead of bleeding into the
  vitals at small heights (the 1280x760 night-laptop overlap).

## v0.15.0 - 2026-08-26 — art direction A, company behavior

- Same robots, same rooms, deeper truth: departments SLEEP at night
  (closed-lid eyes) when off shift; the chief's bubble falls back
  brief → strategy verdict → "night watch — no brief".
- One wide TRADING PIT: the patrol now loops inside it (LIVE → KERNEL →
  PAPER); a stale heartbeat sits the live bot at its terminal instead of
  ghost-standing. The interlock grew into the KERNEL locker — padlock
  closed green when armed & watched, open red on KILL.
- The NIGHTBELL hangs by the executive shaft: glows + swings only while
  phone-worthy alarms are live. A fresh RFC sends the yellow folder
  Strategy → Build along 2F.
- Left rail is departments-first: DEPARTMENTS lamps (artifact ages) above
  the desk seats; annexes (ops, content, projects) now all live on 2F.

## v0.14.0 - 2026-08-26 — the company floors

- The building now draws Vesper as a company, same art language: 2F is
  STRATEGY + BUILD (on-call primaries) with ops/projects annexes; the
  paper book moved down to a two-terminal TRADING PIT beside the premarket
  briefing desk; an INTERLOCK breaker renders real kill-switch + watchdog
  state (display only). The trader stays the ground-floor plant.
- Light law: department lamps are artifact-driven — Strategy = fresh RFC
  in ~/Projects/vesper/rfcs, Build = fresh commit in a hub repo, Chief =
  its own run only (a busy session no longer lights the chief).
- New IDEAS · RFC rail reads the RFC shelf; `GET /api/company`.
- Demo gains the upstairs beat: a [demo] Strategy verdict lands mid-
  morning, Build blinks, the pit trades on.
- Fixed: watchdog "not installed" false alarm after the vesper label
  rename; annex wall art clamped inside narrow rooms.

## v0.13.0 - 2026-08-26 — the quality floor

- The look is now a tested contract: Playwright renders the building and
  home page against a frozen scripted demo instant (`TERRARIUM_DEMO_AT`,
  `?freeze=`) and diffs pixels at three window sizes. `make visual`.
- Lint everywhere: ruff (backend), Biome (frontend, + format), knip
  (dead code), all under `make test`. First sweep fixed real findings —
  two absolute URLs that bypassed the vite proxy (home + search were
  broken under docker), a page refresh spawning phantom office mail, and
  the last greenhouse-era dead code in theme.ts.
- Escape now closes the intro overlay; buttons carry explicit types.

## v0.12.0 - 2026-08-26 — the plugin

- Terrarium is now a Claude Code plugin, and this repo is its marketplace:
  `/plugin marketplace add Iraizeye/terrarium` then
  `/plugin install terrarium@terrarium`. Hooks stream sessions onto the
  floor (tool names + file basenames, localhost only, fire-and-forget);
  `/terrarium:status` and `/terrarium:note` ride along.
- `TERRARIUM_URL` env overrides the default `http://127.0.0.1:8000`.

## v0.11.1 - 2026-08-26 — the office mail is real

- Inter-agent traffic is now drawn, never invented: when a seat finishes a
  real run, an envelope rides the elevator to the chief's desk (the chief
  seat genuinely digests every output); when the chief's brief goes out,
  the envelope leaves the building (Telegram); a fresh trader alert sends
  a note from the lobby toward the desk rail. Born from LinkedIn feedback
  asking for "agents that talk" — this is the version that keeps the
  telemetry law.
- `?mail=test` previews the animation (same class of dev knob as `?phase=`).

## v0.11.0 - 2026-08-24 — receipts

- Unified search: `GET /api/search?q=` fans out read-only across the
  session log, trader alerts, decisions, the agent's memory shelf, and
  the Argus mailbox — dated, source-tagged hits, newest first. The left
  rail grows a search box; an active query swaps the rail to a receipts
  panel. Deep-linkable via `?q=`. Idea borrowed from block/buzz's unified
  event log, sized to one machine.
- Demo mode ships a scripted search corpus — searching in demo never
  reads the visitor's files.

## v0.10.1 - 2026-08-24 — the repo tells the truth

- README rewritten around the product as it is: the three-story building,
  the activity lights, a "how to read the building" legend, and fresh
  screenshots — the real night watch plus two demo-mode captures.
- Demo mode now covers `/api/home` with a fully scripted home page; before
  this, demo read the visitor's real `~/.claude` memory shelf, breaking
  the "nothing on your machine is read" promise.
- Demo desk seats stamp wall-relative `ran_at` so the 20-minute activity
  lights actually perform in demo: most offices lit, premarket off shift.
- Deep links: `?view=home` opens the agent's home page, `?intro=0` skips
  the intro overlay (kiosk displays, screenshots).
- Intro overlay copy and colors caught up with the building and the warm
  brass chrome.

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
