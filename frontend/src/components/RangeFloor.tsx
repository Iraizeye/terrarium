// The floor — a room drawn in code around Grok's copper robots.
// Every element is functional: the board carries the live tape, the LED
// sign is the real session clock, each desk monitor glows with its seat's
// actual status, and the wall clock reads ET. The room re-lights itself
// with the market phase. No raster backdrop; crisp at any size.

import { useEffect, useRef, useState } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { getPhase, type Phase } from '../theme'
import type { TradingStatus, AgentFleet, BoardState } from '../types'

const MONO = '"JetBrains Mono", "Fira Code", monospace'
const P = {
  red: '#f0716a', amber: '#e0b34d', gold: '#d9a441',
  text: '#eaf0e8', ink: '#1a1814', bubble: '#f2f6ea',
  crt: '#07140e', mint: '#7de8a8',
}

type SeatStatus = 'ok' | 'failed' | 'pending'
interface DeskSeat { name: string; status: SeatStatus; brief?: string | null }
type Action = 'sit' | 'work' | 'walk' | 'point'
interface Station {
  key: string
  label: string
  x: number
  y: number
  action: Action
  flip: boolean
  present: boolean
  down: boolean
  pending: boolean
  bubble: string | null
}

const GROUND = 0.88
const SPOTS: Record<string, { x: number; y: number; action: Action; flip?: boolean }> = {
  projects:  { x: 0.155, y: GROUND, action: 'sit' },
  premarket: { x: 0.275, y: GROUND, action: 'sit' },
  ops:       { x: 0.505, y: GROUND, action: 'sit' },
  content:   { x: 0.745, y: GROUND, action: 'work' },
  paper:     { x: 0.885, y: GROUND, action: 'sit' },
  chief:     { x: 0.400, y: 0.875, action: 'point' },
  live:      { x: 0.62, y: 0.91, action: 'walk' },
}
const DESK_SEATS = ['projects', 'premarket', 'ops', 'content', 'paper'] as const
const FRAMES = 6
const WALK = { x0: 0.56, x1: 0.68, y: 0.91, period: 14000 }
const ANCHOR_X: Record<Action, number> = { sit: 0.42, work: 0.66, walk: 0.50, point: 0.50 }
const SPRITE_FRAC: Record<Action, number> = { sit: 0.50, work: 0.50, walk: 0.36, point: 0.50 }

// the big board on the wall houses the live tape
const BOARD = { x: 0.180, y: 0.014, w: 0.348, h: 0.336 }
const WALL_PANELS: { x: number; y: number; w: number; h: number }[] = [
  { x: 0.196, y: 0.032, w: 0.152, h: 0.140 },
  { x: 0.360, y: 0.032, w: 0.152, h: 0.140 },
  { x: 0.196, y: 0.188, w: 0.152, h: 0.140 },
  { x: 0.360, y: 0.188, w: 0.152, h: 0.140 },
]
const SIGN = { x: 0.560, y: 0.096, w: 0.180, h: 0.052 }
const SIGN_HOUSE = { x: 0.548, y: 0.082, w: 0.204, h: 0.080 }
const CLOCK = { x: 0.845, y: 0.135, r: 0.075 }

// room light per market phase — walls, floor, and lamp warmth move with it
const ROOM: Record<Phase, {
  wallTop: string; wallBot: string; floorA: string; floorB: string
  counterTop: string; counterFace: string; wash: string | null
}> = {
  night: { wallTop: '#252e3a', wallBot: '#2f3947', floorA: '#3d2f21', floorB: '#2f241a', counterTop: '#7a5a38', counterFace: '#4a371f', wash: null },
  dawn:  { wallTop: '#2d3138', wallBot: '#3d3a33', floorA: '#453527', floorB: '#362a1e', counterTop: '#87643c', counterFace: '#523d22', wash: 'rgba(235,170,80,0.10)' },
  day:   { wallTop: '#3a4550', wallBot: '#49535d', floorA: '#4a3a2b', floorB: '#3b2f22', counterTop: '#94714a', counterFace: '#5a4428', wash: 'rgba(255,225,170,0.07)' },
  dusk:  { wallTop: '#2c2f37', wallBot: '#3a332c', floorA: '#41301f', floorB: '#34281b', counterTop: '#7d5c38', counterFace: '#4d3820', wash: 'rgba(240,140,80,0.08)' },
}

