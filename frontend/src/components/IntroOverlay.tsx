// First visit — thirty seconds of orientation, then never again
// (unless reopened from the header's "?" button).

import { useEffect } from 'react'
import { MONO, UI } from '../ui'

const SEEN_KEY = 'terrarium.intro-seen'

export function introSeen(): boolean {
  // ?intro=0 skips the overlay (kiosk displays, screenshots).
  try {
    if (new URLSearchParams(window.location.search).get('intro') === '0') return true
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return true
  }
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* private mode */
  }
}

const ZONES: { name: string; desc: string }[] = [
  {
    name: 'The building',
    desc: 'center — a three-story office. The chief holds the executive floor; each agent below has an office themed to its job. A lit office means that seat worked in the last 20 minutes — dark means off shift. Typing, patrol walks, and speech bubbles are all driven by real state.',
  },
  {
    name: 'Fleet',
    desc: 'left rail — sessions, scheduled seats, and the ops log. Always on. Tool names only, never content.',
  },
  {
    name: 'Books',
    desc: 'right rail — live and paper books, positions, stops, and the last decision verbatim. Always on.',
  },
  {
    name: 'The tape',
    desc: 'under the building — what the engine saw last cycle. PASS means it judged a candidate and declined.',
  },
]

export default function IntroOverlay({ onClose }: { onClose: () => void }) {
  // Escape closes; the visible × button is the primary affordance, so the
  // backdrop/stopPropagation clicks below are convenience-only.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss is convenience; button + Escape are the accessible paths
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape handled globally above
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        background: 'rgba(8,9,12,0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: swallows backdrop clicks only */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: not an interactive element */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 92vw)',
          padding: '28px 30px 24px',
          background: 'rgba(26,22,16,0.97)',
          border: UI.border,
          borderRadius: 14,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 64px rgba(12,7,2,0.55)',
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.24em',
            color: UI.dim,
            textTransform: 'uppercase',
          }}
        >
          welcome to
        </div>
        <div
          style={{
            fontSize: 26,
            color: UI.brass,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            margin: '2px 0 4px',
          }}
        >
          Terrarium
        </div>
        <div style={{ fontSize: 12.5, color: UI.soft, lineHeight: 1.5, marginBottom: 18 }}>
          A little world of working agents. The building is drawn entirely in code; every light,
          chart, sign, and robot in it is live telemetry from this machine — nothing rendered is
          simulated except demo mode, which says so.
        </div>
        <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
          {ZONES.map((z) => (
            <div key={z.name} style={{ display: 'grid', gap: 2 }}>
              <span
                style={{
                  fontSize: 10.5,
                  letterSpacing: '0.16em',
                  color: UI.text,
                  textTransform: 'uppercase',
                  fontFamily: MONO,
                }}
              >
                {z.name}
              </span>
              <span style={{ fontSize: 11.5, color: UI.soft, lineHeight: 1.5 }}>{z.desc}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontFamily: MONO,
              padding: '7px 18px',
              cursor: 'pointer',
              borderRadius: 8,
              background: UI.accentSoft,
              border: '1px solid rgba(62,207,154,0.4)',
              color: UI.accent,
            }}
          >
            step inside
          </button>
          <span style={{ fontSize: 10, color: UI.dim }}>
            status colors: <span style={{ color: UI.green }}>green</span> running ·{' '}
            <span style={{ color: UI.amber }}>amber</span> scheduled/idle ·{' '}
            <span style={{ color: UI.red }}>red</span> needs attention
          </span>
        </div>
      </div>
    </div>
  )
}
