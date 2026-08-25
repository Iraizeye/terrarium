// CLAUDE HOME — the agent's own page: what it knows, watches, and carries.
//
// Iris's framing: "your little home, that I can see." Every section is a
// window onto state the agent already keeps as files — nothing here is
// authored for the dashboard, so the page can never drift from the truth.
// Reads /api/home on its own cadence; deliberately not part of the frozen
// websocket status contract.

import { useEffect, useState } from 'react'
import { Clamp2, EmptyState, MONO, Panel, PanelHeader, UI } from '../ui'

interface MemoryEntry { title: string; hook: string; updated: string | null }
interface Experiment { title: string; sample: string | null; pass_bar: string | null; n: number | null }
interface Position { mode: string; symbol: string; quantity: number; stop: number; horizon: string }
interface HomePayload {
  memory: MemoryEntry[]
  doctor: { line: string | null; at: string | null; green: boolean | null }
  watch: { token_expires_at: number | null; positions: Position[]; kill: boolean; last_broker_contact: string | null }
  experiments: Experiment[]
  toolbox: { skills: number | null; agents: number | null; commands: number | null; memories: number | null }
}

function tokenRunway(expiresAt: number | null): { text: string; warn: boolean } {
  if (expiresAt == null) return { text: 'unknown', warn: true }
  const hours = (expiresAt * 1000 - Date.now()) / 3.6e6
  if (hours <= 0) return { text: 'EXPIRED — refresh due', warn: true }
  if (hours < 48) return { text: `${Math.round(hours)}h runway`, warn: true }
  return { text: `${Math.round(hours / 24)}d runway`, warn: false }
}

function Chip({ label, value, warn, title }: { label: string; value: string; warn?: boolean; title?: string }) {
  return (
    <span title={title} style={{
      fontFamily: MONO, fontSize: 10, padding: '4px 10px', borderRadius: 999,
      border: UI.hairline, background: UI.surfaceSoft, whiteSpace: 'nowrap',
    }}>
      <span style={{ color: UI.dim }}>{label} </span>
      <span style={{ color: warn ? UI.amber : UI.text }}>{value}</span>
    </span>
  )
}

function SkeletonBar({ w, delay }: { w: string; delay: number }) {
  return (
    <div style={{
      height: 10, width: w, borderRadius: 6, background: 'rgba(148,163,184,0.10)',
      animation: `led-pulse 1.6s ease-in-out ${delay}s infinite`,
    }} />
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'grid', gap: 10, alignContent: 'start', padding: '4px 2px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 3, color: UI.brassDim }}>
          {'⌂'} CLAUDE HOME
        </span>
        <span style={{ fontSize: 10, color: UI.dim, letterSpacing: '0.08em' }}>
          what the agent knows, watches, and carries — read from its own files
        </span>
      </div>
      {children}
    </div>
  )
}

