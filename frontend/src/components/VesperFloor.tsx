// The stage: WARM EMBER TERRARIUM A — a night cutaway in three tiers.
//
//   3F  the hall: strategy desk, gold plaque, ELEVATOR RFC, the hall meet
//   2F  systems: build with tablet, the elevator, the Chief with the
//       Nightbell and the brief binder
//   1F  PIT PATROL: KERNEL · LIVE · PAPER in a row, locker, charts,
//       paper stack, the orange floor emblem
//
// Every glow is telemetry: the banner follows the doctor's truth, lamps
// follow artifacts, the patrol follows the live heartbeat, the RFC packet
// rides the elevator only when a real RFC lands. Quiet is a state here.
//
// Art lock: flat cozy painted vectors. Espresso/mahogany rooms, warm
// ivory-cream robots with round amber-gold eyes, one copper-red Chief,
// candle-warm light. No steel, no neon, no crowd.

import { useEffect, useRef, useState } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { getPhase } from '../theme'
import { MONO } from '../ui'

interface DeskSeat {
  name: string
  status: string
  ran_at: string | null
}

export interface CompanyStatus {
  strategy_at: string | null
  strategy_verdict: string | null
  build_at: string | null
  rfcs: { name: string; verdict: string | null; at: string }[]
}
interface Doctor {
  line: string | null
  green: boolean | null
}

// ── composition ──────────────────────────────────────────────────────────────
const FRAME = { x: 0.045, y: 0.012, w: 0.91, h: 0.976, r: 26 }
const BANNER = { x: 0.075, y: 0.045, w: 0.85, h: 0.056 }
const T3 = { top: 0.125, ground: 0.39 }
const T2 = { top: 0.415, ground: 0.675 }
const T1 = { top: 0.7, ground: 0.935 }
const ELEV = { x0: 0.465, x1: 0.585 }
const PATROL = { x0: 0.14, x1: 0.62, period: 19000 }

// ── palette: warm ember ──────────────────────────────────────────────────────
const P = {
  night: '#120a07',
  frame: '#221410',
  frameEdge: '#40281b',
  wallTop: '#241610',
  wallBot: '#2e1d13',
  floorA: '#231610',
  floorB: '#1a100a',
  slab: '#1f140d',
  gold: '#d9a441',
  goldDim: 'rgba(217,164,65,0.55)',
  cream: '#efe3c8',
  creamShade: '#d9c8a6',
  creamDark: '#b8a37f',
  amber: '#f5b84a',
  candle: '#f6c05a',
  bannerWarn: '#a8501e',
  bannerCalm: '#241610',
  red: '#c94f42',
  chiefHi: '#e8544a',
  chiefMid: '#b3232a',
  chiefDk: '#7a1418',
  green: '#7fb069',
  dim: 'rgba(239,227,200,0.45)',
}

type Pose = 'sit' | 'stand' | 'walk' | 'tablet'
interface Actor {
  key: string
  x: number
  y: number
  pose: Pose
  flip?: boolean
  chief?: boolean
  working: boolean
  sleep: boolean
  down: boolean
  bubble: string | null
  tag?: string // pit name bubbles: KERNEL / LIVE / PAPER
  held?: 'candle' | 'clipboard'
}

const ACTIVE_MS = 20 * 60_000
const freshISO = (iso?: string | null) => !!iso && Date.now() - new Date(iso).getTime() < ACTIVE_MS

function doctorCause(line: string | null | undefined): string {
  if (!line) return ''
  const after = line.split(/problem\(s\) — /)[1] ?? line
  return after
    .split(/ — |\(/)[0]
    .trim()
    .slice(0, 46)
}

// ── tiny paint helpers ───────────────────────────────────────────────────────
function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

function candleAt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
  rr(ctx, x - s * 0.5, y - s * 1.6, s, s * 1.6, s * 0.3, P.cream)
  const fl = 0.75 + 0.25 * Math.sin(t / 160 + x)
  ctx.fillStyle = P.candle
  ctx.beginPath()
  ctx.ellipse(x, y - s * 2.05, s * 0.34, s * 0.55 * fl, 0, 0, Math.PI * 2)
  ctx.fill()
  const g = ctx.createRadialGradient(x, y - s * 2, 1, x, y - s * 2, s * 5)
  g.addColorStop(0, `rgba(246,192,90,${0.22 * fl})`)
  g.addColorStop(1, 'rgba(246,192,90,0)')
  ctx.fillStyle = g
  ctx.fillRect(x - s * 5, y - s * 7, s * 10, s * 9)
  // light pools on the floor beneath — candle light lands somewhere
  const pool = ctx.createRadialGradient(x, y + s * 1.2, 1, x, y + s * 1.2, s * 6)
  pool.addColorStop(0, `rgba(246,192,90,${0.1 * fl})`)
  pool.addColorStop(1, 'rgba(246,192,90,0)')
  ctx.fillStyle = pool
  ctx.save()
  ctx.translate(x, y + s * 1.2)
  ctx.scale(1, 0.3)
  ctx.beginPath()
  ctx.arc(0, 0, s * 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function plantAt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, tall = false) {
  rr(ctx, x - s * 0.55, y - s * 0.9, s * 1.1, s * 0.9, s * 0.16, '#5a3a22')
  ctx.fillStyle = '#4f7d46'
  const n = tall ? 5 : 3
  for (let i = 0; i < n; i++) {
    const a = ((i - (n - 1) / 2) * 0.5) / n + Math.PI / 2
    const L = s * (tall ? 2.6 : 1.5) * (0.75 + (0.25 * ((i * 37) % 10)) / 10)
    ctx.beginPath()
    ctx.ellipse(
      x + Math.cos(a) * L * 0.45,
      y - s * 0.9 - Math.sin(a) * L * 0.55,
      s * 0.28,
      L * 0.5,
      Math.PI / 2 - a,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
}

function tableAt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  rr(ctx, x - w / 2, y - h, w, h * 0.16, 3, '#6b4526')
  rr(ctx, x - w * 0.38, y - h + h * 0.16, w * 0.1, h * 0.84, 2, '#54341c')
  rr(ctx, x + w * 0.28, y - h + h * 0.16, w * 0.1, h * 0.84, 2, '#54341c')
}

function crateAt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  rr(ctx, x - s / 2, y - s, s, s, 2, '#5f3d22')
  ctx.strokeStyle = '#4a2e18'
  ctx.lineWidth = 1
  ctx.strokeRect(x - s / 2 + 2, y - s + 2, s - 4, s - 4)
  ctx.beginPath()
  ctx.moveTo(x - s / 2 + 2, y - s + 2)
  ctx.lineTo(x + s / 2 - 2, y - 2)
  ctx.stroke()
}

function bubbleAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  yTop: number,
  text: string,
  S: number,
  small = false,
) {
  ctx.font = `${small ? '' : 'bold '}${Math.max(8, S * (small ? 0.02 : 0.024))}px ${MONO}`
  const tw = ctx.measureText(text).width
  const bw = Math.min(tw + S * 0.045, S * 0.62)
  const bh = S * (small ? 0.042 : 0.05)
  const bx = x - bw / 2
  const by = yTop - bh - S * 0.02
  ctx.save()
  ctx.shadowColor = 'rgba(18,10,6,0.4)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 2
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh, S * 0.016)
  if (!small) {
    ctx.moveTo(x - S * 0.012, by + bh)
    ctx.lineTo(x, by + bh + S * 0.016)
    ctx.lineTo(x + S * 0.012, by + bh)
  }
  ctx.closePath()
  ctx.fillStyle = P.cream
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = P.goldDim
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.fillStyle = '#3b2a1a'
  ctx.textAlign = 'center'
  ctx.fillText(text, x, by + bh * 0.68)
  ctx.textAlign = 'left'
  ctx.restore()
}

function plaqueAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  lines: string[],
  S: number,
  icon?: 'gear' | 'shield',
) {
  const lh = S * 0.026
  const h = lh * lines.length + S * 0.02 + (icon ? S * 0.034 : 0)
  rr(ctx, x - w / 2 - 2, y - 2, w + 4, h + 4, 4, '#54341c')
  rr(ctx, x - w / 2, y, w, h, 3, '#2c1c10')
  ctx.strokeStyle = P.goldDim
  ctx.lineWidth = 1
  ctx.strokeRect(x - w / 2 + 2, y + 2, w - 4, h - 4)
  ctx.textAlign = 'center'
  lines.forEach((ln, i) => {
    ctx.font = `${i === 0 ? 'bold ' : ''}${Math.max(7, S * (i === 0 ? 0.02 : 0.015))}px ${MONO}`
    ctx.fillStyle = i === 0 ? P.gold : P.goldDim
    ctx.fillText(ln, x, y + S * 0.026 + i * lh)
  })
  if (icon) {
    const iy = y + lh * lines.length + S * 0.024
    ctx.strokeStyle = P.goldDim
    ctx.fillStyle = P.goldDim
    if (icon === 'gear') {
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, iy, S * 0.009, 0, Math.PI * 2)
      ctx.stroke()
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(x + Math.cos(a) * S * 0.009, iy + Math.sin(a) * S * 0.009)
        ctx.lineTo(x + Math.cos(a) * S * 0.014, iy + Math.sin(a) * S * 0.014)
        ctx.stroke()
      }
    } else {
      ctx.beginPath()
      ctx.moveTo(x, iy - S * 0.012)
      ctx.lineTo(x + S * 0.011, iy - S * 0.006)
      ctx.lineTo(x + S * 0.011, iy + S * 0.004)
      ctx.lineTo(x, iy + S * 0.014)
      ctx.lineTo(x - S * 0.011, iy + S * 0.004)
      ctx.lineTo(x - S * 0.011, iy - S * 0.006)
      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.textAlign = 'left'
}

