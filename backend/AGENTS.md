# Backend Context

FastAPI backend for TERRARIUM on 127.0.0.1:8000. Five modules; keep it small.

- `collectors.py` — all data gathering, read-only and best-effort: a missing
  file is a status, never an exception
- `routers/crew.py` — Claude Code hook receiver; the `/api/crew/hook` contract
  is frozen
- `routers/sessions.py` — session log; `/api/sessions/log` contract is frozen
- Tests: `venv/bin/python -m pytest tests/` — cover any new collector with a
  fixture-directory test like the existing ones
