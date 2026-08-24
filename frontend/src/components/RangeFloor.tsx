// THE TERRARIUM FLOOR — side-view pixel glasshouse (Office-style cutaway). Every
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
  bg: '#0b1310', wainscot: '#16241c',
  frame: '#182620', mullion: '#24382e', sheen: 'rgba(220,255,235,0.05)',
  skyNight: '#08130e', skyDawn: '#142516', skyDay: '#22331f', skyDusk: '#171f12',
  floor: '#121b15',
  desk: '#5d452c', deskTop: '#7a5a36', deskShadow: '#44311e',
  screenBg: '#0e1410', mint: '#7de8a8', red: '#f0716a', amber: '#e0b34d',
  board: '#efe9d8', boardTxt: '#3a3a44', gold: '#d9a441', goldDim: '#8a6a2a',
  emerald: '#3ecf9a',
  text: '#eaf0e8', dim: '#93a396', ink: '#141414',
  bubble: '#f2f6ea', plant: '#4f8f4a', plantD: '#356534', plantL: '#6fae5c',
  pot: '#7a5230', vine: '#2e5238',
  shelf: '#3e4f38', archive: '#c8a04a',
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

// Glass back wall: the market sky shows through the panes, mullions frame it,
// leaf silhouettes press against the glass from outside, fireflies at night.
function drawGlassWall(ctx: CanvasRenderingContext2D, sky: string, night: boolean, t: number) {
  px(ctx, 0, 13, LW, 105, sky)
  // outside foliage silhouettes along the bottom of the glass
  for (let i = 0; i < 24; i++) {
    const lx = i * 21 + (seeded(i * 3.7) * 8 - 4)
    const lh = 8 + Math.floor(seeded(i * 9.1) * 18)
    px(ctx, lx, 118 - lh, 12, lh, night ? '#0c1b12' : '#1a3320')
    px(ctx, lx + 3, 118 - lh - 5, 6, 6, night ? '#0c1b12' : '#1a3320')
  }
  // mullion grid
  for (let mx = 0; mx <= 12; mx++) px(ctx, mx * 40, 13, 2, 105, P.mullion)
  px(ctx, 0, 48, LW, 2, P.mullion)
  px(ctx, 0, 84, LW, 2, P.mullion)
  px(ctx, 0, 116, LW, 2, P.mullion)
  // one diagonal sheen band per pane row
  ctx.fillStyle = P.sheen
  for (let mx = 0; mx < 12; mx += 3) ctx.fillRect(mx * 40 + 6, 16, 8, 100)
  // fireflies drift outside the glass at night
  if (night) {
    for (let f = 0; f < 9; f++) {
      const fx = (seeded(f * 17.3) * LW + t / (900 + f * 90)) % LW
      const fy = 24 + seeded(f * 31.7) * 80 + Math.sin(t / 700 + f * 2) * 4
      const on = Math.sin(t / 380 + f * 5) > 0.15
      if (on) px(ctx, fx, fy, 1.6, 1.6, '#d8f0a0')
    }
  }
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  px(ctx, x + 2, y - 14, 6, 8, P.plant); px(ctx, x, y - 9, 10, 5, P.plantD)
  px(ctx, x + 1, y - 4, 8, 6, P.pot); px(ctx, x + 2, y + 2, 6, 1, '#161008')
}

function drawTallPlant(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  px(ctx, x + 4, y - 26, 4, 20, P.plantD)
  px(ctx, x, y - 30, 6, 9, P.plant); px(ctx, x + 7, y - 33, 6, 10, P.plantL)
  px(ctx, x + 3, y - 37, 6, 8, P.plant); px(ctx, x - 2 + (s % 3), y - 22, 5, 7, P.plantD)
  px(ctx, x + 1, y - 7, 10, 8, P.pot); px(ctx, x + 2, y + 1, 8, 1, '#161008')
}

