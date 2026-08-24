// THE RANGE FLOOR — side-view pixel office (Office-style cutaway). Every
// worker is real: the five desk seats from /api/desk plus both trading
// daemons from the store. Nothing is simulated — a quiet floor looks quiet.
//
// 480x270 logical canvas scaled with smoothing off for chunky pixels.

import { useEffect, useRef, useState } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import type { BoardState, MarketClock, TradingStatus } from '../types'

const LW = 480
const LH = 270
const MONO = '"Fira Code", monospace'

const P = {
  bg: '#17110c', wall: '#3a2a1c', wallPanel: '#463322', wainscot: '#2b1e12',
  frame: '#1c1410', city: '#0d0a1a', cityLite: '#d9a441', citySky: '#8fb4d8',
  floor: '#241a10',
  desk: '#6a4a2c', deskTop: '#8a6338', deskShadow: '#503620',
  screenBg: '#0e1410', mint: '#7de8a8', red: '#ff7060', amber: '#f0c040',
  board: '#efe9d8', boardTxt: '#3a3a44', gold: '#d9a441', goldDim: '#8a6a2a',
  text: '#f2eee4', dim: '#a89a88', ink: '#141414',
  bubble: '#f6f2e4', plant: '#4f8f4a', plantD: '#356534', pot: '#7a5230',
  shelf: '#553b22', archive: '#c8a04a',
  skins: ['#e8b890', '#c89068', '#a87850', '#8a6040'],
  hairs: ['#2a1c14', '#584030', '#c8a04a', '#101018', '#7a3a2a'],
}

type SeatStatus = 'ok' | 'failed' | 'pending'
interface DeskSeat {
  name: string; role: string; status: SeatStatus
  ran_at: string | null; brief?: string | null
}

interface Station {
  key: string
  label: string
  shirt: string
  pants: string
  skin: string
  hair: string
  x: number            // desk left edge
  row: number          // 0 = back row, 1 = front row
  present: boolean
  down: boolean
  chip: string
  bubble: string | null
  screen: 'bars' | 'candles' | 'wave' | 'film' | 'list'
}