function phaseText(phase: Phase): string {
  return phase === 'day' ? 'MARKET OPEN' : phase === 'dawn' ? 'DAWN RUN' : phase === 'dusk' ? 'AFTER CLOSE' : 'NIGHT WATCH'
}

function coverRect(cw: number, ch: number, iw: number, ih: number) {
  const s = Math.max(cw / iw, ch / ih)
  const dw = iw * s
  const dh = ih * s
  // vertical overflow crops mostly ceiling-side but keeps the desks
  return { dx: (cw - dw) / 2, dy: (ch - dh) * 0.72, dw, dh }
}

function fleetBusy(fleet: AgentFleet | null): boolean {
  return !!fleet?.agents?.some(a => a.state === 'live')
}

function stationsFrom(
  seats: DeskSeat[],
  trading: TradingStatus | null,
  fleet: AgentFleet | null,
): Station[] {
  const liveHb = trading?.modes?.live?.status === 'alive'
  const busy = fleetBusy(fleet) || liveHb
  const names = ['projects', 'premarket', 'ops', 'content'] as const
  const out: Station[] = names.map((name) => {
    const seat = seats.find(s => s.name === name)
    const st: SeatStatus = seat?.status ?? 'pending'
    const p = SPOTS[name]
    const present = st === 'ok' || (busy && st !== 'failed')
    return {
      key: name, label: name.toUpperCase(), x: p.x, y: p.y,
      action: p.action, flip: !!p.flip,
      present, down: st === 'failed', pending: !present && st !== 'failed',
      bubble: st === 'failed' ? 'SEAT DOWN' : null,
    }
  })
  const paper = trading?.modes?.paper
  const pp = SPOTS.paper
  const paperOn = paper?.status === 'alive'
  out.push({
    key: 'paper', label: 'PAPER', x: pp.x, y: pp.y,
    action: 'sit', flip: true,
    present: paperOn, down: paper?.status === 'stale',
    pending: !paperOn && paper?.status !== 'stale',
    bubble: null,
  })
  const chiefSeat = seats.find(s => s.name === 'chief')
  const cp = SPOTS.chief
  const chiefOk = chiefSeat?.status === 'ok'
  out.push({
    key: 'chief', label: 'CHIEF', x: cp.x, y: cp.y,
    action: 'point', flip: false,
    present: chiefOk || busy, down: chiefSeat?.status === 'failed',
    pending: !(chiefOk || busy) && chiefSeat?.status !== 'failed',
    bubble: chiefOk ? 'brief sent — runs the floor' : null,
  })
  const live = trading?.modes?.live
  const last = trading?.last_decision
  const p = SPOTS.live
  const liveWalk = live?.status === 'alive' || busy
  out.push({
    key: 'live', label: 'LIVE', x: p.x, y: p.y,
    action: 'walk', flip: false,
    present: liveWalk, down: live?.status === 'stale',
    pending: !liveWalk && live?.status !== 'stale',
    bubble: last?.action
      ? `${last.action.toUpperCase()}${last.symbol ? ' ' + last.symbol : ''}` : null,
  })
  return out
}