export default function ClaudeHomePanel() {
  const [data, setData] = useState<HomePayload | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    const load = () =>
      fetch('http://127.0.0.1:8000/api/home')
        .then((r) => r.json())
        .then((d) => { if (alive) { setData(d); setError(false) } })
        .catch(() => { if (alive) setError(true) })
    load()
    const id = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  if (error) {
    return (
      <Shell>
        <Panel>
          <EmptyState>home unreachable — is the backend on :8000 running?</EmptyState>
        </Panel>
      </Shell>
    )
  }

  if (!data) {
    return (
      <Shell>
        <Panel style={{ padding: '14px 16px', display: 'grid', gap: 10 }}>
          <SkeletonBar w="42%" delay={0} />
          <SkeletonBar w="86%" delay={0.15} />
          <SkeletonBar w="71%" delay={0.3} />
        </Panel>
        <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 10 }}>
          <Panel style={{ padding: '14px 16px', display: 'grid', gap: 10, alignContent: 'start' }}>
            <SkeletonBar w="34%" delay={0.1} />
            <SkeletonBar w="78%" delay={0.25} />
            <SkeletonBar w="64%" delay={0.4} />
          </Panel>
          <Panel style={{ padding: '14px 16px', display: 'grid', gap: 10, alignContent: 'start' }}>
            <SkeletonBar w="46%" delay={0.2} />
            <SkeletonBar w="82%" delay={0.35} />
            <SkeletonBar w="58%" delay={0.5} />
          </Panel>
        </div>
      </Shell>
    )
  }

  const runway = tokenRunway(data.watch.token_expires_at)

  return (
    <Shell>
      {/* Doctor — the morning's one-line diagnosis, front and center */}
      <Panel style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, padding: '10px 14px', borderLeft: `3px solid ${data.doctor.green ? UI.green : UI.amber}` }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: data.doctor.green ? UI.green : UI.amber, flexShrink: 0 }}>
          {data.doctor.green ? 'DOCTOR · GREEN' : 'DOCTOR'}
        </span>
        <Clamp2 text={data.doctor.line ?? 'no diagnosis yet — first scheduled run is 9:15 ET'} size={10.5} />
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 10, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 10 }}>
          {/* Watch — the standing threads that used to need a human to ask */}
          <Panel>
            <PanelHeader label="Watch" title="the standing threads: auth runway, kill switch, open positions" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 14px 12px' }}>
              <Chip label="token" value={runway.text} warn={runway.warn} title="broker OAuth runway" />
              <Chip label="kill switch" value={data.watch.kill ? 'ACTIVE' : 'clear'} warn={data.watch.kill} />
              <Chip
                label="broker contact"
                value={data.watch.last_broker_contact ? data.watch.last_broker_contact.slice(5, 16).replace('T', ' ') : '—'}
              />
              {data.watch.positions.length === 0 && <Chip label="book" value="flat" />}
              {data.watch.positions.map((p) => (
                <Chip
                  key={`${p.mode}-${p.symbol}`}
                  label={p.mode}
                  value={`${p.symbol} ×${p.quantity}${p.horizon === 'swing' ? ' · swing' : ''}`}
                  title={`stop ${p.stop}`}
                />
              ))}
            </div>
          </Panel>

          {/* Experiments — the pre-registered board, pass bars set before data */}
          <Panel>
            <PanelHeader label="Experiments · pre-registered" title="pass bars set before the data arrives — no moving the goalposts" />
            <div style={{ display: 'grid', gap: 6, padding: '8px 14px 12px' }}>
              {data.experiments.map((e) => (
                <div key={e.title} style={{ display: 'grid', gap: 2, paddingBottom: 6, borderBottom: UI.hairline }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: UI.text }}>{e.title}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: e.n != null ? UI.green : UI.dim, flexShrink: 0 }}>
                      {e.n != null ? `n=${e.n}` : 'accruing'}
                    </span>
                  </div>
                  {e.pass_bar && <Clamp2 text={`pass: ${e.pass_bar}`} size={9.5} color={UI.dim} />}
                </div>
              ))}
              {data.experiments.length === 0 && (
                <EmptyState>no experiments registered — hypotheses land here with their pass bars.</EmptyState>
              )}
            </div>
          </Panel>

          {/* Toolbox — the vanity corner that doubles as breakage detection */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Chip label="skills" value={fmt(data.toolbox.skills)} />
            <Chip label="agents" value={fmt(data.toolbox.agents)} />
            <Chip label="commands" value={fmt(data.toolbox.commands)} />
            <Chip label="memories" value={fmt(data.toolbox.memories)} />
          </div>
        </div>

        {/* Memory shelf — what the agent currently knows and believes */}
        <Panel style={{ maxHeight: '100%' }}>
          <PanelHeader
            label={`Memory · ${data.memory.length} files`}
            title="the agent's persistent memory index — titles and hooks only"
          />
          <div style={{ display: 'grid', gap: 8, overflowY: 'auto', minHeight: 0, padding: '8px 14px 12px', maxHeight: 420 }}>
            {data.memory.map((m) => (
              <div key={m.title} style={{ display: 'grid', gap: 1, paddingBottom: 6, borderBottom: UI.hairline }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: UI.text }}>{m.title}</span>
                  {m.updated && (
                    <span style={{ fontFamily: MONO, fontSize: 9, color: UI.dim, flexShrink: 0 }}>
                      {m.updated.slice(5, 16).replace('T', ' ')}
                    </span>
                  )}
                </div>
                <Clamp2 text={m.hook} size={9.5} />
              </div>
            ))}
            {data.memory.length === 0 && (
              <EmptyState>no memory files yet — the agent writes them as it works.</EmptyState>
            )}
          </div>
        </Panel>
      </div>
    </Shell>
  )
}

function fmt(n: number | null): string {
  return n == null ? '—' : String(n)
}
