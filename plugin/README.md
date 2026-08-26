# Terrarium plugin

Streams your Claude Code activity to a local [Terrarium](https://github.com/Iraizeye/terrarium)
dashboard: every session, prompt, and tool call lands on the office floor in
~2 seconds, and the robot that represents your session types while you work.

## What it does

- **Hooks** forward Claude Code lifecycle events (`SessionStart`,
  `UserPromptSubmit`, `PreToolUse`, `Notification`, `Stop`) to Terrarium's
  frozen `POST /api/crew/hook` contract. Fire-and-forget with a 2-second
  timeout — if the dashboard is down, Claude Code never notices.
- **`/terrarium:status`** — checks the dashboard is up and summarizes machine
  health.
- **`/terrarium:note`** — logs a dated note to the dashboard's session feed.

Only tool *names* and file *basenames* leave the session, and only to
localhost. No prompt content, no file contents, nothing off the machine.

## Install

Run the [Terrarium dashboard](https://github.com/Iraizeye/terrarium) first
(`make demo` to try it, `make dev` for real), then:

```
/plugin marketplace add Iraizeye/terrarium
/plugin install terrarium@terrarium
```

Dashboard on a non-default port? Set `TERRARIUM_URL` (default
`http://127.0.0.1:8000`).
