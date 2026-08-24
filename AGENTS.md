# Project Context

`terrarium` (local path: `mission-control-dashboard`) is the operator UI for a
single-agent setup: **Claude Code** (the only agent), the **range-trader**
autonomous trading stack, and the machine they run on. Single-agent is a design
decision — do not add polling for services that do not exist.

## Architecture

- `frontend/` — React/Vite dashboard on `127.0.0.1:3000`
- `backend/` — FastAPI + WebSocket on `127.0.0.1:8000`; five modules
  (`main`, `state`, `collectors`, `routers/crew`, `routers/sessions`)
- The backend is **read-only** over everything it watches: SQLite ledgers open
  in ro-mode, logs and transcripts are tail-read from byte offsets. Its only
  write is its own session-log DB.

## Frozen contracts — never change these

- `POST /api/crew/hook` — Claude Code hooks in `~/.claude/settings.json`
- `POST /api/sessions/log` — range-trader's alert hook and session notes

## Product expectations

- Operator trust over visual flair: never show GO for something unverified.
- The GO/NO-GO board covers only things that exist; a healthy machine reads
  ALL STATIONS GO with zero red.
- Keep the pixel/CRT visual identity (Fira Code, violet accent, canvas stage).
- No fake or simulated data on live surfaces.

## Editing guidance

- Backend changes: run `backend/venv/bin/python -m pytest backend/tests/`.
- Frontend changes: `cd frontend && npm run build` must pass (tsc + vite).
- Do not add a `?v=` cache-buster to `frontend/index.html` — one white-screened
  the app after dependency changes; Vite manages its own invalidation.
- When changing the status payload, update `backend/state.py`,
  `frontend/src/types/index.ts`, and the store/websocket consumers together.
