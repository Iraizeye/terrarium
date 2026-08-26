// THE DESK — the scheduled seat roster: recurring Claude seats, one card
// each, like a trading floor. Watch-only: the desk writes files, this
// panel reads /api/desk and renders status + the latest brief line.

import { useEffect, useState } from 'react'
import { Clamp2, EmptyState, Led, MONO, Panel, PanelHeader, UI } from '../ui'

type Seat = {
  name: string
  role: string
  schedule: string
  status: 'ok' | 'failed' | 'pending'
  ran_at: string | null
  brief: string | null
}

const STATUS_COLOR: Record<Seat['status'], string> = {
  ok: UI.green,
  pending: UI.amber,
  failed: UI.red,
}

const STATUS_TITLE: Record<Seat['status'], string> = {
  ok: 'last run completed',
  pending: 'scheduled — has not run yet today',
  failed: 'last run failed',
}

function firstLines(brief: string | null, n = 2): string {
  if (!brief) return 'no brief yet — appears after this seat’s first run'
  return brief
    .split('\n')
    .filter((l) => l.trim())
    .slice(0, n)
    .join(' · ')
}

export default function DeskPanel() {
  const [seats, setSeats] = useState<Seat[]>([])
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch('/api/desk')
        .then((r) => r.json())
        .then((d) => {
          if (alive) setSeats(d.seats)
        })
        .catch(() => {})
    load()
    const t = setInterval(load, 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  return (
    <Panel id="panel-desk">
      <PanelHeader
        label="The desk"
        title="scheduled agent seats — each runs on its own clock and files a brief"
      />
      {seats.length === 0 ? (
        <EmptyState>
          no scheduled seats configured — optional: recurring agent jobs appear here with their
          schedules and briefs.
        </EmptyState>
      ) : (
        <div style={{ padding: '4px 14px 8px', display: 'grid', gap: 6, fontFamily: MONO }}>
          {seats.map((s) => (
            <div key={s.name} style={{ borderBottom: UI.hairline, paddingBottom: 5 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Led color={STATUS_COLOR[s.status]} title={STATUS_TITLE[s.status]} />
                <span style={{ color: UI.text, fontSize: 12 }}>{s.role}</span>
                <span style={{ color: UI.dim, fontSize: 10, marginLeft: 'auto' }}>
                  {s.status === 'pending'
                    ? s.schedule
                    : s.ran_at
                      ? new Date(s.ran_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                </span>
              </div>
              {s.status === 'failed' ? (
                <div style={{ color: UI.red, fontSize: 10 }}>SEAT DOWN — see ops log</div>
              ) : (
                <Clamp2 text={firstLines(s.brief)} size={10} />
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
