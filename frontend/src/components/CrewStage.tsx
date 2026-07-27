import { useEffect, useRef, useState } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import type { CrewEvent, CrewMember, CrewStatus } from '../types'
import { GOLD, PHASES, getPhase } from '../theme'

// ── Palette ──────────────────────────────────────────────────────────────────
// Sprite discipline: readable silhouette first, 2-3 colors per part,
// the eyes carry the personality. The owl's eye IS an iris: gold ring,
// dark pupil — the namesake, watching.

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

// The watch-owl (Claude): violet feathers, cream face, golden iris eyes
const OWL = {
  body: '#8f5cff',
  shade: '#6a3fd0',
  belly: '#e8ddc8',
  bellyShade: '#c9bda3',
  iris: '#f5b451',
  pupil: '#1a1426',
  beak: '#d99a3a',
  glow: 'rgba(143,92,255,0.5)',
}
// The tower
const WOOD = { frame: '#26233a', dark: '#1b1928', stud: '#312d48' }

const SPARK_COLORS = ['#f5b451', '#8f5cff', '#79ff98', '#e8ddc8', '#ffce3a']

const CLAUDE_X = 0.24 // tower anchor as fraction of canvas width
const PX = 5

// Wall plaques — versions flown out of this room
const PLAQUES = ['v0.4', 'v0.5', 'v0.6', 'v0.7']

// ── Celebration sparks (first light, in pieces) ──────────────────────────────

interface Spark {
  x: number; y: number; vx: number; vy: number
  w: number; h: number; rot: number; vrot: number
  color: string; life: number
}

function spawnSparks(pool: Spark[], cx: number, cy: number) {
  for (let i = 0; i < 42; i++) {
    pool.push({
      x: cx + (Math.random() - 0.5) * 40,
      y: cy + (Math.random() - 0.5) * 30,
      vx: (Math.random() - 0.5) * 5,
      vy: -Math.random() * 6 - 2,
      w: 5 + Math.random() * 4,
      h: 3 + Math.random() * 3,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.3,
      color: SPARK_COLORS[i % SPARK_COLORS.length],
      life: 1,
    })
  }
}

