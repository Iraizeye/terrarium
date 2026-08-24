// FLEET — every Claude Code session on this machine, one card each.
//
// Watch-only by design: Terrarium observes agents, it does not command
// them. The action line carries tool names and file basenames only — the
// backend guarantees no session content can reach this panel, because the
// dashboard gets screenshotted and this repo is public.

import { useDashboardStore } from '../store/dashboardStore'
import type { FleetAgent } from '../types'
import { EmptyState, Led, MONO, Panel, PanelHeader, UI } from '../ui'

const STATE_COLOR: Record<FleetAgent['state'], string> = {
  live: UI.green,
  idle: UI.amber,
  done: UI.dim,
}

const STATE_TITLE: Record<FleetAgent['state'], string> = {
  live: 'session active right now',
  idle: 'session open, currently idle',
  done: 'session closed',
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
  return (
    <div style={{ padding: '5px 14px', borderTop: UI.hairline }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
        <Led color={STATE_COLOR[agent.state]} pulse={agent.state === 'live'} title={STATE_TITLE[agent.state]} />
        <span style={{
          fontSize: 11.5, fontWeight: 700, color: UI.text, fontFamily: MONO,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {agent.project}
        </span>
        <span style={{ fontSize: 9, color: UI.dim, fontFamily: MONO, marginLeft: 'auto', flexShrink: 0 }}>
          {fmtAge(agent.age_s)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', paddingLeft: 12, minWidth: 0 }}>
        <span style={{
          fontSize: 10, color: agent.state === 'done' ? UI.dim : UI.soft, fontFamily: MONO,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {agent.action ?? (agent.state === 'done' ? 'session closed' : 'waiting')}
        </span>
        <span style={{ fontSize: 9, color: UI.dim, fontFamily: MONO, marginLeft: 'auto', flexShrink: 0 }}>
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
    <Panel style={{ height: '100%' }}>
      <PanelHeader
        label="Fleet"
        title="every Claude Code session on this machine today"
        right={
          <span style={{ fontSize: 9, color: UI.dim, fontFamily: MONO }}>
            {agents.length === 0 ? '' : `${liveCount} live · ${agents.length} today`}
          </span>
        }
      />
      {agents.length === 0 ? (
        <EmptyState>
          no agent sessions yet today — start a Claude Code session on this
          machine and it appears here as a card.
        </EmptyState>
      ) : (
        <div style={{ overflowY: 'auto', minHeight: 0 }}>
          {agents.map((a) => (
            <AgentCard key={`${a.project}-${a.session}`} agent={a} />
          ))}
        </div>
      )}
    </Panel>
  )
}
