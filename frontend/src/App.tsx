import { useEffect, useRef, useState } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import { useDashboardStore } from './store/dashboardStore'
import { OpsLog, buildBoardCells } from './components/CrewTelemetry'
import RangeFloor from './components/RangeFloor'
import BoardPanel from './components/BoardPanel'
import ClaudeHomePanel from './components/ClaudeHomePanel'
import DeskPanel from './components/DeskPanel'
import FleetPanel from './components/FleetPanel'
import TradingPanel from './components/TradingPanel'
import { getPhase, palette, type Phase } from './theme'
import IntroOverlay, { introSeen, markIntroSeen } from './components/IntroOverlay'
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

// ── Floating particles (canvas) ──────────────────────────────────────────────

interface Particle {
  x: number; y: number; vx: number; vy: number
  r: number; alpha: number; life: number; decay: number
}

function FloatingParticles({ rgb }: { rgb: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const mkParticle = (w: number, h: number): Particle => ({
      x: Math.random() * w,
      y: Math.random() * h + h * 0.1,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -Math.random() * 0.35 - 0.08,
      r: Math.random() * 1.4 + 0.2,
      alpha: Math.random() * 0.45 + 0.05,
      life: 1,
      decay: 0.0008 + Math.random() * 0.0012,
    })

    const particles: Particle[] = Array.from({ length: 70 }, (_, i) => {
      const p = mkParticle(canvas.width, canvas.height)
      p.life = i / 70
      return p
    })

    let id: number
    const frame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.life -= p.decay
        if (p.life <= 0 || p.y < -10) {
          Object.assign(p, mkParticle(canvas.width, canvas.height))
          p.y = canvas.height + 4
          p.life = 1
        }
        const a = p.alpha * Math.min(p.life * 4, 1)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb},${a})`
        ctx.fill()
      }
      id = requestAnimationFrame(frame)
    }
    frame()
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(id) }
  }, [rgb])

  return (
    <canvas ref={ref} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} />
  )
}

// ── Volumetric fog ───────────────────────────────────────────────────────────

function VolumetricFog({ phase }: { phase: Phase }) {
  return (
    <>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `radial-gradient(ellipse 70% 50% at 28% 62%, ${palette(phase).fog1}, transparent)`,
        animation: 'fog-breathe 12s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `radial-gradient(ellipse 60% 45% at 72% 38%, ${palette(phase).fog2}, transparent)`,
        animation: 'fog-breathe 16s ease-in-out infinite 5s',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 80% 30% at 50% 90%, rgba(10,45,32,0.22), transparent)',
      }} />
    </>
  )
}

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
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: isConnected && live ? C.teal : C.dim,
          animation: !isConnected ? 'link-blink 1.4s ease-in-out infinite' : undefined,
        }} />
        <span style={{ fontSize: 18, color: C.text, letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums', fontFamily: MONO }}>
          {time}
        </span>
      </div>
      {!isConnected && (
        <span style={{ fontSize: 9, color: C.dim, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          reconnecting…
        </span>
      )}
    </div>
  )
}

// ── Header ───────────────────────────────────────────────────────────────────

function CommandHeader() {
  return (
    <div style={{ display: 'grid', gap: 1, padding: '2px 0' }}>
      <div style={{ fontSize: 11, color: C.dim, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
        Mission Control
      </div>
      <div style={{ fontSize: 19, color: UI.accent, letterSpacing: '0.09em', textTransform: 'uppercase' }}>
        Terrarium
      </div>
      <div style={{ fontSize: 11, color: C.dim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        your agents, under glass
      </div>
    </div>
  )
}

// ── Alert bar — red only when something REAL is wrong ────────────────────────

function AlertBar() {
  const store = useDashboardStore()
  const trading = store.trading

  const alerts: { text: string; tone: string }[] = []
  const cells = buildBoardCells(useDashboardStore.getState())
  for (const cell of cells) {
    if (cell.state === 'nogo') alerts.push({ text: `${cell.callsign}: ${cell.detail}`, tone: C.red })
    if (cell.state === 'hold') alerts.push({ text: `${cell.callsign}: ${cell.detail}`, tone: C.amber })
  }
  // A stale trading heartbeat during market hours is the one that matters most
  const marketOpen = trading?.market?.is_open
  const anyStale = marketOpen && (['paper', 'live'] as const).some(
    (m) => trading?.modes?.[m]?.status === 'stale',
  )

  if (alerts.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px' }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.green }} />
        <span style={{ fontSize: 10, color: C.dim, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          All stations GO
        </span>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6,
      padding: '5px 12px', borderRadius: 999,
      border: `1px solid ${anyStale || alerts.some(a => a.tone === C.red) ? 'rgba(240,113,106,0.32)' : 'rgba(224,179,77,0.30)'}`,
      background: UI.surfaceSoft,
      maxWidth: 680,
    }}>
      {alerts.slice(0, 3).map((alert, i) => (
        <span key={i} title={alert.text} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: alert.tone, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: alert.tone, letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
            {alert.text}
          </span>
        </span>
      ))}
      {alerts.length > 3 && (
        <span style={{ fontSize: 9, color: C.dim, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          +{alerts.length - 3}
        </span>
      )}
    </div>
  )
}

// ── Bottom stat pills ────────────────────────────────────────────────────────

function StatPill({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  const pctMatch = value.match(/^(\d+(\.\d+)?)%$/)
  const numericPct = pctMatch ? parseFloat(pctMatch[1]) : null
  const accent = warn || (numericPct != null && numericPct > 85)
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
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      padding: '5px 12px 6px',
      border: `1px solid ${warn || (numericPct != null && numericPct > 85) ? 'rgba(224,179,77,0.5)' : numericPct != null && numericPct > 70 ? 'rgba(224,179,77,0.34)' : 'rgba(148,163,184,0.16)'}`,
      background: UI.surface,
      borderRadius: UI.radius,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      minWidth: 96,
    }}>
      <span style={{ fontSize: 8.5, letterSpacing: '0.18em', color: C.soft, textTransform: 'uppercase', marginBottom: 2, whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 17, color: accent, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1, fontFamily: MONO, animation: pulsing ? 'stat-pulse 0.4s ease-out' : undefined }}>{value}</span>
        {sub && <span style={{ fontSize: 9, color: C.dim, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{sub}</span>}
      </span>
    </div>
  )
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { isConnected } = useWebSocket()
  // Center-stage view: the crew canvas, or the agent's home page.
  const [view, setView] = useState<'stage' | 'home'>('stage')
  const [showIntro, setShowIntro] = useState(() => !introSeen())
  const closeIntro = () => { markIntroSeen(); setShowIntro(false) }
  const system = useDashboardStore((s) => s.system)
  const usage = useDashboardStore((s) => s.usage)
  const trading = useDashboardStore((s) => s.trading)
  const phase = getPhase(trading?.market)
  const sky = palette(phase)

  const realized = trading
    ? (trading.modes.paper.realized_today + trading.modes.live.realized_today)
    : 0

  return (
    <div
      className="app-root"
      style={{
        background: sky.sky.join(', '),
        transition: 'background 3s ease',
        color: C.text,
        fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {/* The horizon — first light rises here as the session approaches */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: sky.horizon, transition: 'background 3s ease',
      }} />
      <VolumetricFog phase={phase} />
      <FloatingParticles rgb={sky.particle} />
      {showIntro && <IntroOverlay onClose={closeIntro} />}

      <div className="shell">

        {/* Header — identity | alerts | clock */}
        <div className="shell-header">
          <CommandHeader />
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
            <AlertBar />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={() => setShowIntro(true)}
              style={{
                fontFamily: MONO, fontSize: 10,
                color: C.dim, background: 'transparent',
                border: '1px solid rgba(148,163,184,0.22)',
                borderRadius: 999, padding: '3px 9px', cursor: 'pointer',
              }}
              title="what am I looking at?"
            >
              ?
            </button>
            <button
              onClick={() => setView(view === 'stage' ? 'home' : 'stage')}
              style={{
                fontFamily: MONO, fontSize: 10, letterSpacing: 1.5,
                color: view === 'home' ? UI.accent : UI.soft,
                background: 'transparent', border: '1px solid rgba(148,163,184,0.22)',
                borderRadius: 999, padding: '3px 10px', cursor: 'pointer',
              }}
              title="the agent's own page"
            >
              {'\u2302'} home
            </button>
            <div className="clock-block">
              <ClockDot isConnected={isConnected} />
            </div>
          </div>
        </div>

        {/* Left rail — fleet board over the ops log */}
        <div className="shell-log">
          <div style={{ flexShrink: 0, maxHeight: '38%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <FleetPanel />
          </div>
          <div style={{ flexShrink: 0 }}>
            <DeskPanel />
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <OpsLog />
          </div>
        </div>

        {/* Center — the stage, or the agent's home */}
        <div className="shell-stage">
          {view === 'stage' ? <RangeFloor /> : <ClaudeHomePanel />}
        </div>

        {/* Right rail — trading desk over the decision board */}
        <div className="shell-desk">
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <TradingPanel />
          </div>
          <div style={{ flexShrink: 0, maxHeight: '45%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <BoardPanel />
          </div>
        </div>

        {/* Footer — vitals + usage */}
        <div className="shell-footer">
          <StatPill label="Memory" value={system?.ram_pct != null ? `${Math.round(system.ram_pct)}%` : '—'} sub={system ? `${system.ram_used_gb}/${system.ram_total_gb} GB` : undefined} />
          <StatPill label="CPU" value={system?.cpu_pct != null ? `${Math.round(system.cpu_pct)}%` : '—'} sub={system?.load_1m ? `${system.load_1m} avg` : undefined} />
          <StatPill label="Disk" value={system?.disk_pct != null ? `${Math.round(system.disk_pct)}%` : '—'} sub={system ? `${system.disk_used_gb}/${system.disk_total_gb} GB` : undefined} warn={system?.disk_pct != null && system.disk_pct > 85} />
          <StatPill label="Trader" value={system ? `${system.trader_procs}` : '—'} sub={system?.trader_ram_mb ? `${system.trader_ram_mb} MB` : 'daemons'} warn={system != null && system.trader_procs < 2} />
          <StatPill
            label="P&L today"
            value={trading ? `${realized >= 0 ? '+' : ''}${realized.toFixed(2)}` : '—'}
            sub="paper+live"
            warn={realized < 0}
          />
          <StatPill
            label="Claude today"
            value={usage?.available ? fmtTokens((usage.input_tokens ?? 0) + (usage.output_tokens ?? 0)) : '—'}
            sub={usage?.available ? `${usage.sessions_today} sessions · ${fmtTokens(usage.cache_read_tokens)} cached` : 'tokens'}
          />
          <StatPill label="Uptime" value={system?.uptime_seconds ? formatUptime(system.uptime_seconds) : '—'} sub={undefined} />
        </div>

      </div>
    </div>
  )
}
