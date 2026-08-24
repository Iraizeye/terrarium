// THE DESK — the-range-desk seat roster: five scheduled Claude seats,
// one card each, like a trading floor. Watch-only: the desk writes files,
// this panel reads /api/desk and renders status + the latest brief line.

import { useEffect, useState } from 'react'

const INK = { text: '#f2f1f7', soft: '#a29db8', dim: '#575370' }
const GREEN = '#79ff98'
const AMBER = '#f0c040'
const RED = '#ff7979'
const MONO = '"Fira Code", monospace'
const HAIRLINE = '1px solid rgba(150,146,172,0.10)'

type Seat = {
  name: string
  role: string
  schedule: string
  status: 'ok' | 'failed' | 'pending'
  ran_at: string | null
  brief: string | null
}

const STATUS_COLOR: Record<Seat['status'], string> = {
  ok: GREEN,
  pending: AMBER,
  failed: RED,
}

function firstLines(brief: string | null, n = 2): string {
  if (!brief) return '—'
  return brief.split('\n').filter(l => l.trim()).slice(0, n).join(' · ')
}

export default function DeskPanel() {
  const [seats, setSeats] = useState<Seat[]>([])
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch('/api/desk')
        .then(r => r.json())
        .then(d => { if (alive) setSeats(d.seats) })
        .catch(() => {})
    load()
    const t = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  return (
    <div style={{ fontFamily: MONO, display: 'grid', gap: 6 }}>
      <div style={{ color: INK.dim, fontSize: 10, letterSpacing: 2 }}>THE DESK</div>
      {seats.map(s => (
        <div key={s.name} style={{ borderBottom: HAIRLINE, paddingBottom: 5 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span style={{ color: STATUS_COLOR[s.status], fontSize: 10 }}>●</span>
            <span style={{ color: INK.text, fontSize: 12 }}>{s.role}</span>
            <span style={{ color: INK.dim, fontSize: 10, marginLeft: 'auto' }}>
              {s.status === 'pending' ? s.schedule
                : s.ran_at ? new Date(s.ran_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
          <div style={{
            color: s.status === 'failed' ? RED : INK.soft, fontSize: 10,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {s.status === 'failed' ? 'SEAT DOWN' : firstLines(s.brief)}
          </div>
        </div>
      ))}
    </div>
  )
}
