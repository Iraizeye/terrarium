---
description: Check whether the Terrarium dashboard is up and summarize what it sees — services, machine vitals, session activity. Use when the user asks "is terrarium up", "dashboard status", or wants the office opened.
---

# Terrarium status

1. Fetch `${TERRARIUM_URL:-http://127.0.0.1:8000}/api/status` (curl, 3s timeout).
2. If it fails: the backend isn't running — tell the user to start it
   (`make dev` in their terrarium checkout) and stop there.
3. If it succeeds: summarize in 2-3 sentences — overall health, CPU/RAM/disk,
   and anything red. Do not dump raw JSON.
4. Offer to open the dashboard; if the user wants it, run
   `open http://127.0.0.1:3000` (macOS) or `xdg-open` on Linux.
