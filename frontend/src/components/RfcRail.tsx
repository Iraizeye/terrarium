// IDEAS — the RFC shelf. Strategy's paper trail, read straight from
// ~/Projects/vesper/rfcs via /api/company. Empty shelf renders quietly.

import { useEffect, useState } from 'react'
import { EmptyState, MONO, Panel, PanelHeader, UI } from '../ui'
import type { CompanyStatus } from './VesperFloor'

const VERDICT_COLOR: Record<string, string> = {
  add: UI.green,
  later: UI.amber,
  no: UI.red,
}

function useCompany(): CompanyStatus | null {
  const [company, setCompany] = useState<CompanyStatus | null>(null)
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch('/api/company')
        .then((r) => r.json())
        .then((d) => {
          if (alive) setCompany(d)
        })
        .catch(() => {})
    load()
    const id = setInterval(load, 90_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])
  return company
}

function ago(iso: string | null | undefined): string {
  if (!iso) return 'idle'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m ago`
  if (m < 60 * 48) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

const ACTIVE_MS = 20 * 60_000
function Lamp({ at }: { at: string | null | undefined }) {
  const on = !!at && Date.now() - new Date(at).getTime() < ACTIVE_MS
  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        flexShrink: 0,
        background: on ? UI.green : 'rgba(148,140,120,0.35)',
        boxShadow: on ? '0 0 8px rgba(90,191,122,0.6)' : 'none',
      }}
    />
  )
}

// Departments first: the on-call primaries and their artifact lamps.
// Strategy's clock is the newest RFC; Build's is the newest hub commit.
export function DepartmentsPanel() {
  const company = useCompany()
  const rows: [string, string | null | undefined, string][] = [
    ['STRATEGY', company?.strategy_at, company?.strategy_verdict ?? 'no open verdict'],
    ['BUILD', company?.build_at, 'last shipped commit'],
  ]
  return (
    <Panel id="panel-departments" style={{ flexShrink: 0 }}>
      <PanelHeader
        label="Departments"
        title="on-call: lamps lit by artifacts (RFCs, commits), never by talk"
      />
      <div style={{ display: 'grid', gap: 6, padding: '7px 12px 10px' }}>
        {rows.map(([name, at, sub]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lamp at={at} />
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10.5,
                letterSpacing: 1.2,
                color: UI.text,
                width: 74,
              }}
            >
              {name}
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9.5,
                color: UI.dim,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
              {sub}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: UI.dim, flexShrink: 0 }}>
              {ago(at)}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

export default function RfcRail() {
  const company = useCompany()
  const rfcs = company?.rfcs ?? []
  return (
    <Panel style={{ flexShrink: 0 }}>
      <PanelHeader
        label="Ideas · RFC"
        title="Strategy's shelf — verdicts from ~/Projects/vesper/rfcs"
      />
      <div style={{ display: 'grid', gap: 5, padding: '6px 12px 10px' }}>
        {rfcs.slice(0, 4).map((r) => (
          <div
            key={r.name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              alignItems: 'baseline',
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10.5,
                color: UI.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {r.name}
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                letterSpacing: 1,
                flexShrink: 0,
                color: r.verdict ? (VERDICT_COLOR[r.verdict] ?? UI.dim) : UI.dim,
                textTransform: 'uppercase',
              }}
            >
              {r.verdict ?? 'draft'}
            </span>
          </div>
        ))}
        {rfcs.length === 0 && <EmptyState>no open RFCs — ideas land here via /idea.</EmptyState>}
      </div>
    </Panel>
  )
}
