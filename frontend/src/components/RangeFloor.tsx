// THE RANGE FLOOR — pixel office replacing the Mesa. Every sprite is a real
// worker: the five desk seats (launchd com.range-desk.*) plus the two trading
// daemons. Nothing is simulated — a quiet floor looks quiet.
//
// Canvas renders at a fixed 384x240 logical resolution scaled up with
// image smoothing off, so the pixels stay chunky at any panel size.

import { useEffect, useRef, useState } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import type { MarketClock } from '../types'

const LOGICAL_W = 384
const LOGICAL_H = 240
const MONO = '"Fira Code", monospace'

// warm office palette, sampled from the reference floor
const P = {
  night: '#131020', wallNight: '#241b2e', wallDay: '#4b3a52',
  window: '#0e0c1e', windowDay: '#8fb4d8', moon: '#e8e4d8',
  floor: '#4a3527', plank: '#55402f', plankLine: '#3c2a1e',
  desk: '#7a5636', deskTop: '#8f6a42', deskEdge: '#5c3f28',
  screenOn: '#9fe8c0', screenIdle: '#3a4a58', screenErr: '#e07050',
  plant: '#4f8f4a', plantDark: '#356534', pot: '#8a5a34',
  shelf: '#6a4a2e', book: ['#b05a4a', '#4a7ab0', '#c8a04a', '#5a9a5a', '#8a5aa0'],
  couch: '#7a4a5a', rug: '#61344a', tv: '#0f2a22', tvText: '#7de8a8',
  rack: '#2a2a34', rackLite: '#79ff98', rackErr: '#ff7060',
  cooler: '#a8c8e0', text: '#f2eee4', dim: '#a89a88', gold: '#d9a441',
  skin: '#e8b890', skinAlt: '#a87850', hair: '#3a2a20',
}

type SeatStatus = 'ok' | 'failed' | 'pending'
interface DeskSeat { name: string; role: string; status: SeatStatus; ran_at: string | null }

interface Worker {
  key: string
  label: string
  shirt: string
  desk: [number, number]      // where the sprite sits when working/done
  away: [number, number]      // where it stands when pending/idle
  rack: [number, number]      // where it stands when failed/stale
  state: 'desk' | 'away' | 'rack'
  chip: string
}

