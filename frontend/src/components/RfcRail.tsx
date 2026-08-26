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

export default function RfcRail() {
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
