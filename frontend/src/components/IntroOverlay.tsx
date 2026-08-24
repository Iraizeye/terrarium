// First visit — thirty seconds of orientation, then never again
// (unless reopened from the header's "?" button).

import { UI, MONO } from '../ui'

const SEEN_KEY = 'terrarium.intro-seen'

export function introSeen(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return true }
}

export function markIntroSeen(): void {
  try { localStorage.setItem(SEEN_KEY, '1') } catch { /* private mode */ }
}

const ZONES: { name: string; desc: string }[] = [
  { name: 'The floor', desc: 'center stage — every agent on this machine is a robot at a bench inside the glasshouse. The light through the glass lives the real market session; the terrarium dome at center is the chief of staff, its firefly glowing mint once the morning brief is in.' },
  { name: 'Fleet & ops', desc: 'left rail — each running Claude session as a card (tool names only, never content), the scheduled desk seats, and a live log of agent activity.' },
  { name: 'Trading desk', desc: 'right rail — both trading books (live + paper) with positions, stops, and the engine’s actual reasoning for its last decision, verbatim.' },
  { name: 'The board', desc: 'bottom right — what the trading engine saw last cycle and what it did. PASS means it judged a candidate and declined: discipline is the product.' },
]

export default function IntroOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 50,
        background: 'rgba(8,9,12,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 92vw)', padding: '28px 30px 24px',
          background: 'rgba(17,19,24,0.97)', border: UI.border, borderRadius: 14,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: '0.24em', color: UI.dim, textTransform: 'uppercase' }}>
          welcome to
        </div>
        <div style={{ fontSize: 26, color: UI.accent, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '2px 0 4px' }}>
          Terrarium
        </div>
        <div style={{ fontSize: 12.5, color: UI.soft, lineHeight: 1.5, marginBottom: 18 }}>
          Your AI agents, under glass. Everything on screen is real telemetry from this
          machine — nothing is simulated except demo mode, which says so.
        </div>
        <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
          {ZONES.map((z) => (
            <div key={z.name} style={{ display: 'grid', gap: 2 }}>
              <span style={{ fontSize: 10.5, letterSpacing: '0.16em', color: UI.text, textTransform: 'uppercase', fontFamily: MONO }}>
                {z.name}
              </span>
              <span style={{ fontSize: 11.5, color: UI.soft, lineHeight: 1.5 }}>{z.desc}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={onClose}
            style={{
              fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: MONO,
              padding: '7px 18px', cursor: 'pointer', borderRadius: 8,
              background: UI.accentSoft, border: '1px solid rgba(62,207,154,0.4)', color: UI.accent,
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
