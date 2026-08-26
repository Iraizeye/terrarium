"""
TERRARIUM — FastAPI backend on :8000.

Watches three things: Claude (hook feed), the range-trader stack (ledgers,
heartbeats, alerts), and this machine (vitals, service ports). Read-only over
everything it watches; the only writes are its own session-log DB.
"""
import asyncio
import json
import sqlite3
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from . import state as _st
from .config import DEMO, MAX_WS_CONNECTIONS, POLL_INTERVAL, SESSIONS_DB
from .routers import crew, desk, home, search, sessions
from .state import _now_iso, _state, broadcast_status, status_payload

if DEMO:
    from .demo import (
        demo_agent_fleet as agent_fleet,
    )
    from .demo import (
        demo_board_state as board_state,
    )
    from .demo import (
        demo_claude_usage as claude_usage,
    )
    from .demo import (
        demo_service_checks as service_checks,
    )
    from .demo import (
        demo_system_metrics as system_metrics,
    )
    from .demo import (
        demo_trading_status as trading_status,
    )
else:
    from .collectors import (
        agent_fleet,
        board_state,
        claude_usage,
        service_checks,
        system_metrics,
        trading_status,
    )


def _init_sessions_db() -> None:
    with sqlite3.connect(SESSIONS_DB) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS session_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                ts TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_date ON session_log(date)")


async def run_poll_loop() -> None:
    loop = asyncio.get_event_loop()
    while True:
        try:
            system, services, trading, usage = await asyncio.gather(
                loop.run_in_executor(None, system_metrics),
                loop.run_in_executor(None, service_checks),
                loop.run_in_executor(None, trading_status),
                loop.run_in_executor(None, claude_usage),
            )
            # Sequenced after the gather on purpose: fleet reads the token
            # offsets claude_usage maintains, so running it afterwards keeps
            # the counts consistent instead of racing the same dict.
            fleet = await loop.run_in_executor(None, agent_fleet)
            _state["board"] = await loop.run_in_executor(None, board_state)
            _state["system"] = system
            _state["services"] = services
            _state["trading"] = trading
            _state["usage"] = usage
            _state["fleet"] = fleet
            _state["last_updated"] = _now_iso()
            await broadcast_status()
        except Exception as exc:
            print(f"[poll] error: {exc}", flush=True)
            traceback.print_exc()
        await asyncio.sleep(POLL_INTERVAL)


@asynccontextmanager
async def _lifespan(app: FastAPI):
    _init_sessions_db()
    asyncio.create_task(run_poll_loop())
    asyncio.create_task(crew.run_crew_idle_decay())
    if DEMO:
        from .demo import run_demo_crew, seed_demo_sessions
        seed_demo_sessions(SESSIONS_DB)
        asyncio.create_task(run_demo_crew())
        print("[startup] DEMO MODE — every panel is scripted fiction", flush=True)
    print(f"[startup] TERRARIUM backend on :8000 — polling every {POLL_INTERVAL}s", flush=True)
    yield


app = FastAPI(
    title="TERRARIUM API",
    description="Single-agent mission control: Claude, the trader, the machine.",
    version="0.7.0",
    lifespan=_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router_module in (crew, desk, home, search, sessions):
    app.include_router(router_module.router)


@app.get("/api/status")
async def api_status():
    payload = status_payload()
    payload["last_updated"] = _state["last_updated"]
    return payload


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    async with _st._ws_lock:
        if len(_st._ws_clients) >= MAX_WS_CONNECTIONS:
            await ws.close(code=1008, reason="Server at capacity")
            return
    await ws.accept()
    async with _st._ws_lock:
        _st._ws_clients.add(ws)
    try:
        await ws.send_text(json.dumps(status_payload()))
    except Exception:
        pass
    try:
        while True:
            await ws.receive_text()
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        async with _st._ws_lock:
            _st._ws_clients.discard(ws)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)
