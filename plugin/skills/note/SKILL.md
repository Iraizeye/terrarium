---
description: Log a note to the Terrarium session log — a dated entry on the dashboard's ops feed. Use when the user says "log this to terrarium", "note this on the dashboard", or after finishing notable work they want recorded.
---

# Terrarium note

Post the note to the local Terrarium session log (frozen contract):

```bash
curl -s -m 3 -X POST "${TERRARIUM_URL:-http://127.0.0.1:8000}/api/sessions/log" \
  -H 'Content-Type: application/json' \
  -d '{"role":"note","content":"<the note text>"}'
```

Use "$ARGUMENTS" as the note text if provided; otherwise write one concise
sentence describing what was just completed. Confirm to the user with the
note text as logged. If the request fails, say the dashboard backend on
:8000 isn't reachable — never retry in a loop.
