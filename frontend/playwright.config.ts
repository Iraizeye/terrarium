// Visual regression — the look of the building is a tested contract.
//
// Runs against a fully scripted demo backend frozen at one instant
// (TERRARIUM_DEMO_AT) so every pixel is deterministic: no personal data,
// no live services touched (isolated ports 8100/3100), no wall clock.
import { defineConfig } from '@playwright/test'

// Loop position 105s of 300 = mid-day: market open, NOVA on, offices lit.
const DEMO_AT = '1788000105'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    toHaveScreenshot: {
      // tolerate antialiasing; catch real layout drift
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:3100',
    timezoneId: 'America/Chicago',
  },
  webServer: [
    {
      command:
        `cd .. && TERRARIUM_DEMO=1 TERRARIUM_DEMO_AT=${DEMO_AT} ` +
        'TERRARIUM_SESSIONS_DB=/tmp/terrarium-visual-sessions.db TZ=America/Chicago ' +
        'backend/.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8100',
      url: 'http://127.0.0.1:8100/api/desk',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'BACKEND_URL=http://127.0.0.1:8100 npx vite --port 3100 --strictPort',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
})
