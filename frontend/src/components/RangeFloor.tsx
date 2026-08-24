// Night office. Robots sit IN rolling chairs. CRT glass shows live tape.

import { useEffect, useRef, useState } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { getPhase, type Phase } from '../theme'
import type { TradingStatus, AgentFleet, BoardState } from '../types'

const MONO = '"JetBrains Mono", "Fira Code", monospace'
const P = {
  red: '#f0716a', amber: '#e0b34d', gold: '#d9a441',
  text: '#eaf0e8', ink: '#1a1814', bubble: '#f2f6ea',
  crt: '#07140e', green: '#3dff7a', dim: '#1a3d28',
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
const FRAMES = 6
const WALK = { x0: 0.56, x1: 0.68, y: 0.91, period: 14000 }
const ANCHOR_X: Record<Action, number> = { sit: 0.42, work: 0.66, walk: 0.50, point: 0.50 }
const SPRITE_FRAC: Record<Action, number> = { sit: 0.50, work: 0.50, walk: 0.36, point: 0.50 }

// the painted sign lies; this LED panel tells the truth (fractions of office.jpg)
const SIGN = { x: 0.548, y: 0.088, w: 0.185, h: 0.062 }
// one of the painted wall monitors is switched on with live data
const WALLMON = { x: 0.192, y: 0.034, w: 0.140, h: 0.134 }
// the tilted corner monitor painted with a fake ticker — live now, tilt matched
const WALLMON2 = { cx: 0.110, cy: 0.160, w: 0.142, h: 0.220, rot: -0.09 }

const GRADE: Record<Phase, string | null> = {
  night: null,
  dawn: 'rgba(255,176,80,0.10)',
  day: 'rgba(255,228,170,0.09)',
  dusk: 'rgba(250,130,70,0.08)',
}

function phaseText(phase: Phase): string {
  return phase === 'day' ? 'MARKET OPEN' : phase === 'dawn' ? 'DAWN RUN' : phase === 'dusk' ? 'AFTER CLOSE' : 'NIGHT WATCH'
}

// CRT glass, fractions of office.jpg
const SCREENS: { x: number; y: number; w: number; h: number }[] = [
  { x: 0.058, y: 0.352, w: 0.082, h: 0.098 },
  { x: 0.210, y: 0.350, w: 0.100, h: 0.095 },
  { x: 0.430, y: 0.348, w: 0.092, h: 0.092 },
  { x: 0.718, y: 0.348, w: 0.085, h: 0.092 },
  { x: 0.848, y: 0.350, w: 0.082, h: 0.095 },
]

function coverRect(cw: number, ch: number, iw: number, ih: number) {
  const s = Math.max(cw / iw, ch / ih)
  const dw = iw * s
  const dh = ih * s
  return { dx: (cw - dw) / 2, dy: ch - dh, dw, dh }
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
    key: 'chief', label: 'CHIEF OF STAFF', x: cp.x, y: cp.y,
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
  const r = Math.min(5, w * 0.08, h * 0.12)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.clip()
  ctx.fillStyle = P.crt
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = 'rgba(50, 220, 110, 0.07)'
  ctx.fillRect(x, y, w, h * 0.45)
  const scan = ((now / 35) % (h + 8)) - 4
  ctx.fillStyle = 'rgba(80, 255, 140, 0.08)'
  ctx.fillRect(x, y + scan, w, 2)
  if (q) {
    const up = q.move >= 0
    const col = up ? P.green : P.red
    const pad = Math.max(2, w * 0.06)
    ctx.fillStyle = col
    ctx.textAlign = 'left'
    ctx.font = `bold ${Math.max(7, Math.min(10, h * 0.22))}px ${MONO}`
    ctx.fillText(q.symbol.slice(0, 5), x + pad, y + h * 0.30)
    ctx.font = `${Math.max(6, Math.min(9, h * 0.20))}px ${MONO}`
    ctx.fillText(q.last ? q.last.toFixed(2) : '—', x + pad, y + h * 0.52)
    const series = hist.length > 2 ? hist : [q.last * 0.995, q.last]
    const min = Math.min(...series)
    const max = Math.max(...series)
    const span = max - min || 1
    ctx.beginPath()
    ctx.strokeStyle = col
    ctx.lineWidth = 1.2
    const chartY = y + h * 0.58
    const chartH = h * 0.34
    series.forEach((v, i) => {
      const px = x + pad + (i / Math.max(1, series.length - 1)) * (w - pad * 2)
      const py = chartY + chartH - ((v - min) / span) * chartH
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()
  }
  ctx.restore()
}

export default function RangeFloor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
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
    const office = loadImage('/office.jpg')
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
    Promise.all([office, stills, Promise.all(packs)]).then(([img, stillPairs, packs]) => {
      if (cancelled) return
      imgRef.current = img
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

      const img = imgRef.current
      const iw = img?.width || 1280
      const ih = img?.height || 720
      const { dx, dy, dw, dh } = coverRect(rect.width, rect.height, iw, ih)
      if (img) ctx.drawImage(img, dx, dy, dw, dh)

      // time-of-day grade over the painting (sprites and live glass stay crisp)
      const phase = getPhase(trading?.market)
      const grade = GRADE[phase]
      if (grade) {
        ctx.save()
        ctx.globalCompositeOperation = 'soft-light'
        ctx.fillStyle = grade
        ctx.fillRect(0, 0, rect.width, rect.height)
        ctx.restore()
      }

      // live LED sign over the painted one
      {
        const sx = dx + SIGN.x * dw, sy = dy + SIGN.y * dh
        const sw = SIGN.w * dw, sh = SIGN.h * dh
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(sx, sy, sw, sh, 4)
        ctx.fillStyle = '#140b0c'
        ctx.fill()
        ctx.strokeStyle = 'rgba(120,60,50,0.8)'
        ctx.lineWidth = 2
        ctx.stroke()
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

      // two painted wall monitors are switched on with live data
      {
        const qs = quotesFrom(board, trading)
        const q0 = qs[0] ?? null
        const wx = dx + WALLMON.x * dw, wy = dy + WALLMON.y * dh
        const ww = WALLMON.w * dw, wh = WALLMON.h * dh
        drawScreen(ctx, wx, wy, ww, wh, q0, q0 ? (sparkRef.current[q0.symbol] ?? []) : [], now)
        const q1 = qs[1] ?? q0
        const m = WALLMON2
        ctx.save()
        ctx.translate(dx + m.cx * dw, dy + m.cy * dh)
        ctx.rotate(m.rot)
        drawScreen(ctx, -m.w * dw / 2, -m.h * dh / 2, m.w * dw, m.h * dh,
          q1, q1 ? (sparkRef.current[q1.symbol] ?? []) : [], now)
        ctx.restore()
      }

      const quotes = quotesFrom(board, trading)
      if (now - lastPush > 400) {
        lastPush = now
        for (const q of quotes) {
          const hist = sparkRef.current[q.symbol] ?? []
          const jitter = q.last * (1 + Math.sin(now / 700 + q.symbol.length) * 0.0015)
          hist.push(q.last || jitter)
          sparkRef.current[q.symbol] = hist.slice(-48)
        }
      }

      for (const [i, scr] of SCREENS.entries()) {
        const q = quotes[i % Math.max(1, quotes.length)] ?? null
        const hist = q ? (sparkRef.current[q.symbol] ?? []) : []
        drawScreen(
          ctx,
          dx + scr.x * dw, dy + scr.y * dh, scr.w * dw, scr.h * dh,
          q, hist, now,
        )
      }

      const stations = stationsFrom(seats, trading, fleet)
      const frames = framesRef.current
      const stills = stillsRef.current
      const order = [...stations].sort((a, b) => a.y - b.y)

      for (const [i, s] of order.entries()) {
        let x = dx + s.x * dw
        let y = dy + s.y * dh
        let flip = s.flip
        if (s.action === 'walk' && s.present) {
          const wpos = walkAt(now)
          x = dx + wpos.x * dw
          y = dy + wpos.y * dh
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
        ctx.font = `9px ${MONO}`
        ctx.textAlign = 'center'
        ctx.fillStyle = s.down ? P.red : s.pending ? P.amber : P.text
        ctx.fillText(s.label, x, y + 14)
        ctx.textAlign = 'left'
      }

      const withBubbles = stations.filter(s => s.bubble)
      if (withBubbles.length) {
        const pick = withBubbles[Math.floor(now / 5000) % withBubbles.length]
        ctx.font = `11px ${MONO}`
        const w = Math.min(ctx.measureText(pick.bubble!).width + 14, 220)
        const cxb = dx + pick.x * dw
        const bx = Math.max(dx + 4, Math.min(dx + dw - w - 4, cxb - w / 2))
        const by = Math.max(dy + 6, dy + (pick.y - SPRITE_FRAC[pick.action] - 0.05) * dh)
        ctx.fillStyle = pick.down ? P.red : P.gold
        ctx.fillRect(bx, by, w, 18)
        ctx.fillStyle = P.bubble
        ctx.fillRect(bx + 1, by + 1, w - 2, 16)
        ctx.fillStyle = P.ink
        ctx.fillText(pick.bubble!.slice(0, 34), bx + 7, by + 13)
        ctx.fillStyle = pick.down ? P.red : P.gold
        ctx.fillRect(cxb - 3, by + 18, 6, 4)
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
