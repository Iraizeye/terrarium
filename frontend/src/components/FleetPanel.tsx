// FLEET — every Claude Code session on this machine, one card each.
//
// Watch-only by design: rangewatch observes agents, it does not command
// them. The action line carries tool names and file basenames only — the
// backend guarantees no session content can reach this panel, because the
// dashboard gets screenshotted and this repo is public.

import { useDashboardStore } from '../store/dashboardStore'
import type { FleetAgent } from '../types'

const INK = { text: '#f2f1f7', soft: '#a29db8', dim: '#575370' }
const GREEN = '#79ff98'
const AMBER = '#f0c040'
const MONO = '"Fira Code", monospace'
const HAIRLINE = '1px solid rgba(150,146,172,0.10)'
const GOLD_DIM_HEADER = 'rgba(245,180,81,0.7)'

const STATE_COLOR: Record<FleetAgent['state'], string> = {
  live: GREEN,
  idle: AMBER,
  done: INK.dim,
}

function fmtAge(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return `${n}`
}

function shortModel(model: string | null): string | null {
  if (!model) return null
  // "claude-opus-5[1m]" -> "opus", "claude-sonnet-4-6" -> "sonnet"
  const m = model.match(/claude-([a-z]+)/)
  return m ? m[1] : model
}

function AgentCard({ agent }: { agent: FleetAgent }) {
  const color = STATE_COLOR[agent.state]
  return (
    <div style={{ padding: '5px 0', borderTop: HAIRLINE }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: color,
          flexShrink: 0, alignSelf: 'center',
          animation: agent.state === 'live' ? 'led-pulse 2s ease-in-out infinite' : undefined,
        }} />
        <span style={{
          fontSize: 11.5, fontWeight: 700, color: INK.text, fontFamily: MONO,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {agent.project}
        </span>
        <span style={{ fontSize: 9, color: INK.dim, fontFamily: MONO, marginLeft: 'auto', flexShrink: 0 }}>
          {fmtAge(agent.age_s)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', paddingLeft: 12, minWidth: 0 }}>
        <span style={{
          fontSize: 10, color: agent.state === 'done' ? INK.dim : INK.soft, fontFamily: MONO,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {agent.action ?? (agent.state === 'done' ? 'session closed' : 'waiting')}
        </span>
        <span style={{ fontSize: 9, color: INK.dim, fontFamily: MONO, marginLeft: 'auto', flexShrink: 0 }}>
          {shortModel(agent.model) ? `${shortModel(agent.model)} · ` : ''}{fmtTokens(agent.tokens)} tok
        </span>
      </div>
    </div>
  )
}

export default function FleetPanel() {
  const fleet = useDashboardStore((s) => s.fleet)
  const agents = fleet?.agents ?? []
  const liveCount = agents.filter((a) => a.state === 'live').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        paddingBottom: 4,
      }}>
        <span style={{
          fontSize: 10, color: GOLD_DIM_HEADER, letterSpacing: '0.22em',
          textTransform: 'uppercase',
        }}>
          Fleet
        </span>
        <span style={{ fontSize: 9, color: INK.dim, fontFamily: MONO }}>
          {agents.length === 0 ? '' : `${liveCount} live · ${agents.length} today`}
        </span>
      </div>
      {agents.length === 0 ? (
        <div style={{ fontSize: 10, color: INK.dim, fontFamily: MONO, padding: '6px 0' }}>
          no agents today
        </div>
      ) : (
        <div style={{ overflowY: 'auto', minHeight: 0 }}>
          {agents.map((a) => (
            <AgentCard key={`${a.project}-${a.session}`} agent={a} />
          ))}
        </div>
      )}
    </div>
  )
}