function drawHangingPlant(ctx: CanvasRenderingContext2D, x: number, t: number, i: number) {
  const sway = Math.round(Math.sin(t / 1400 + i * 2.1) * 1)
  px(ctx, x + 5, 13, 1, 9, '#4a5a4c')
  px(ctx, x + sway, 22, 11, 6, P.pot)
  px(ctx, x - 2 + sway, 27, 4, 9, P.plant); px(ctx, x + 3 + sway, 27, 4, 13, P.plantL)
  px(ctx, x + 9 + sway, 27, 4, 10, P.plantD)
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

function drawFigure(ctx: CanvasRenderingContext2D, x: number, y: number, s: Station,
                    t: number, i: number, pose: 'seated' | 'stand' | 'walk') {
  // (x, y) anchors the feet; head is ~34px above
  const top = y - 34
  const bob = pose === 'seated' ? 0 : Math.round(Math.sin(t / 300 + i * 2) * 1)
  if (pose === 'walk') {
    const step = Math.floor(t / 140) % 2
    px(ctx, x + 3 + (step ? 1 : -1), y - 8, 4, 8, s.pants)
    px(ctx, x + 10 - (step ? 1 : -1), y - 8, 4, 8, s.pants)
  } else if (pose === 'stand') {
    px(ctx, x + 3, y - 8 + bob, 4, 8, s.pants); px(ctx, x + 10, y - 8 + bob, 4, 8, s.pants)
  }
  const by = pose === 'seated' ? top + 12 : y - 21 + bob
  px(ctx, x + 1, by, 15, 13, s.shirt)
  px(ctx, x - 1, by + 1, 3, 8, s.shirt); px(ctx, x + 15, by + 1, 3, 8, s.shirt)
  px(ctx, x, by + 2, 1, 6, s.skin); px(ctx, x + 17, by + 2, 1, 6, s.skin)
  const hy = by - 14
  px(ctx, x + 3, hy, 12, 13, s.skin)
  px(ctx, x + 2, hy - 2, 14, 5, s.hair)
  px(ctx, x + 2, hy + 1, 2, 4, s.hair); px(ctx, x + 14, hy + 1, 2, 4, s.hair)
  const blink = Math.floor((t + i * 900) / 180) % 24 === 0
  if (!blink) { px(ctx, x + 5, hy + 5, 2, 2, P.ink); px(ctx, x + 11, hy + 5, 2, 2, P.ink) }
  if (s.down) { px(ctx, x + 4, hy + 3, 4, 1, P.ink); px(ctx, x + 10, hy + 3, 4, 1, P.ink) }
  px(ctx, x + 7, hy + 10, 4, 1, s.down ? P.red : P.ink)
}

// Where a worker is right now. Deterministic stroll: each 18s block, a present
// worker either stays seated or walks to a hangout and back. Continuous at
// block edges because every trip starts and ends at the desk.
const HANGOUTS: [number, number][] = [[46, 250], [230, 248], [434, 246]]
function ease(u: number): number { return u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u) }
function workerPose(s: Station, i: number, t: number): { x: number; y: number; pose: 'seated' | 'stand' | 'walk' } {
  const deskY = s.row === 0 ? 152 : 210
  const home = { x: s.x + 10, y: deskY + 4, pose: 'seated' as const }
  if (s.down) return { x: s.x + 10, y: deskY + 4, pose: 'seated' }
  if (!s.present) return home
  const BLOCK = 18000
  const block = Math.floor(t / BLOCK)
  const r = seeded(i * 131 + block * 17)
  if (r < 0.7) return home                       // most blocks: heads-down work
  const dest = HANGOUTS[Math.floor(seeded(i * 77 + block * 13) * HANGOUTS.length)]
  const u = (t % BLOCK) / BLOCK
  const feet: [number, number] = [s.x + 10, deskY + 26]  // step out beside the desk
  let fx: number, fy: number, pose: 'stand' | 'walk'
  if (u < 0.3) { const k = ease(u / 0.3); fx = feet[0] + (dest[0] - feet[0]) * k; fy = feet[1] + (dest[1] - feet[1]) * k; pose = 'walk' }
  else if (u < 0.7) { fx = dest[0]; fy = dest[1]; pose = 'stand' }
  else { const k = ease((u - 0.7) / 0.3); fx = dest[0] + (feet[0] - dest[0]) * k; fy = dest[1] + (feet[1] - dest[1]) * k; pose = 'walk' }
  if (u > 0.97) return home
  return { x: fx, y: fy, pose }
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
  return h < 3 ? { txt: 'DAWN RUN', c: P.amber } : { txt: 'NIGHT', c: '#7ac0a0' }
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
      const shift = shiftLabel(mkt)

      // ── room ──
      px(ctx, 0, 0, LW, LH, P.bg)
      const skyColor = mkt?.is_open ? P.skyDay
        : shift.txt === 'DAWN RUN' ? P.skyDawn
        : shift.txt === 'NIGHT' ? P.skyNight : P.skyDusk
      drawGlassWall(ctx, skyColor, shift.txt === 'NIGHT', t)
      px(ctx, 0, 112, LW, 6, P.wainscot)
      px(ctx, 0, 118, LW, LH - 118, P.floor)
      for (let y = 126; y < LH; y += 12) px(ctx, 0, y, LW, 1, '#182419')

      // in-scene header strip
      px(ctx, 0, 0, LW, 13, '#081009')
      ctx.font = `7px ${MONO}`
      ctx.fillStyle = P.emerald; ctx.fillText('TERRARIUM', 6, 9.5)
      ctx.fillStyle = P.dim; ctx.fillText('FLOOR', 66, 9.5)
      px(ctx, 100, 2.5, ctx.measureText(shift.txt).width + 8, 9, '#12211a')
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

      drawHangingPlant(ctx, 130, t, 0)
      drawHangingPlant(ctx, 296, t, 1)
      drawHangingPlant(ctx, 352, t, 2)
      drawShelfArchive(ctx, 400, 30)
      drawTallPlant(ctx, 112, 118, 1); drawTallPlant(ctx, 462, 118, 2)
      drawPlant(ctx, 216, 112); drawPlant(ctx, 380, 112)

      const chiefSeat = seats.find(s => s.name === 'chief')
      drawChief(ctx, t, chiefSeat?.status === 'ok',
        chiefSeat?.status === 'ok' ? 'brief sent · runs the floor'
          : chiefSeat?.status === 'failed' ? 'SEAT DOWN' : 'runs the floor')

      // ── ticker ──
      px(ctx, 0, 118, LW, 11, '#0a120d')
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

      const poses = stations.map((s, i) => ({ s, i, p: workerPose(s, i, t) }))
      for (const { s, i, p } of poses) {
        if ((s.present || s.down) && p.pose === 'seated') drawFigure(ctx, p.x, p.y, s, t, i, 'seated')
      }
      for (let i = 0; i < stations.length; i++) drawDeskRow(ctx, stations[i], t, i * 17 + 3)
      for (const { s, i, p } of poses) {
        if (s.present && p.pose !== 'seated') drawFigure(ctx, p.x, p.y, s, t, i, p.pose)
      }

      // one speech bubble at a time, rotating through stations that have one
      const withBubbles = stations.filter(s => s.bubble)
      if (withBubbles.length) {
        const pick = withBubbles[Math.floor(t / 5000) % withBubbles.length]
        const deskY = pick.row === 0 ? 152 : 210
        const by = pick.row === 0 ? deskY - 62 : deskY - 58
        drawBubble(ctx, pick.x + 19, Math.max(by, 132), pick.bubble!, pick.down ? P.red : P.gold)
      }

      // garden bench + water cooler
      px(ctx, 20, 236, 66, 16, '#4a5a3c'); px(ctx, 20, 228, 66, 10, '#5a6c48')
      px(ctx, 16, 236, 6, 16, '#3c4a30'); px(ctx, 84, 236, 6, 16, '#3c4a30')
      px(ctx, 442, 232, 10, 8, '#d8d8e0'); px(ctx, 443, 222, 8, 10, '#a8c8e0')
      px(ctx, 444, 240, 6, 12, '#8a8a94')

      // footer: next shift + health, day progress bar (real clock)
      px(ctx, 0, LH - 12, LW, 12, '#0a120d')
      ctx.font = `5px ${MONO}`; ctx.fillStyle = P.dim
      const pendingSeat = seats.find(s => s.status === 'pending')
      const failedN = seats.filter(s => s.status === 'failed').length
      ctx.fillText(
        `${pendingSeat ? `next shift: ${pendingSeat.name}` : 'all seats reported'}`
        + `   failed ${failedN}   disk ${system ? system.disk_pct.toFixed(0) + '%' : '—'}`,
        6, LH - 4)
      const dayFrac = (Date.now() / 86400000) % 1
      px(ctx, LW - 110, LH - 8, 100, 3, '#182419')
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
