// CLAUDE HOME — the agent's own page: what it knows, watches, and carries.
//
// Iris's framing: "your little home, that I can see." Every section is a
// window onto state the agent already keeps as files — nothing here is
// authored for the dashboard, so the page can never drift from the truth.
// Reads /api/home on its own cadence; deliberately not part of the frozen
// websocket status contract.

import { useEffect, useState } from 'react'
import { MONO, UI } from '../ui'

const INK = { text: UI.text, soft: UI.soft, dim: UI.dim }
const GREEN = UI.green
const AMBER = UI.amber
const VIOLET = UI.accent
const HAIRLINE = UI.hairline
const CARD_BG = UI.surfaceSoft

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: CARD_BG, border: HAIRLINE, borderRadius: 6, padding: '10px 12px', minWidth: 0 }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: VIOLET, marginBottom: 8 }}>
        {title}
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

  if (error) return <Shell><Empty text="home unreachable — backend down?" /></Shell>
  if (!data) return <Shell><Empty text="opening the front door…" /></Shell>

  const runway = tokenRunway(data.watch.token_expires_at)

  return (
    <Shell>
      {/* Doctor — the morning's one-line diagnosis, front and center */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 12px',
        background: CARD_BG, border: HAIRLINE, borderRadius: 6,
        borderLeft: `3px solid ${data.doctor.green ? GREEN : AMBER}`,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: data.doctor.green ? GREEN : AMBER, flexShrink: 0 }}>
          {data.doctor.green ? 'DOCTOR · GREEN' : 'DOCTOR'}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: INK.soft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.doctor.line ?? 'no diagnosis yet — first scheduled run is 9:15 ET'}
        </span>
      </div>

      {/* Watch — the standing threads that used to need a human to ask */}
      <Section title="WATCH">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip label="token" value={runway.text} warn={runway.warn} />
          <Chip label="kill switch" value={data.watch.kill ? 'ACTIVE' : 'clear'} warn={data.watch.kill} />
          {data.watch.positions.length === 0 && <Chip label="book" value="flat" />}
          {data.watch.positions.map((p) => (
            <Chip
              key={`${p.mode}-${p.symbol}`}
              label={p.mode}
              value={`${p.symbol} ×${p.quantity}${p.horizon === 'swing' ? ' · swing' : ''}`}
              accent={p.horizon === 'swing' ? VIOLET : undefined}
            />
          ))}
        </div>
      </Section>

      {/* Experiments — the pre-registered board, pass bars set before data */}
      <Section title="EXPERIMENTS · PRE-REGISTERED">
        <div style={{ display: 'grid', gap: 6 }}>
          {data.experiments.map((e) => (
            <div key={e.title} style={{ display: 'grid', gap: 2, paddingBottom: 6, borderBottom: HAIRLINE }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: INK.text }}>{e.title}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: e.n != null ? GREEN : INK.dim, flexShrink: 0 }}>
                  {e.n != null ? `n=${e.n}` : 'accruing'}
                </span>
              </div>
              {e.pass_bar && (
                <span style={{ fontFamily: MONO, fontSize: 9.5, color: INK.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  pass: {e.pass_bar}
                </span>
              )}
            </div>
          ))}
          {data.experiments.length === 0 && <Empty text="no experiments registered" />}
        </div>
      </Section>

      {/* Memory shelf — what the agent currently knows and believes */}
      <Section title={`MEMORY · ${data.memory.length} FILES`}>
        <div style={{ display: 'grid', gap: 7, overflowY: 'auto', maxHeight: 260 }}>
          {data.memory.map((m) => (
            <div key={m.title} style={{ display: 'grid', gap: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: INK.text }}>{m.title}</span>
                {m.updated && (
                  <span style={{ fontFamily: MONO, fontSize: 9, color: INK.dim, flexShrink: 0 }}>
                    {m.updated.slice(5, 16).replace('T', ' ')}
                  </span>
                )}
              </div>
              <span style={{ fontFamily: MONO, fontSize: 9.5, color: INK.soft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.hook}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Toolbox — the vanity corner that doubles as breakage detection */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Chip label="skills" value={fmt(data.toolbox.skills)} />
        <Chip label="agents" value={fmt(data.toolbox.agents)} />
        <Chip label="commands" value={fmt(data.toolbox.commands)} />
        <Chip label="memories" value={fmt(data.toolbox.memories)} />
        <Chip label="broker contact" value={data.watch.last_broker_contact ? data.watch.last_broker_contact.slice(5, 16).replace('T', ' ') : '—'} />
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'grid', gap: 10, alignContent: 'start', padding: '4px 2px 8px' }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 3, color: INK.soft }}>
        ⌂ CLAUDE HOME
      </div>
      {children}
    </div>
  )
}

function Chip({ label, value, warn, accent }: { label: string; value: string; warn?: boolean; accent?: string }) {
  const color = warn ? AMBER : accent ?? INK.text
  return (
    <span style={{
      fontFamily: MONO, fontSize: 10, padding: '3px 8px', borderRadius: 4,
      border: HAIRLINE, background: UI.surfaceSoft, whiteSpace: 'nowrap',
    }}>
      <span style={{ color: INK.dim }}>{label} </span>
      <span style={{ color }}>{value}</span>
    </span>
  )
}

function Empty({ text }: { text: string }) {
  return <span style={{ fontFamily: MONO, fontSize: 10, color: INK.dim }}>{text}</span>
}

function fmt(n: number | null): string {
  return n == null ? '—' : String(n)
}