function stepSparks(ctx: CanvasRenderingContext2D, pool: Spark[], groundY: number) {
  for (let i = pool.length - 1; i >= 0; i--) {
    const c = pool[i]
    c.vy += 0.18
    c.x += c.vx
    c.y += c.vy
    c.rot += c.vrot
    if (c.y > groundY + 8) { c.y = groundY + 8; c.vy = 0; c.vx *= 0.9; c.life -= 0.03 }
    if (c.life <= 0) { pool.splice(i, 1); continue }
    ctx.save()
    ctx.translate(c.x, c.y)
    ctx.rotate(c.rot)
    ctx.globalAlpha = Math.min(1, c.life * 2)
    ctx.fillStyle = c.color
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h)
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

// ── The watchtower ───────────────────────────────────────────────────────────

function towerGeometry(cx: number, groundY: number) {
  const cabinFloor = groundY - 24 * PX     // where the owl's talons grip
  const cabinTop = cabinFloor - 16 * PX    // roof line
  const beaconY = cabinTop - 3.4 * PX      // lamp center
  return { cabinFloor, cabinTop, beaconY }
}

function drawTower(ctx: CanvasRenderingContext2D, cx: number, groundY: number) {
  const { cabinFloor, cabinTop } = towerGeometry(cx, groundY)
  const P = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }
  const legSpread = 11 * PX

  // splayed lattice legs
  ctx.strokeStyle = WOOD.frame
  ctx.lineWidth = 5
  for (const s of [-1, 1] as const) {
    ctx.beginPath()
    ctx.moveTo(cx + s * legSpread, groundY + 2)
    ctx.lineTo(cx + s * (legSpread - 3 * PX), cabinFloor + 2 * PX)
    ctx.stroke()
  }
  // cross braces
  ctx.lineWidth = 2.5
  ctx.strokeStyle = WOOD.dark
  for (let i = 0; i < 3; i++) {
    const y0 = groundY - (i * 7 + 1) * PX
    const y1 = y0 - 7 * PX
    const spread0 = legSpread - i * PX
    const spread1 = legSpread - (i + 1) * PX
    ctx.beginPath()
    ctx.moveTo(cx - spread0, y0); ctx.lineTo(cx + spread1, y1)
    ctx.moveTo(cx + spread0, y0); ctx.lineTo(cx - spread1, y1)
    ctx.stroke()
  }
  // ladder
  P(cx - 1.2 * PX, cabinFloor + 2 * PX, 0.5 * PX, groundY - cabinFloor - 2 * PX, WOOD.dark)
  P(cx + 0.7 * PX, cabinFloor + 2 * PX, 0.5 * PX, groundY - cabinFloor - 2 * PX, WOOD.dark)
  for (let y = cabinFloor + 3.4 * PX; y < groundY - PX; y += 2.4 * PX) {
    P(cx - 1.2 * PX, y, 2.4 * PX, 0.45 * PX, WOOD.frame)
  }

  // cabin platform
  P(cx - 10 * PX, cabinFloor, 20 * PX, 1.6 * PX, WOOD.frame)
  for (let i = 0; i < 5; i++) P(cx - 9 * PX + i * 4 * PX, cabinFloor - 0.5 * PX, 1.1 * PX, 0.5 * PX, WOOD.stud)
  // side rails
  P(cx - 10 * PX, cabinFloor - 5 * PX, 1.2 * PX, 5 * PX, WOOD.frame)
  P(cx + 8.8 * PX, cabinFloor - 5 * PX, 1.2 * PX, 5 * PX, WOOD.frame)
  P(cx - 10 * PX, cabinFloor - 5 * PX, 20 * PX, 0.8 * PX, WOOD.dark)
  // roof posts + roof
  P(cx - 9 * PX, cabinTop, 1.1 * PX, 4 * PX, WOOD.dark)
  P(cx + 7.9 * PX, cabinTop, 1.1 * PX, 4 * PX, WOOD.dark)
  P(cx - 11 * PX, cabinTop - 1.6 * PX, 22 * PX, 1.8 * PX, WOOD.frame)
  P(cx - 9.6 * PX, cabinTop - 2.9 * PX, 19.2 * PX, 1.4 * PX, WOOD.dark)

  // the owl's console: ledge + screen frame, cabin right
  P(cx + 4.2 * PX, cabinFloor - 4.6 * PX, 4.6 * PX, 0.9 * PX, WOOD.dark)
  P(cx + 4.6 * PX, cabinFloor - 9.4 * PX, 4 * PX, 4.4 * PX, '#12101e')
  P(cx + 4.6 * PX, cabinFloor - 9.4 * PX, 4 * PX, 0.5 * PX, OWL.body)
  // coffee, because some rituals survive redesigns
  P(cx - 8.6 * PX, cabinFloor - 1.6 * PX, 1.3 * PX, 1.1 * PX, '#e3000b')
  P(cx - 8.35 * PX, cabinFloor - 1.95 * PX, 0.8 * PX, 0.4 * PX, '#7a4a2b')
}

function drawConsoleScreen(ctx: CanvasRenderingContext2D, cx: number, groundY: number,
                           active: boolean, t: number) {
  const { cabinFloor } = towerGeometry(cx, groundY)
  const sx = cx + 4.9 * PX, sy = cabinFloor - 9 * PX
  ctx.fillStyle = active ? '#0d1f16' : '#0d0b16'
  ctx.fillRect(sx, sy, 3.4 * PX, 3.6 * PX)
  if (active) {
    for (let i = 0; i < 4; i++) {
      const lineT = (t * 2 + i * 0.9) % 3.6
      const w = (1 + ((i * 37 + Math.floor(t)) % 3)) * PX * 0.7
      if (lineT < 3.2) {
        ctx.fillStyle = i % 3 === 0 ? OWL.body : GO
        ctx.fillRect(sx + 1, sy + 2 + lineT * 4, w, 2)
      }
    }
  }
}

