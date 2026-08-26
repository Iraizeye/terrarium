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
const FRAME = { x: 0.012, y: 0.012, w: 0.976, h: 0.976, r: 26 }
const BANNER = { x: 0.045, y: 0.045, w: 0.91, h: 0.052 }
const T3 = { top: 0.125, ground: 0.39 }
const T2 = { top: 0.415, ground: 0.675 }
const T1 = { top: 0.7, ground: 0.935 }
const ELEV = { x0: 0.445, x1: 0.555 }
const PATROL = { x0: 0.14, x1: 0.62, period: 19000 }

// ── palette: warm ember ──────────────────────────────────────────────────────
const P = {
  night: '#120a07',
  frame: '#2b1a12',
  frameEdge: '#40281b',
  wallTop: '#3b2a1e',
  wallBot: '#4a3526',
  floorA: '#2e1f14',
  floorB: '#271a11',
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
) {
  const lh = S * 0.026
  const h = lh * lines.length + S * 0.02
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
  ctx.textAlign = 'left'
}

// ── the robots: ivory-cream, round amber eyes, one red chief ────────────────
function drawEyes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  u: number,
  a: Actor,
  t: number,
) {
  const r = u * 0.052
  const gap = u * 0.085
  if (a.sleep) {
    ctx.fillStyle = 'rgba(245,184,74,0.35)'
    ctx.fillRect(x - gap - r, y, r * 2, u * 0.012)
    ctx.fillRect(x + gap - r, y, r * 2, u * 0.012)
    return
  }
  const blink = Math.floor((t + x * 13) / 210) % 24 === 0
  const color = a.down ? P.red : P.amber
  if (a.working && !blink) {
    const g = ctx.createRadialGradient(x, y, 1, x, y, r * 3.4)
    g.addColorStop(0, 'rgba(245,184,74,0.5)')
    g.addColorStop(1, 'rgba(245,184,74,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r * 4 - gap, y - r * 4, (r * 4 + gap) * 2, r * 8)
  }
  ctx.fillStyle = color
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(x + s * gap, y, r, blink ? r * 0.15 : r, 0, 0, Math.PI * 2)
    ctx.fill()
  }
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
  const body = a.chief ? P.chiefMid : P.cream
  const bodyHi = a.chief ? P.chiefHi : '#f7eeda'
  const bodyDk = a.chief ? P.chiefDk : P.creamShade
  ctx.save()
  ctx.translate(x, groundY)
  if (a.flip) ctx.scale(-1, 1)
  ctx.fillStyle = 'rgba(10,6,3,0.4)'
  ctx.beginPath()
  ctx.ellipse(0, 0, u * 0.3, u * 0.06, 0, 0, Math.PI * 2)
  ctx.fill()

  const walk = a.pose === 'walk'
  const step = walk ? Math.sin(t / 150) : 0
  if (a.pose === 'sit') {
    rr(ctx, -u * 0.2, -u * 0.16, u * 0.16, u * 0.16, u * 0.04, bodyDk)
    rr(ctx, u * 0.04, -u * 0.16, u * 0.16, u * 0.16, u * 0.04, bodyDk)
  } else {
    rr(ctx, -u * 0.17 + step * u * 0.05, -u * 0.22, u * 0.13, u * 0.22, u * 0.04, bodyDk)
    rr(ctx, u * 0.04 - step * u * 0.05, -u * 0.22, u * 0.13, u * 0.22, u * 0.04, bodyDk)
  }
  const torsoY = a.pose === 'sit' ? -u * 0.5 : -u * 0.58
  rr(ctx, -u * 0.24, torsoY - bob, u * 0.48, u * 0.4, u * 0.09, body)
  rr(ctx, -u * 0.24, torsoY - bob, u * 0.48, u * 0.14, u * 0.09, bodyHi)
  if (a.chief) {
    ctx.fillStyle = P.gold
    ctx.beginPath()
    ctx.moveTo(0, torsoY - bob + u * 0.06)
    ctx.lineTo(-u * 0.045, torsoY - bob + u * 0.2)
    ctx.lineTo(0, torsoY - bob + u * 0.34)
    ctx.lineTo(u * 0.045, torsoY - bob + u * 0.2)
    ctx.closePath()
    ctx.fill()
  } else {
    ctx.fillStyle = P.creamDark
    ctx.beginPath()
    ctx.arc(0, torsoY - bob + u * 0.22, u * 0.035, 0, Math.PI * 2)
    ctx.fill()
  }
  const armY = torsoY - bob + u * 0.06
  if (a.pose === 'tablet') {
    rr(ctx, -u * 0.32, armY + u * 0.1, u * 0.14, u * 0.08, u * 0.03, body)
    rr(ctx, u * 0.18, armY + u * 0.1, u * 0.14, u * 0.08, u * 0.03, body)
    ctx.save()
    ctx.translate(0, armY + u * 0.13)
    ctx.rotate(-0.12)
    rr(ctx, -u * 0.16, -u * 0.1, u * 0.32, u * 0.2, u * 0.02, '#3b2c1c')
    rr(ctx, -u * 0.14, -u * 0.08, u * 0.28, u * 0.16, u * 0.015, a.working ? '#5a7d52' : '#2c2118')
    ctx.restore()
  } else {
    const sw = walk ? step * u * 0.06 : 0
    rr(ctx, -u * 0.335 - sw, armY, u * 0.1, u * 0.26, u * 0.045, body)
    rr(ctx, u * 0.235 + sw, armY, u * 0.1, u * 0.26, u * 0.045, body)
  }
  const headY = torsoY - bob - u * 0.36
  rr(ctx, -u * 0.28, headY, u * 0.56, u * 0.36, u * 0.11, body)
  rr(ctx, -u * 0.28, headY, u * 0.56, u * 0.12, u * 0.11, bodyHi)
  drawEyes(ctx, 0, headY + u * 0.21, u, a, t)
  ctx.fillStyle = bodyDk
  ctx.fillRect(-u * 0.015, headY - u * 0.05, u * 0.03, u * 0.05)
  ctx.beginPath()
  ctx.arc(0, headY - u * 0.06, u * 0.028, 0, Math.PI * 2)
  ctx.fillStyle = a.working ? P.amber : bodyDk
  ctx.fill()
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
          [0.165, T2.ground - 0.1],
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
      for (let i = 0; i < 9; i++) {
        const px = (i * 0.117 + 0.03) % 1
        const ph = S * (0.1 + ((i * 53) % 7) * 0.014)
        const py = i % 2 ? Y(0.06) + ph : Y(0.97)
        ctx.fillStyle = '#0d1410'
        ctx.beginPath()
        ctx.moveTo(X(px), py - ph)
        ctx.lineTo(X(px) - ph * 0.42, py)
        ctx.lineTo(X(px) + ph * 0.42, py)
        ctx.closePath()
        ctx.fill()
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
        ctx.font = `bold ${Math.max(9, bh * 0.36)}px ${MONO}`
        ctx.textAlign = 'left'
        ctx.fillText(text, ix + S * 0.03, iy + bh * 0.13)
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = warn ? 'rgba(239,227,200,0.7)' : P.dim
          ctx.fillRect(
            bx + bw - S * 0.03 - i * S * 0.014,
            iy + bh * 0.16 - (i + 1) * bh * 0.14,
            S * 0.008,
            (i + 1) * bh * 0.14,
          )
        }
      }

      // ── tiers ──
      for (const T of [T3, T2, T1]) {
        const g = ctx.createLinearGradient(0, Y(T.top), 0, Y(T.ground))
        g.addColorStop(0, P.wallTop)
        g.addColorStop(1, P.wallBot)
        ctx.fillStyle = g
        ctx.fillRect(X(0.05), Y(T.top), dw * 0.9, dh * (T.ground - T.top))
        if (!night) {
          ctx.fillStyle = phase === 'day' ? 'rgba(255,225,170,0.05)' : 'rgba(240,150,80,0.06)'
          ctx.fillRect(X(0.05), Y(T.top), dw * 0.9, dh * (T.ground - T.top))
        }
        // wood paneling: soft vertical seams + a wainscot band
        ctx.strokeStyle = 'rgba(24,13,7,0.5)'
        ctx.lineWidth = 1
        for (let sx = 0.05; sx < 0.95; sx += 0.075) {
          ctx.beginPath()
          ctx.moveTo(X(sx), Y(T.top))
          ctx.lineTo(X(sx), Y(T.ground))
          ctx.stroke()
        }
        ctx.fillStyle = 'rgba(30,17,9,0.75)'
        ctx.fillRect(X(0.05), Y(T.ground - 0.055), dw * 0.9, dh * 0.007)
        ctx.fillStyle = 'rgba(217,164,65,0.12)'
        ctx.fillRect(X(0.05), Y(T.ground - 0.048), dw * 0.9, dh * 0.002)
        // night is dim, not empty: a faint ember haze near each floor
        const haze = ctx.createLinearGradient(0, Y(T.ground - 0.09), 0, Y(T.ground))
        haze.addColorStop(0, 'rgba(246,192,90,0)')
        haze.addColorStop(1, 'rgba(246,192,90,0.08)')
        ctx.fillStyle = haze
        ctx.fillRect(X(0.05), Y(T.ground - 0.09), dw * 0.9, dh * 0.09)
        const fg = ctx.createLinearGradient(0, Y(T.ground - 0.016), 0, Y(T.ground + 0.012))
        fg.addColorStop(0, P.floorA)
        fg.addColorStop(1, P.floorB)
        ctx.fillStyle = fg
        ctx.fillRect(X(0.05), Y(T.ground - 0.016), dw * 0.9, dh * 0.028)
        ctx.fillStyle = P.slab
        ctx.fillRect(X(0.05), Y(T.ground + 0.012), dw * 0.9, dh * 0.02)
      }

      // ── the elevator (RFC shaft), 3F + 2F ──
      {
        ctx.fillStyle = '#241812'
        ctx.fillRect(
          X(ELEV.x0),
          Y(T3.top),
          dw * (ELEV.x1 - ELEV.x0),
          dh * (T2.ground - T3.top + 0.012),
        )
        for (const T of [T3, T2]) {
          const doorW = dw * (ELEV.x1 - ELEV.x0) - S * 0.024
          const doorH = dh * (T.ground - T.top) * 0.72
          const dx2 = X(ELEV.x0) + S * 0.012
          const dy2 = Y(T.ground) - doorH
          rr(ctx, dx2, dy2, doorW, doorH, 4, '#3a2417')
          ctx.fillStyle = '#54341c'
          ctx.fillRect(dx2 + doorW / 2 - 1, dy2, 2, doorH)
          ctx.strokeStyle = P.goldDim
          ctx.lineWidth = 1
          ctx.strokeRect(dx2 + 3, dy2 + 3, doorW - 6, doorH - 6)
          ctx.font = `bold ${Math.max(7, S * 0.016)}px ${MONO}`
          ctx.fillStyle = P.goldDim
          ctx.textAlign = 'center'
          ctx.fillText('ELEVATOR RFC', X(elevMid), dy2 - S * 0.012)
          ctx.textAlign = 'left'
        }
        const rfcHot = freshISO(company?.strategy_at) || packets.some((p) => p.kind === 'rfc')
        ctx.fillStyle = rfcHot ? P.amber : '#3a2c1a'
        ctx.beginPath()
        ctx.arc(X(elevMid), Y(T2.top) + S * 0.012, S * 0.009, 0, Math.PI * 2)
        ctx.fill()
      }

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
          x: 0.16,
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
        ctx.bezierCurveTo(mx + mw * 0.4, my + mh * 0.2, mx + mw * 0.55, my + mh * 0.85, mx + mw * 0.85, my + mh * 0.3)
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
        X(0.365),
        Y(T3.top + 0.035),
        S * 0.16,
        ['TERRARIUM A', 'OFFICE · SYSTEMS', 'GROWTH'],
        S,
      )
      {
        const dwid = S * 0.085
        const dhig = dh * (T3.ground - T3.top) * 0.6
        rr(ctx, X(0.365) - dwid / 2, Y(T3.ground) - dhig, dwid, dhig, 4, '#2c1a0f')
        ctx.strokeStyle = '#54341c'
        ctx.strokeRect(X(0.365) - dwid / 2 + 3, Y(T3.ground) - dhig + 3, dwid - 6, dhig - 6)
        ctx.fillStyle = P.gold
        ctx.beginPath()
        ctx.arc(X(0.365) + dwid * 0.28, Y(T3.ground) - dhig * 0.45, S * 0.006, 0, Math.PI * 2)
        ctx.fill()
      }
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
      plaqueAt(ctx, X(0.15), Y(T2.top + 0.035), S * 0.17, ['SYSTEMS NEVER SLEEP'], S)
      {
        const gx = X(0.252)
        const gy = Y(T2.top + 0.052)
        ctx.strokeStyle = P.goldDim
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(gx, gy, S * 0.011, 0, Math.PI * 2)
        ctx.stroke()
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2
          ctx.beginPath()
          ctx.moveTo(gx + Math.cos(a) * S * 0.011, gy + Math.sin(a) * S * 0.011)
          ctx.lineTo(gx + Math.cos(a) * S * 0.017, gy + Math.sin(a) * S * 0.017)
          ctx.stroke()
        }
      }
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
      plaqueAt(ctx, X(0.855), Y(T2.top + 0.035), S * 0.17, ['CHIEF', 'PAPER & PARCHMENT'], S)
      tableAt(ctx, X(0.92), Y(T2.ground), S * 0.095, S * 0.055)
      candleAt(ctx, X(0.9), Y(T2.ground) - S * 0.055, S * 0.011, now)
      rr(ctx, X(0.925), Y(T2.ground) - S * 0.072, S * 0.016, S * 0.017, 2, '#8a5a3a')
      plantAt(ctx, X(0.95), Y(T2.ground) - S * 0.055, S * 0.011)
      rr(ctx, X(0.937), Y(T2.ground) - S * 0.064, S * 0.026, S * 0.009, 1, '#8a2f28')
      rr(ctx, X(0.937), Y(T2.ground) - S * 0.073, S * 0.026, S * 0.009, 1, '#a8433a')
      {
        const tail3 = (trading?.alerts ?? []).slice(-3).join(' ')
        const ringing = /NOT READY|KILL|stranded|SEAT DOWN|stale/i.test(tail3)
        const bx3 = X(0.79)
        const by3 = Y(T2.top + 0.075)
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
        const ex = X(0.84)
        const ey = Y(T1.ground) - S * 0.012
        ctx.save()
        ctx.translate(ex, ey)
        ctx.scale(1, 0.42)
        ctx.fillStyle = '#b45a1e'
        ctx.beginPath()
        ctx.arc(0, 0, S * 0.085, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#d9822e'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(0, 0, S * 0.062, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = '#e8dfc8'
        ctx.beginPath()
        ctx.ellipse(0, -S * 0.01, S * 0.016, S * 0.038, 0.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      tableAt(ctx, X(0.93), Y(T1.ground), S * 0.07, S * 0.05)
      candleAt(ctx, X(0.93), Y(T1.ground) - S * 0.05, S * 0.011, now)

      // ── warm cone lamps over working spots ──
      const lampSpots: [number, { top: number; ground: number }, boolean][] = [
        [0.175, T3, stratOn],
        [0.757, T3, meetOn],
        [0.16, T2, buildOn],
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
        [0.16, T2.ground, 'BUILD'],
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
