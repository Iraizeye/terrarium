# Frontend Context

React/Vite dashboard on 127.0.0.1:3000. Types in `src/types/index.ts` mirror
`backend/state.status_payload()` exactly — change them together.

- `components/CrewStage.tsx` — canvas stage (minifig, big board, GO/NO-GO)
- `components/TradingPanel.tsx` — right-rail trading desk
- Keep the pixel/CRT identity; numbers are always Fira Code monospace
- `npm run build` (tsc + vite) must pass before shipping
- Never add a `?v=` cache-buster to `index.html`
