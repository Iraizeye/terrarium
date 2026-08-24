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
  { name: 'The floor', desc: 'center — a hand-drawn trading office. Every robot is a real seat or book: typing on shift, dim while waiting, red when down. The chief of staff points at the wall once the morning brief is in; the LED sign and the lit wall monitors are the real session clock and tape.' },
  { name: 'Fleet', desc: 'left rail — sessions, scheduled seats, and the ops log. Always on. Tool names only, never content.' },
  { name: 'Books', desc: 'right rail — live and paper books, positions, stops, and the last decision verbatim. Always on.' },
  { name: 'The tape', desc: 'under the office — what the engine saw last cycle. PASS means it judged a candidate and declined.' },
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
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 64px rgba(3,12,8,0.55)',
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: '0.24em', color: UI.dim, textTransform: 'uppercase' }}>
          welcome to
        </div>
        <div style={{ fontSize: 26, color: UI.accent, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '2px 0 4px' }}>
          Terrarium
        </div>
        <div style={{ fontSize: 12.5, color: UI.soft, lineHeight: 1.5, marginBottom: 18 }}>
          A little world of working agents. The office is hand-drawn; every number,
          chart, sign, and robot in it is live telemetry from this machine —
          nothing rendered is simulated except demo mode, which says so.
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
