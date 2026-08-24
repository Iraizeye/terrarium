import { useEffect, useRef, useState } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import type { CrewEvent, CrewMember, CrewStatus, MarketClock } from '../types'
import { GOLD, getPhase, palette, type Phase } from '../theme'
import { Panel as UIPanel, PanelHeader as UIPanelHeader, PillButton as UIPillButton, UI as UISTYLE } from '../ui'

// ── THE MESA ─────────────────────────────────────────────────────────────────
// A silhouette landscape where the sun IS the market: it climbs toward the
// ridge as the open approaches, arcs across the sky while the session runs,
// and sets after the close. Claude is the watchtower on the ridge — lit
// window and sweeping beacon in status color — with a small owl silhouette
// on the roof, gold eyes blinking. Same data, different cinema.

const INK = { text: '#f2f1f7', soft: '#a29db8', dim: '#575370' }
const PANEL_BORDER = '1px solid rgba(150,146,172,0.16)'
const STATUS: Record<CrewStatus, string> = {
  idle: '#5a5878',
  thinking: '#7ee8ff',
  working: '#79ff98',
  waiting: '#f0c040',
}
const GO = '#79ff98'
const HOLD = '#f0c040'
const NOGO = '#ff7060'
const VIOLET = '#8f5cff'

// silhouette layers, back to front
const MESA_TONES = ['rgba(32,24,54,0.75)', 'rgba(22,16,40,0.88)', 'rgba(13,9,26,0.98)']
const TOWER_TONE = '#120c22'
const TOWER_EDGE = '#241a3e'

const CLAUDE_X = 0.24 // tower anchor as fraction of canvas width
const PX = 5

// Ridge plaques — versions flown out of this room
const PLAQUES = ['v0.4', 'v0.5', 'v0.6', 'v0.7']

const MARKET_SESSION_S = 6.5 * 3600   // 09:30 → 16:00
const DAWN_WINDOW_S = 90 * 60

// ── Sky: stars + the market sun / off-hours moon ─────────────────────────────

function hash(i: number): number {
  let x = (i * 2654435761) % 4294967296
  x = ((x >> 16) ^ x) * 0x45d9f3b
  x = ((x >> 16) ^ x) % 4294967296
  return (x < 0 ? -x : x) / 4294967296
}

const STAR_ALPHA: Record<Phase, number> = { night: 1, dawn: 0.55, day: 0.08, dusk: 0.45 }

function drawStars(ctx: CanvasRenderingContext2D, w: number, groundY: number,
                   t: number, phase: Phase) {
  const base = STAR_ALPHA[phase]
  if (base <= 0.02) return
  for (let i = 0; i < 90; i++) {
    const x = hash(i * 3 + 1) * w
    const y = hash(i * 3 + 2) * (groundY - 60)
    const tw = 0.55 + 0.45 * Math.sin(t * (0.6 + hash(i) * 1.4) + i)
    ctx.globalAlpha = base * tw * (0.25 + hash(i * 7) * 0.6)
    ctx.fillStyle = hash(i * 5) > 0.8 ? '#cbb8ff' : '#e8ddc8'
    const s = hash(i * 11) > 0.92 ? 2 : 1.3
    ctx.fillRect(x, y, s, s)
  }
  ctx.globalAlpha = 1
}

/** Where the disc sits. Returns null when it shouldn't be drawn. */
function discPosition(w: number, groundY: number, market: MarketClock | null,
                      phase: Phase): { x: number; y: number; kind: 'sun' | 'moon' } | null {
  if (phase === 'day' && market) {
    // the session arc: rises at the open, peaks midday, sets at the close
    const p = Math.min(1, Math.max(0, 1 - market.seconds_to_change / MARKET_SESSION_S))
    return {
      x: w * (0.12 + 0.76 * p),
      y: groundY - 70 - Math.sin(Math.PI * p) * (groundY * 0.55),
      kind: 'sun',
    }
  }
  if (phase === 'dawn' && market) {
    // climbing toward the ridge as the open approaches
    const p = Math.min(1, Math.max(0, 1 - market.seconds_to_change / DAWN_WINDOW_S))
    return { x: w * 0.14, y: groundY + 26 - p * 88, kind: 'sun' }
  }
  if (phase === 'dusk') {
    return { x: w * 0.88, y: groundY - 26, kind: 'sun' }
  }
  // night: a high, patient moon
  return { x: w * 0.82, y: groundY * 0.22, kind: 'moon' }
}