// wall sconce: the fixture is always there; the glow obeys the light law
function sconceAt(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, on: boolean) {
  ctx.fillStyle = '#3a281a'
  ctx.fillRect(x - S * 0.003, y, S * 0.006, S * 0.016)
  const sg = ctx.createLinearGradient(x, y - S * 0.028, x, y)
  sg.addColorStop(0, on ? '#8a6a34' : '#4a3826')
  sg.addColorStop(1, on ? '#5f4826' : '#32241610'.slice(0, 7))
  ctx.fillStyle = sg
  ctx.beginPath()
  ctx.moveTo(x - S * 0.012, y - S * 0.028)
  ctx.lineTo(x + S * 0.012, y - S * 0.028)
  ctx.lineTo(x + S * 0.02, y)
  ctx.lineTo(x - S * 0.02, y)
  ctx.closePath()
  ctx.fill()
  if (on) {
    ctx.fillStyle = '#ffe9b8'
    ctx.beginPath()
    ctx.ellipse(x, y - S * 0.002, S * 0.013, S * 0.005, 0, 0, Math.PI * 2)
    ctx.fill()
    const g = ctx.createRadialGradient(x, y + S * 0.01, 1, x, y + S * 0.01, S * 0.09)
    g.addColorStop(0, 'rgba(246,197,110,0.3)')
    g.addColorStop(1, 'rgba(246,197,110,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y + S * 0.01, S * 0.09, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ── the robots: painted cream boxes, big amber eyes, one red chief ──────────
function aoAt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const g = ctx.createRadialGradient(x, y, 1, x, y, w)
  g.addColorStop(0, 'rgba(12,6,2,0.38)')
  g.addColorStop(1, 'rgba(12,6,2,0)')
  ctx.fillStyle = g
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(1, 0.32)
  ctx.beginPath()
  ctx.arc(0, 0, w, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  u: number,
  a: Actor,
  t: number,
) {
  const r = u * 0.075
  const gap = u * 0.105
  if (a.sleep) {
    ctx.strokeStyle = 'rgba(245,184,74,0.5)'
    ctx.lineWidth = Math.max(1.5, u * 0.02)
    for (const sd of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(x + sd * gap, y - r * 0.2, r * 0.8, Math.PI * 0.15, Math.PI * 0.85)
      ctx.stroke()
    }
    return
  }
  const blink = Math.floor((t + x * 13) / 230) % 26 === 0
  const color = a.down ? P.red : P.amber
  for (const sd of [-1, 1]) {
    const ex = x + sd * gap
    // glow halo
    if (!blink) {
      const g = ctx.createRadialGradient(ex, y, 1, ex, y, r * (a.working ? 3.2 : 2.1))
      g.addColorStop(0, a.working ? 'rgba(245,184,74,0.55)' : 'rgba(245,184,74,0.28)')
      g.addColorStop(1, 'rgba(245,184,74,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(ex, y, r * 3.2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(ex, y, r, blink ? r * 0.12 : r, 0, 0, Math.PI * 2)
    ctx.fill()
    if (!blink) {
      // warm core + spec highlight: painted, not flat
      const c = ctx.createRadialGradient(ex - r * 0.25, y - r * 0.25, 1, ex, y, r)
      c.addColorStop(0, '#ffe9b8')
      c.addColorStop(0.5, color)
      c.addColorStop(1, a.down ? '#8a2f28' : '#c07f1e')
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(ex, y, r * 0.92, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath()
      ctx.arc(ex - r * 0.32, y - r * 0.35, r * 0.22, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function shadedBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  base: string,
  hi: string,
  lo: string,
) {
  const g = ctx.createLinearGradient(x, y, x, y + h)
  g.addColorStop(0, hi)
  g.addColorStop(0.45, base)
  g.addColorStop(1, lo)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
  // soft side shadow for volume
  const sg = ctx.createLinearGradient(x + w * 0.62, y, x + w, y)
  sg.addColorStop(0, 'rgba(90,60,30,0)')
  sg.addColorStop(1, 'rgba(90,60,30,0.18)')
  ctx.fillStyle = sg
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

function drawRobot(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  H: number,
  a: Actor,
  t: number,
) {
  const u = H
  const bob = a.working ? Math.sin(t / 420 + x) * u * 0.012 : 0
  const chief = !!a.chief
  const base = chief ? P.chiefMid : P.cream
  const hi = chief ? P.chiefHi : '#faf3e2'
  const lo = chief ? P.chiefDk : '#cdb992'
  ctx.save()
  ctx.translate(x, groundY)
  if (a.flip) ctx.scale(-1, 1)
  aoAt(ctx, 0, 0, u * 0.42)

  const walk = a.pose === 'walk'
  const step = walk ? Math.sin(t / 150) : 0
  // legs + feet
  if (a.pose === 'sit') {
    shadedBox(ctx, -u * 0.21, -u * 0.15, u * 0.17, u * 0.15, u * 0.05, lo, base, lo)
    shadedBox(ctx, u * 0.04, -u * 0.15, u * 0.17, u * 0.15, u * 0.05, lo, base, lo)
  } else {
    for (const [ox, sw] of [
      [-u * 0.175, step * u * 0.05],
      [u * 0.045, -step * u * 0.05],
    ] as const) {
      shadedBox(ctx, ox + sw, -u * 0.2, u * 0.13, u * 0.2, u * 0.04, lo, base, lo)
      shadedBox(ctx, ox + sw - u * 0.01, -u * 0.055, u * 0.15, u * 0.055, u * 0.025, base, hi, lo)
    }
  }
  // torso: gently tapered, shaded
  const torsoY = a.pose === 'sit' ? -u * 0.52 : -u * 0.6
  shadedBox(ctx, -u * 0.25, torsoY - bob, u * 0.5, u * 0.42, u * 0.1, base, hi, lo)
  if (chief) {
    // gold crest badge on the chest — the reference's emblem
    ctx.fillStyle = P.gold
    ctx.beginPath()
    ctx.moveTo(0, torsoY - bob + u * 0.1)
    ctx.lineTo(u * 0.055, torsoY - bob + u * 0.14)
    ctx.lineTo(u * 0.055, torsoY - bob + u * 0.2)
    ctx.lineTo(0, torsoY - bob + u * 0.26)
    ctx.lineTo(-u * 0.055, torsoY - bob + u * 0.2)
    ctx.lineTo(-u * 0.055, torsoY - bob + u * 0.14)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#8a5f1e'
    ctx.beginPath()
    ctx.arc(0, torsoY - bob + u * 0.175, u * 0.02, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // chest seam + small badge light
    ctx.strokeStyle = 'rgba(160,130,90,0.4)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(-u * 0.25, torsoY - bob + u * 0.15)
    ctx.lineTo(u * 0.25, torsoY - bob + u * 0.15)
    ctx.stroke()
    ctx.fillStyle = a.working ? P.amber : P.creamDark
    ctx.beginPath()
    ctx.arc(u * 0.13, torsoY - bob + u * 0.24, u * 0.03, 0, Math.PI * 2)
    ctx.fill()
  }
  // arms
  const armY = torsoY - bob + u * 0.07
  if (a.pose === 'tablet') {
    shadedBox(ctx, -u * 0.34, armY + u * 0.09, u * 0.15, u * 0.09, u * 0.035, base, hi, lo)
    shadedBox(ctx, u * 0.19, armY + u * 0.09, u * 0.15, u * 0.09, u * 0.035, base, hi, lo)
    ctx.save()
    ctx.translate(0, armY + u * 0.13)
    ctx.rotate(-0.12)
    shadedBox(
      ctx,
      -u * 0.17,
      -u * 0.11,
      u * 0.34,
      u * 0.22,
      u * 0.02,
      '#3b2c1c',
      '#4a3a26',
      '#241a10',
    )
    ctx.fillStyle = a.working ? '#6f9460' : '#2c2118'
    ctx.fillRect(-u * 0.145, -u * 0.085, u * 0.29, u * 0.17)
    if (a.working) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      for (let i = 0; i < 3; i++)
        ctx.fillRect(-u * 0.12, -u * 0.06 + i * u * 0.05, u * 0.2, u * 0.014)
    }
    ctx.restore()
  } else {
    const sw = walk ? step * u * 0.06 : 0
    shadedBox(ctx, -u * 0.35 - sw, armY, u * 0.11, u * 0.28, u * 0.05, base, hi, lo)
    shadedBox(ctx, u * 0.24 + sw, armY, u * 0.11, u * 0.28, u * 0.05, base, hi, lo)
    // shoulder joint spheres — the articulated look
    for (const sx2 of [-u * 0.295 - sw, u * 0.295 + sw]) {
      const jg = ctx.createRadialGradient(
        sx2 - u * 0.015,
        armY + u * 0.02,
        1,
        sx2,
        armY + u * 0.035,
        u * 0.055,
      )
      jg.addColorStop(0, hi)
      jg.addColorStop(1, lo)
      ctx.fillStyle = jg
      ctx.beginPath()
      ctx.arc(sx2, armY + u * 0.035, u * 0.055, 0, Math.PI * 2)
      ctx.fill()
    }
    // held props: KERNEL's candle, PAPER's clipboard
    if (a.held === 'candle') {
      const hx = u * 0.33
      const hy = armY + u * 0.24
      rr(ctx, hx - u * 0.02, hy - u * 0.1, u * 0.04, u * 0.1, u * 0.012, P.cream)
      const fl2 = 0.75 + 0.25 * Math.sin(t / 150)
      ctx.fillStyle = P.candle
      ctx.beginPath()
      ctx.ellipse(hx, hy - u * 0.13, u * 0.014, u * 0.024 * fl2, 0, 0, Math.PI * 2)
      ctx.fill()
      const cg2 = ctx.createRadialGradient(hx, hy - u * 0.12, 1, hx, hy - u * 0.12, u * 0.14)
      cg2.addColorStop(0, `rgba(246,192,90,${0.3 * fl2})`)
      cg2.addColorStop(1, 'rgba(246,192,90,0)')
      ctx.fillStyle = cg2
      ctx.beginPath()
      ctx.arc(hx, hy - u * 0.12, u * 0.14, 0, Math.PI * 2)
      ctx.fill()
    } else if (a.held === 'clipboard') {
      ctx.save()
      ctx.translate(u * 0.31, armY + u * 0.18)
      ctx.rotate(-0.15)
      rr(ctx, -u * 0.075, -u * 0.1, u * 0.15, u * 0.2, u * 0.015, '#8a6a3c')
      rr(ctx, -u * 0.062, -u * 0.085, u * 0.124, u * 0.17, u * 0.01, '#efe6cd')
      ctx.fillStyle = 'rgba(90,60,30,0.5)'
      for (let i = 0; i < 3; i++)
        ctx.fillRect(-u * 0.045, -u * 0.055 + i * u * 0.045, u * 0.09, u * 0.012)
      ctx.restore()
    }
  }
  // head: painted DOME with a dark visor band — the reference's helmet look
  const headY = torsoY - bob - u * 0.5
  const hg = ctx.createLinearGradient(0, headY, 0, headY + u * 0.56)
  hg.addColorStop(0, hi)
  hg.addColorStop(0.55, base)
  hg.addColorStop(1, lo)
  ctx.fillStyle = hg
  ctx.beginPath()
  ctx.moveTo(-u * 0.33, headY + u * 0.5)
  ctx.lineTo(-u * 0.33, headY + u * 0.3)
  ctx.arc(0, headY + u * 0.3, u * 0.33, Math.PI, 0)
  ctx.lineTo(u * 0.33, headY + u * 0.5)
  ctx.quadraticCurveTo(u * 0.33, headY + u * 0.56, u * 0.22, headY + u * 0.56)
  ctx.lineTo(-u * 0.22, headY + u * 0.56)
  ctx.quadraticCurveTo(-u * 0.33, headY + u * 0.56, -u * 0.33, headY + u * 0.5)
  ctx.closePath()
  ctx.fill()
  // dome spec highlight
  ctx.fillStyle = 'rgba(255,248,230,0.28)'
  ctx.beginPath()
  ctx.ellipse(-u * 0.12, headY + u * 0.14, u * 0.11, u * 0.055, -0.5, 0, Math.PI * 2)
  ctx.fill()
  // visor band: dark glass slot the eyes glow out of
  const vg2 = ctx.createLinearGradient(0, headY + u * 0.2, 0, headY + u * 0.42)
  vg2.addColorStop(0, chief ? '#1c2b28' : '#221a10')
  vg2.addColorStop(1, chief ? '#0e1715' : '#151009')
  ctx.fillStyle = vg2
  ctx.beginPath()
  ctx.roundRect(-u * 0.26, headY + u * 0.2, u * 0.52, u * 0.22, u * 0.11)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'
  ctx.lineWidth = 1
  ctx.stroke()
  if (chief) {
    // the Chief's visor is dark glass — presence, not eyes (per reference);
    // a faint sweep keeps it readable as glass, red only when down
    const sweep = ctx.createLinearGradient(-u * 0.2, headY + u * 0.2, u * 0.2, headY + u * 0.42)
    sweep.addColorStop(0, 'rgba(120,200,190,0.12)')
    sweep.addColorStop(0.5, 'rgba(120,200,190,0.02)')
    sweep.addColorStop(1, 'rgba(120,200,190,0.08)')
    ctx.fillStyle = sweep
    ctx.beginPath()
    ctx.roundRect(-u * 0.26, headY + u * 0.2, u * 0.52, u * 0.22, u * 0.11)
    ctx.fill()
    if (a.down) {
      ctx.fillStyle = 'rgba(240,113,106,0.55)'
      ctx.fillRect(-u * 0.18, headY + u * 0.29, u * 0.36, u * 0.03)
    }
  } else {
    drawEyes(ctx, 0, headY + u * 0.31, u, a, t)
  }
  // antenna
  ctx.fillStyle = lo
  ctx.fillRect(-u * 0.016, headY - u * 0.055, u * 0.032, u * 0.055)
  ctx.beginPath()
  ctx.arc(0, headY - u * 0.065, u * 0.032, 0, Math.PI * 2)
  ctx.fillStyle = a.working ? P.amber : lo
  ctx.fill()
  if (a.working) {
    const ag = ctx.createRadialGradient(0, headY - u * 0.065, 1, 0, headY - u * 0.065, u * 0.09)
    ag.addColorStop(0, 'rgba(245,184,74,0.5)')
    ag.addColorStop(1, 'rgba(245,184,74,0)')
    ctx.fillStyle = ag
    ctx.beginPath()
    ctx.arc(0, headY - u * 0.065, u * 0.09, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// ── the component ────────────────────────────────────────────────────────────
export default function VesperFloor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const trading = useDashboardStore((s) => s.trading)
  const [seats, setSeats] = useState<DeskSeat[]>([])
  const [company, setCompany] = useState<CompanyStatus | null>(null)
  const [doctor, setDoctor] = useState<Doctor | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => {
      fetch('/api/desk')
        .then((r) => r.json())
        .then((d) => alive && setSeats(d.seats))
        .catch(() => {})
      fetch('/api/company')
        .then((r) => r.json())
        .then((d) => alive && setCompany(d))
        .catch(() => {})
      fetch('/api/home')
        .then((r) => r.json())
        .then((d) => alive && setDoctor(d.doctor ?? null))
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 60_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const dataRef = useRef({ seats, trading, company, doctor })
  dataRef.current = { seats, trading, company, doctor }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0

    const params = new URLSearchParams(window.location.search)
    const frozenMs = Number(params.get('freeze')) || null
    const mailPreview = params.get('mail') === 'test'
    let lastPreview = 0

    interface Packet {
      pts: [number, number][]
      t0: number
      dur: number
      kind: 'rfc' | 'brief'
    }
    const packets: Packet[] = []
    let seenStrategyAt: string | null | undefined
    let seenChiefRan: string | null | undefined
    const elevMid = (ELEV.x0 + ELEV.x1) / 2
    const spawnRfc = (now: number) =>
      packets.length < 2 &&
      packets.push({
        kind: 'rfc',
        t0: now,
        dur: 4200,
        pts: [
          [0.175, T3.ground - 0.1],
          [elevMid, T3.ground - 0.1],
          [elevMid, T2.ground - 0.1],
          [0.31, T2.ground - 0.1],
        ],
      })
    const spawnBrief = (now: number) =>
      packets.length < 2 &&
      packets.push({
        kind: 'brief',
        t0: now,
        dur: 2600,
        pts: [
          [0.84, T2.ground - 0.14],
          [0.985, T2.ground - 0.2],
        ],
      })

    const draw = (rafNow: number) => {
      const now = frozenMs ?? rafNow
      const { seats, trading, company, doctor } = dataRef.current
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = true
      const dw = rect.width
      const dh = rect.height
      const X = (f: number) => f * dw
      const Y = (f: number) => f * dh
      const S = Math.min(dh, dw * 0.62)

      const phase = getPhase(trading?.market)
      const night = phase === 'night'

      // ── outside: deep night, pines, distant lights ──
      ctx.fillStyle = P.night
      ctx.fillRect(0, 0, dw, dh)
      for (const side of [0.018, 0.982]) {
        for (let i = 0; i < 4; i++) {
          const px = side + (side < 0.5 ? 1 : -1) * i * 0.011
          const ph = S * (0.34 - i * 0.05)
          const py = Y(0.55 + i * 0.14)
          ctx.fillStyle = i % 2 ? '#0c130e' : '#101a13'
          for (let tier = 0; tier < 3; tier++) {
            const tw = ph * (0.5 - tier * 0.12)
            const ty = py - ph * 0.35 * tier
            ctx.beginPath()
            ctx.moveTo(X(px), ty - ph * 0.5)
            ctx.lineTo(X(px) - tw, ty)
            ctx.lineTo(X(px) + tw, ty)
            ctx.closePath()
            ctx.fill()
          }
        }
      }
      for (let i = 0; i < 14; i++) {
        const lx = X((i * 0.073 + 0.05) % 1)
        const ly = Y(i % 2 ? 0.03 : 0.985)
        ctx.fillStyle = `rgba(246,192,90,${0.16 + ((i * 31) % 5) * 0.05})`
        ctx.fillRect(lx, ly, 2, 2)
      }

      // ── the shell ──
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.55)'
      ctx.shadowBlur = 30
      rr(ctx, X(FRAME.x), Y(FRAME.y), dw * FRAME.w, dh * FRAME.h, FRAME.r, P.frame)
      ctx.restore()
      ctx.strokeStyle = P.frameEdge
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(
        X(FRAME.x) + 5,
        Y(FRAME.y) + 5,
        dw * FRAME.w - 10,
        dh * FRAME.h - 10,
        FRAME.r - 4,
      )
      ctx.stroke()

      // ── the banner: the doctor's truth ──
      {
        const kill = !!trading?.kill_switch
        const notReady = /NOT READY/i.test(doctor?.line ?? '')
        const degraded = doctor?.green === false
        const noTel = !trading
        const flat =
          (trading?.modes?.live?.open_positions?.length ?? 0) === 0 &&
          (trading?.modes?.paper?.open_positions?.length ?? 0) === 0
        let text: string
        let warn = true
        if (noTel) text = 'TELEMETRY DOWN — NOT A VERDICT'
        else if (kill) text = 'KILL ACTIVE — BUYS HALTED'
        else if (notReady) text = `NOT READY — ${doctorCause(doctor?.line).toUpperCase()}`
        else if (degraded) text = `DEGRADED — ${doctorCause(doctor?.line).toUpperCase()}`
        else {
          warn = false
          text = night && flat ? 'NIGHT WATCH · ALL QUIET' : 'ALL SYSTEMS GO'
        }
        const bx = X(BANNER.x)
        const by = Y(BANNER.y)
        const bw = dw * BANNER.w
        const bh = dh * BANNER.h
        rr(ctx, bx, by, bw, bh, 8, warn ? P.bannerWarn : P.bannerCalm)
        const ix = bx + S * 0.035
        const iy = by + bh / 2
        if (warn) {
          ctx.fillStyle = P.cream
          ctx.beginPath()
          ctx.moveTo(ix, iy - bh * 0.24)
          ctx.lineTo(ix - bh * 0.24, iy + bh * 0.2)
          ctx.lineTo(ix + bh * 0.24, iy + bh * 0.2)
          ctx.closePath()
          ctx.fill()
          ctx.fillStyle = P.bannerWarn
          ctx.font = `bold ${bh * 0.42}px ${MONO}`
          ctx.textAlign = 'center'
          ctx.fillText('!', ix, iy + bh * 0.14)
        } else {
          ctx.fillStyle = P.green
          ctx.beginPath()
          ctx.arc(ix, iy, bh * 0.12, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = warn ? P.cream : P.dim
        ctx.font = `bold ${Math.max(11, bh * 0.46)}px ${MONO}`
        ctx.textAlign = 'left'
        ctx.fillText(text, ix + S * 0.03, iy + bh * 0.16)
        // wifi arcs + signal bars, right side
        const wx2 = bx + bw - S * 0.075
        ctx.strokeStyle = warn ? 'rgba(239,227,200,0.85)' : P.dim
        ctx.lineWidth = Math.max(1.5, bh * 0.06)
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath()
          ctx.arc(wx2, iy + bh * 0.18, bh * 0.13 * i, Math.PI * 1.22, Math.PI * 1.78)
          ctx.stroke()
        }
        ctx.fillStyle = warn ? 'rgba(239,227,200,0.85)' : P.dim
        ctx.beginPath()
        ctx.arc(wx2, iy + bh * 0.18, bh * 0.05, 0, Math.PI * 2)
        ctx.fill()
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(
            bx + bw - S * 0.038 + i * S * 0.009,
            iy + bh * 0.2 - (i + 1) * bh * 0.1,
            S * 0.006,
            (i + 1) * bh * 0.1,
          )
        }
      }

      // ── tiers ──
      for (const T of [T3, T2, T1]) {
        const g = ctx.createLinearGradient(0, Y(T.top), 0, Y(T.ground))
        g.addColorStop(0, P.wallTop)
        g.addColorStop(1, P.wallBot)
        ctx.fillStyle = g
        ctx.fillRect(X(0.08), Y(T.top), dw * 0.84, dh * (T.ground - T.top))
        if (!night) {
          ctx.fillStyle = phase === 'day' ? 'rgba(255,225,170,0.05)' : 'rgba(240,150,80,0.06)'
          ctx.fillRect(X(0.08), Y(T.top), dw * 0.84, dh * (T.ground - T.top))
        }
        // wood paneling: soft vertical seams + a wainscot band
        ctx.strokeStyle = 'rgba(24,13,7,0.5)'
        ctx.lineWidth = 1
        for (let sx = 0.08; sx < 0.92; sx += 0.075) {
          ctx.beginPath()
          ctx.moveTo(X(sx), Y(T.top))
          ctx.lineTo(X(sx), Y(T.ground))
          ctx.stroke()
        }
        ctx.fillStyle = 'rgba(30,17,9,0.75)'
        ctx.fillRect(X(0.08), Y(T.ground - 0.055), dw * 0.84, dh * 0.007)
        ctx.fillStyle = 'rgba(217,164,65,0.12)'
        ctx.fillRect(X(0.08), Y(T.ground - 0.048), dw * 0.84, dh * 0.002)
        // night is dim, not empty: a faint ember haze near each floor
        const haze = ctx.createLinearGradient(0, Y(T.ground - 0.09), 0, Y(T.ground))
        haze.addColorStop(0, 'rgba(246,192,90,0)')
        haze.addColorStop(1, 'rgba(246,192,90,0.08)')
        ctx.fillStyle = haze
        ctx.fillRect(X(0.08), Y(T.ground - 0.09), dw * 0.84, dh * 0.09)
        const fg = ctx.createLinearGradient(0, Y(T.ground - 0.016), 0, Y(T.ground + 0.012))
        fg.addColorStop(0, P.floorA)
        fg.addColorStop(1, P.floorB)
        ctx.fillStyle = fg
        ctx.fillRect(X(0.08), Y(T.ground - 0.016), dw * 0.84, dh * 0.028)
        // thick front slab with a warm top lip — the shelf edge of the diorama
        const sg2 = ctx.createLinearGradient(0, Y(T.ground + 0.012), 0, Y(T.ground + 0.042))
        sg2.addColorStop(0, '#38230f')
        sg2.addColorStop(0.25, '#241608')
        sg2.addColorStop(1, '#170d05')
        ctx.fillStyle = sg2
        ctx.fillRect(X(0.07), Y(T.ground + 0.012), dw * 0.86, dh * 0.03)
        ctx.fillStyle = 'rgba(232,164,78,0.12)'
        ctx.fillRect(X(0.07), Y(T.ground + 0.012), dw * 0.86, 2)
        // large wall panels (the reference's paneled backdrop)
        ctx.strokeStyle = 'rgba(10,5,2,0.35)'
        ctx.lineWidth = 2
        for (let pxw = 0.1; pxw < 0.9; pxw += 0.105) {
          ctx.strokeRect(X(pxw), Y(T.top + 0.03), dw * 0.09, dh * (T.ground - T.top - 0.075))
        }
        // ceiling shadow: rooms are carved, not printed
        const cs = ctx.createLinearGradient(0, Y(T.top), 0, Y(T.top + 0.05))
        cs.addColorStop(0, 'rgba(15,8,4,0.5)')
        cs.addColorStop(1, 'rgba(15,8,4,0)')
        ctx.fillStyle = cs
        ctx.fillRect(X(0.08), Y(T.top), dw * 0.84, dh * 0.05)
      }
      // interior partition walls: left room | center | right room, both upper tiers
      for (const T of [T3, T2]) {
        for (const wx of [0.335, 0.665]) {
          const px5 = X(wx)
          const ww = S * 0.014
          const wg = ctx.createLinearGradient(px5 - ww, 0, px5 + ww, 0)
          wg.addColorStop(0, '#2a190e')
          wg.addColorStop(0.5, '#3f2917')
          wg.addColorStop(1, '#1f120a')
          ctx.fillStyle = wg
          ctx.fillRect(px5 - ww, Y(T.top), ww * 2, dh * (T.ground - T.top + 0.012))
          ctx.fillStyle = 'rgba(217,164,65,0.1)'
          ctx.fillRect(px5 - ww, Y(T.top), 2, dh * (T.ground - T.top))
        }
      }

      // ── the elevator: solid bronze doors, gold plate, warm recess ──
      {
        // shaft recess behind
        ctx.fillStyle = '#1c110a'
        ctx.fillRect(
          X(ELEV.x0) - S * 0.008,
          Y(T3.top),
          dw * (ELEV.x1 - ELEV.x0) + S * 0.016,
          dh * (T2.ground - T3.top + 0.012),
        )
        for (const T of [T3, T2]) {
          const doorW = dw * (ELEV.x1 - ELEV.x0)
          const doorH = dh * (T.ground - T.top) * (T === T3 ? 0.6 : 0.88)
          const dx2 = X(ELEV.x0)
          const dy2 = Y(T.ground) - doorH
          // frame
          rr(
            ctx,
            dx2 - S * 0.008,
            dy2 - S * 0.012,
            doorW + S * 0.016,
            doorH + S * 0.012,
            5,
            '#54341c',
          )
          // solid double doors, warm bronze, panel insets
          const dg = ctx.createLinearGradient(dx2, dy2, dx2, dy2 + doorH)
          dg.addColorStop(0, '#6b4526')
          dg.addColorStop(0.5, '#5a3a20')
          dg.addColorStop(1, '#43290f')
          ctx.fillStyle = dg
          ctx.fillRect(dx2, dy2, doorW, doorH)
          // center seam
          ctx.fillStyle = '#2c1a0c'
          ctx.fillRect(dx2 + doorW / 2 - 1.5, dy2, 3, doorH)
          // panel insets, two per door
          for (const px4 of [dx2 + doorW * 0.08, dx2 + doorW * 0.58]) {
            rr(ctx, px4, dy2 + doorH * 0.08, doorW * 0.34, doorH * 0.38, 3, 'rgba(30,17,8,0.35)')
            rr(ctx, px4, dy2 + doorH * 0.54, doorW * 0.34, doorH * 0.38, 3, 'rgba(30,17,8,0.35)')
          }
          // kick plate + top glint
          ctx.fillStyle = 'rgba(217,164,65,0.18)'
          ctx.fillRect(dx2, dy2 + doorH - S * 0.012, doorW, S * 0.012)
          ctx.fillStyle = 'rgba(255,235,190,0.1)'
          ctx.fillRect(dx2, dy2, doorW, S * 0.008)
          // gold label plate above the doors
          ctx.font = `bold ${Math.max(7, S * 0.015)}px ${MONO}`
          const lt = 'ELEVATOR RFC'
          const lw2 = ctx.measureText(lt).width + S * 0.024
          rr(ctx, X(elevMid) - lw2 / 2, dy2 - S * 0.038, lw2, S * 0.026, 3, '#54341c')
          rr(
            ctx,
            X(elevMid) - lw2 / 2 + 1.5,
            dy2 - S * 0.038 + 1.5,
            lw2 - 3,
            S * 0.026 - 3,
            2,
            P.gold,
          )
          ctx.fillStyle = '#3b240f'
          ctx.textAlign = 'center'
          ctx.fillText(lt, X(elevMid), dy2 - S * 0.038 + S * 0.019)
          ctx.textAlign = 'left'
        }
        // amber R indicator between floors
        const rfcHot = freshISO(company?.strategy_at) || packets.some((p) => p.kind === 'rfc')
        rr(ctx, X(elevMid) - S * 0.026, Y(T2.top) - S * 0.028, S * 0.052, S * 0.022, 3, '#1c110a')
        ctx.fillStyle = rfcHot ? P.amber : '#3a2c1a'
        ctx.beginPath()
        ctx.arc(X(elevMid) - S * 0.011, Y(T2.top) - S * 0.017, S * 0.005, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = `bold ${S * 0.014}px ${MONO}`
        ctx.fillStyle = rfcHot ? P.amber : P.goldDim
        ctx.fillText('R', X(elevMid) + S * 0.004, Y(T2.top) - S * 0.013)
        if (rfcHot) {
          const rg = ctx.createRadialGradient(
            X(elevMid),
            Y(T2.top) + S * 0.012,
            1,
            X(elevMid),
            Y(T2.top) + S * 0.012,
            S * 0.03,
          )
          rg.addColorStop(0, 'rgba(245,184,74,0.5)')
          rg.addColorStop(1, 'rgba(245,184,74,0)')
          ctx.fillStyle = rg
          ctx.beginPath()
          ctx.arc(X(elevMid), Y(T2.top) + S * 0.012, S * 0.03, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // wall sconces: fixtures always present; glow obeys the light law
      sconceAt(ctx, X(0.3), Y(T3.top + 0.05), S, freshISO(company?.strategy_at))
      sconceAt(
        ctx,
        X(0.845),
        Y(T3.top + 0.05),
        S,
        freshISO(company?.strategy_at) && freshISO(company?.build_at),
      )
      sconceAt(ctx, X(0.265), Y(T2.top + 0.05), S, freshISO(company?.build_at))

      // floor label plates, left wall (as the reference draws them)
      plaqueAt(ctx, X(0.115), Y(T3.top + 0.028), S * 0.062, ['3F', 'HALL'], S)
      plaqueAt(ctx, X(0.115), Y(T2.top + 0.028), S * 0.062, ['1F', 'PIT'], S)

      // ── data → actors ──
      const chiefSeat = seats.find((s) => s.name === 'chief')
      const chiefRan = freshISO(chiefSeat?.ran_at)
      const chiefOk = chiefSeat?.status === 'ok'
      const stratOn = freshISO(company?.strategy_at)
      const buildOn = freshISO(company?.build_at)
      const meetOn = stratOn && buildOn
      const liveHb = trading?.modes?.live?.status === 'alive'
      const paperHb = trading?.modes?.paper?.status === 'alive'
      const kill = !!trading?.kill_switch
      const wd = !!trading?.modes?.live?.watchdog_armed || !!trading?.modes?.paper?.watchdog_armed

      {
        const at = company?.strategy_at ?? null
        if (seenStrategyAt === undefined) seenStrategyAt = at
        else if (at && at !== seenStrategyAt) {
          spawnRfc(now)
          seenStrategyAt = at
        }
        const cr = chiefSeat?.ran_at ?? null
        if (seenChiefRan === undefined) seenChiefRan = cr
        else if (cr && cr !== seenChiefRan) {
          spawnBrief(now)
          seenChiefRan = cr
        }
        if (mailPreview && now - lastPreview > 5200) {
          lastPreview = now
          if (Math.floor(now / 5200) % 2) spawnBrief(now)
          else spawnRfc(now)
        }
      }

      const chiefBubble = chiefOk
        ? 'brief sent — floor is yours'
        : company?.strategy_verdict
          ? `strategy: ${company.strategy_verdict.slice(0, 26)}`
          : night
            ? 'night watch — no brief'
            : null

      const actors: Actor[] = [
        {
          key: 'strategy',
          x: 0.155,
          y: T3.ground,
          pose: 'sit',
          working: stratOn,
          sleep: night && !stratOn,
          down: false,
          bubble: stratOn
            ? (company?.strategy_verdict ?? 'writing the RFC').slice(0, 30)
            : night
              ? 'Quiet shift tonight'
              : null,
        },
        {
          key: 'meetA',
          x: 0.72,
          y: T3.ground,
          pose: 'stand',
          working: meetOn,
          sleep: night && !meetOn,
          down: false,
          bubble: meetOn ? 'RFC looks steady.' : null,
        },
        {
          key: 'meetB',
          x: 0.795,
          y: T3.ground,
          pose: 'stand',
          flip: true,
          working: meetOn,
          sleep: night && !meetOn,
          down: false,
          bubble: null,
        },
        {
          key: 'build',
          x: 0.315,
          y: T2.ground,
          pose: 'tablet',
          working: buildOn,
          sleep: night && !buildOn,
          down: false,
          bubble: null,
        },
        {
          key: 'chief',
          x: 0.84,
          y: T2.ground,
          pose: 'stand',
          chief: true,
          flip: true,
          working: chiefRan,
          sleep: night && !chiefRan,
          down: chiefSeat?.status === 'failed',
          bubble: chiefBubble,
        },
        {
          key: 'kernel',
          x: 0.2,
          y: T1.ground,
          pose: 'stand',
          working: wd && !kill,
          sleep: false,
          down: kill,
          bubble: null,
          tag: 'KERNEL',
          held: 'candle',
        },
        {
          key: 'live',
          x: 0.36,
          y: T1.ground,
          pose: liveHb ? 'walk' : 'stand',
          working: liveHb,
          sleep: night && !liveHb,
          down: trading?.modes?.live?.status === 'stale',
          bubble: null,
          tag: 'LIVE',
        },
        {
          key: 'paper',
          x: 0.52,
          y: T1.ground,
          pose: 'stand',
          working: paperHb,
          sleep: night && !paperHb,
          down: trading?.modes?.paper?.status === 'stale',
          bubble: null,
          tag: 'PAPER',
          held: 'clipboard',
        },
      ]

      // ── 3F set dressing ──
      plantAt(ctx, X(0.075), Y(T3.ground), S * 0.032, true)
      {
        const bx = X(0.24)
        const by = Y(T3.ground)
        rr(ctx, bx, by - S * 0.11, S * 0.09, S * 0.11, 3, '#54341c')
        for (let r = 0; r < 2; r++)
          for (let b = 0; b < 4; b++) {
            ctx.fillStyle = ['#8a5a3a', '#4f7d46', '#a8843c', '#6b4526'][(r + b) % 4]
            ctx.fillRect(bx + 4 + b * S * 0.02, by - S * 0.1 + r * S * 0.055, S * 0.014, S * 0.045)
          }
      }
      aoAt(ctx, X(0.175), Y(T3.ground), S * 0.1)
      tableAt(ctx, X(0.175), Y(T3.ground), S * 0.14, S * 0.062)
      rr(ctx, X(0.175) - S * 0.028, Y(T3.ground) - S * 0.095, S * 0.05, S * 0.034, 2, '#3b2c1c')
      ctx.fillStyle = freshISO(company?.strategy_at) ? '#5a7d52' : '#241a12'
      ctx.fillRect(X(0.175) - S * 0.024, Y(T3.ground) - S * 0.09, S * 0.042, S * 0.024)
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = ['#e8c94a', '#d9a441', '#c9a26b'][i]
        ctx.fillRect(X(0.115 + i * 0.024), Y(T3.top + 0.05), S * 0.016, S * 0.016)
      }
      // the strategy map: parchment, a route, a pin
      {
        const mx = X(0.262)
        const my = Y(T3.top + 0.038)
        const mw = S * 0.055
        const mh = S * 0.046
        rr(ctx, mx - 3, my - 3, mw + 6, mh + 6, 2, '#54341c')
        rr(ctx, mx, my, mw, mh, 1, '#e6d9b8')
        ctx.strokeStyle = '#b8a37f'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(mx + mw * 0.12, my + mh * 0.75)
        ctx.bezierCurveTo(
          mx + mw * 0.4,
          my + mh * 0.2,
          mx + mw * 0.55,
          my + mh * 0.85,
          mx + mw * 0.85,
          my + mh * 0.3,
        )
        ctx.stroke()
        ctx.setLineDash([2, 2])
        ctx.strokeStyle = '#a8501e'
        ctx.beginPath()
        ctx.moveTo(mx + mw * 0.15, my + mh * 0.6)
        ctx.lineTo(mx + mw * 0.8, my + mh * 0.35)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = '#c94f42'
        ctx.beginPath()
        ctx.arc(mx + mw * 0.8, my + mh * 0.35, S * 0.004, 0, Math.PI * 2)
        ctx.fill()
      }
      plaqueAt(
        ctx,
        X(0.5),
        Y(T3.top + 0.03),
        S * 0.24,
        ['TERRARIUM A', 'OFFICE · SYSTEMS · GROWTH'],
        S,
      )
      {
        // the 2F door, left of the elevator, with its mini plate
        const doorX = 0.405
        const dwid = S * 0.075
        const dhig = dh * (T3.ground - T3.top) * 0.62
        plaqueAt(ctx, X(doorX), Y(T3.ground) - dhig - S * 0.038, S * 0.045, ['2F'], S)
        rr(ctx, X(doorX) - dwid / 2, Y(T3.ground) - dhig, dwid, dhig, 4, '#241408')
        const dg2 = ctx.createLinearGradient(0, Y(T3.ground) - dhig, 0, Y(T3.ground))
        dg2.addColorStop(0, '#3a2412')
        dg2.addColorStop(1, '#241408')
        ctx.fillStyle = dg2
        ctx.fillRect(X(doorX) - dwid / 2 + 2, Y(T3.ground) - dhig + 2, dwid - 4, dhig - 2)
        ctx.strokeStyle = '#4a2e16'
        ctx.strokeRect(X(doorX) - dwid / 2 + 5, Y(T3.ground) - dhig + 6, dwid - 10, dhig - 10)
        ctx.fillStyle = P.gold
        ctx.beginPath()
        ctx.arc(X(doorX) + dwid * 0.26, Y(T3.ground) - dhig * 0.46, S * 0.006, 0, Math.PI * 2)
        ctx.fill()
      }
      aoAt(ctx, X(0.9), Y(T3.ground), S * 0.07)
      tableAt(ctx, X(0.9), Y(T3.ground), S * 0.09, S * 0.055)
      candleAt(ctx, X(0.885), Y(T3.ground) - S * 0.055, S * 0.012, now)
      plantAt(ctx, X(0.925), Y(T3.ground) - S * 0.055, S * 0.014)
      rr(ctx, X(0.885), Y(T3.top + 0.05), S * 0.055, S * 0.045, 2, '#54341c')
      rr(ctx, X(0.885) + 3, Y(T3.top + 0.05) + 3, S * 0.055 - 6, S * 0.045 - 6, 1, '#e8dfc8')
      plantAt(ctx, X(0.885) + S * 0.028, Y(T3.top + 0.05) + S * 0.038, S * 0.006)
      if (freshISO(company?.strategy_at)) {
        rr(ctx, X(0.905), Y(T3.ground) - S * 0.062, S * 0.028, S * 0.018, 2, '#e8c94a')
      }

      // ── 2F set dressing ──
      plaqueAt(ctx, X(0.185), Y(T2.top + 0.07), S * 0.14, ['SYSTEMS', 'NEVER SLEEP'], S, 'gear')
      crateAt(ctx, X(0.075), Y(T2.ground), S * 0.045)
      crateAt(ctx, X(0.115), Y(T2.ground), S * 0.034)
      rr(ctx, X(0.24), Y(T2.ground) - S * 0.03, S * 0.05, S * 0.03, 3, '#a8501e')
      rr(ctx, X(0.24) + S * 0.018, Y(T2.ground) - S * 0.038, S * 0.014, S * 0.01, 2, '#7d3a14')
      rr(ctx, X(0.255), Y(T2.top + 0.06), S * 0.045, S * 0.06, 2, '#e8dfc8')
      ctx.strokeStyle = '#5a8a52'
      ctx.lineWidth = 1.4
      for (let i = 0; i < 3; i++) {
        const cy = Y(T2.top + 0.075) + i * S * 0.016
        ctx.beginPath()
        ctx.moveTo(X(0.255) + 4, cy)
        ctx.lineTo(X(0.255) + 8, cy + 4)
        ctx.lineTo(X(0.255) + 14, cy - 3)
        ctx.stroke()
      }
      plaqueAt(
        ctx,
        X(0.775),
        Y(T2.top + 0.05),
        S * 0.16,
        ['CHIEF', 'PAPER & PARCHMENT'],
        S,
        'shield',
      )
      aoAt(ctx, X(0.92), Y(T2.ground), S * 0.075)
      tableAt(ctx, X(0.92), Y(T2.ground), S * 0.095, S * 0.055)
      candleAt(ctx, X(0.9), Y(T2.ground) - S * 0.055, S * 0.011, now)
      rr(ctx, X(0.925), Y(T2.ground) - S * 0.072, S * 0.016, S * 0.017, 2, '#8a5a3a')
      plantAt(ctx, X(0.95), Y(T2.ground) - S * 0.055, S * 0.011)
      rr(ctx, X(0.937), Y(T2.ground) - S * 0.064, S * 0.026, S * 0.009, 1, '#8a2f28')
      rr(ctx, X(0.937), Y(T2.ground) - S * 0.073, S * 0.026, S * 0.009, 1, '#a8433a')
      {
        const tail3 = (trading?.alerts ?? []).slice(-3).join(' ')
        const ringing = /NOT READY|KILL|stranded|SEAT DOWN|stale/i.test(tail3)
        const bx3 = X(0.878)
        const by3 = Y(T2.top + 0.062)
        const br3 = S * 0.014
        const swing = ringing ? Math.sin(now / 130) * 0.3 : 0
        ctx.save()
        ctx.translate(bx3, by3)
        ctx.rotate(swing)
        ctx.strokeStyle = '#54341c'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(0, -br3)
        ctx.lineTo(0, 0)
        ctx.stroke()
        if (ringing) {
          const g3 = ctx.createRadialGradient(0, br3, 1, 0, br3, br3 * 3.4)
          g3.addColorStop(0, 'rgba(240,113,106,0.35)')
          g3.addColorStop(1, 'rgba(240,113,106,0)')
          ctx.fillStyle = g3
          ctx.fillRect(-br3 * 3.4, -br3, br3 * 6.8, br3 * 5)
        }
        ctx.fillStyle = ringing ? '#e8b54a' : '#8a6a34'
        ctx.beginPath()
        ctx.arc(0, br3 * 0.8, br3, Math.PI, 0)
        ctx.lineTo(br3 * 1.12, br3 * 1.6)
        ctx.lineTo(-br3 * 1.12, br3 * 1.6)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = ringing ? '#f0716a' : '#5f4826'
        ctx.beginPath()
        ctx.arc(0, br3 * 1.72, br3 * 0.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // ── 1F: PIT PATROL ──
      plaqueAt(
        ctx,
        X(0.175),
        Y(T1.top + 0.03),
        S * 0.21,
        ['PIT PATROL', 'KERNEL · LIVE · PAPER'],
        S,
      )
      {
        const kx = X(0.115)
        const ky = Y(T1.ground) - S * 0.115
        const kw = S * 0.05
        const kh = S * 0.115
        rr(ctx, kx - 2, ky - 2, kw + 4, kh + 2, 3, '#4a3a2c')
        rr(ctx, kx, ky, kw, kh, 2, '#3a2d20')
        ctx.strokeStyle = '#241a10'
        ctx.strokeRect(kx + 2, ky + 2, kw - 4, kh - 4)
        ctx.fillStyle = '#241a10'
        for (let v = 0; v < 3; v++)
          ctx.fillRect(kx + kw * 0.25, ky + kh * 0.1 + v * kh * 0.07, kw * 0.5, 2)
        const lockC = kill ? P.red : wd ? P.green : P.amber
        ctx.strokeStyle = lockC
        ctx.lineWidth = Math.max(1.5, S * 0.0035)
        ctx.beginPath()
        if (kill)
          ctx.arc(kx + kw / 2 + kw * 0.16, ky + kh * 0.52, kw * 0.15, Math.PI * 0.9, Math.PI * 1.9)
        else ctx.arc(kx + kw / 2, ky + kh * 0.52, kw * 0.15, Math.PI, 0)
        ctx.stroke()
        ctx.fillStyle = lockC
        ctx.fillRect(kx + kw / 2 - kw * 0.18, ky + kh * 0.55, kw * 0.36, kh * 0.12)
      }
      for (let i = 0; i < 2; i++) {
        const cx2 = X(0.315 + i * 0.062)
        const cy2 = Y(T1.top + 0.042)
        rr(ctx, cx2, cy2, S * 0.05, S * 0.036, 2, '#241a10')
        ctx.strokeStyle = liveHb ? '#7fb069' : '#4a3a28'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        for (let px2 = 0; px2 <= 10; px2++) {
          const vx = cx2 + 3 + (px2 * (S * 0.05 - 6)) / 10
          const vy = cy2 + S * 0.026 - Math.abs(Math.sin(px2 * 1.7 + i * 3)) * S * 0.014
          if (px2 === 0) ctx.moveTo(vx, vy)
          else ctx.lineTo(vx, vy)
        }
        ctx.stroke()
      }
      aoAt(ctx, X(0.585), Y(T1.ground), S * 0.065)
      tableAt(ctx, X(0.585), Y(T1.ground), S * 0.08, S * 0.05)
      for (let i = 0; i < 3; i++)
        rr(
          ctx,
          X(0.567),
          Y(T1.ground) - S * 0.056 - i * S * 0.007,
          S * 0.036,
          S * 0.006,
          1,
          '#e8dfc8',
        )
      rr(ctx, X(0.605), Y(T1.ground) - S * 0.068, S * 0.018, S * 0.016, 2, '#8a2f28')
      crateAt(ctx, X(0.685), Y(T1.ground), S * 0.04)
      {
        // the recessed emblem: dark well, glowing ember ring, leaf mark, railing
        const ex = X(0.84)
        const ey = Y(T1.ground) - S * 0.016
        ctx.save()
        ctx.translate(ex, ey)
        ctx.scale(1, 0.4)
        // outer well
        ctx.fillStyle = '#140c07'
        ctx.beginPath()
        ctx.arc(0, 0, S * 0.105, 0, Math.PI * 2)
        ctx.fill()
        // ember ring: radial glow
        const er2 = ctx.createRadialGradient(0, 0, S * 0.03, 0, 0, S * 0.09)
        er2.addColorStop(0, '#3a1c08')
        er2.addColorStop(0.6, '#b45a1e')
        er2.addColorStop(0.8, '#e88a2e')
        er2.addColorStop(1, '#2c1810')
        ctx.fillStyle = er2
        ctx.beginPath()
        ctx.arc(0, 0, S * 0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#1c0f08'
        ctx.beginPath()
        ctx.arc(0, 0, S * 0.05, 0, Math.PI * 2)
        ctx.fill()
        // leaf mark
        ctx.fillStyle = '#e8a84e'
        ctx.beginPath()
        ctx.ellipse(0, -S * 0.008, S * 0.012, S * 0.032, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#e8a84e'
        ctx.lineWidth = 2
        for (const la of [-0.7, 0.7]) {
          ctx.beginPath()
          ctx.ellipse(Math.sin(la) * S * 0.022, S * 0.005, S * 0.008, S * 0.02, la, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.restore()
        // glow rising from the well
        const wg2 = ctx.createRadialGradient(ex, ey, 1, ex, ey, S * 0.11)
        wg2.addColorStop(0, 'rgba(232,138,46,0.14)')
        wg2.addColorStop(1, 'rgba(232,138,46,0)')
        ctx.fillStyle = wg2
        ctx.fillRect(ex - S * 0.11, ey - S * 0.08, S * 0.22, S * 0.1)
        // railing arc behind: thin posts + top rail
        ctx.strokeStyle = '#3a281a'
        ctx.lineWidth = Math.max(1.5, S * 0.004)
        ctx.beginPath()
        ctx.ellipse(ex, ey - S * 0.05, S * 0.1, S * 0.028, 0, Math.PI, 0)
        ctx.stroke()
        for (const rx of [-0.85, -0.4, 0.4, 0.85]) {
          ctx.beginPath()
          ctx.moveTo(ex + rx * S * 0.1, ey - S * 0.05 - Math.sqrt(1 - rx * rx) * S * 0.028)
          ctx.lineTo(ex + rx * S * 0.1, ey - S * 0.008)
          ctx.stroke()
        }
      }
      aoAt(ctx, X(0.93), Y(T1.ground), S * 0.06)
      tableAt(ctx, X(0.93), Y(T1.ground), S * 0.07, S * 0.05)
      candleAt(ctx, X(0.93), Y(T1.ground) - S * 0.05, S * 0.011, now)

      // ── warm cone lamps over working spots ──
      const lampSpots: [number, { top: number; ground: number }, boolean][] = [
        [0.175, T3, stratOn],
        [0.757, T3, meetOn],
        [0.315, T2, buildOn],
        [0.84, T2, chiefRan],
        [0.36, T1, liveHb || paperHb],
      ]
      for (const [lxF, T, on] of lampSpots) {
        const lx = X(lxF)
        rr(ctx, lx - S * 0.03, Y(T.top + 0.012), S * 0.06, dh * 0.007, 2, '#241a10')
        if (on) {
          ctx.fillStyle = '#ffedc4'
          ctx.fillRect(lx - S * 0.026, Y(T.top + 0.018), S * 0.052, dh * 0.005)
          const cone = ctx.createLinearGradient(0, Y(T.top + 0.02), 0, Y(T.ground))
          cone.addColorStop(0, 'rgba(246,197,110,0.2)')
          cone.addColorStop(1, 'rgba(246,197,110,0.015)')
          ctx.fillStyle = cone
          ctx.beginPath()
          ctx.moveTo(lx - S * 0.026, Y(T.top + 0.02))
          ctx.lineTo(lx + S * 0.026, Y(T.top + 0.02))
          ctx.lineTo(lx + S * 0.1, Y(T.ground))
          ctx.lineTo(lx - S * 0.1, Y(T.ground))
          ctx.closePath()
          ctx.fill()
        } else {
          ctx.fillStyle = 'rgba(120,100,80,0.35)'
          ctx.fillRect(lx - S * 0.024, Y(T.top + 0.018), S * 0.048, dh * 0.004)
        }
      }

      // ── actors ──
      const H = S * 0.16
      for (const a of actors) {
        let ax = X(a.x)
        let flip = !!a.flip
        if (a.pose === 'walk') {
          const p = (now % PATROL.period) / PATROL.period
          const goingRight = p < 0.5
          const uu = goingRight ? p * 2 : 1 - (p - 0.5) * 2
          ax = X(PATROL.x0 + (PATROL.x1 - PATROL.x0) * uu)
          flip = !goingRight
        }
        drawRobot(ctx, ax, Y(a.y), a.chief ? H * 1.3 : H, { ...a, flip }, now)
        if (a.tag) bubbleAt(ctx, ax, Y(a.y) - (a.chief ? H * 1.3 : H) * 1.05, a.tag, S, true)
      }
      const plates: [number, number, string][] = [
        [0.155, T3.ground, 'STRATEGY'],
        [0.315, T2.ground, 'BUILD'],
        [0.84, T2.ground, 'CHIEF'],
      ]
      for (const [pxF, pyF, txt] of plates) {
        ctx.font = `bold ${Math.max(7, S * 0.016)}px ${MONO}`
        const w = ctx.measureText(txt).width + S * 0.02
        rr(ctx, X(pxF) - w / 2, Y(pyF) + dh * 0.014, w, S * 0.026, 3, '#54341c')
        rr(ctx, X(pxF) - w / 2 + 1.5, Y(pyF) + dh * 0.014 + 1.5, w - 3, S * 0.026 - 3, 2, P.gold)
        ctx.fillStyle = '#3b240f'
        ctx.textAlign = 'center'
        ctx.fillText(txt, X(pxF), Y(pyF) + dh * 0.014 + S * 0.019)
        ctx.textAlign = 'left'
      }

      // ── one speech bubble at a time ──
      const speakers = actors.filter((a) => a.bubble)
      if (speakers.length) {
        const pick = speakers[Math.floor(now / 5000) % speakers.length]
        const px3 = pick.pose === 'walk' ? X(0.38) : X(pick.x)
        bubbleAt(
          ctx,
          px3,
          Y(pick.y) - (pick.chief ? H * 1.35 : H * 1.02) - S * 0.045,
          pick.bubble as string,
          S,
        )
      }

      // ── packets in flight ──
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i]
        const t = (now - p.t0) / p.dur
        if (t > 1.1) {
          packets.splice(i, 1)
          continue
        }
        const tt = Math.min(1, t)
        const pts = p.pts.map(([fx, fy]) => [X(fx), Y(fy)] as [number, number])
        const segs: number[] = []
        let total = 0
        for (let k = 0; k < pts.length - 1; k++) {
          const L = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1])
          segs.push(L)
          total += L
        }
        const e = tt < 0.5 ? 2 * tt * tt : 1 - (-2 * tt + 2) ** 2 / 2
        let dist = e * total
        let qx = pts[pts.length - 1][0]
        let qy = pts[pts.length - 1][1]
        for (let k = 0; k < segs.length; k++) {
          if (dist <= segs[k]) {
            const f = segs[k] ? dist / segs[k] : 1
            qx = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f
            qy = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f
            break
          }
          dist -= segs[k]
        }
        if (t <= 1) {
          const w = S * 0.03
          ctx.save()
          ctx.shadowColor = 'rgba(10,6,3,0.4)'
          ctx.shadowBlur = 5
          if (p.kind === 'rfc') {
            rr(ctx, qx - w / 2, qy - w * 0.34, w, w * 0.62, 2, '#e8c94a')
            ctx.shadowColor = 'transparent'
            rr(ctx, qx - w / 2, qy - w * 0.34, w * 0.45, w * 0.16, 2, '#d9b433')
          } else {
            rr(ctx, qx - w / 2, qy - w * 0.3, w, w * 0.58, 2, P.cream)
            ctx.shadowColor = 'transparent'
            ctx.strokeStyle = P.goldDim
            ctx.beginPath()
            ctx.moveTo(qx - w / 2, qy - w * 0.3)
            ctx.lineTo(qx, qy + w * 0.05)
            ctx.lineTo(qx + w / 2, qy - w * 0.3)
            ctx.stroke()
          }
          ctx.restore()
        } else {
          const f = (t - 1) / 0.1
          const g = ctx.createRadialGradient(qx, qy, 0, qx, qy, S * 0.04)
          g.addColorStop(0, `rgba(232,201,74,${0.5 * (1 - f)})`)
          g.addColorStop(1, 'rgba(232,201,74,0)')
          ctx.fillStyle = g
          ctx.fillRect(qx - S * 0.04, qy - S * 0.04, S * 0.08, S * 0.08)
        }
      }

      // warm vignette
      const vg = ctx.createRadialGradient(dw / 2, dh * 0.55, dh * 0.3, dw / 2, dh * 0.55, dw * 0.7)
      vg.addColorStop(0, 'rgba(0,0,0,0)')
      vg.addColorStop(1, 'rgba(10,5,2,0.34)')
      ctx.fillStyle = vg
      ctx.fillRect(0, 0, dw, dh)

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', minHeight: 0 }}
    />
  )
}
