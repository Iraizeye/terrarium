// CREW TELEMETRY — what survived of the old stage into Terrarium:
// the GO/NO-GO truth table (feeds the header alert bar) and the live ops log.

import { useDashboardStore } from '../store/dashboardStore'
import type { CrewEvent } from '../types'
import { Panel as UIPanel, PanelHeader as UIPanelHeader, PillButton as UIPillButton, UI as UISTYLE } from '../ui'

// ── GO/NO-GO ─────────────────────────────────────────────────────────────────

export interface BoardCell {
  callsign: string
  state: 'go' | 'hold' | 'nogo' | 'off'
  detail: string
}

/** Build the GO/NO-GO cells from live state. This is the board's truth table. */
export function buildBoardCells(store: ReturnType<typeof useDashboardStore.getState>): BoardCell[] {
  const trading = store.trading
  const services = store.services
  const fresh = store.lastUpdate ? Date.now() - store.lastUpdate.getTime() < 30_000 : false

  const modeCell = (mode: 'paper' | 'live'): BoardCell => {
    const m = trading?.modes?.[mode]
    if (!m) return { callsign: mode.toUpperCase(), state: 'off', detail: 'no data' }
    const state = m.status === 'alive' ? 'go' : m.status === 'stale' ? 'nogo' : 'hold'
    const age = m.heartbeat_age_s
    return {
      callsign: mode.toUpperCase(),
      state,
      detail: age == null ? 'no heartbeat yet' : `heartbeat ${age}s ago`,
    }
  }
  const watchdogCell = (mode: 'paper' | 'live'): BoardCell => {
    const armed = trading?.modes?.[mode]?.watchdog_armed
    return {
      callsign: mode === 'paper' ? 'WDOG-P' : 'WDOG-L',
      state: armed ? 'go' : 'nogo',
      detail: armed ? 'watchdog armed' : 'watchdog not installed',
    }
  }
  const svcCell = (key: string, callsign: string): BoardCell => {
    const svc = services[key]
    return {
      callsign,
      state: svc ? (svc.status === 'up' ? 'go' : 'nogo') : 'off',
      detail: svc ? `:${svc.port} ${svc.status}` : 'not checked',
    }
  }

  return [
    modeCell('paper'),
    modeCell('live'),
    watchdogCell('paper'),
    watchdogCell('live'),
    {
      callsign: 'KILL',
      state: trading ? (trading.kill_switch ? 'hold' : 'go') : 'off',
      detail: trading?.kill_switch ? 'kill switch ACTIVE — buys halted' : 'kill switch clear',
    },
    svcCell('glance', 'GLANCE'),
    svcCell('screenpipe', 'OPTICS'),
    {
      callsign: 'FEED',
      state: fresh ? 'go' : 'nogo',
      detail: fresh ? 'telemetry live' : 'telemetry stale',
    },
  ]
}

// ── Ops log (left rail) ──────────────────────────────────────────────────────

const KIND_GLYPH: Record<CrewEvent['kind'], string> = {
  tool: '⚙', thought: '◌', lifecycle: '●', hook: '·',
}

const OPS_FILTERS = ['all', 'tools', 'events'] as const

export function OpsLog() {
  const allEvents = useDashboardStore((s) => s.crewEvents)
  const filter = useDashboardStore((s) => s.opsFilter)
  const setOpsFilter = useDashboardStore((s) => s.setOpsFilter)
  const events = filter === 'all' ? allEvents
    : filter === 'tools' ? allEvents.filter((e) => e.kind === 'tool')
    : allEvents.filter((e) => e.kind !== 'tool')
  return (
    <UIPanel style={{ height: '100%' }}>
      <UIPanelHeader
        label="Ops log — live"
        title="every tool call and lifecycle event from agent sessions, as it happens"
        right={
          <span style={{ display: 'flex', gap: 4 }}>
            {OPS_FILTERS.map((f) => (
              <UIPillButton key={f} active={filter === f} onClick={() => setOpsFilter(f)}>{f}</UIPillButton>
            ))}
          </span>
        }
      />
      <div style={{ padding: '6px 0', overflowY: 'auto', minHeight: 0 }}>
        {events.length === 0 && (
          <div style={{ padding: '10px 14px', fontSize: 10.5, lineHeight: 1.55, color: UISTYLE.dim, fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}>
            no agent activity yet — tool calls and session events stream in
            here live once an agent is working.
          </div>
        )}
        {events.slice(0, 60).map((e) => (
          <div key={e.id} style={{ display: 'flex', gap: 8, padding: '3px 14px', alignItems: 'baseline' }}>
            <span style={{ fontSize: 9, color: UISTYLE.dim, fontVariantNumeric: 'tabular-nums', fontFamily: '"JetBrains Mono", "Fira Code", monospace', flexShrink: 0 }}>
              {new Date(e.ts).toLocaleTimeString([], { hour12: false })}
            </span>
            <span style={{ color: UISTYLE.accent, fontSize: 10, flexShrink: 0 }}>{KIND_GLYPH[e.kind] ?? '·'}</span>
            <span title={e.text} style={{
              fontSize: 11, color: UISTYLE.soft,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            }}>
              {e.text}
            </span>
          </div>
        ))}
      </div>
    </UIPanel>
  )
}