const WORKER_STYLE: Record<string, { shirt: string; label: string }> = {
  premarket: { shirt: '#4a7ab0', label: 'PREMARKET' },
  ops: { shirt: '#5a9a5a', label: 'OPS' },
  content: { shirt: '#c05a8a', label: 'CONTENT' },
  projects: { shirt: '#c8a04a', label: 'PROJECTS' },
  chief: { shirt: '#e8e4d8', label: 'CHIEF' },
  live: { shirt: '#e07050', label: 'TRADER·LIVE' },
  paper: { shirt: '#8a8ac0', label: 'TRADER·PAPER' },
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

function drawSprite(ctx: CanvasRenderingContext2D, x: number, y: number,
                    shirt: string, t: number, seated: boolean, altSkin: boolean) {
  const bob = seated ? 0 : Math.round(Math.sin(t / 400 + x) * 1)
  const skin = altSkin ? P.skinAlt : P.skin
  // legs
  if (!seated) { px(ctx, x + 1, y + 10 + bob, 2, 4, '#2a2a34'); px(ctx, x + 5, y + 10 + bob, 2, 4, '#2a2a34') }
  // body
  px(ctx, x, y + 4 + bob, 8, 6, shirt)
  // head
  px(ctx, x + 1, y - 2 + bob, 6, 6, skin)
  px(ctx, x + 1, y - 3 + bob, 6, 2, P.hair)
  // eyes blink every ~4s
  if (Math.floor(t / 200) % 20 !== 0) { px(ctx, x + 2, y + bob, 1, 1, '#1a1a1a'); px(ctx, x + 5, y + bob, 1, 1, '#1a1a1a') }
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, screen: string) {
  px(ctx, x, y, 26, 3, P.deskTop)
  px(ctx, x, y + 3, 26, 8, P.desk)
  px(ctx, x, y + 11, 2, 4, P.deskEdge); px(ctx, x + 24, y + 11, 2, 4, P.deskEdge)
  px(ctx, x + 8, y - 8, 10, 7, '#1a1a22')
  px(ctx, x + 9, y - 7, 8, 5, screen)
  px(ctx, x + 12, y - 1, 2, 1, '#1a1a22')
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  px(ctx, x + 1, y - 6, 4, 4, P.plant); px(ctx, x, y - 4, 6, 3, P.plantDark)
  px(ctx, x + 1, y, 4, 3, P.pot)
}

function drawShelf(ctx: CanvasRenderingContext2D, x: number, y: number, rows: number) {
  px(ctx, x, y, 34, rows * 10 + 2, P.shelf)
  for (let r = 0; r < rows; r++) {
    px(ctx, x + 2, y + 2 + r * 10, 30, 8, '#241a10')
    for (let b = 0; b < 6; b++) {
      px(ctx, x + 3 + b * 5, y + 3 + r * 10, 4, 6, P.book[(r * 7 + b * 3) % P.book.length])
    }
  }
}

function fmtCountdown(mkt: MarketClock | null): string {
  if (!mkt) return '--:--'
  const s = mkt.seconds_to_change
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return `${mkt.is_open ? 'CLOSE' : 'OPEN'} ${h}h ${String(m).padStart(2, '0')}m`
}

export default function RangeFloor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [seats, setSeats] = useState<DeskSeat[]>([])
  const trading = useDashboardStore(s => s.trading)
  const board = useDashboardStore(s => s.board)
  const system = useDashboardStore(s => s.system)

  useEffect(() => {
    let alive = true
    const load = () => fetch('/api/desk').then(r => r.json())
      .then(d => { if (alive) setSeats(d.seats) }).catch(() => {})
    load()
    const t = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  // refs so the rAF loop reads fresh data without re-arming
  const dataRef = useRef({ seats, trading, board, system })
  dataRef.current = { seats, trading, board, system }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0

    const draw = (t: number) => {
      const { seats, trading, board, system } = dataRef.current
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      const scale = Math.min(canvas.width / LOGICAL_W, canvas.height / LOGICAL_H)
      ctx.imageSmoothingEnabled = false
      ctx.setTransform(scale, 0, 0, scale, (canvas.width - LOGICAL_W * scale) / 2, (canvas.height - LOGICAL_H * scale) / 2)

      const mkt = trading?.market ?? null
      const day = mkt?.is_open ?? false

      // ── room shell ──
      px(ctx, 0, 0, LOGICAL_W, LOGICAL_H, P.night)
      px(ctx, 0, 0, LOGICAL_W, 44, day ? P.wallDay : P.wallNight)
      // windows
      for (const wx of [16, 60, 104]) {
        px(ctx, wx, 8, 30, 26, day ? P.windowDay : P.window)
        px(ctx, wx + 14, 8, 2, 26, day ? P.wallDay : P.wallNight)
        if (!day) px(ctx, wx + 20, 12, 5, 5, P.moon)
      }
      // whiteboard with a real number: today's realized P&L
      px(ctx, 150, 8, 52, 28, '#e8e4d8'); px(ctx, 148, 6, 56, 2, P.deskEdge)
      ctx.font = `5px ${MONO}`; ctx.fillStyle = '#3a4a58'
      const realized = trading ? (trading.modes.live.realized_today + trading.modes.paper.realized_today) : 0
      ctx.fillText('TODAY', 155, 16)
      ctx.fillStyle = realized >= 0 ? '#2a7a4a' : '#b04a3a'
      ctx.fillText(`P&L ${realized >= 0 ? '+' : ''}${realized.toFixed(2)}`, 155, 24)
      ctx.fillStyle = '#3a4a58'
      ctx.fillText(trading?.kill_switch ? 'KILL: ON' : 'KILL: off', 155, 32)
      // clock placard: next seat
      px(ctx, 214, 10, 58, 24, '#1a1424')
      ctx.fillStyle = P.gold; ctx.font = `5px ${MONO}`
      ctx.fillText('THE RANGE', 222, 19)
      ctx.fillStyle = P.dim
      const pending = seats.find(s => s.status === 'pending')
      ctx.fillText(pending ? `next: ${pending.name}` : 'desk clear', 222, 28)
      drawShelf(ctx, 284, 6, 3)
      drawShelf(ctx, 326, 6, 3)

      // ── ticker strip (real board candidates + positions) ──
      px(ctx, 0, 44, LOGICAL_W, 10, '#0e0b18')
      ctx.font = `5px ${MONO}`
      const cells: { txt: string; c: string }[] = []
      const arm = board?.arms?.live
      for (const posMode of ['live', 'paper'] as const) {
        for (const p of trading?.modes?.[posMode]?.open_positions ?? []) {
          cells.push({ txt: `${p.symbol} HELD`, c: P.gold })
        }
      }
      for (const c of arm?.candidates ?? []) {
        cells.push({ txt: `${c.symbol} ${c.move_pct >= 0 ? '▲' : '▼'}${Math.abs(c.move_pct).toFixed(1)}%`, c: c.move_pct >= 0 ? '#79ff98' : '#ff7060' })
      }
      if (!cells.length) cells.push({ txt: mkt?.is_open ? 'board empty' : 'market closed', c: P.dim })
      const speed = 15 // px/s
      let off = -((t / 1000) * speed) % 600
      for (let loop = 0; loop < 2; loop++) {
        let cx = off + loop * Math.max(600, cells.length * 60)
        for (const cell of cells) {
          ctx.fillStyle = cell.c
          ctx.fillText(cell.txt, cx, 51)
          cx += ctx.measureText(cell.txt).width + 14
        }
      }

      // ── floor planks ──
      for (let y = 54; y < LOGICAL_H; y += 10) {
        px(ctx, 0, y, LOGICAL_W, 10, (y / 10) % 2 ? P.floor : P.plank)
        px(ctx, 0, y, LOGICAL_W, 1, P.plankLine)
      }

      // ── furniture ──
      // lounge: rug, couch, TV with real market countdown
      px(ctx, 150, 160, 90, 50, P.rug)
      px(ctx, 162, 186, 66, 14, P.couch); px(ctx, 162, 180, 66, 8, '#8a5a6a')
      px(ctx, 168, 162, 54, 16, P.tv)
      ctx.fillStyle = P.tvText; ctx.font = `6px ${MONO}`
      ctx.fillText(fmtCountdown(mkt), 172, 172)
      // server rack, blinking; red when anything is stale/failed
      const anyBad = seats.some(s => s.status === 'failed')
        || trading?.modes.live.status === 'stale' || trading?.modes.paper.status === 'stale'
      px(ctx, 344, 120, 24, 84, P.rack)
      for (let r = 0; r < 6; r++) {
        px(ctx, 348, 126 + r * 13, 16, 8, '#1a1a22')
        const on = Math.floor(t / 500 + r) % 3 !== 0
        px(ctx, 350, 128 + r * 13, 3, 3, on ? (anyBad ? P.rackErr : P.rackLite) : '#333')
      }
      // water cooler + kitchen counter
      px(ctx, 130, 214, 8, 6, '#d8d8e0'); px(ctx, 131, 206, 6, 8, P.cooler)
      px(ctx, 10, 214, 60, 14, '#5c4430'); px(ctx, 10, 210, 60, 4, '#6f543c')
      // plants
      drawPlant(ctx, 6, 70); drawPlant(ctx, 250, 70); drawPlant(ctx, 310, 214); drawPlant(ctx, 226, 120)

      // ── desks + workers ──
      const deskSpots: [number, number][] = [[24, 84], [70, 84], [24, 124], [70, 124], [24, 164], [70, 164]]
      const workers: Worker[] = []
      const seatOrder = ['premarket', 'ops', 'content', 'projects']
      seatOrder.forEach((name, i) => {
        const seat = seats.find(s => s.name === name)
        const st: SeatStatus = seat?.status ?? 'pending'
        workers.push({
          key: name, label: WORKER_STYLE[name].label, shirt: WORKER_STYLE[name].shirt,
          desk: deskSpots[i], away: [104 + i * 40, 196], rack: [330, 150 + i * 16],
          state: st === 'ok' ? 'desk' : st === 'failed' ? 'rack' : 'away',
          chip: st === 'ok' ? 'in today' : st === 'failed' ? 'SEAT DOWN' : 'scheduled',
        })
      })
      // trading daemons at the remaining two desks
      ;(['live', 'paper'] as const).forEach((mode, i) => {
        const m = trading?.modes?.[mode]
        const okHb = m?.status === 'alive'
        workers.push({
          key: mode, label: WORKER_STYLE[mode].label, shirt: WORKER_STYLE[mode].shirt,
          desk: deskSpots[4 + i], away: deskSpots[4 + i], rack: [330, 182 + i * 16],
          state: okHb ? 'desk' : m?.status === 'stale' ? 'rack' : 'desk',
          chip: okHb ? (m?.open_positions?.length ? `${m.open_positions.length} open` : 'flat')
            : m?.status === 'stale' ? 'heartbeat stale' : 'off hours',
        })
      })
      // chief center-floor
      const chiefSeat = seats.find(s => s.name === 'chief')
      workers.push({
        key: 'chief', label: 'CHIEF OF STAFF', shirt: WORKER_STYLE.chief.shirt,
        desk: [196, 110], away: [196, 110], rack: [330, 134],
        state: chiefSeat?.status === 'failed' ? 'rack' : 'desk',
        chip: chiefSeat?.status === 'ok' ? 'brief sent' : chiefSeat?.status === 'failed' ? 'SEAT DOWN' : 'on the floor',
      })

      // desks first (so sprites sit "behind" them visually above)
      deskSpots.forEach(([dx, dy], i) => {
        const w = workers[i]
        const screen = w ? (w.state === 'desk' ? P.screenOn : w.state === 'rack' ? P.screenErr : P.screenIdle) : P.screenIdle
        drawDesk(ctx, dx - 6, dy + 8, screen)
      })

      ctx.textAlign = 'center'
      workers.forEach((w, i) => {
        const [x, y] = w.state === 'desk' ? w.desk : w.state === 'away' ? w.away : w.rack
        drawSprite(ctx, x, y, w.shirt, t + i * 700, w.state === 'desk' && w.key !== 'chief', i % 3 === 1)
        if (w.key === 'chief') {
          // headphones halo like the reference
          px(ctx, x - 1, y - 4, 10, 1, P.gold)
          px(ctx, x - 2, y - 3, 1, 4, P.gold); px(ctx, x + 9, y - 3, 1, 4, P.gold)
        }
        ctx.font = `4px ${MONO}`
        ctx.fillStyle = w.state === 'rack' ? P.rackErr : P.text
        ctx.fillText(w.label, x + 4, y + 20)
        ctx.fillStyle = w.state === 'rack' ? P.rackErr : P.dim
        ctx.fillText(w.chip, x + 4, y + 25)
      })
      ctx.textAlign = 'left'

      // ── footer stat line (all real) ──
      px(ctx, 0, LOGICAL_H - 9, LOGICAL_W, 9, '#0e0b18')
      ctx.font = `5px ${MONO}`; ctx.fillStyle = P.dim
      // disk_used_gb measures the wrong APFS volume upstream; pct is trustworthy
      const disk = system ? `disk ${system.disk_pct.toFixed(0)}% used` : 'disk —'
      const inToday = seats.filter(s => s.status === 'ok').length
      ctx.fillText(`seats in ${inToday}/${seats.length || 5}   ${disk}   cpu ${system ? system.cpu_pct.toFixed(0) : '—'}%`, 6, LOGICAL_H - 3)

      raf = requestAnimationFrame(draw)
    }
    const onVis = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    document.addEventListener('visibilitychange', onVis)
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 0, background: P.night, borderRadius: 8, overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}
