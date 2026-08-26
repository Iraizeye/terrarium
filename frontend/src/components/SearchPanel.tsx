// Unified search — ask the machine a question, get receipts.
//
// Fans out to /api/search: session log, trader alerts, decisions, the
// agent's memory shelf, the Argus mailbox. Read-only, newest first,
// every hit tagged with where it came from. Idea borrowed from
// block/buzz's unified event log, sized to one machine.

import { useEffect, useRef, useState } from 'react'
import { Clamp2, EmptyState, MONO, Panel, PanelHeader, UI } from '../ui'

export interface SearchHit {
  source: string
  at: string | null
  text: string
  where: string
}

function fmtAt(at: string | null): string {
  if (!at) return ''
  const m = at.match(/(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  return m ? `${m[1]}-${m[2]} ${m[3]}:${m[4]}` : at.slice(0, 10)
}

export function useSearch(q: string): { hits: SearchHit[] | null; loading: boolean } {
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [loading, setLoading] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setHits(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const mine = ++seq.current
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        .then((r) => r.json())
        .then((d) => {
          if (seq.current === mine) {
            setHits(d.hits ?? [])
            setLoading(false)
          }
        })
        .catch(() => {
          if (seq.current === mine) {
            setHits([])
            setLoading(false)
          }
        })
    }, 300)
    return () => clearTimeout(id)
  }, [q])

  return { hits, loading }
}

export function SearchInput({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="search the machine's history…"
        spellCheck={false}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          fontFamily: MONO,
          fontSize: 11,
          color: UI.text,
          background: UI.surfaceSoft,
          border: UI.hairline,
          borderRadius: 8,
          padding: '7px 26px 7px 10px',
          outline: 'none',
        }}
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ('')}
          title="clear"
          style={{
            position: 'absolute',
            right: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: MONO,
            fontSize: 11,
            color: UI.dim,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 6px',
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

export function SearchResults({
  q,
  hits,
  loading,
}: {
  q: string
  hits: SearchHit[] | null
  loading: boolean
}) {
  return (
    <Panel style={{ flex: 1, minHeight: 0 }}>
      <PanelHeader
        label={`Receipts${hits ? ` · ${hits.length}` : ''}`}
        title="dated hits across the session log, alerts, decisions, memory, and the Argus mailbox"
      />
      <div
        style={{
          display: 'grid',
          gap: 8,
          overflowY: 'auto',
          minHeight: 0,
          padding: '8px 12px 12px',
          alignContent: 'start',
        }}
      >
        {loading &&
          !hits &&
          ['74%', '58%', '82%'].map((w, i) => (
            <div
              key={w}
              style={{
                height: 10,
                width: w,
                borderRadius: 6,
                background: 'rgba(210,175,120,0.10)',
                animation: `led-pulse 1.6s ease-in-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
        {hits && hits.length === 0 && !loading && (
          <EmptyState>no receipts for “{q.trim()}” — the logs are quiet on it.</EmptyState>
        )}
        {hits?.map((h, i) => (
          <div
            key={`${h.source}-${h.at}-${i}`}
            style={{ display: 'grid', gap: 2, paddingBottom: 7, borderBottom: UI.hairline }}
          >
            <div
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
                  fontSize: 9.5,
                  letterSpacing: 1.5,
                  color: UI.brassDim,
                  textTransform: 'uppercase',
                }}
              >
                {h.source}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: UI.dim, flexShrink: 0 }}>
                {fmtAt(h.at)}
              </span>
            </div>
            <Clamp2 text={h.text} size={10.5} />
            <span style={{ fontFamily: MONO, fontSize: 9, color: UI.dim }}>{h.where}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}