function walkAt(now: number): { x: number; y: number; flip: boolean } {
  const p = (now % WALK.period) / WALK.period
  const goingRight = p < 0.5
  const u = goingRight ? p * 2 : 1 - (p - 0.5) * 2
  return { x: WALK.x0 + (WALK.x1 - WALK.x0) * u, y: WALK.y, flip: !goingRight }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.save()
  ctx.fillStyle = 'rgba(8, 10, 14, 0.38)'
  ctx.beginPath()
  ctx.ellipse(x, y - 2, w * 0.32, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

interface Quote { symbol: string; last: number; move: number }

function quotesFrom(board: BoardState | null, trading: TradingStatus | null): Quote[] {
  const out: Quote[] = []
  for (const c of board?.arms?.live?.candidates ?? []) {
    if (c.symbol) out.push({ symbol: c.symbol, last: c.last ?? 0, move: c.move_pct ?? 0 })
  }
  if (!out.length) {
    for (const c of board?.arms?.paper?.candidates ?? []) {
      if (c.symbol) out.push({ symbol: c.symbol, last: c.last ?? 0, move: c.move_pct ?? 0 })
    }
  }
  for (const mode of ['live', 'paper'] as const) {
    for (const p of trading?.modes?.[mode]?.open_positions ?? []) {
      if (!out.find(q => q.symbol === p.symbol)) {
        out.push({ symbol: p.symbol, last: p.entry, move: 0 })
      }
    }
  }
  return out
}

function drawScreen(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  q: Quote | null,
  hist: number[],
  now: number,
) {
  const r = Math.min(6, w * 0.06, h * 0.1)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.clip()
  ctx.fillStyle = P.crt
  ctx.fillRect(x, y, w, h)
  const scan = ((now / 45) % (h + 10)) - 5
  ctx.fillStyle = 'rgba(120,230,160,0.05)'
  ctx.fillRect(x, y + scan, w, 2)
  if (q) {
    const up = q.move >= 0
    const line = up ? '#56d98f' : '#e0837c'
    const pad = Math.max(3, w * 0.05)
    const series = hist.length > 2 ? hist : [q.last * 0.996, q.last]
    const min = Math.min(...series)
    const max = Math.max(...series)
    const span = max - min || 1
    const chartY = y + h * 0.14
    const chartH = h * 0.58
    ctx.beginPath()
    series.forEach((v, i) => {
      const px = x + pad + (i / Math.max(1, series.length - 1)) * (w - pad * 2)
      const py = chartY + chartH - ((v - min) / span) * chartH
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.strokeStyle = line
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.lineTo(x + w - pad, chartY + chartH + 2)
    ctx.lineTo(x + pad, chartY + chartH + 2)
    ctx.closePath()
    ctx.fillStyle = up ? 'rgba(70,190,120,0.18)' : 'rgba(220,120,110,0.15)'
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.fillStyle = '#9fe8c0'
    ctx.font = `bold ${Math.max(7, Math.min(10, h * 0.15))}px ${MONO}`
    ctx.fillText(
      `${q.symbol.slice(0, 5)}  ${q.last ? q.last.toFixed(2) : ''}  ${up ? '+' : ''}${(q.move * 100).toFixed(1)}%`,
      x + pad + 1, y + h - pad - 2,
    )
  }
  ctx.strokeStyle = 'rgba(160,255,200,0.10)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

export default function RangeFloor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stillsRef = useRef<Record<string, HTMLImageElement>>({})
  const framesRef = useRef<Record<string, HTMLImageElement[]>>({ chair: [], walk: [], point: [] })
  const sparkRef = useRef<Record<string, number[]>>({})
  const [ready, setReady] = useState(false)
  const [seats, setSeats] = useState<DeskSeat[]>([])
  const trading = useDashboardStore(s => s.trading)
  const fleet = useDashboardStore(s => s.fleet)
  const board = useDashboardStore(s => s.board)

  useEffect(() => {
    let cancelled = false
    const stills = Promise.all([
      loadImage('/bots/idle-chair.png').then(img => ['idle', img] as const),
      loadImage('/bots/work-chair.png').then(img => ['work', img] as const),
      loadImage('/bots/stand.png').then(img => ['stand', img] as const),
    ])
    const packs = (['chair', 'walk', 'point'] as const).map(kind =>
      Promise.all(
        Array.from({ length: FRAMES }, (_, i) => loadImage(`/bots/${kind}/${i}.png`)),
      ).then(imgs => [kind, imgs] as const),
    )
    Promise.all([stills, Promise.all(packs)]).then(([stillPairs, packs]) => {
      if (cancelled) return
      stillsRef.current = Object.fromEntries(stillPairs)
      const bag: Record<string, HTMLImageElement[]> = { chair: [], walk: [], point: [] }
      for (const [kind, imgs] of packs) bag[kind] = imgs
      framesRef.current = bag
      setReady(true)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let alive = true
    const load = () => fetch('/api/desk').then(r => r.json())
      .then(d => { if (alive) setSeats(d.seats) }).catch(() => {})
    load()
    const id = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const dataRef = useRef({ seats, trading, fleet, board })
  dataRef.current = { seats, trading, fleet, board }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let lastPush = 0

    const draw = (now: number) => {
      const { seats, trading, fleet, board } = dataRef.current
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.fillStyle = '#0b1116'
      ctx.fillRect(0, 0, rect.width, rect.height)

      if (!stillsRef.current.idle) {
        // skeleton: the office warming up — shimmer band over dark glass
        const shim = ((now / 6) % (rect.width * 1.6)) - rect.width * 0.3
        const g = ctx.createLinearGradient(shim - 140, 0, shim + 140, 0)
        g.addColorStop(0, 'rgba(120,200,160,0)')
        g.addColorStop(0.5, 'rgba(120,200,160,0.05)')
        g.addColorStop(1, 'rgba(120,200,160,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, rect.width, rect.height)
        ctx.fillStyle = 'rgba(140,170,155,0.55)'
        ctx.font = `10px ${MONO}`
        ctx.textAlign = 'center'
        ctx.fillText('warming up the office…', rect.width / 2, rect.height / 2)
        ctx.textAlign = 'left'
        raf = requestAnimationFrame(draw)
        return
      }

      const { dx, dy, dw, dh } = coverRect(rect.width, rect.height, 1280, 720)
      const X = (fx: number) => dx + fx * dw
      const Y = (fy: number) => dy + fy * dh
      const phase = getPhase(trading?.market)
      const room = ROOM[phase]

      // ── the room ──
      // wall
      {
        const g = ctx.createLinearGradient(0, Y(0), 0, Y(0.62))
        g.addColorStop(0, room.wallTop)
        g.addColorStop(1, room.wallBot)
        ctx.fillStyle = g
        ctx.fillRect(X(0), Y(0), dw, dh * 0.62)
        if (room.wash) {
          ctx.fillStyle = room.wash
          ctx.fillRect(X(0), Y(0), dw, dh * 0.62)
        }
      }
      // floor
      {
        const g = ctx.createLinearGradient(0, Y(0.62), 0, Y(1))
        g.addColorStop(0, room.floorA)
        g.addColorStop(1, room.floorB)
        ctx.fillStyle = g
        ctx.fillRect(X(0), Y(0.62), dw, dh * 0.38)
        ctx.strokeStyle = 'rgba(0,0,0,0.16)'
        ctx.lineWidth = 1
        for (let i = 1; i < 8; i++) {
          const fy = 0.62 + i * 0.048
          ctx.beginPath()
          ctx.moveTo(X(0), Y(fy))
          ctx.lineTo(X(1), Y(fy))
          ctx.stroke()
        }
        for (let i = 0; i < 9; i++) {
          const fx = 0.06 + i * 0.115 + (i % 2) * 0.03
          ctx.beginPath()
          ctx.moveTo(X(fx), Y(0.62 + (i % 3) * 0.096))
          ctx.lineTo(X(fx), Y(0.62 + (i % 3) * 0.096 + 0.048))
          ctx.stroke()
        }
      }
      // counter: top, face, shadow
      ctx.fillStyle = room.counterTop
      ctx.fillRect(X(0), Y(0.560), dw, dh * 0.030)
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.fillRect(X(0), Y(0.560), dw, dh * 0.006)
      ctx.fillStyle = room.counterFace
      ctx.fillRect(X(0), Y(0.590), dw, dh * 0.085)
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(X(0), Y(0.675), dw, dh * 0.012)
      // drawer lines on the face
      ctx.strokeStyle = 'rgba(0,0,0,0.20)'
      for (const fx of [0.09, 0.34, 0.58, 0.82]) {
        ctx.strokeRect(X(fx), Y(0.600), dw * 0.05, dh * 0.060)
      }

      // the big board (houses the live tape)
      ctx.fillStyle = '#10161d'
      ctx.strokeStyle = '#0b0f14'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.roundRect(X(BOARD.x), Y(BOARD.y), dw * BOARD.w, dh * BOARD.h, 8)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.045)'
      ctx.fillRect(X(BOARD.x) + 3, Y(BOARD.y) + 2, dw * BOARD.w - 6, 2)
      ctx.fillStyle = 'rgba(160,200,180,0.4)'
      ctx.font = `${Math.max(6, dh * 0.014)}px ${MONO}`
      ctx.fillText('THE TAPE — judged this session', X(BOARD.x + 0.008), Y(BOARD.y + BOARD.h) - dh * 0.012)

      // LED sign housing
      ctx.fillStyle = '#1a1113'
      ctx.strokeStyle = '#33201d'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(X(SIGN_HOUSE.x), Y(SIGN_HOUSE.y), dw * SIGN_HOUSE.w, dh * SIGN_HOUSE.h, 6)
      ctx.fill()
      ctx.stroke()

      // wall clock — real ET
      {
        const cx = X(CLOCK.x), cy = Y(CLOCK.y), r = dh * CLOCK.r
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fillStyle = '#e6e2d4'; ctx.fill()
        ctx.lineWidth = Math.max(2, r * 0.09); ctx.strokeStyle = '#2a2320'; ctx.stroke()
        const et = trading?.market?.et?.match(/(\d{1,2}):(\d{2})/)
        if (et) {
          const hh = (parseInt(et[1], 10) % 12) + parseInt(et[2], 10) / 60
          const mm = parseInt(et[2], 10)
          const ha = (hh / 12) * Math.PI * 2 - Math.PI / 2
          const ma = (mm / 60) * Math.PI * 2 - Math.PI / 2
          ctx.strokeStyle = '#2a2320'
          ctx.lineWidth = Math.max(1.5, r * 0.08)
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ha) * r * 0.5, cy + Math.sin(ha) * r * 0.5); ctx.stroke()
          ctx.lineWidth = Math.max(1, r * 0.05)
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ma) * r * 0.78, cy + Math.sin(ma) * r * 0.78); ctx.stroke()
          ctx.fillStyle = '#2a2320'
          ctx.beginPath(); ctx.arc(cx, cy, r * 0.07, 0, Math.PI * 2); ctx.fill()
        }
        ctx.fillStyle = 'rgba(160,200,180,0.4)'
        ctx.font = `${Math.max(6, dh * 0.013)}px ${MONO}`
        ctx.textAlign = 'center'
        ctx.fillText('ET', cx, cy + r + dh * 0.022)
        ctx.textAlign = 'left'
      }

      // banker lamps + warm pools
      for (const fx of [0.41, 0.635]) {
        const lx = X(fx), ly = Y(0.560)
        const glow = ctx.createRadialGradient(lx, ly - dh * 0.02, 2, lx, ly - dh * 0.02, dh * 0.12)
        glow.addColorStop(0, 'rgba(200,240,150,0.16)')
        glow.addColorStop(1, 'rgba(200,240,150,0)')
        ctx.fillStyle = glow
        ctx.fillRect(lx - dh * 0.12, ly - dh * 0.14, dh * 0.24, dh * 0.2)
        ctx.strokeStyle = '#8a7a4a'
        ctx.lineWidth = Math.max(1.5, dh * 0.005)
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly - dh * 0.045); ctx.stroke()
        ctx.fillStyle = '#3f9a52'
        ctx.beginPath()
        ctx.ellipse(lx, ly - dh * 0.050, dh * 0.032, dh * 0.014, 0, Math.PI, 0)
        ctx.fill()
        ctx.fillStyle = 'rgba(230,255,190,0.7)'
        ctx.fillRect(lx - dh * 0.024, ly - dh * 0.048, dh * 0.048, dh * 0.004)
      }

      // ── live tape on the board ──
      const quotes = quotesFrom(board, trading)
      if (now - lastPush > 400) {
        lastPush = now
        for (const q of quotes) {
          const hist = sparkRef.current[q.symbol] ?? []
          hist.push(q.last)
          sparkRef.current[q.symbol] = hist.slice(-48)
        }
      }
      for (const [i, scr] of WALL_PANELS.entries()) {
        const q = quotes[i] ?? null
        const hist = q ? (sparkRef.current[q.symbol] ?? []) : []
        drawScreen(ctx, X(scr.x), Y(scr.y), dw * scr.w, dh * scr.h, q, hist, now)
      }

      // LED sign — the real session phase and clock
      {
        const sx = X(SIGN.x), sy = Y(SIGN.y)
        const sw = dw * SIGN.w, sh = dh * SIGN.h
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(sx, sy, sw, sh, 4)
        ctx.fillStyle = '#120a0b'
        ctx.fill()
        const open = trading?.market?.is_open
        const label = phaseText(phase)
        const et = trading?.market?.et?.match(/\d{1,2}:\d{2}/)?.[0] ?? ''
        const flick = Math.sin(now / 320) > -0.92 ? 1 : 0.55
        ctx.globalAlpha = flick
        ctx.fillStyle = open ? '#ff5a4a' : '#e0b34d'
        ctx.textAlign = 'center'
        ctx.font = `bold ${Math.max(8, sh * 0.42)}px ${MONO}`
        ctx.fillText(`${label}${et ? ' · ' + et + ' ET' : ''}`, sx + sw / 2, sy + sh * 0.62)
        ctx.textAlign = 'left'
        ctx.restore()
      }

      // ── the cast ──
      const stations = stationsFrom(seats, trading, fleet)

      // desk monitors — each seat's screen glows with its robot's status
      for (const key of DESK_SEATS) {
        const st = stations.find(s => s.key === key)
        const spot = SPOTS[key]
        if (!st || !spot) continue
        const mw = dw * 0.070, mh = dh * 0.082
        const mx = X(spot.x) - mw / 2, my = Y(0.560) - mh - dh * 0.012
        ctx.fillStyle = '#232a30'
        ctx.beginPath(); ctx.roundRect(mx - 3, my - 3, mw + 6, mh + 6, 5); ctx.fill()
        const on = st.present && !st.down
        const glow = st.down ? 'rgba(240,113,106,0.5)' : st.pending ? 'rgba(224,179,77,0.28)' : 'rgba(125,232,168,0.35)'
        ctx.fillStyle = on ? '#0b1a12' : '#10151a'
        ctx.fillRect(mx, my, mw, mh)
        ctx.fillStyle = glow
        ctx.fillRect(mx, my, mw, mh * 0.16)
        if (on) {
          ctx.strokeStyle = 'rgba(125,232,168,0.6)'
          ctx.lineWidth = 1
          ctx.beginPath()
          for (let i = 0; i <= 16; i++) {
            const px = mx + (i / 16) * mw
            const py = my + mh * 0.62 + Math.sin(now / 260 + i * 0.9 + spot.x * 20) * mh * 0.14
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
          }
          ctx.stroke()
        }
        // stand
        ctx.fillStyle = '#1b2126'
        ctx.fillRect(X(spot.x) - dw * 0.004, my + mh + 3, dw * 0.008, dh * 0.008)
      }

      const frames = framesRef.current
      const stills = stillsRef.current
      const order = [...stations].sort((a, b) => a.y - b.y)

      for (const [i, s] of order.entries()) {
        let x = X(s.x)
        let y = Y(s.y)
        let flip = s.flip
        if (s.action === 'walk' && s.present) {
          const wpos = walkAt(now)
          x = X(wpos.x)
          y = Y(wpos.y)
          flip = wpos.flip
        }
        const working = s.present && !s.down
        const frameN = working
          ? Math.floor(now / (s.action === 'walk' ? 100 : 90) + i * 2) % FRAMES
          : 0
        let sprite: HTMLImageElement | undefined
        if (s.action === 'walk') sprite = frames.walk[frameN]
        else if (s.action === 'point') sprite = working ? frames.point[frameN] : stills.stand
        else if (s.action === 'work') sprite = stills.work
        else sprite = working ? frames.chair[frameN] : stills.idle
        const frac = SPRITE_FRAC[s.action]
        if (sprite) {
          const th = dh * frac
          const tw = sprite.width * (th / sprite.height)
          const ax = ANCHOR_X[s.action]
          shadow(ctx, x, y, tw)
          ctx.save()
          ctx.globalAlpha = s.down ? 0.5 : s.pending ? 0.78 : 1
          ctx.translate(x, y)
          if (flip) ctx.scale(-1, 1)
          ctx.drawImage(sprite, -ax * tw, -th, tw, th)
          ctx.restore()
        }
        ctx.font = `8px ${MONO}`
        ctx.textAlign = 'center'
        ctx.save()
        ctx.globalAlpha = 0.8
        ctx.fillStyle = 'rgba(6,8,10,0.6)'
        const lw2 = ctx.measureText(s.label).width + 8
        ctx.fillRect(x - lw2 / 2, y + 6, lw2, 11)
        ctx.fillStyle = s.down ? P.red : s.pending ? P.amber : P.text
        ctx.fillText(s.label, x, y + 14)
        ctx.restore()
        ctx.textAlign = 'left'
      }

      const withBubbles = stations.filter(s => s.bubble)
      if (withBubbles.length) {
        const pick = withBubbles[Math.floor(now / 5000) % withBubbles.length]
        ctx.font = `11px ${MONO}`
        const w = Math.min(ctx.measureText(pick.bubble!).width + 14, 220)
        const cxb = X(pick.x)
        const bx = Math.max(dx + 4, Math.min(dx + dw - w - 4, cxb - w / 2))
        const by = Math.max(dy + 6, Y(pick.y - SPRITE_FRAC[pick.action] - 0.05))
        ctx.fillStyle = pick.down ? P.red : P.gold
        ctx.fillRect(bx, by, w, 18)
        ctx.fillStyle = P.bubble
        ctx.fillRect(bx + 1, by + 1, w - 2, 16)
        ctx.fillStyle = P.ink
        ctx.fillText(pick.bubble!.slice(0, 34), bx + 7, by + 13)
        ctx.fillStyle = pick.down ? P.red : P.gold
        ctx.fillRect(cxb - 3, by + 18, 6, 4)
      }

      // vignette pulls the eye to the cast
      {
        const g = ctx.createRadialGradient(
          rect.width / 2, rect.height * 0.58, rect.height * 0.35,
          rect.width / 2, rect.height * 0.58, rect.width * 0.72,
        )
        g.addColorStop(0, 'rgba(0,0,0,0)')
        g.addColorStop(1, 'rgba(4,6,8,0.30)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, rect.width, rect.height)
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [ready])

  return (
    <div className="floor-frame">
      <canvas ref={canvasRef} />
    </div>
  )
}