const STYLE: Record<string, { shirt: string; pants: string; screen: Station['screen'] }> = {
  premarket: { shirt: '#4a7ab0', pants: '#26364a', screen: 'list' },
  ops: { shirt: '#5a9a5a', pants: '#2c4a2c', screen: 'bars' },
  content: { shirt: '#c05a8a', pants: '#4a2438', screen: 'film' },
  projects: { shirt: '#c8a04a', pants: '#4a3a1c', screen: 'list' },
  live: { shirt: '#e07050', pants: '#4a2a20', screen: 'candles' },
  paper: { shirt: '#8a8ac0', pants: '#32324a', screen: 'candles' },
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

function seeded(n: number): number { // deterministic 0..1, stable across frames
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

// ── set dressing ─────────────────────────────────────────────────────────────

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, day: boolean, seed: number) {
  px(ctx, x - 2, y - 2, 40, 30, P.frame)
  px(ctx, x, y, 36, 26, day ? P.citySky : P.city)
  for (let bx = 0; bx < 5; bx++) {
    const bh = 6 + Math.floor(seeded(seed + bx) * 12)
    px(ctx, x + 2 + bx * 7, y + 26 - bh, 5, bh, day ? '#5a7a9a' : '#1a1430')
    if (!day) for (let w = 0; w < 3; w++) {
      if (seeded(seed * 3 + bx * 7 + w) > 0.45) {
        px(ctx, x + 3 + bx * 7 + (w % 2) * 2, y + 26 - bh + 2 + w * 3, 1, 1, P.cityLite)
      }
    }
  }
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  px(ctx, x + 2, y - 14, 6, 8, P.plant); px(ctx, x, y - 9, 10, 5, P.plantD)
  px(ctx, x + 1, y - 4, 8, 6, P.pot); px(ctx, x + 2, y + 2, 6, 1, '#161008')
}

function drawShelfArchive(ctx: CanvasRenderingContext2D, x: number, y: number) {
  px(ctx, x, y, 66, 22, P.shelf)
  for (let r = 0; r < 2; r++) for (let b = 0; b < 9; b++) {
    px(ctx, x + 3 + b * 7, y + 2 + r * 10, 5, 8,
      ['#b05a4a', '#4a7ab0', '#c8a04a', '#5a9a5a', '#8a5aa0'][(r * 5 + b * 3) % 5])
  }
  px(ctx, x + 18, y + 23, 30, 7, '#20160c')
  ctx.font = `5px ${MONO}`; ctx.fillStyle = P.archive
  ctx.fillText('ARCHIVE', x + 21, y + 28.5)
}

// ── the cast ────────────────────────────────────────────────────────────────

function drawWorker(ctx: CanvasRenderingContext2D, s: Station, t: number, i: number) {
  const deskY = s.row === 0 ? 152 : 210
  const x = s.x + 10
  const y = deskY - 30
  const bob = s.present ? 0 : Math.round(Math.sin(t / 380 + i * 2) * 1)
  if (!s.present) {
    px(ctx, x + 3, y + 24 + bob, 4, 8, s.pants); px(ctx, x + 10, y + 24 + bob, 4, 8, s.pants)
  }
  px(ctx, x + 1, y + 12 + bob, 15, 13, s.shirt)
  px(ctx, x - 1, y + 13 + bob, 3, 8, s.shirt); px(ctx, x + 15, y + 13 + bob, 3, 8, s.shirt)
  px(ctx, x, y + 14 + bob, 1, 6, s.skin); px(ctx, x + 17, y + 14 + bob, 1, 6, s.skin)
  px(ctx, x + 3, y - 2 + bob, 12, 13, s.skin)
  px(ctx, x + 2, y - 4 + bob, 14, 5, s.hair)
  px(ctx, x + 2, y - 1 + bob, 2, 4, s.hair); px(ctx, x + 14, y - 1 + bob, 2, 4, s.hair)
  const blink = Math.floor((t + i * 900) / 180) % 24 === 0
  if (!blink) { px(ctx, x + 5, y + 3 + bob, 2, 2, P.ink); px(ctx, x + 11, y + 3 + bob, 2, 2, P.ink) }
  if (s.down) { px(ctx, x + 4, y + 1 + bob, 4, 1, P.ink); px(ctx, x + 10, y + 1 + bob, 4, 1, P.ink) }
  px(ctx, x + 7, y + 8 + bob, 4, 1, s.down ? P.red : P.ink)
}

function drawScreen(ctx: CanvasRenderingContext2D, kind: Station['screen'], x: number, y: number,
                    t: number, alive: boolean, seed: number) {
  px(ctx, x, y, 30, 18, '#101418'); px(ctx, x + 1, y + 1, 28, 16, P.screenBg)
  if (!alive) { px(ctx, x + 13, y + 8, 4, 2, '#31414a'); return }
  const c = P.mint
  if (kind === 'candles') {
    for (let b = 0; b < 7; b++) {
      const h = 3 + Math.floor(seeded(seed + b + Math.floor(t / 2400)) * 9)
      const up = seeded(seed * 2 + b + Math.floor(t / 2400)) > 0.45
      px(ctx, x + 3 + b * 4, y + 15 - h, 2, h, up ? P.mint : P.red)
    }
  } else if (kind === 'bars') {
    for (let b = 0; b < 6; b++) {
      const h = 3 + Math.floor(seeded(seed + b) * 10 + Math.sin(t / 900 + b) * 2)
      px(ctx, x + 3 + b * 4.5, y + 15 - h, 3, h, c)
    }
  } else if (kind === 'wave') {
    for (let wx = 0; wx < 26; wx++) {
      const wy = 9 + Math.round(Math.sin((wx + t / 160) / 2.4) * 4)
      px(ctx, x + 2 + wx, y + wy, 1, 2, c)
    }
  } else if (kind === 'film') {
    for (let f = 0; f < 3; f++) px(ctx, x + 3 + f * 9, y + 4, 7, 10, ['#c05a8a', '#d9a441', '#4a7ab0'][f])
    px(ctx, x + 2, y + 2, 26, 1, '#333'); px(ctx, x + 2, y + 15, 26, 1, '#333')
  } else {
    for (let l = 0; l < 4; l++) px(ctx, x + 3, y + 3 + l * 4, 12 + seeded(seed + l) * 12, 2, l ? '#41616a' : c)
  }
}

function drawDeskRow(ctx: CanvasRenderingContext2D, s: Station, t: number, seed: number) {
  const deskY = s.row === 0 ? 152 : 210
  px(ctx, s.x - 2, deskY, 42, 4, P.deskTop)
  px(ctx, s.x - 2, deskY + 4, 42, 14, P.desk)
  px(ctx, s.x - 2, deskY + 18, 42, 2, P.deskShadow)
  drawScreen(ctx, s.screen, s.x + 4, deskY - 19, t, s.present && !s.down, seed)
  ctx.textAlign = 'center'
  ctx.font = `6px ${MONO}`
  ctx.fillStyle = s.down ? P.red : P.text
  ctx.fillText(s.label, s.x + 19, deskY + 11)
  ctx.font = `5px ${MONO}`
  ctx.fillStyle = s.down ? P.red : P.dim
  ctx.fillText(s.chip, s.x + 19, deskY + 17)
  ctx.textAlign = 'left'
}

function drawBubble(ctx: CanvasRenderingContext2D, cx: number, y: number, text: string, accent: string) {
  ctx.font = `6px ${MONO}`
  const w = Math.min(ctx.measureText(text).width + 10, 170)
  const x = Math.max(4, Math.min(LW - w - 4, cx - w / 2))
  px(ctx, x - 1, y - 1, w + 2, 13, accent)
  px(ctx, x, y, w, 11, P.bubble)
  px(ctx, cx - 2, y + 11, 4, 3, accent)
  ctx.fillStyle = P.ink
  ctx.fillText(text, x + 5, y + 8)
}

function drawChief(ctx: CanvasRenderingContext2D, t: number, ok: boolean, chip: string) {
  const cx = 240, cy = 74
  ctx.fillStyle = '#f4f0e2'
  ctx.beginPath(); ctx.arc(cx, cy, 17, 0, Math.PI * 2); ctx.fill()
  px(ctx, cx - 19, cy - 4, 4, 10, P.gold); px(ctx, cx + 15, cy - 4, 4, 10, P.gold)
  px(ctx, cx - 17, cy - 14, 34, 4, P.gold)
  const blink = Math.floor(t / 210) % 22 === 0
  if (!blink) { px(ctx, cx - 7, cy - 3, 3, 5, P.ink); px(ctx, cx + 4, cy - 3, 3, 5, P.ink) }
  px(ctx, cx + 9, cy + 8, 5, 5, ok ? P.mint : P.amber)
  ctx.textAlign = 'center'
  ctx.font = `7px ${MONO}`; ctx.fillStyle = P.gold
  ctx.fillText('CHIEF OF STAFF', cx, cy + 32)
  ctx.font = `5px ${MONO}`; ctx.fillStyle = P.dim
  ctx.fillText(chip, cx, cy + 40)
  ctx.textAlign = 'left'
}

function fmtClock(mkt: MarketClock | null): string {
  if (!mkt?.et) return '--:--'
  const m = mkt.et.match(/\d{1,2}:\d{2}/)
  return m ? m[0] : '--:--'
}

function shiftLabel(mkt: MarketClock | null): { txt: string; c: string } {
  if (!mkt) return { txt: 'OFFLINE', c: P.dim }
  if (mkt.is_open) return { txt: 'MARKET OPEN', c: P.mint }
  const h = mkt.seconds_to_change / 3600
  return h < 3 ? { txt: 'DAWN RUN', c: P.amber } : { txt: 'NIGHT', c: '#8a8ac0' }
}

function tickerCells(trading: TradingStatus | null, board: BoardState | null): { txt: string; c: string }[] {
  const cells: { txt: string; c: string }[] = []
  for (const mode of ['live', 'paper'] as const) {
    for (const p of trading?.modes?.[mode]?.open_positions ?? []) cells.push({ txt: `${p.symbol} HELD`, c: P.gold })
  }
  for (const c of board?.arms?.live?.candidates ?? []) {
    cells.push({
      txt: `${c.symbol} ${c.move_pct >= 0 ? '▲' : '▼'}${Math.abs(c.move_pct).toFixed(1)}%`,
      c: c.move_pct >= 0 ? P.mint : P.red,
    })
  }
  for (const a of (trading?.alerts ?? []).slice(0, 3)) cells.push({ txt: a.slice(0, 60), c: P.dim })
  if (!cells.length) cells.push({ txt: trading?.market?.is_open ? 'quiet tape' : 'market closed — night crew on', c: P.dim })
  return cells
}

// ── component ───────────────────────────────────────────────────────────────

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
      const scale = Math.min(canvas.width / LW, canvas.height / LH)
      ctx.imageSmoothingEnabled = false
      ctx.setTransform(scale, 0, 0, scale,
        (canvas.width - LW * scale) / 2, (canvas.height - LH * scale) / 2)

      const mkt = trading?.market ?? null
      const day = mkt?.is_open ?? false
      const shift = shiftLabel(mkt)

      // ── room ──
      px(ctx, 0, 0, LW, LH, P.bg)
      px(ctx, 0, 0, LW, 118, P.wall)
      for (let panel = 0; panel < 12; panel++) px(ctx, panel * 40, 0, 1, 118, P.wallPanel)
      px(ctx, 0, 112, LW, 6, P.wainscot)
      px(ctx, 0, 118, LW, LH - 118, P.floor)
      for (let y = 126; y < LH; y += 12) px(ctx, 0, y, LW, 1, '#2c2014')

      // in-scene header strip
      px(ctx, 0, 0, LW, 13, '#100c08')
      ctx.font = `7px ${MONO}`
      ctx.fillStyle = P.gold; ctx.fillText('THE RANGE', 6, 9.5)
      ctx.fillStyle = P.dim; ctx.fillText('FLOOR', 66, 9.5)
      px(ctx, 100, 2.5, ctx.measureText(shift.txt).width + 8, 9, '#1c1410')
      ctx.fillStyle = shift.c; ctx.fillText(shift.txt, 104, 9.5)
      const inToday = seats.filter(s => s.status === 'ok').length
      const openPos = (trading?.modes.live.open_positions.length ?? 0)
        + (trading?.modes.paper.open_positions.length ?? 0)
      const realized = trading
        ? trading.modes.live.realized_today + trading.modes.paper.realized_today : 0
      const stats: [string, string][] = [
        ['SEATS', `${inToday}/${seats.length || 5}`],
        ['OPEN', `${openPos}`],
        ['P&L', `${realized >= 0 ? '+' : ''}${realized.toFixed(2)}`],
        ['CPU', system ? `${system.cpu_pct.toFixed(0)}%` : '—'],
      ]
      let sx = LW - 196
      for (const [k, v] of stats) {
        ctx.fillStyle = P.dim; ctx.fillText(k, sx, 9.5)
        ctx.fillStyle = k === 'P&L' ? (realized >= 0 ? P.mint : P.red) : P.text
        const kw = ctx.measureText(k).width
        ctx.fillText(v, sx + kw + 3, 9.5)
        sx += kw + ctx.measureText(v).width + 12
      }
      ctx.font = `8px ${MONO}`; ctx.fillStyle = P.text
      ctx.fillText(fmtClock(mkt), LW - 32, 9.5)

      // thesis whiteboard: last decision gist + kill switch (all real)
      px(ctx, 8, 22, 96, 52, P.board)
      px(ctx, 6, 20, 100, 2, P.frame); px(ctx, 6, 74, 100, 2, P.frame)
      ctx.font = `6px ${MONO}`; ctx.fillStyle = P.boardTxt
      ctx.fillText('THESIS', 13, 31)
      const rawThesis = trading?.last_decision?.thesis ?? ''
      const gist = (rawThesis.length > 14 ? rawThesis
        : board?.arms?.live?.gist ?? (rawThesis || 'no ruling yet')).slice(0, 60)
      ctx.font = `5px ${MONO}`
      let line = ''; let ln = 0
      for (const w of gist.split(' ')) {
        if (ctx.measureText(line + ' ' + w).width > 86 && line) {
          ctx.fillText(line, 13, 39 + ln * 7); line = w; ln++
          if (ln > 2) break
        } else line = (line ? line + ' ' : '') + w
      }
      if (ln <= 2 && line) ctx.fillText(line, 13, 39 + ln * 7)
      ctx.fillStyle = trading?.kill_switch ? '#b04a3a' : P.goldDim
      ctx.fillText(trading?.kill_switch ? '• KILL SWITCH ON' : '• flat by the close', 13, 68)

      drawWindow(ctx, 130, 26, day, 7)
      drawWindow(ctx, 296, 26, day, 13)
      drawWindow(ctx, 344, 26, day, 29)
      drawShelfArchive(ctx, 400, 30)
      drawPlant(ctx, 116, 112); drawPlant(ctx, 466, 112)

      const chiefSeat = seats.find(s => s.name === 'chief')
      drawChief(ctx, t, chiefSeat?.status === 'ok',
        chiefSeat?.status === 'ok' ? 'brief sent · runs the floor'
          : chiefSeat?.status === 'failed' ? 'SEAT DOWN' : 'runs the floor')

      // ── ticker ──
      px(ctx, 0, 118, LW, 11, '#0e0a14')
      ctx.font = `6px ${MONO}`
      const cells = tickerCells(trading, board)
      let total = 0
      for (const c of cells) total += ctx.measureText(c.txt).width + 16
      total = Math.max(total, LW)
      const off = -((t / 1000) * 18) % total
      for (let loop = 0; loop < 2; loop++) {
        let cx2 = off + loop * total
        for (const cell of cells) {
          ctx.fillStyle = P.goldDim; ctx.fillText('◆', cx2 - 10, 126)
          ctx.fillStyle = cell.c; ctx.fillText(cell.txt, cx2, 126)
          cx2 += ctx.measureText(cell.txt).width + 16
        }
      }

      // ── stations ──
      const stations: Station[] = []
      const seatNames = ['premarket', 'ops', 'content', 'projects'] as const
      seatNames.forEach((name, i) => {
        const seat = seats.find(s => s.name === name)
        const st: SeatStatus = seat?.status ?? 'pending'
        const brief = (seat?.brief ?? '').split('\n').find(l => l.trim()) ?? ''
        stations.push({
          key: name, label: name.toUpperCase(),
          shirt: STYLE[name].shirt, pants: STYLE[name].pants,
          skin: P.skins[i % P.skins.length], hair: P.hairs[i % P.hairs.length],
          x: 22 + i * 56, row: 0,
          present: st === 'ok', down: st === 'failed',
          chip: st === 'ok' ? 'in today' : st === 'failed' ? 'SEAT DOWN' : 'scheduled',
          bubble: st === 'failed' ? 'SEAT DOWN' : brief ? brief.slice(0, 34) : null,
          screen: STYLE[name].screen,
        })
      })
      ;(['live', 'paper'] as const).forEach((mode, i) => {
        const m = trading?.modes?.[mode]
        const aliveHb = m?.status === 'alive'
        const last = trading?.last_decision
        stations.push({
          key: mode, label: mode === 'live' ? 'TRADER·LIVE' : 'TRADER·PAPER',
          shirt: STYLE[mode].shirt, pants: STYLE[mode].pants,
          skin: P.skins[(i + 2) % P.skins.length], hair: P.hairs[(i + 3) % P.hairs.length],
          x: 300 + i * 70, row: 1,
          present: aliveHb, down: m?.status === 'stale',
          chip: aliveHb
            ? (m?.open_positions.length ? `${m.open_positions.length} open` : 'flat')
            : m?.status === 'stale' ? 'heartbeat stale' : 'off shift',
          bubble: mode === 'live' && last?.action
            ? `${last.action.toUpperCase()}${last.symbol ? ' ' + last.symbol : ''}` : null,
          screen: 'candles',
        })
      })

      for (let i = 0; i < stations.length; i++) {
        const s = stations[i]
        if (s.present || s.down) drawWorker(ctx, s, t, i)
        drawDeskRow(ctx, s, t, i * 17 + 3)
      }

      // one speech bubble at a time, rotating through stations that have one
      const withBubbles = stations.filter(s => s.bubble)
      if (withBubbles.length) {
        const pick = withBubbles[Math.floor(t / 5000) % withBubbles.length]
        const deskY = pick.row === 0 ? 152 : 210
        const by = pick.row === 0 ? deskY - 62 : deskY - 58
        drawBubble(ctx, pick.x + 19, Math.max(by, 132), pick.bubble!, pick.down ? P.red : P.gold)
      }

      // lounge + water cooler
      px(ctx, 20, 236, 66, 16, '#6a3a4a'); px(ctx, 20, 228, 66, 10, '#7a4a5a')
      px(ctx, 16, 236, 6, 16, '#5a3040'); px(ctx, 84, 236, 6, 16, '#5a3040')
      px(ctx, 442, 232, 10, 8, '#d8d8e0'); px(ctx, 443, 222, 8, 10, '#a8c8e0')
      px(ctx, 444, 240, 6, 12, '#8a8a94')

      // footer: next shift + health, day progress bar (real clock)
      px(ctx, 0, LH - 12, LW, 12, '#0e0a14')
      ctx.font = `5px ${MONO}`; ctx.fillStyle = P.dim
      const pendingSeat = seats.find(s => s.status === 'pending')
      const failedN = seats.filter(s => s.status === 'failed').length
      ctx.fillText(
        `${pendingSeat ? `next shift: ${pendingSeat.name}` : 'all seats reported'}`
        + `   failed ${failedN}   disk ${system ? system.disk_pct.toFixed(0) + '%' : '—'}`,
        6, LH - 4)
      const dayFrac = (Date.now() / 86400000) % 1
      px(ctx, LW - 110, LH - 8, 100, 3, '#241a10')
      px(ctx, LW - 110, LH - 8, 100 * dayFrac, 3, P.goldDim)

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
    <div style={{ width: '100%', height: '100%', minHeight: 0, background: P.bg, borderRadius: 8, overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}