/** The beacon — Claude's status, readable from across the range. */
function drawBeacon(ctx: CanvasRenderingContext2D, cx: number, groundY: number,
                    status: CrewStatus, t: number) {
  const { cabinTop, beaconY } = towerGeometry(cx, groundY)
  const color = STATUS[status]
  ctx.fillStyle = WOOD.dark
  ctx.fillRect(cx - 0.7 * PX, cabinTop - 3 * PX, 1.4 * PX, 1.6 * PX)
  ctx.fillStyle = WOOD.frame
  ctx.fillRect(cx - 1.6 * PX, beaconY - 1.4 * PX, 3.2 * PX, 2.4 * PX)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx, beaconY, 3.2, 0, Math.PI * 2)
  ctx.fill()
  const halo = ctx.createRadialGradient(cx, beaconY, 1, cx, beaconY, 26)
  halo.addColorStop(0, color + 'aa')
  halo.addColorStop(1, 'transparent')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(cx, beaconY, 26, 0, Math.PI * 2)
  ctx.fill()
  // sweeping beams — lazy when idle, urgent when working
  const speed = status === 'working' ? 0.9 : status === 'thinking' ? 0.45 : 0.18
  const len = 260
  const spread = 0.16
  for (const offset of [0, Math.PI]) {
    const angle = (t * speed + offset) % (Math.PI * 2)
    ctx.save()
    ctx.translate(cx, beaconY)
    ctx.rotate(angle)
    const beam = ctx.createLinearGradient(0, 0, len, 0)
    beam.addColorStop(0, color + '3d')
    beam.addColorStop(1, 'transparent')
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

// ── The watch-owl ────────────────────────────────────────────────────────────
// Round blob + ear tufts: the silhouette reads at any size. The gold irises
// do the acting — they track, blink, and point at whatever Claude is doing.

function drawOwl(ctx: CanvasRenderingContext2D, cx: number, groundY: number,
                 status: CrewStatus, t: number, celebrating: boolean, waving: boolean) {
  const { cabinFloor } = towerGeometry(cx, groundY)
  const working = status === 'working'
  const bob = Math.sin(t * (celebrating ? 9 : working ? 5 : 1.4)) * (celebrating ? 3 : 1.2)
  const ox = cx - 1.5 * PX
  const oy = cabinFloor - 0.4 * PX + bob
  const W = 11 * PX, H = 12.5 * PX
  const bx = ox - W / 2, by = oy - H
  const tilt = status === 'thinking' ? Math.sin(t * 1.1) * 1.6 : 0   // the head-cock

  // perch glow
  const grd = ctx.createRadialGradient(ox, oy + 4, 2, ox, oy + 4, 48)
  grd.addColorStop(0, OWL.glow)
  grd.addColorStop(1, 'transparent')
  ctx.fillStyle = grd
  ctx.beginPath()
  ctx.ellipse(ox, oy + 3, 48, 9, 0, 0, Math.PI * 2)
  ctx.fill()

  // body blob
  ctx.fillStyle = OWL.body
  ctx.beginPath()
  ctx.roundRect(bx, by, W, H, 14)
  ctx.fill()
  // ear tufts
  ctx.beginPath()
  ctx.moveTo(bx + 6 + tilt, by + 6)
  ctx.lineTo(bx + 13 + tilt, by - 7)
  ctx.lineTo(bx + 19 + tilt, by + 4)
  ctx.moveTo(bx + W - 6 + tilt, by + 6)
  ctx.lineTo(bx + W - 13 + tilt, by - 7)
  ctx.lineTo(bx + W - 19 + tilt, by + 4)
  ctx.fill()

  // wings
  ctx.fillStyle = OWL.shade
  if (celebrating) {
    for (const s of [-1, 1] as const) {
      ctx.save()
      ctx.translate(ox + s * (W / 2 - 2), by + H * 0.45)
      ctx.rotate(s * -0.9)
      ctx.beginPath()
      ctx.roundRect(-3, -H * 0.62, 7, H * 0.62, 4)
      ctx.fill()
      ctx.restore()
    }
  } else if (waving) {
    const wig = Math.sin(t * 11) * 0.35
    ctx.save()
    ctx.translate(ox + W / 2 - 2, by + H * 0.42)
    ctx.rotate(-1.1 + wig)
    ctx.beginPath()
    ctx.roundRect(-3, -H * 0.58, 7, H * 0.58, 4)
    ctx.fill()
    ctx.restore()
    ctx.beginPath()
    ctx.roundRect(bx - 1.5, by + H * 0.3, 5, H * 0.55, 4)
    ctx.fill()
  } else if (working) {
    const dip = Math.sin(t * 13) > 0 ? 2 : 0
    ctx.beginPath()
    ctx.roundRect(bx - 1.5, by + H * 0.3, 5, H * 0.55, 4)
    ctx.fill()
    ctx.save()
    ctx.translate(ox + W / 2 - 3, by + H * 0.52 + dip * 0.4)
    ctx.rotate(0.9)
    ctx.beginPath()
    ctx.roundRect(-2.5, 0, 6, H * 0.5, 4)
    ctx.fill()
    ctx.restore()
  } else {
    for (const s of [-1, 1] as const) {
      ctx.beginPath()
      ctx.roundRect(ox + s * (W / 2 - 3.5) - 2.5, by + H * 0.3, 5, H * 0.58, 4)
      ctx.fill()
    }
  }

  // belly patch with chevrons
  ctx.fillStyle = OWL.belly
  ctx.beginPath()
  ctx.roundRect(bx + W * 0.26, by + H * 0.42, W * 0.48, H * 0.5, 10)
  ctx.fill()
  ctx.strokeStyle = OWL.bellyShade
  ctx.lineWidth = 1.4
  for (let r = 0; r < 3; r++) {
    const yy = by + H * 0.55 + r * 7
    ctx.beginPath()
    for (let k = 0; k < 3; k++) {
      const xx = bx + W * 0.32 + k * 8
      ctx.moveTo(xx, yy)
      ctx.lineTo(xx + 3, yy + 3)
      ctx.lineTo(xx + 6, yy)
    }
    ctx.stroke()
  }

  // THE EYES — golden irises, the namesake
  const eyeY = by + H * 0.27
  const gazeX = working ? 1.2 : status === 'thinking' ? Math.sin(t * 0.9) * 1.4 : Math.sin(t * 0.5) * 0.8
  const gazeY = working ? 1.2 : status === 'thinking' ? -0.8 : 0.2
  const blink = (t % 4.3) > 4.14
  for (const s of [-1, 1] as const) {
    const ex = ox + s * W * 0.21 + tilt
    ctx.fillStyle = OWL.belly
    ctx.beginPath()
    ctx.arc(ex, eyeY, 8.6, 0, Math.PI * 2)
    ctx.fill()
    if (blink) {
      ctx.fillStyle = OWL.shade
      ctx.beginPath()
      ctx.arc(ex, eyeY, 7.2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillStyle = OWL.iris
      ctx.beginPath()
      ctx.arc(ex, eyeY, 5.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = OWL.pupil
      ctx.beginPath()
      ctx.arc(ex + gazeX * 0.6 * s + gazeX * 0.4, eyeY + gazeY, 2.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillRect(ex - 1.5 + gazeX * 0.4, eyeY - 3.4, 1.6, 1.6)
    }
  }
  // beak
  ctx.fillStyle = OWL.beak
  ctx.beginPath()
  ctx.moveTo(ox - 3 + tilt, eyeY + 6.5)
  ctx.lineTo(ox + 3 + tilt, eyeY + 6.5)
  ctx.lineTo(ox + tilt, eyeY + 12)
  ctx.closePath()
  ctx.fill()

  // talons gripping the platform
  ctx.fillStyle = OWL.beak
  for (const s of [-1, 1] as const) {
    for (let k = 0; k < 3; k++) {
      ctx.fillRect(ox + s * W * 0.18 - 3 + k * 3, oy - 1, 2, 4)
    }
  }
}

function drawThoughtDots(ctx: CanvasRenderingContext2D, cx: number, groundY: number, t: number) {
  const { cabinTop } = towerGeometry(cx, groundY)
  const y = cabinTop - 14
  for (let i = 0; i < 3; i++) {
    const phase = Math.sin(t * 4 - i * 0.9)
    ctx.globalAlpha = 0.35 + Math.max(0, phase) * 0.65
    ctx.fillStyle = OWL.body
    ctx.fillRect(cx - 26 + i * 12, y - Math.max(0, phase) * 4, 6, 6)
  }
  ctx.globalAlpha = 1
}

function drawWaitingMark(ctx: CanvasRenderingContext2D, cx: number, groundY: number, t: number) {
  const { cabinTop } = towerGeometry(cx, groundY)
  const y = cabinTop - 16 + Math.sin(t * 5) * 3
  ctx.fillStyle = STATUS.waiting
  ctx.fillRect(cx - 20, y - 12, 5, 9)
  ctx.fillRect(cx - 20, y + 1, 5, 4)
}

// ── The range floor — prairie grass in perspective, a fence at the edge ─────

function drawRange(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number) {
  ctx.fillStyle = 'rgba(148,144,170,0.05)'
  ctx.fillRect(0, groundY + 2, w, h - groundY)
  for (let row = 0; row < 7; row++) {
    const yy = groundY + 14 + row * row * 5.5
    if (yy > h) break
    const scale = 1 + row * 0.35
    const spacing = 34 * scale
    const offset = (row % 2) * spacing * 0.5
    ctx.strokeStyle = `rgba(148,144,170,${0.11 - row * 0.012})`
    ctx.lineWidth = 1.6
    for (let x = -offset; x < w + spacing; x += spacing) {
      const jitter = ((x * 7 + row * 13) % 11) - 5
      const gx = x + jitter
      const gh = 3.2 * scale
      ctx.beginPath()
      ctx.moveTo(gx, yy); ctx.lineTo(gx - 0.8 * scale, yy - gh)
      ctx.moveTo(gx, yy); ctx.lineTo(gx + 0.4, yy - gh * 1.25)
      ctx.moveTo(gx, yy); ctx.lineTo(gx + 0.8 * scale, yy - gh * 0.8)
      ctx.stroke()
    }
  }
  // fence line at the right edge of the range
  const fy = groundY + 8
  ctx.strokeStyle = 'rgba(148,144,170,0.14)'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(w * 0.72, fy)
  ctx.lineTo(w * 0.99, fy + 3)
  ctx.stroke()
  for (let i = 0; i < 6; i++) {
    const fx = w * (0.73 + i * 0.052)
    ctx.beginPath()
    ctx.moveTo(fx, fy + i * 0.5)
    ctx.lineTo(fx, fy - 7 + i * 0.4)
    ctx.stroke()
  }
}

function drawHorizon(ctx: CanvasRenderingContext2D, w: number, groundY: number,
                     glow: [string, string]) {
  const grd = ctx.createLinearGradient(0, groundY - 120, 0, groundY + 6)
  grd.addColorStop(0, glow[1])
  grd.addColorStop(1, glow[0])
  ctx.fillStyle = grd
  ctx.fillRect(0, groundY - 120, w, 126)
}

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
                       market: { is_open: boolean; seconds_to_change: number; et: string } | null,
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
  ctx.fillStyle = '#1b1928'
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

  // orbit trace
  const ox = bx + bw * 0.55, ow = bw * 0.4, oy = by + 30, oh = 26
  ctx.strokeStyle = 'rgba(148,144,170,0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 0; i <= ow; i += 3) {
    const yy = oy + Math.sin((i / ow) * Math.PI * 2) * oh * 0.5
    i === 0 ? ctx.moveTo(ox + i, yy) : ctx.lineTo(ox + i, yy)
  }
  ctx.stroke()
  const p = (t * 0.07) % 1
  ctx.fillStyle = open ? GOLD : INK.dim
  ctx.beginPath()
  ctx.arc(ox + p * ow, oy + Math.sin(p * Math.PI * 2) * oh * 0.5, 3, 0, Math.PI * 2)
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
      borderTop: `2px solid ${OWL.body}`,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 32px -16px rgba(0,0,0,0.45)',
      zIndex: 5,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 15, letterSpacing: '0.14em', color: OWL.body, textTransform: 'uppercase', fontWeight: 700 }}>
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
        {member.activity ?? 'perched, watching the range'}
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
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
      padding: '10px 0 6px',
      background: 'rgba(9,7,15,0.72)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: PANEL_BORDER,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px 8px', borderBottom: '1px solid rgba(150,146,172,0.10)', flexShrink: 0 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.22em', color: INK.dim, textTransform: 'uppercase' }}>
          Ops log — live
        </span>
        <span style={{ display: 'flex', gap: 4 }}>
          {OPS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setOpsFilter(f)}
              style={{
                background: 'none', padding: '1px 6px', cursor: 'pointer',
                border: `1px solid ${filter === f ? 'rgba(150,146,172,0.4)' : 'transparent'}`,
                color: filter === f ? OWL.body : INK.dim,
                fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase',
              }}
            >
              {f}
            </button>
          ))}
        </span>
      </div>
      <div style={{ padding: '6px 0', overflowY: 'auto', minHeight: 0 }}>
        {events.length === 0 && (
          <div style={{ padding: '10px 14px', fontSize: 11, color: INK.dim }}>
            waiting for Claude activity…
          </div>
        )}
        {events.slice(0, 60).map((e) => (
          <div key={e.id} style={{ display: 'flex', gap: 8, padding: '3px 14px', alignItems: 'baseline' }}>
            <span style={{ fontSize: 9, color: INK.dim, fontVariantNumeric: 'tabular-nums', fontFamily: '"Fira Code", monospace', flexShrink: 0 }}>
              {new Date(e.ts).toLocaleTimeString([], { hour12: false })}
            </span>
            <span style={{ color: OWL.body, fontSize: 10, flexShrink: 0 }}>{KIND_GLYPH[e.kind] ?? '·'}</span>
            <span style={{
              fontSize: 11, color: INK.soft,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              fontFamily: '"Fira Code", monospace',
            }}>
              {e.text}
            </span>
          </div>
        ))}
      </div>
    </div>
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

  // click routing: owl/tower -> wing-wave; GO/NO-GO cell -> detail popover
  const handleStageClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const r = canvas.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    const w = canvas.width, groundY = canvas.height * 0.66

    const ax = w * CLAUDE_X
    const { cabinTop } = towerGeometry(ax, groundY)
    if (Math.abs(x - ax) < 62 && y > cabinTop - 30 && y < groundY + 12) {
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

  // finished turns -> sparks
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

    const sparks: Spark[] = []
    let raf: number
    const frame = () => {
      const t = performance.now() / 1000
      const now = Date.now()
      const w = canvas.width, h = canvas.height
      const groundY = h * 0.66
      const state = useDashboardStore.getState()
      ctx.clearRect(0, 0, w, h)
      ctx.imageSmoothingEnabled = false

      drawHorizon(ctx, w, groundY, PHASES[getPhase(state.trading?.market)].stageGlow)
      drawRange(ctx, w, h, groundY)
      drawPlaques(ctx, w, groundY)

      const member = state.crew.claude
      const status: CrewStatus = member?.status ?? 'idle'
      const cx = w * CLAUDE_X

      // beacon sweeps BEHIND the board — light across the range
      drawBeacon(ctx, cx, groundY, status, t)

      const latest = state.crewEvents[0]
      const alert = state.trading?.alerts?.length
        ? state.trading.alerts[state.trading.alerts.length - 1]
        : ''
      drawWallBoard(
        ctx, w, groundY, t,
        buildBoardCells(state),
        state.trading?.market ?? null,
        latest ? `claude: ${latest.text}` : alert,
      )

      const cel = celebrateRef.current
      const celebrating = !!cel && cel.until > now
      const waving = waveRef.current > now
      if (cel && celebrating && !cel.spawned) {
        const { cabinFloor } = towerGeometry(cx, groundY)
        spawnSparks(sparks, cx, cabinFloor - 40)
        cel.spawned = true
      }
      drawTower(ctx, cx, groundY)
      drawConsoleScreen(ctx, cx, groundY, status === 'working', t)
      drawOwl(ctx, cx, groundY, status, t, celebrating, waving)
      if (!celebrating && status === 'thinking') drawThoughtDots(ctx, cx, groundY, t)
      if (!celebrating && status === 'waiting') drawWaitingMark(ctx, cx, groundY, t)

      stepSparks(ctx, sparks, groundY)
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
