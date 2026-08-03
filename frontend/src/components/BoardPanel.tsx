// THE BOARD — what each arm's model saw last cycle, and what it did.
//
// The gauges, earnings lines, and funnel live in daemon logs; this is the
// window. Watch-only, and the `gist` field is capped server-side to a
// sentence — never full reasoning — because dashboards get screenshotted.

import { useState } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import type { BoardArm, BoardCandidate } from '../types'

const INK = { text: '#f2f1f7', soft: '#a29db8', dim: '#575370' }
const GREEN = '#79ff98'
const AMBER = '#f0c040'
const RED = '#ff7060'
const MONO = '"Fira Code", monospace'
const HAIRLINE = '1px solid rgba(150,146,172,0.10)'
const GOLD_DIM_HEADER = 'rgba(245,180,81,0.7)'

function moveColor(pct: number) {
  return pct > 0.001 ? GREEN : pct < -0.001 ? RED : INK.soft
}

function outcomeBadge(arm: BoardArm): { text: string; color: string } {
  if (arm.action === 'buy') return { text: `BUY ${arm.action_symbol ?? ''}`, color: GREEN }
  if (arm.bear_veto) return { text: 'BEAR VETO', color: AMBER }
  if (arm.action === 'pass') return { text: `PASS${arm.pass_reason ? ` · ${arm.pass_reason}` : ''}`, color: INK.dim }
  return { text: '—', color: INK.dim }
}

function CandidateRow({ c }: { c: BoardCandidate }) {
  return (
    <div style={{ padding: '4px 0', borderTop: HAIRLINE, opacity: c.affordable ? 1 : 0.55 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', minWidth: 0 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: INK.text, fontFamily: MONO }}>
          {c.symbol}
        </span>
        {!c.affordable && (
          <span style={{ fontSize: 8, color: INK.dim, letterSpacing: '0.08em' }}>UNBUYABLE</span>
        )}
        <span style={{ fontSize: 10, color: INK.soft, fontFamily: MONO }}>
          {c.last != null ? `$${c.last.toFixed(2)}` : ''}
          {c.rvol != null ? ` · ${c.rvol.toFixed(1)}x` : ''}
        </span>
        <span style={{
          fontSize: 10, fontFamily: MONO, marginLeft: 'auto', flexShrink: 0,
          color: moveColor(c.move_pct),
        }}>
          {(c.move_pct * 100).toFixed(1)}%
        </span>
      </div>
      {c.tech && (
        <div style={{
          fontSize: 9, color: INK.soft, fontFamily: MONO, paddingLeft: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {c.tech}
        </div>
      )}
      {c.earn && (
        <div style={{
          fontSize: 9, color: AMBER, fontFamily: MONO, paddingLeft: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          ⦿ {c.earn}
        </div>
      )}
    </div>
  )
}

export default function BoardPanel() {
  const board = useDashboardStore((s) => s.board)
  const [mode, setMode] = useState<'paper' | 'live'>('live')
  const arm = board?.arms?.[mode]

  const badge = arm ? outcomeBadge(arm) : null
  const funnel = arm?.funnel ?? {}
  const funnelText = funnel.scanned != null
    ? `${funnel.scanned} scanned → ${funnel.to_engine ?? '?'} judged` +
      (funnel.unaffordable_filtered ? ` (${funnel.unaffordable_filtered} unbuyable)` : '')
    : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 4 }}>
        <span style={{
          fontSize: 10, color: GOLD_DIM_HEADER, letterSpacing: '0.22em',
          textTransform: 'uppercase',
        }}>
          The Board
        </span>
        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
          {(['live', 'paper'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
                padding: '1px 7px', cursor: 'pointer', fontFamily: MONO,
                background: 'transparent',
                border: HAIRLINE,
                borderRadius: 3,
                color: mode === m ? INK.text : INK.dim,
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {!arm || arm.candidates.length === 0 ? (
        <div style={{ fontSize: 10, color: INK.dim, fontFamily: MONO, padding: '6px 0' }}>
          no cycle yet today
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', paddingBottom: 2 }}>
            {badge && (
              <span style={{
                fontSize: 9.5, fontWeight: 700, color: badge.color, fontFamily: MONO,
                letterSpacing: '0.06em',
              }}>
                {badge.text}
              </span>
            )}
            <span style={{ fontSize: 9, color: INK.dim, fontFamily: MONO, marginLeft: 'auto' }}>
              {arm.cycle_at ? arm.cycle_at.slice(11, 16) : ''} · {funnelText}
            </span>
          </div>
          {arm.gist && (
            <div style={{
              fontSize: 9.5, color: INK.soft, lineHeight: 1.35, paddingBottom: 3,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {arm.gist}
            </div>
          )}
          <div style={{ overflowY: 'auto', minHeight: 0 }}>
            {arm.candidates.map((c) => <CandidateRow key={c.symbol} c={c} />)}
          </div>
        </>
      )}
    </div>
  )
}
