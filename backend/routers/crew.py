"""
Crew router — Claude's live activity feed.

One real data source, no simulation: Claude Code hooks POST here
(SessionStart, PreToolUse, ...). The /api/crew/hook contract predates the
rewrite and must not change — hooks in ~/.claude/settings.json depend on it.
"""
import asyncio
import uuid
from collections import deque
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Body

from ..state import _now_iso, broadcast

router = APIRouter()

IDLE_AFTER_SECONDS = 120
EVENTS_MAX = 300


def _blank_member() -> dict[str, Any]:
    return {
        "name": "Claude",
        "role": "Claude Code",
        "model": "fable-5",
        "status": "idle",        # idle | thinking | working | waiting
        "activity": None,
        "tool": None,
        "task": None,
        "events_today": 0,
        "last_event_at": None,
    }


_crew: dict[str, dict[str, Any]] = {"claude": _blank_member()}
_crew_events: deque = deque(maxlen=EVENTS_MAX)


async def _emit(kind: str, text: str, *, status: str | None = None,
                tool: str | None = None) -> None:
    member = _crew["claude"]
    now = _now_iso()
    if status:
        member["status"] = status
    member["activity"] = text
    member["tool"] = tool
    member["last_event_at"] = now
    member["events_today"] += 1
    event = {
        "id": uuid.uuid4().hex[:12],
        "ts": now,
        "agent": "claude",
        "kind": kind,            # hook | tool | thought | lifecycle
        "text": text,
        "tool": tool,
        "meta": {},
    }
    _crew_events.append(event)
    await broadcast({"type": "crew_event", "timestamp": now, "event": event, "crew": _crew})


def _summarize_tool(tool_name: str, tool_input: dict) -> str:
    if tool_name == "Bash":
        return tool_input.get("description") or (tool_input.get("command") or "")[:80]
    if tool_name in ("Edit", "Write", "Read", "NotebookEdit"):
        path = tool_input.get("file_path") or ""
        return f"{tool_name} {Path(path).name}" if path else tool_name
    if tool_name in ("Grep", "Glob"):
        return f"{tool_name} {tool_input.get('pattern', '')}"[:80]
    if tool_name == "Task":
        return f"subagent: {tool_input.get('description', '')}"[:80]
    if tool_name in ("WebFetch", "WebSearch"):
        return f"{tool_name} {tool_input.get('url') or tool_input.get('query', '')}"[:80]
    if tool_name.startswith("mcp__"):
        parts = tool_name.split("__")
        if len(parts) >= 3:
            server = parts[1].replace("claude-in-", "").replace("-", " ")
            return f"{server}: {parts[2].replace('_', ' ')}"[:80]
    return tool_name


@router.post("/api/crew/hook")
async def crew_hook(payload: dict = Body(...)):
    """Receiver for Claude Code hook events. Contract is frozen."""
    hook = payload.get("hook_event_name", "")
    tool_name = payload.get("tool_name") or ""
    tool_input = payload.get("tool_input") or {}
    cwd = payload.get("cwd") or ""
    project = Path(cwd).name if cwd else None
    if project:
        _crew["claude"]["task"] = project

    if hook == "SessionStart":
        await _emit("lifecycle", f"session started in {project or '~'}", status="thinking")
    elif hook == "UserPromptSubmit":
        await _emit("thought", "reading Iris's prompt", status="thinking")
    elif hook == "PreToolUse":
        await _emit("tool", _summarize_tool(tool_name, tool_input),
                    status="working", tool=tool_name)
    elif hook == "PostToolUse":
        _crew["claude"]["last_event_at"] = _now_iso()
    elif hook == "Notification":
        await _emit("lifecycle", payload.get("message") or "needs attention", status="waiting")
    elif hook in ("Stop", "SubagentStop", "SessionEnd"):
        await _emit("lifecycle", "finished turn", status="idle")
    else:
        _crew["claude"]["last_event_at"] = _now_iso()

    return {"ok": True}


@router.get("/api/crew")
async def get_crew():
    return {"crew": _crew, "events": list(_crew_events)}


async def run_crew_idle_decay() -> None:
    while True:
        try:
            member = _crew["claude"]
            last = member.get("last_event_at")
            if member["status"] != "idle" and last:
                age = (datetime.now(UTC) - datetime.fromisoformat(last)).total_seconds()
                if age > IDLE_AFTER_SECONDS:
                    member["status"] = "idle"
                    member["activity"] = None
                    member["tool"] = None
                    await broadcast({"type": "crew_event", "timestamp": _now_iso(),
                                     "event": None, "crew": _crew})
        except Exception as exc:
            print(f"[crew] idle decay error: {exc}", flush=True)
        await asyncio.sleep(15)