function drawDisc(ctx: CanvasRenderingContext2D, w: number, groundY: number,
                  market: MarketClock | null, phase: Phase) {
  const pos = discPosition(w, groundY, market, phase)
  if (!pos) return
  const r = pos.kind === 'sun' ? 26 : 18
  const core = pos.kind === 'sun' ? GOLD : '#cfc4ec'
  const glowC = pos.kind === 'sun' ? 'rgba(245,180,81,' : 'rgba(190,170,255,'

  const glow = ctx.createRadialGradient(pos.x, pos.y, r * 0.4, pos.x, pos.y, r * 4.2)
  glow.addColorStop(0, glowC + (pos.kind === 'sun' ? '0.35)' : '0.22)'))
  glow.addColorStop(1, glowC + '0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, r * 4.2, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
  ctx.fill()
  if (pos.kind === 'moon') {
    ctx.fillStyle = 'rgba(120,105,165,0.5)'
    ctx.beginPath()
    ctx.arc(pos.x - 6, pos.y - 4, 4, 0, Math.PI * 2)
    ctx.arc(pos.x + 5, pos.y + 6, 3, 0, Math.PI * 2)
    ctx.arc(pos.x + 8, pos.y - 7, 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ── The mesas — three parallax silhouette ridges ─────────────────────────────

function mesaProfile(seed: number, w: number): [number, number][] {
  // deterministic flat-topped butte skyline: [x, heightAboveBase] control points
  const pts: [number, number][] = []
  let x = -40
  let i = 0
  while (x < w + 80) {
    const flat = 40 + hash(seed + i * 7) * 150
    const height = 14 + hash(seed + i * 13) * 46
    const rise = 10 + hash(seed + i * 17) * 22
    pts.push([x, 0], [x + rise, height], [x + rise + flat, height], [x + rise * 2 + flat, 0])
    x += rise * 2 + flat + 24 + hash(seed + i * 23) * 90
    i++
  }
  return pts
}

const MESA_CACHE: Record<string, [number, number][]> = {}

function drawMesas(ctx: CanvasRenderingContext2D, w: number, groundY: number) {
  const layers = [
    { seed: 11, base: groundY - 46, tone: MESA_TONES[0] },
    { seed: 47, base: groundY - 20, tone: MESA_TONES[1] },
    { seed: 83, base: groundY + 2, tone: MESA_TONES[2] },
  ]
  for (const layer of layers) {
    const key = `${layer.seed}:${w}`
    const pts = MESA_CACHE[key] ?? (MESA_CACHE[key] = mesaProfile(layer.seed, w))
    ctx.fillStyle = layer.tone
    ctx.beginPath()
    ctx.moveTo(-50, groundY + 40)
    for (const [x, hgt] of pts) ctx.lineTo(x, layer.base - hgt)
    ctx.lineTo(w + 50, groundY + 40)
    ctx.closePath()
    ctx.fill()
  }
}

// ── The desert floor — brush and bones of the range ──────────────────────────

function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number) {
  ctx.fillStyle = 'rgba(10,7,20,0.9)'
  ctx.fillRect(0, groundY, w, h - groundY)
  // sparse sage silhouettes, bigger up close
  for (let i = 0; i < 26; i++) {
    const x = hash(i * 31 + 5) * w
    const depth = hash(i * 37 + 9)
    const y = groundY + 10 + depth * (h - groundY - 18)
    const s = 3 + depth * 9
    ctx.strokeStyle = `rgba(40,30,66,${0.5 + depth * 0.4})`
    ctx.lineWidth = 1 + depth * 1.2
    ctx.beginPath()
    ctx.moveTo(x, y); ctx.lineTo(x - s * 0.5, y - s)
    ctx.moveTo(x, y); ctx.lineTo(x + 0.3, y - s * 1.35)
    ctx.moveTo(x, y); ctx.lineTo(x + s * 0.55, y - s * 0.85)
    ctx.stroke()
  }
  // fence at the property line
  const fy = groundY + 26
  ctx.strokeStyle = 'rgba(60,46,92,0.55)'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(w * 0.7, fy)
  ctx.lineTo(w * 1.0, fy + 8)
  ctx.stroke()
  for (let i = 0; i < 6; i++) {
    const fx = w * (0.715 + i * 0.055)
    ctx.beginPath()
    ctx.moveTo(fx, fy + i * 1.4)
    ctx.lineTo(fx, fy - 10 + i * 1.2)
    ctx.stroke()
  }
}

function drawHorizonGlow(ctx: CanvasRenderingContext2D, w: number, groundY: number,
                         glow: [string, string]) {
  const grd = ctx.createLinearGradient(0, groundY - 150, 0, groundY + 6)
  grd.addColorStop(0, glow[1])
  grd.addColorStop(1, glow[0])
  ctx.fillStyle = grd
  ctx.fillRect(0, groundY - 150, w, 156)
}

// ── The watchtower — Claude, in silhouette against the sky ───────────────────

function towerGeometry(cx: number, groundY: number) {
  const baseW = 15 * PX
  const topW = 9 * PX
  const towerTop = groundY - 34 * PX     // cabin floor line
  const cabinH = 9 * PX
  const roofY = towerTop - cabinH
  const beaconY = roofY - 4.5 * PX
  return { baseW, topW, towerTop, cabinH, roofY, beaconY }
}

function drawTower(ctx: CanvasRenderingContext2D, cx: number, groundY: number,
                   status: CrewStatus, t: number) {
  const { baseW, topW, towerTop, cabinH, roofY, beaconY } = towerGeometry(cx, groundY)
  const color = STATUS[status]

  // tapered body
  ctx.fillStyle = TOWER_TONE
  ctx.beginPath()
  ctx.moveTo(cx - baseW / 2, groundY + 4)
  ctx.lineTo(cx - topW / 2, towerTop)
  ctx.lineTo(cx + topW / 2, towerTop)
  ctx.lineTo(cx + baseW / 2, groundY + 4)
  ctx.closePath()
  ctx.fill()
  // cross-brace cutout lines (lighter, so the lattice reads in silhouette)
  ctx.strokeStyle = TOWER_EDGE
  ctx.lineWidth = 2
  for (let i = 0; i < 4; i++) {
    const y0 = groundY - i * 8.2 * PX
    const y1 = y0 - 8.2 * PX
    if (y1 < towerTop) break
    const half0 = (baseW / 2) - (i * (baseW - topW) / 8)
    const half1 = (baseW / 2) - ((i + 1) * (baseW - topW) / 8)
    ctx.beginPath()
    ctx.moveTo(cx - half0, y0); ctx.lineTo(cx + half1, y1)
    ctx.moveTo(cx + half0, y0); ctx.lineTo(cx - half1, y1)
    ctx.stroke()
  }

  // cabin
  ctx.fillStyle = TOWER_TONE
  ctx.fillRect(cx - 8 * PX, roofY, 16 * PX, cabinH)
  // deck lip + posts
  ctx.fillRect(cx - 9.4 * PX, towerTop - 0.4 * PX, 18.8 * PX, 1.4 * PX)
  // roof
  ctx.beginPath()
  ctx.moveTo(cx - 9.6 * PX, roofY)
  ctx.lineTo(cx, roofY - 3.6 * PX)
  ctx.lineTo(cx + 9.6 * PX, roofY)
  ctx.closePath()
  ctx.fill()

  // THE WINDOW — Claude's light, in status color
  const flicker = status === 'working' ? 0.85 + 0.15 * Math.sin(t * 9) : 1
  const winW = 5.4 * PX, winH = 4.6 * PX
  const wx = cx - winW / 2, wy = roofY + (cabinH - winH) / 2 + 0.4 * PX
  const wglow = ctx.createRadialGradient(cx, wy + winH / 2, 2, cx, wy + winH / 2, 60)
  wglow.addColorStop(0, color + '55')
  wglow.addColorStop(1, color + '00')
  ctx.fillStyle = wglow
  ctx.beginPath()
  ctx.arc(cx, wy + winH / 2, 60, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = flicker
  ctx.fillStyle = color
  ctx.fillRect(wx, wy, winW, winH)
  ctx.globalAlpha = 1
  // window cross
  ctx.strokeStyle = TOWER_TONE
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx, wy); ctx.lineTo(cx, wy + winH)
  ctx.moveTo(wx, wy + winH / 2); ctx.lineTo(wx + winW, wy + winH / 2)
  ctx.stroke()
  // a tiny silhouette at the window when working — someone's at the desk
  if (status === 'working') {
    ctx.fillStyle = TOWER_TONE
    ctx.beginPath()
    ctx.arc(cx + 1.2 * PX, wy + winH - 1.6 * PX, 1.5 * PX, Math.PI, 0)
    ctx.fill()
  }

  // beacon mast + lamp
  ctx.fillStyle = TOWER_TONE
  ctx.fillRect(cx - 0.6 * PX, beaconY, 1.2 * PX, roofY - 3.6 * PX - beaconY + 2)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx, beaconY, 3, 0, Math.PI * 2)
  ctx.fill()
  const halo = ctx.createRadialGradient(cx, beaconY, 1, cx, beaconY, 22)
  halo.addColorStop(0, color + '99')
  halo.addColorStop(1, color + '00')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(cx, beaconY, 22, 0, Math.PI * 2)
  ctx.fill()
}

/** Beacon beams — status color sweeping the range. Drawn behind the board. */
function drawBeams(ctx: CanvasRenderingContext2D, cx: number, groundY: number,
                   status: CrewStatus, t: number) {
  const { beaconY } = towerGeometry(cx, groundY)
  const color = STATUS[status]
  const speed = status === 'working' ? 0.9 : status === 'thinking' ? 0.45 : 0.16
  const len = 300
  const spread = 0.14
  for (const offset of [0, Math.PI]) {
    const angle = (t * speed + offset) % (Math.PI * 2)
    ctx.save()
    ctx.translate(cx, beaconY)
    ctx.rotate(angle)
    const beam = ctx.createLinearGradient(0, 0, len, 0)
    beam.addColorStop(0, color + '38')
    beam.addColorStop(1, color + '00')
    ctx.fillStyle = beam
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(len, -len * spread)
    ctx.lineTo(len, len * spread)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}

/** The owl stayed — a small silhouette on the roof peak, gold eyes blinking. */
function drawRoofOwl(ctx: CanvasRenderingContext2D, cx: number, groundY: number,
                     t: number, waving: boolean) {
  const { roofY } = towerGeometry(cx, groundY)
  const ox = cx + 6.4 * PX
  const oy = roofY - 1.2 * PX
  const bob = Math.sin(t * 1.3) * 0.8
  // body silhouette
  ctx.fillStyle = TOWER_TONE
  ctx.beginPath()
  ctx.roundRect(ox - 7, oy - 16 + bob, 14, 16, 6)
  ctx.fill()
  // ear tufts
  ctx.beginPath()
  ctx.moveTo(ox - 6, oy - 13 + bob); ctx.lineTo(ox - 3.4, oy - 20 + bob); ctx.lineTo(ox - 1, oy - 14 + bob)
  ctx.moveTo(ox + 6, oy - 13 + bob); ctx.lineTo(ox + 3.4, oy - 20 + bob); ctx.lineTo(ox + 1, oy - 14 + bob)
  ctx.fill()
  // wing lifts when waving
  if (waving) {
    const wig = Math.sin(t * 11) * 0.3
    ctx.save()
    ctx.translate(ox + 6, oy - 8 + bob)
    ctx.rotate(-1.0 + wig)
    ctx.beginPath()
    ctx.roundRect(-2, -9, 4, 9, 2)
    ctx.fill()
    ctx.restore()
  }
  // gold eyes — the iris, always watching
  const blink = (t % 4.3) > 4.16
  if (!blink) {
    ctx.fillStyle = GOLD
    ctx.beginPath()
    ctx.arc(ox - 3, oy - 10 + bob, 1.8, 0, Math.PI * 2)
    ctx.arc(ox + 3, oy - 10 + bob, 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawThoughtDots(ctx: CanvasRenderingContext2D, cx: number, groundY: number, t: number) {
  const { beaconY } = towerGeometry(cx, groundY)
  const y = beaconY - 18
  for (let i = 0; i < 3; i++) {
    const phase = Math.sin(t * 4 - i * 0.9)
    ctx.globalAlpha = 0.35 + Math.max(0, phase) * 0.65
    ctx.fillStyle = VIOLET
    ctx.fillRect(cx - 32 + i * 12, y - Math.max(0, phase) * 4, 6, 6)
  }
  ctx.globalAlpha = 1
}

function drawWaitingMark(ctx: CanvasRenderingContext2D, cx: number, groundY: number, t: number) {
  const { beaconY } = towerGeometry(cx, groundY)
  const y = beaconY - 20 + Math.sin(t * 5) * 3
  ctx.fillStyle = STATUS.waiting
  ctx.fillRect(cx - 26, y - 12, 5, 9)
  ctx.fillRect(cx - 26, y + 1, 5, 4)
}

// ── Shooting star — a finished turn crosses the sky ──────────────────────────

interface Meteor { x: number; y: number; vx: number; vy: number; life: number }

function spawnMeteor(pool: Meteor[], w: number) {
  pool.push({
    x: w * (0.25 + Math.random() * 0.3),
    y: 30 + Math.random() * 60,
    vx: 5.5 + Math.random() * 2.5,
    vy: 2.2 + Math.random() * 1.2,
    life: 1,
  })
}

function stepMeteors(ctx: CanvasRenderingContext2D, pool: Meteor[]) {
  for (let i = pool.length - 1; i >= 0; i--) {
    const m = pool[i]
    m.x += m.vx
    m.y += m.vy
    m.life -= 0.012
    if (m.life <= 0) { pool.splice(i, 1); continue }
    const trail = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 16, m.y - m.vy * 16)
    trail.addColorStop(0, `rgba(245,180,81,${0.9 * m.life})`)
    trail.addColorStop(1, 'rgba(245,180,81,0)')
    ctx.strokeStyle = trail
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(m.x, m.y)
    ctx.lineTo(m.x - m.vx * 16, m.y - m.vy * 16)
    ctx.stroke()
    ctx.fillStyle = `rgba(255,236,200,${m.life})`
    ctx.beginPath()
    ctx.arc(m.x, m.y, 2.4, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ── Plaques on the ridge ─────────────────────────────────────────────────────

function drawPlaques(ctx: CanvasRenderingContext2D, w: number, groundY: number) {
  const y = groundY - 30 * PX - 158
  PLAQUES.forEach((label, i) => {
    const x = w * 0.55 + (i - (PLAQUES.length - 1) / 2) * 56 - 20
    ctx.fillStyle = 'rgba(148,144,170,0.10)'
    ctx.strokeStyle = 'rgba(148,144,170,0.22)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(x, y - 44, 40, 26, 4)
    ctx.fill()
    ctx.stroke()
    ctx.font = '600 10px "Fira Code", monospace'
    ctx.fillStyle = INK.dim
    ctx.textAlign = 'center'
    ctx.fillText(label, x + 20, y - 27)
    ctx.textAlign = 'left'
  })
}

// ── The Big Board — market clock + GO/NO-GO over the REAL stack ──────────────

export interface BoardCell {
  callsign: string
  state: 'go' | 'hold' | 'nogo' | 'off'
  detail: string
}

function boardGeometry(w: number, groundY: number) {
  const bw = Math.min(w * 0.5, 600)
  const bh = 172
  const bx = w * 0.58 - bw / 2
  const by = groundY - 30 * PX - bh + 46
  const cols = 4
  const cellW = (bw - 32) / cols
  return { bw, bh, bx, by, cols, cellW }
}

function fmtCountdown(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m ${String(Math.floor(s % 60)).padStart(2, '0')}s`
}

function drawWallBoard(ctx: CanvasRenderingContext2D, w: number, groundY: number,
                       t: number, cells: BoardCell[],
                       market: MarketClock | null,
                       ticker: string) {
  const { bw, bh, bx, by, cols, cellW } = boardGeometry(w, groundY)

  ctx.fillStyle = 'rgba(16,14,26,0.92)'
  ctx.strokeStyle = 'rgba(148,144,170,0.28)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh, 6)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = 'rgba(245,180,81,0.65)'   // first-light trim
  ctx.fillRect(bx + 1, by + 1, bw - 2, 2)
  ctx.fillStyle = TOWER_TONE
  ctx.fillRect(bx + 24, by + bh, 8, groundY - by - bh)
  ctx.fillRect(bx + bw - 32, by + bh, 8, groundY - by - bh)

  // header — market clock
  ctx.font = '600 11px "Fira Code", monospace'
  ctx.fillStyle = INK.dim
  ctx.textAlign = 'left'
  const open = market?.is_open ?? false
  ctx.fillText(open ? 'MARKET OPEN — CLOSES IN' : 'MARKET CLOSED — OPENS IN', bx + 16, by + 22)
  ctx.font = '700 22px "Fira Code", monospace'
  ctx.fillStyle = open ? GOLD : INK.text
  ctx.fillText(market ? fmtCountdown(market.seconds_to_change) : '——', bx + 16, by + 46)
  ctx.font = '600 11px "Fira Code", monospace'
  ctx.fillStyle = INK.dim
  ctx.fillText(market ? `${market.et} ET` : '', bx + 16 + 130, by + 46)

  // session arc trace — mirrors the sun's path
  const ox = bx + bw * 0.55, ow = bw * 0.4, oy = by + 40, oh = 22
  ctx.strokeStyle = 'rgba(148,144,170,0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 0; i <= ow; i += 3) {
    const yy = oy - Math.sin((i / ow) * Math.PI) * oh
    i === 0 ? ctx.moveTo(ox + i, yy) : ctx.lineTo(ox + i, yy)
  }
  ctx.stroke()
  const p = open && market
    ? Math.min(1, Math.max(0, 1 - market.seconds_to_change / MARKET_SESSION_S))
    : (t * 0.03) % 1
  ctx.fillStyle = open ? GOLD : INK.dim
  ctx.beginPath()
  ctx.arc(ox + p * ow, oy - Math.sin(p * Math.PI) * oh, 3, 0, Math.PI * 2)
  ctx.fill()

  // GO / NO-GO cells
  cells.forEach((cell, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    const gx = bx + 16 + col * cellW
    const gy = by + 70 + row * 34
    const color = cell.state === 'go' ? GO : cell.state === 'hold' ? HOLD
      : cell.state === 'off' ? INK.dim : NOGO
    ctx.font = '600 9px "Fira Code", monospace'
    ctx.fillStyle = INK.dim
    ctx.fillText(cell.callsign, gx, gy)
    ctx.font = '700 12px "Fira Code", monospace'
    ctx.fillStyle = color
    ctx.fillText(
      cell.state === 'go' ? 'GO' : cell.state === 'hold' ? 'HOLD'
        : cell.state === 'off' ? '——' : 'NO GO',
      gx, gy + 14,
    )
  })

  // ticker
  if (ticker) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(bx + 2, by + bh - 24, bw - 4, 20)
    ctx.clip()
    ctx.fillStyle = 'rgba(148,144,170,0.08)'
    ctx.fillRect(bx + 2, by + bh - 24, bw - 4, 20)
    ctx.font = '500 11px "Fira Code", monospace'
    ctx.fillStyle = INK.soft
    const text = `▸ ${ticker}   `
    const tw = ctx.measureText(text).width
    const shift = (t * 40) % (tw + bw)
    ctx.fillText(text, bx + bw - shift, by + bh - 9)
    ctx.restore()
  }
}

/** Build the GO/NO-GO cells from live state. This is the board's truth table. */
export function buildBoardCells(store: ReturnType<typeof useDashboardStore.getState>): BoardCell[] {
  const trading = store.trading
  const services = store.services
  const fresh = store.lastUpdate ? Date.now() - store.lastUpdate.getTime() < 30_000 : false

  const modeCell = (mode: 'paper' | 'live'): BoardCell => {
    const m = trading?.modes?.[mode]
    if (!m) return { callsign: mode.toUpperCase(), state: 'off', detail: 'no data' }
    const state = m.status === 'alive' ? 'go' : m.status === 'stale' ? 'nogo' : 'hold'
    const age = m.heartbeat_age_s
    return {
      callsign: mode.toUpperCase(),
      state,
      detail: age == null ? 'no heartbeat yet' : `heartbeat ${age}s ago`,
    }
  }
  const watchdogCell = (mode: 'paper' | 'live'): BoardCell => {
    const armed = trading?.modes?.[mode]?.watchdog_armed
    return {
      callsign: mode === 'paper' ? 'WDOG-P' : 'WDOG-L',
      state: armed ? 'go' : 'nogo',
      detail: armed ? 'watchdog armed' : 'watchdog not installed',
    }
  }
  const svcCell = (key: string, callsign: string): BoardCell => {
    const svc = services[key]
    return {
      callsign,
      state: svc ? (svc.status === 'up' ? 'go' : 'nogo') : 'off',
      detail: svc ? `:${svc.port} ${svc.status}` : 'not checked',
    }
  }

  return [
    modeCell('paper'),
    modeCell('live'),
    watchdogCell('paper'),
    watchdogCell('live'),
    {
      callsign: 'KILL',
      state: trading ? (trading.kill_switch ? 'hold' : 'go') : 'off',
      detail: trading?.kill_switch ? 'kill switch ACTIVE — buys halted' : 'kill switch clear',
    },
    svcCell('glance', 'GLANCE'),
    svcCell('screenpipe', 'OPTICS'),
    {
      callsign: 'FEED',
      state: fresh ? 'go' : 'nogo',
      detail: fresh ? 'telemetry live' : 'telemetry stale',
    },
  ]
}

// ── Status plate (HTML overlay) ──────────────────────────────────────────────

function StatusPlate({ member }: { member: CrewMember }) {
  const statusColor = STATUS[member.status] ?? STATUS.idle
  return (
    <div style={{
      position: 'absolute',
      top: 'min(calc(66% + 40px), calc(100% - 132px))',
      left: `calc(${CLAUDE_X * 100}% - 125px)`,
      width: 250,
      padding: '10px 14px 12px',
      background: 'rgba(11,8,18,0.82)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: PANEL_BORDER,
      borderTop: `2px solid ${VIOLET}`,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 32px -16px rgba(0,0,0,0.45)',
      zIndex: 5,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 15, letterSpacing: '0.14em', color: VIOLET, textTransform: 'uppercase', fontWeight: 700 }}>
          {member.name}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: statusColor,
            animation: member.status !== 'idle' ? 'led-pulse 1.2s ease-in-out infinite' : undefined,
          }} />
          <span style={{ fontSize: 10, letterSpacing: '0.16em', color: statusColor, textTransform: 'uppercase' }}>
            {member.status}
          </span>
        </span>
      </div>
      <div style={{ fontSize: 9.5, color: INK.dim, letterSpacing: '0.1em', marginTop: 2 }}>
        Night watch · {member.role} · {member.model}
      </div>
      <div style={{
        marginTop: 7, fontSize: 11.5, color: INK.text, fontFamily: '"Fira Code", monospace',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minHeight: 16,
      }}>
        {member.activity ?? 'lamp lit, watching the range'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9.5, color: INK.soft, letterSpacing: '0.06em' }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>
          {member.task ? `▸ ${member.task}` : '▸ no task'}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{member.events_today} ev</span>
      </div>
    </div>
  )
}

// ── Ops log (left rail) ──────────────────────────────────────────────────────

const KIND_GLYPH: Record<CrewEvent['kind'], string> = {
  tool: '⚙', thought: '◌', lifecycle: '●', hook: '·',
}

const OPS_FILTERS = ['all', 'tools', 'events'] as const

export function OpsLog() {
  const allEvents = useDashboardStore((s) => s.crewEvents)
  const filter = useDashboardStore((s) => s.opsFilter)
  const setOpsFilter = useDashboardStore((s) => s.setOpsFilter)
  const events = filter === 'all' ? allEvents
    : filter === 'tools' ? allEvents.filter((e) => e.kind === 'tool')
    : allEvents.filter((e) => e.kind !== 'tool')
  return (
    <UIPanel style={{ height: '100%' }}>
      <UIPanelHeader
        label="Ops log — live"
        title="every tool call and lifecycle event from agent sessions, as it happens"
        right={
          <span style={{ display: 'flex', gap: 4 }}>
            {OPS_FILTERS.map((f) => (
              <UIPillButton key={f} active={filter === f} onClick={() => setOpsFilter(f)}>{f}</UIPillButton>
            ))}
          </span>
        }
      />
      <div style={{ padding: '6px 0', overflowY: 'auto', minHeight: 0 }}>
        {events.length === 0 && (
          <div style={{ padding: '10px 14px', fontSize: 10.5, lineHeight: 1.55, color: UISTYLE.dim, fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}>
            no agent activity yet — tool calls and session events stream in
            here live once an agent is working.
          </div>
        )}
        {events.slice(0, 60).map((e) => (
          <div key={e.id} style={{ display: 'flex', gap: 8, padding: '3px 14px', alignItems: 'baseline' }}>
            <span style={{ fontSize: 9, color: UISTYLE.dim, fontVariantNumeric: 'tabular-nums', fontFamily: '"JetBrains Mono", "Fira Code", monospace', flexShrink: 0 }}>
              {new Date(e.ts).toLocaleTimeString([], { hour12: false })}
            </span>
            <span style={{ color: UISTYLE.accent, fontSize: 10, flexShrink: 0 }}>{KIND_GLYPH[e.kind] ?? '·'}</span>
            <span title={e.text} style={{
              fontSize: 11, color: UISTYLE.soft,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            }}>
              {e.text}
            </span>
          </div>
        ))}
      </div>
    </UIPanel>
  )
}

// ── Stage ────────────────────────────────────────────────────────────────────

export default function CrewStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const crew = useDashboardStore((s) => s.crew)
  const crewEvents = useDashboardStore((s) => s.crewEvents)
  const setCrew = useDashboardStore((s) => s.setCrew)
  const setCrewEvents = useDashboardStore((s) => s.setCrewEvents)
  const [selectedCell, setSelectedCell] = useState<BoardCell | null>(null)
  const celebrateRef = useRef<{ until: number; spawned: boolean } | null>(null)
  const waveRef = useRef(0)

  // click routing: tower -> the roof owl waves; GO/NO-GO cell -> detail popover
  const handleStageClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const r = canvas.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    const w = canvas.width, groundY = canvas.height * 0.66

    const ax = w * CLAUDE_X
    const { beaconY } = towerGeometry(ax, groundY)
    if (Math.abs(x - ax) < 62 && y > beaconY - 30 && y < groundY + 12) {
      waveRef.current = Date.now() + 1800
      return
    }
    const g = boardGeometry(w, groundY)
    if (x >= g.bx && x <= g.bx + g.bw && y >= g.by + 58 && y <= g.by + 58 + 2 * 34 + 10) {
      const col = Math.floor((x - (g.bx + 16)) / g.cellW)
      const row = Math.floor((y - (g.by + 58)) / 34)
      const cells = buildBoardCells(useDashboardStore.getState())
      const idx = row * g.cols + col
      if (idx >= 0 && idx < cells.length) {
        setSelectedCell((cur) => cur?.callsign === cells[idx].callsign ? null : cells[idx])
        return
      }
    }
    setSelectedCell(null)
  }

  // seed from REST so the stage is alive before the first WS frame
  useEffect(() => {
    fetch('/api/crew')
      .then((r) => r.json())
      .then((d) => {
        if (d.crew) setCrew(d.crew)
        if (d.events) setCrewEvents([...d.events].reverse())
      })
      .catch(() => { /* backend not up yet */ })
  }, [setCrew, setCrewEvents])

  // finished turns -> a shooting star
  useEffect(() => {
    const latest = crewEvents[0]
    if (latest?.kind === 'lifecycle' && latest.text.includes('finished')) {
      celebrateRef.current = { until: Date.now() + 2600, spawned: false }
    }
  }, [crewEvents])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const resize = () => {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    const meteors: Meteor[] = []
    let raf: number
    const frame = () => {
      const t = performance.now() / 1000
      const now = Date.now()
      const w = canvas.width, h = canvas.height
      const groundY = h * 0.66
      const state = useDashboardStore.getState()
      const phase = getPhase(state.trading?.market)
      const market = state.trading?.market ?? null
      ctx.clearRect(0, 0, w, h)
      ctx.imageSmoothingEnabled = false

      // sky → disc → glow → mesas → floor: the landscape stack
      drawStars(ctx, w, groundY, t, phase)
      drawDisc(ctx, w, groundY, market, phase)
      drawHorizonGlow(ctx, w, groundY, palette(phase).stageGlow)
      drawMesas(ctx, w, groundY)
      drawFloor(ctx, w, h, groundY)
      drawPlaques(ctx, w, groundY)

      const member = state.crew.claude
      const status: CrewStatus = member?.status ?? 'idle'
      const cx = w * CLAUDE_X

      drawBeams(ctx, cx, groundY, status, t)

      const latest = state.crewEvents[0]
      const alert = state.trading?.alerts?.length
        ? state.trading.alerts[state.trading.alerts.length - 1]
        : ''
      drawWallBoard(
        ctx, w, groundY, t,
        buildBoardCells(state),
        market,
        latest ? `claude: ${latest.text}` : alert,
      )

      const cel = celebrateRef.current
      const celebrating = !!cel && cel.until > now
      const waving = waveRef.current > now
      if (cel && celebrating && !cel.spawned) {
        spawnMeteor(meteors, w)
        spawnMeteor(meteors, w)
        cel.spawned = true
      }
      drawTower(ctx, cx, groundY, status, t)
      drawRoofOwl(ctx, cx, groundY, t, waving || celebrating)
      if (!celebrating && status === 'thinking') drawThoughtDots(ctx, cx, groundY, t)
      if (!celebrating && status === 'waiting') drawWaitingMark(ctx, cx, groundY, t)

      stepMeteors(ctx, meteors)
      raf = requestAnimationFrame(frame)
    }
    frame()
    return () => { ro.disconnect(); cancelAnimationFrame(raf) }
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
      <canvas ref={canvasRef} onClick={handleStageClick} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }} />

      {crew.claude && <StatusPlate member={crew.claude} />}

      {selectedCell && (
        <div style={{
          position: 'absolute', top: 24, left: '58%', transform: 'translateX(-50%)',
          width: 300, padding: '10px 14px 12px', zIndex: 7,
          background: 'rgba(11,8,18,0.94)', border: PANEL_BORDER,
          borderTop: `2px solid ${selectedCell.state === 'go' ? GO : selectedCell.state === 'hold' ? HOLD : NOGO}`,
          boxShadow: '0 16px 32px -16px rgba(0,0,0,0.6)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 12, letterSpacing: '0.16em', color: INK.text, fontWeight: 700 }}>
              {selectedCell.callsign}
            </span>
            <button onClick={() => setSelectedCell(null)} style={{ background: 'none', border: 'none', color: INK.dim, cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, fontFamily: '"Fira Code", monospace', color: INK.soft }}>
            {selectedCell.detail}
          </div>
        </div>
      )}

      <Logbook />
    </div>
  )
}

// ── LOGBOOK — write a note into the session log from the stage ───────────────

function Logbook() {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const send = async () => {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const r = await fetch('/api/sessions/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'note', content }),
      })
      const d = await r.json()
      setNote(d.ok ? 'logged' : 'log failed')
      if (d.ok) setText('')
    } catch { setNote('backend unreachable') }
    setSending(false)
    setTimeout(() => setNote(null), 4000)
  }

  return (
    <div style={{
      position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: 8,
      width: 'min(480px, 80%)', padding: '7px 10px', zIndex: 6,
      background: 'rgba(11,8,18,0.85)', border: PANEL_BORDER,
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    }}>
      <span style={{ fontSize: 9, letterSpacing: '0.2em', color: GOLD, opacity: 0.8, flexShrink: 0 }}>LOGBOOK ▸</span>
      {note && (
        <span style={{
          position: 'absolute', top: -22, left: 10, fontSize: 10,
          fontFamily: '"Fira Code", monospace',
          color: note === 'logged' ? GO : HOLD,
        }}>
          {note}
        </span>
      )}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') send() }}
        placeholder="note for the session log…"
        style={{
          flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
          color: INK.text, fontSize: 12, fontFamily: '"Fira Code", monospace',
        }}
      />
      <button
        onClick={send}
        disabled={sending || !text.trim()}
        style={{
          background: 'none', border: `1px solid ${GOLD}`, color: GOLD,
          fontSize: 10, letterSpacing: '0.14em', padding: '3px 10px',
          cursor: sending || !text.trim() ? 'default' : 'pointer',
          opacity: sending || !text.trim() ? 0.4 : 1,
        }}
      >
        {sending ? '…' : 'LOG'}
      </button>
    </div>
  )
}
