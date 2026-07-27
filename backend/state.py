"""
Shared mutable state and WebSocket broadcast.

The poll loop writes here; /api/status and the WS broadcast read from here.
"""
import asyncio
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket

_state: dict[str, Any] = {
    "services": {},        # key -> {name, status, port}
    "system": {},          # cpu/ram/disk/uptime + trading daemon RSS
    "trading": {},         # per-mode status + market clock + alerts
    "usage": {},           # Claude Code usage today
    "last_updated": None,
}

_ws_clients: set[WebSocket] = set()
_ws_lock = asyncio.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def status_payload() -> dict[str, Any]:
    return {
        "type": "status_update",
        "timestamp": _now_iso(),
        "services": _state["services"],
        "system": _state["system"],
        "trading": _state["trading"],
        "usage": _state["usage"],
    }


async def broadcast(payload: dict[str, Any]) -> None:
    data = json.dumps(payload)
    async with _ws_lock:
        dead: set[WebSocket] = set()
        for ws in _ws_clients:
            try:
                await ws.send_text(data)
            except Exception:
                dead.add(ws)
        _ws_clients.difference_update(dead)


async def broadcast_status() -> None:
    await broadcast(status_payload())
