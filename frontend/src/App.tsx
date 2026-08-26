import { useEffect, useRef, useState } from 'react'
import BoardPanel from './components/BoardPanel'
import ClaudeHomePanel from './components/ClaudeHomePanel'
import { buildBoardCells, OpsLog } from './components/CrewTelemetry'
import DeskPanel from './components/DeskPanel'
import FleetPanel from './components/FleetPanel'
import IntroOverlay, { introSeen, markIntroSeen } from './components/IntroOverlay'
import RfcRail, { DepartmentsPanel } from './components/RfcRail'
import { SearchInput, SearchResults, useSearch } from './components/SearchPanel'
import TradingPanel from './components/TradingPanel'
import VesperFloor from './components/VesperFloor'
import { useWebSocket } from './hooks/useWebSocket'
import { useDashboardStore } from './store/dashboardStore'
import { getPhase, type Phase } from './theme'
import { MONO, UI } from './ui'

// ── Color palette (rails/chrome — see ui.tsx) ────────────────────────────────

const C = {
  text: UI.text,
  soft: UI.soft,
  dim: UI.dim,
  teal: UI.accent,
  green: UI.green,
  amber: UI.amber,
  red: UI.red,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(s: number): string {
  if (!s || s < 0) return '—'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function fmtTokens(n: number | undefined): string {
  if (!n) return '0'
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k`
  return String(n)
}

// ── Clock (top-right) ────────────────────────────────────────────────────────

function ClockDot({ isConnected }: { isConnected: boolean }) {
  const lastUpdate = useDashboardStore((s) => s.lastUpdate)
  const [time, setTime] = useState(() => new Date().toLocaleTimeString())
  const [live, setLive] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString())
      setLive(lastUpdate ? Date.now() - lastUpdate.getTime() < 15000 : false)
    }, 1000)
    return () => clearInterval(id)
  }, [lastUpdate])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: isConnected && live ? C.teal : C.dim,
            animation: !isConnected ? 'link-blink 1.4s ease-in-out infinite' : undefined,
          }}
        />
        <span
          style={{
            fontSize: 18,
            color: C.text,
            letterSpacing: '0.06em',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: MONO,
          }}
        >
          {time}
        </span>
      </div>
      {!isConnected && (
        <span
          style={{ fontSize: 9, color: C.dim, letterSpacing: '0.18em', textTransform: 'uppercase' }}
        >
          reconnecting…
        </span>
      )}
    </div>
  )
}

// ── Status strip — the 30-second answer, per the state matrix ──────────────
// GO only when the doctor agrees; quiet is named, never implied; missing
// telemetry is a fact, not a verdict.

function doctorCause(line: string | null | undefined): string {
  if (!line) return ''
  const afterDash = line.split(/problem\(s\) — /)[1] ?? line
  return afterDash
    .split(/ — |\(/)[0]
    .trim()
    .slice(0, 60)
}

function AlertBar() {
  const store = useDashboardStore()
  const trading = store.trading
  const [doctor, setDoctor] = useState<{ line: string | null; green: boolean | null } | null>(null)
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch('/api/home')
        .then((r) => r.json())
        .then((d) => {
          if (alive) setDoctor(d.doctor ?? null)
        })
        .catch(() => {})
    load()
    const id = setInterval(load, 120_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const Strip = ({
    dot,
    text,
    tone,
    strong,
  }: {
    dot: string
    text: string
    tone: string
    strong?: boolean
  }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        borderRadius: 999,
        border: strong ? `1px solid ${dot}55` : undefined,
        background: strong ? UI.surfaceSoft : undefined,
        maxWidth: 680,
      }}
    >
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <span
        style={{
          fontSize: strong ? 11 : 10,
          color: tone,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {text}
      </span>
    </div>
  )

  // 1. no telemetry: never render a verdict on missing data
  if (!trading)
    return <Strip dot={C.amber} text="TELEMETRY DOWN — not a verdict" tone={C.amber} strong />
  // 2. kill switch beats everything
  if (trading.kill_switch)
    return <Strip dot={C.red} text="KILL ACTIVE — buys halted" tone={C.red} strong />
  // 3. doctor NOT READY
  const notReady = /NOT READY/i.test(doctor?.line ?? '')
  if (notReady)
    return (
      <Strip
        dot={C.red}
        text={`NOT READY — ${doctorCause(doctor?.line)} · next open 09:30 ET`}
        tone={C.red}
        strong
      />
    )
  // 4. board cell alerts (red/amber), same as before
  const cells = buildBoardCells(useDashboardStore.getState())
  const alerts: { text: string; tone: string }[] = []
  for (const cell of cells) {
    if (cell.state === 'nogo')
      alerts.push({ text: `${cell.callsign}: ${cell.detail}`, tone: C.red })
    if (cell.state === 'hold')
      alerts.push({ text: `${cell.callsign}: ${cell.detail}`, tone: C.amber })
  }
  if (doctor && doctor.green === false)
    alerts.unshift({ text: `DEGRADED — ${doctorCause(doctor.line)}`, tone: C.amber })
  if (alerts.length > 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
          padding: '5px 12px',
          borderRadius: 999,
          border: `1px solid ${alerts.some((a) => a.tone === C.red) ? 'rgba(240,113,106,0.32)' : 'rgba(224,179,77,0.30)'}`,
          background: UI.surfaceSoft,
          maxWidth: 680,
        }}
      >
        {alerts.slice(0, 3).map((alert, i) => (
          <span
            key={i}
            title={alert.text}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: alert.tone,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: alert.tone,
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 260,
              }}
            >
              {alert.text}
            </span>
          </span>
        ))}
        {alerts.length > 3 && (
          <span
            style={{
              fontSize: 9,
              color: C.dim,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            +{alerts.length - 3}
          </span>
        )}
      </div>
    )
  }
  // 5. quiet-GO: night, closed, flat — quiet is a state, not an absence
  const flat =
    (trading.modes?.live?.open_positions?.length ?? 0) === 0 &&
    (trading.modes?.paper?.open_positions?.length ?? 0) === 0
  if (getPhase(trading.market) === 'night' && !trading.market?.is_open && flat)
    return <Strip dot={C.dim} text="NIGHT WATCH · all quiet" tone={C.dim} />
  // 6. GO — and now it means it
  return <Strip dot={C.green} text="All stations GO" tone={C.dim} />
}

// ── Bottom stat pills ────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  sub,
  warn,
}: {
  label: string
  value: string
  sub?: string
  warn?: boolean
}) {
  const pctMatch = value.match(/^(\d+(\.\d+)?)%$/)
  const numericPct = pctMatch ? parseFloat(pctMatch[1]) : null
  const accent =
    warn || (numericPct != null && numericPct > 85)
      ? UI.amber
      : numericPct != null && numericPct > 70
        ? C.amber
        : C.text
  const [pulsing, setPulsing] = useState(false)
  const prevValue = useRef(value)
  useEffect(() => {
    if (prevValue.current !== value && prevValue.current !== '') {
      setPulsing(true)
      const t = setTimeout(() => setPulsing(false), 400)
      prevValue.current = value
      return () => clearTimeout(t)
    }
    prevValue.current = value
  }, [value])
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: '5px 12px 6px',
        border: `1px solid ${warn || (numericPct != null && numericPct > 85) ? 'rgba(224,179,77,0.5)' : numericPct != null && numericPct > 70 ? 'rgba(224,179,77,0.34)' : 'rgba(210,175,120,0.18)'}`,
        background: UI.surface,
        borderRadius: UI.radius,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        minWidth: 96,
      }}
    >
      <span
        style={{
          fontSize: 8.5,
          letterSpacing: '0.18em',
          color: C.soft,
          textTransform: 'uppercase',
          marginBottom: 2,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontSize: 17,
            color: accent,
            fontWeight: 700,
            letterSpacing: '0.04em',
            lineHeight: 1,
            fontFamily: MONO,
            animation: pulsing ? 'stat-pulse 0.4s ease-out' : undefined,
          }}
        >
          {value}
        </span>
        {sub && (
          <span
            style={{ fontSize: 9, color: C.dim, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}
          >
            {sub}
          </span>
        )}
      </span>
    </div>
  )
}

// ── App ──────────────────────────────────────────────────────────────────────

function phaseLabel(phase: Phase): string {
  if (phase === 'day') return 'MARKET OPEN'
  if (phase === 'dawn') return 'DAWN RUN'
  if (phase === 'dusk') return 'DUSK'
  return 'NIGHT'
}

function Ticker() {
  const trading = useDashboardStore((s) => s.trading)
  const board = useDashboardStore((s) => s.board)
  const cells: { txt: string; c: string }[] = []
  for (const mode of ['live', 'paper'] as const) {
    for (const p of trading?.modes?.[mode]?.open_positions ?? []) {
      cells.push({ txt: `${p.symbol} HELD`, c: UI.accent })
    }
  }
  for (const c of board?.arms?.live?.candidates ?? []) {
    const up = c.move_pct >= 0
    cells.push({
      txt: `${c.symbol} ${up ? '+' : ''}${c.move_pct.toFixed(1)}%`,
      c: up ? UI.green : UI.red,
    })
  }
  if (!trading?.market?.is_open) {
    // closed market: a scrolling tape is fake busy — say the truth, still
    return (
      <div className="ticker" aria-hidden style={{ justifyContent: 'center', display: 'flex' }}>
        <span style={{ animation: 'none', color: UI.dim }}>TAPE CLOSED · reopens 09:30 ET</span>
      </div>
    )
  }
  if (!cells.length) cells.push({ txt: 'quiet tape', c: UI.dim })
  const line = cells.map((c) => c.txt).join('   ·   ')
  return (
    <div className="ticker" aria-hidden>
      <span>
        {line} · {line} · {line}
      </span>
    </div>
  )
}

export default function App() {
  const { isConnected } = useWebSocket()
  // Deep-linkable: ?view=home opens the agent's home page directly.
  const [view, setView] = useState<'stage' | 'home'>(() =>
    new URLSearchParams(window.location.search).get('view') === 'home' ? 'home' : 'stage',
  )
  const [searchQ, setSearchQ] = useState(
    () => new URLSearchParams(window.location.search).get('q') ?? '',
  )
  const searching = searchQ.trim().length >= 2
  const { hits: searchHits, loading: searchLoading } = useSearch(searchQ)
  const [showIntro, setShowIntro] = useState(() => !introSeen())
  const closeIntro = () => {
    markIntroSeen()
    setShowIntro(false)
  }
  const system = useDashboardStore((s) => s.system)
  const usage = useDashboardStore((s) => s.usage)
  const trading = useDashboardStore((s) => s.trading)
  const phase = getPhase(trading?.market)
  const realized = trading
    ? trading.modes.paper.realized_today + trading.modes.live.realized_today
    : 0
  const et = trading?.market?.et?.match(/\d{1,2}:\d{2}/)?.[0] ?? '--:--'

  return (
    <div
      className="app-root"
      style={{ color: C.text, fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif' }}
    >
      {showIntro && <IntroOverlay onClose={closeIntro} />}

      <div className="shell">
        <div className="shell-header">
          <div>
            <div
              style={{
                fontSize: 11,
                color: UI.brass,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              Terrarium
            </div>
            <div
              style={{
                fontSize: 9,
                color: C.dim,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginTop: 1,
              }}
            >
              a little world of working agents
            </div>
            <div className="hud-chip" style={{ marginTop: 4 }}>
              {phaseLabel(phase)} / {et} ET
            </div>
          </div>
          <AlertBar />
          <div className="hud-tools">
            <button
              type="button"
              onClick={() => setShowIntro(true)}
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: C.dim,
                background: 'transparent',
                border: '1px solid rgba(210,175,120,0.25)',
                borderRadius: 999,
                padding: '3px 9px',
                cursor: 'pointer',
              }}
              title="what am I looking at?"
            >
              ?
            </button>
            <button
              type="button"
              onClick={() => setView(view === 'stage' ? 'home' : 'stage')}
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: 1.5,
                color: view === 'home' ? UI.accent : UI.soft,
                background: 'transparent',
                border: '1px solid rgba(210,175,120,0.25)',
                borderRadius: 999,
                padding: '3px 10px',
                cursor: 'pointer',
              }}
              title="the agent's own page"
            >
              {'\u2302'} home
            </button>
            <ClockDot isConnected={isConnected} />
          </div>
        </div>

        <div className="shell-log">
          <SearchInput q={searchQ} setQ={setSearchQ} />
          {searching ? (
            <SearchResults q={searchQ} hits={searchHits} loading={searchLoading} />
          ) : (
            <>
              <div
                style={{
                  flexShrink: 0,
                  maxHeight: '38%',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                }}
              >
                <FleetPanel />
              </div>
              <DepartmentsPanel />
              <div style={{ flexShrink: 0 }}>
                <DeskPanel />
              </div>
              <RfcRail />
              <div style={{ flex: 1, minHeight: 0 }}>
                <OpsLog />
              </div>
            </>
          )}
        </div>

        <div className="shell-stage">
          {view === 'stage' ? <VesperFloor /> : <ClaudeHomePanel />}
          <Ticker />
        </div>

        <div className="shell-desk">
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <TradingPanel />
          </div>
          <div
            style={{
              flexShrink: 0,
              maxHeight: '45%',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <BoardPanel />
          </div>
        </div>

        <div className="shell-footer">
          <StatPill
            label="Memory"
            value={system?.ram_pct != null ? `${Math.round(system.ram_pct)}%` : '—'}
            sub={system ? `${system.ram_used_gb}/${system.ram_total_gb} GB` : undefined}
          />
          <StatPill
            label="CPU"
            value={system?.cpu_pct != null ? `${Math.round(system.cpu_pct)}%` : '—'}
            sub={system?.load_1m ? `${system.load_1m} avg` : undefined}
          />
          <StatPill
            label="Disk"
            value={system?.disk_pct != null ? `${Math.round(system.disk_pct)}%` : '—'}
            sub={system ? `${system.disk_used_gb}/${system.disk_total_gb} GB` : undefined}
            warn={system?.disk_pct != null && system.disk_pct > 85}
          />
          <StatPill
            label="Trader"
            value={system ? `${system.trader_procs}` : '—'}
            sub={system?.trader_ram_mb ? `${system.trader_ram_mb} MB` : 'daemons'}
            warn={system != null && system.trader_procs < 2}
          />
          <StatPill
            label="P&L today"
            value={trading ? `${realized >= 0 ? '+' : ''}${realized.toFixed(2)}` : '—'}
            sub="paper+live"
            warn={realized < 0}
          />
          <StatPill
            label="Claude today"
            value={
              usage?.available
                ? fmtTokens((usage.input_tokens ?? 0) + (usage.output_tokens ?? 0))
                : '—'
            }
            sub={usage?.available ? `${usage.sessions_today} sessions` : 'tokens'}
          />
          <StatPill
            label="Uptime"
            value={system?.uptime_seconds ? formatUptime(system.uptime_seconds) : '—'}
          />
        </div>
      </div>
    </div>
  )
}
