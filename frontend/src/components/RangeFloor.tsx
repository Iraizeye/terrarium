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

const GROUND = 0.90
const SPOTS: Record<string, { x: number; y: number; action: Action; flip?: boolean }> = {
  projects:  { x: 0.085, y: GROUND, action: 'sit' },
  premarket: { x: 0.225, y: GROUND, action: 'sit' },
  ops:       { x: 0.365, y: GROUND, action: 'sit' },
  content:   { x: 0.775, y: GROUND, action: 'work' },
  paper:     { x: 0.915, y: GROUND, action: 'sit' },
  chief:     { x: 0.520, y: 0.895, action: 'point' },
  live:      { x: 0.56, y: 0.935, action: 'walk' },
}
const DESK_SEATS = ['projects', 'premarket', 'ops', 'content', 'paper'] as const
const BAY_HALF = 0.068
const WALK = { x0: 0.445, x1: 0.675, y: 0.935, period: 16000 }
// bot height per pose, as a fraction of the scene scale S
const POSE_H: Record<Action, number> = { sit: 0.34, work: 0.34, walk: 0.26, point: 0.42 }

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

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.save()
  ctx.fillStyle = 'rgba(8, 10, 14, 0.34)'
  ctx.beginPath()
  ctx.ellipse(x, y - 2, w * 0.5, w * 0.10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ── the copper crew, drawn in code ───────────────────────────────────────────
// chibi proportions: big head, big eyes, stubby limbs — charm by geometry.

const COPPERS = [
  { hi: '#eeb98c', mid: '#cf9058', dk: '#a06a38' },
  { hi: '#e6ab7a', mid: '#c48350', dk: '#946130' },
  { hi: '#f2c49a', mid: '#d89a64', dk: '#aa7440' },
]
const LINE = 'rgba(52,30,14,0.55)'
const CHAIR = { dark: '#2b3036', mid: '#3a4048', metal: '#8a939c' }

interface BotState { working: boolean; pending: boolean; down: boolean }

function eyeColor(st: BotState): string {
  return st.down ? '#f0716a' : st.pending ? '#e0b34d' : '#8df0c0'
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke = true) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2))
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) { ctx.strokeStyle = LINE; ctx.stroke() }
}

function plate(ctx: CanvasRenderingContext2D, c: typeof COPPERS[0], x: number, y: number, w: number, h: number, r: number) {
  rr(ctx, x, y, w, h, r, c.mid)
  ctx.save()
  ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); ctx.clip()
  ctx.fillStyle = c.hi
  ctx.fillRect(x, y, w, h * 0.24)
  ctx.globalAlpha = 0.5
  ctx.fillStyle = c.dk
  ctx.fillRect(x, y + h * 0.76, w, h * 0.24)
  ctx.restore()
}

function limb(ctx: CanvasRenderingContext2D, c: typeof COPPERS[0], pts: [number, number][], w: number) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = LINE
  ctx.lineWidth = w + 2.5
  ctx.beginPath()
  pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
  ctx.stroke()
  ctx.strokeStyle = c.mid
  ctx.lineWidth = w
  ctx.beginPath()
  pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
  ctx.stroke()
  ctx.lineCap = 'butt'
}

function hand(ctx: CanvasRenderingContext2D, c: typeof COPPERS[0], x: number, y: number, r: number) {
  ctx.fillStyle = c.hi
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = LINE; ctx.stroke()
}

/** big friendly head, bottom of head at yBot (negative up), width w */
function drawHead(ctx: CanvasRenderingContext2D, c: typeof COPPERS[0], u: number, yBot: number, t: number, seed: number, st: BotState) {
  const hw = u * 0.46, hh = u * 0.34
  const topY = yBot - hh
  // antenna
  ctx.strokeStyle = c.dk
  ctx.lineWidth = Math.max(1.2, u * 0.02)
  ctx.beginPath(); ctx.moveTo(0, topY); ctx.lineTo(0, topY - u * 0.07); ctx.stroke()
  const tipOn = st.down ? true : Math.floor((t + seed * 700) / 900) % 2 === 0
  ctx.fillStyle = tipOn ? eyeColor(st) : '#3a4a40'
  ctx.beginPath(); ctx.arc(0, topY - u * 0.088, u * 0.026, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = LINE; ctx.stroke()
  // head + ear bolts
  plate(ctx, c, -hw / 2, topY, hw, hh, u * 0.09)
  rr(ctx, -hw / 2 - u * 0.028, topY + hh * 0.32, u * 0.032, hh * 0.34, u * 0.012, c.dk)
  rr(ctx, hw / 2 - u * 0.004, topY + hh * 0.32, u * 0.032, hh * 0.34, u * 0.012, c.dk)
  // visor fills most of the face
  rr(ctx, -hw / 2 + u * 0.045, topY + hh * 0.18, hw - u * 0.09, hh * 0.52, u * 0.07, '#141b1e')
  // big eyes
  const blink = Math.floor((t + seed * 900) / 190) % 26 === 0
  const ec = eyeColor(st)
  const eyeY = topY + hh * 0.44
  if (st.down) {
    ctx.fillStyle = ec
    ctx.fillRect(-u * 0.115, eyeY - u * 0.008, u * 0.075, u * 0.016)
    ctx.fillRect(u * 0.04, eyeY - u * 0.008, u * 0.075, u * 0.016)
  } else {
    const er = blink ? u * 0.008 : u * 0.042
    ctx.fillStyle = ec
    ctx.beginPath(); ctx.ellipse(-u * 0.085, eyeY, u * 0.042, er, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(u * 0.085, eyeY, u * 0.042, er, 0, 0, Math.PI * 2); ctx.fill()
    if (!blink) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.beginPath(); ctx.arc(-u * 0.098, eyeY - u * 0.014, u * 0.011, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(u * 0.072, eyeY - u * 0.014, u * 0.011, 0, Math.PI * 2); ctx.fill()
    }
  }
  // mouth grill under the visor
  ctx.fillStyle = st.down ? 'rgba(240,113,106,0.7)' : c.dk
  for (const mx of [-u * 0.045, -u * 0.005, u * 0.035]) {
    ctx.fillRect(mx, topY + hh * 0.80, u * 0.024, u * 0.014)
  }
}

function drawTorso(ctx: CanvasRenderingContext2D, c: typeof COPPERS[0], u: number, yTop: number, hgt: number, t: number, seed: number, st: BotState) {
  const w = u * 0.40
  plate(ctx, c, -w / 2, yTop, w, hgt, u * 0.08)
  rr(ctx, -u * 0.10, yTop + hgt * 0.22, u * 0.20, hgt * 0.42, u * 0.035, c.dk)
  const on = st.working && Math.sin(t / 600 + seed * 2) > -0.2
  ctx.fillStyle = st.down ? '#f0716a' : on ? '#8df0c0' : '#3a4a40'
  ctx.beginPath(); ctx.arc(0, yTop + hgt * 0.80, u * 0.022, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = LINE; ctx.stroke()
}

function drawChair(ctx: CanvasRenderingContext2D, u: number) {
  ctx.strokeStyle = CHAIR.metal
  ctx.lineWidth = Math.max(1.5, u * 0.022)
  for (const a of [-1, -0.5, 0, 0.5, 1]) {
    ctx.beginPath(); ctx.moveTo(0, -u * 0.09)
    ctx.lineTo(Math.sin(a) * u * 0.19, -u * 0.015); ctx.stroke()
    ctx.fillStyle = '#20242a'
    ctx.beginPath(); ctx.arc(Math.sin(a) * u * 0.19, -u * 0.012, u * 0.022, 0, Math.PI * 2); ctx.fill()
  }
  ctx.strokeStyle = CHAIR.metal
  ctx.lineWidth = Math.max(2, u * 0.032)
  ctx.beginPath(); ctx.moveTo(0, -u * 0.08); ctx.lineTo(0, -u * 0.30); ctx.stroke()
  rr(ctx, -u * 0.205, -u * 0.66, u * 0.41, u * 0.38, u * 0.07, CHAIR.dark)
  rr(ctx, -u * 0.25, -u * 0.345, u * 0.50, u * 0.075, u * 0.035, CHAIR.mid)
}

function drawSeated(ctx: CanvasRenderingContext2D, c: typeof COPPERS[0], u: number, t: number, seed: number, st: BotState) {
  drawChair(ctx, u)
  const bob = st.working ? Math.sin(t / 420 + seed * 7) * u * 0.008 : 0
  // stubby legs off the seat, feet dangling near the base
  limb(ctx, c, [[-u * 0.10, -u * 0.30], [-u * 0.185, -u * 0.22], [-u * 0.165, -u * 0.055]], u * 0.062)
  limb(ctx, c, [[u * 0.10, -u * 0.30], [u * 0.185, -u * 0.22], [u * 0.165, -u * 0.055]], u * 0.062)
  rr(ctx, -u * 0.225, -u * 0.06, u * 0.12, u * 0.05, u * 0.025, c.dk)
  rr(ctx, u * 0.105, -u * 0.06, u * 0.12, u * 0.05, u * 0.025, c.dk)
  // torso
  drawTorso(ctx, c, u, -u * 0.62 + bob, u * 0.30, t, seed, st)
  // laptop on lap, screen back to us with a mint logo
  rr(ctx, -u * 0.16, -u * 0.475, u * 0.32, u * 0.15, u * 0.025, '#3a4048')
  ctx.fillStyle = '#8df0c0'
  ctx.globalAlpha = st.working ? 0.9 : 0.25
  ctx.beginPath(); ctx.arc(0, -u * 0.40, u * 0.02, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = st.down ? 0.6 : st.pending ? 0.8 : 1
  // arms typing on the laptop rim
  const lt = st.working ? Math.sin(t / 130 + seed * 3) * u * 0.014 : 0
  const rt2 = st.working ? Math.sin(t / 130 + seed * 3 + Math.PI) * u * 0.014 : 0
  limb(ctx, c, [[-u * 0.20, -u * 0.56 + bob], [-u * 0.27, -u * 0.44], [-u * 0.12, -u * 0.345 + lt]], u * 0.052)
  limb(ctx, c, [[u * 0.20, -u * 0.56 + bob], [u * 0.27, -u * 0.44], [u * 0.12, -u * 0.345 + rt2]], u * 0.052)
  hand(ctx, c, -u * 0.105, -u * 0.335 + lt, u * 0.036)
  hand(ctx, c, u * 0.105, -u * 0.335 + rt2, u * 0.036)
  drawHead(ctx, c, u, -u * 0.63 + bob, t, seed, st)
}

function drawStandingPoint(ctx: CanvasRenderingContext2D, c: typeof COPPERS[0], u: number, t: number, seed: number, st: BotState) {
  const sway = st.working ? Math.sin(t / 900 + seed) * u * 0.008 : 0
  limb(ctx, c, [[-u * 0.085, -u * 0.34], [-u * 0.095, -u * 0.055]], u * 0.062)
  limb(ctx, c, [[u * 0.085, -u * 0.34], [u * 0.095, -u * 0.055]], u * 0.062)
  rr(ctx, -u * 0.165, -u * 0.06, u * 0.13, u * 0.05, u * 0.025, c.dk)
  rr(ctx, u * 0.035, -u * 0.06, u * 0.13, u * 0.05, u * 0.025, c.dk)
  rr(ctx, -u * 0.14, -u * 0.375, u * 0.28, u * 0.06, u * 0.03, c.dk)
  drawTorso(ctx, c, u, -u * 0.66 + sway, u * 0.30, t, seed, st)
  // left arm relaxed
  limb(ctx, c, [[-u * 0.20, -u * 0.60 + sway], [-u * 0.245, -u * 0.46], [-u * 0.19, -u * 0.38]], u * 0.052)
  hand(ctx, c, -u * 0.185, -u * 0.37, u * 0.034)
  // right arm up, pointing at the board with a red marker
  const lift = st.working ? Math.sin(t / 700 + seed * 5) * u * 0.018 : 0
  limb(ctx, c, [[u * 0.19, -u * 0.62 + sway], [u * 0.31, -u * 0.76 + lift], [u * 0.43, -u * 0.83 + lift]], u * 0.052)
  hand(ctx, c, u * 0.445, -u * 0.835 + lift, u * 0.036)
  ctx.strokeStyle = '#d84a3a'
  ctx.lineWidth = Math.max(1.5, u * 0.024)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(u * 0.465, -u * 0.85 + lift)
  ctx.lineTo(u * 0.525, -u * 0.90 + lift)
  ctx.stroke()
  ctx.lineCap = 'butt'
  drawHead(ctx, c, u, -u * 0.67 + sway, t, seed, st)
}

function drawWalker(ctx: CanvasRenderingContext2D, c: typeof COPPERS[0], u: number, t: number, seed: number, st: BotState) {
  const step = Math.sin(t / 150 + seed)
  const bob = Math.abs(Math.cos(t / 150 + seed)) * u * 0.022
  limb(ctx, c, [[-u * 0.055, -u * 0.32 - bob], [-u * 0.065 + step * u * 0.10, -u * 0.05]], u * 0.06)
  limb(ctx, c, [[u * 0.055, -u * 0.32 - bob], [u * 0.065 - step * u * 0.10, -u * 0.05]], u * 0.06)
  rr(ctx, -u * 0.125 + step * u * 0.10, -u * 0.055, u * 0.12, u * 0.05, u * 0.025, c.dk)
  rr(ctx, u * 0.005 - step * u * 0.10, -u * 0.055, u * 0.12, u * 0.05, u * 0.025, c.dk)
  rr(ctx, -u * 0.125, -u * 0.355 - bob, u * 0.25, u * 0.055, u * 0.027, c.dk)
  drawTorso(ctx, c, u, -u * 0.63 - bob, u * 0.28, t, seed, st)
  // clipboard held with both hands
  limb(ctx, c, [[-u * 0.185, -u * 0.56 - bob], [-u * 0.185, -u * 0.42 - bob]], u * 0.05)
  limb(ctx, c, [[u * 0.185, -u * 0.56 - bob], [u * 0.185, -u * 0.42 - bob]], u * 0.05)
  rr(ctx, -u * 0.14, -u * 0.50 - bob, u * 0.28, u * 0.18, u * 0.02, '#d9d4c4')
  rr(ctx, -u * 0.045, -u * 0.525 - bob, u * 0.09, u * 0.03, u * 0.012, '#8a939c')
  ctx.strokeStyle = 'rgba(60,60,70,0.5)'
  ctx.lineWidth = 1
  for (const ly of [0.455, 0.415, 0.375]) {
    ctx.beginPath(); ctx.moveTo(-u * 0.105, -u * ly - bob); ctx.lineTo(u * 0.105, -u * ly - bob); ctx.stroke()
  }
  hand(ctx, c, -u * 0.18, -u * 0.41 - bob, u * 0.034)
  hand(ctx, c, u * 0.18, -u * 0.41 - bob, u * 0.034)
  drawHead(ctx, c, u, -u * 0.64 - bob, t, seed, st)
}

function drawBot(
  ctx: CanvasRenderingContext2D,
  x: number, groundY: number, H: number,
  pose: Action, t: number, seed: number,
  st: BotState, flip: boolean,
) {
  const c = COPPERS[seed % COPPERS.length]
  ctx.save()
  ctx.translate(x, groundY)
  if (flip) ctx.scale(-1, 1)
  ctx.globalAlpha = st.down ? 0.6 : st.pending ? 0.8 : 1
  ctx.lineWidth = Math.max(1, H * 0.014)
  if (st.down) ctx.rotate(0.05)
  const u = H
  if (pose === 'walk') drawWalker(ctx, c, u, t, seed, st)
  else if (pose === 'point') drawStandingPoint(ctx, c, u, t, seed, st)
  else drawSeated(ctx, c, u, t, seed, st)
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
  // faint screen grid so an idle panel still reads as glass, not a hole
  ctx.strokeStyle = 'rgba(120,230,160,0.06)'
  ctx.lineWidth = 1
  for (const fy of [0.33, 0.55]) {
    ctx.beginPath(); ctx.moveTo(x + 3, y + h * fy); ctx.lineTo(x + w - 3, y + h * fy); ctx.stroke()
  }
  if (!q) {
    ctx.fillStyle = 'rgba(120,200,160,0.30)'
    ctx.font = `${Math.max(6, h * 0.12)}px ${MONO}`
    ctx.fillText('awaiting tape…', x + w * 0.08, y + h * 0.5)
  }
  if (q) {
    const up = q.move >= 0
    const line = up ? '#56d98f' : '#e0837c'
    const pad = Math.max(3, w * 0.05)
    const series = hist.length > 2 ? hist : [q.last * 0.996, q.last]
    const min = Math.min(...series)
    const max = Math.max(...series)
    const flat = (max - min) < Math.max(0.01, (q.last || 1) * 0.0008)
    const span = flat ? Math.max(0.02, (q.last || 1) * 0.004) : (max - min)
    const base = flat ? (min + max) / 2 - span / 2 : min
    const chartY = y + h * 0.14
    const chartH = h * 0.58
    ctx.beginPath()
    series.forEach((v, i) => {
      const px = x + pad + (i / Math.max(1, series.length - 1)) * (w - pad * 2)
      const py = chartY + chartH - ((v - base) / span) * chartH
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
  const sparkRef = useRef<Record<string, number[]>>({})
  const [seats, setSeats] = useState<DeskSeat[]>([])
  const trading = useDashboardStore(s => s.trading)
  const fleet = useDashboardStore(s => s.fleet)
  const board = useDashboardStore(s => s.board)

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

      const dx = 0, dy = 0, dw = rect.width, dh = rect.height
      const X = (fx: number) => fx * dw
      const Y = (fy: number) => fy * dh
      // sprites keep sane proportions at any aspect
      const S = Math.min(dh, dw * 0.60)
      const phase = getPhase(trading?.market)
      const room = ROOM[phase]

      // ── the room ──
      // wall
      {
        const g = ctx.createLinearGradient(0, Y(0), 0, Y(0.47))
        g.addColorStop(0, room.wallTop)
        g.addColorStop(1, room.wallBot)
        ctx.fillStyle = g
        ctx.fillRect(X(0), Y(0), dw, dh * 0.47)
        if (room.wash) {
          ctx.fillStyle = room.wash
          ctx.fillRect(X(0), Y(0), dw, dh * 0.47)
        }
      }
      // floor
      {
        const g = ctx.createLinearGradient(0, Y(0.47), 0, Y(1))
        g.addColorStop(0, room.floorA)
        g.addColorStop(1, room.floorB)
        ctx.fillStyle = g
        ctx.fillRect(X(0), Y(0.47), dw, dh * 0.53)
        ctx.strokeStyle = 'rgba(0,0,0,0.16)'
        ctx.lineWidth = 1
        for (let i = 1; i < 9; i++) {
          const fy = 0.47 + i * 0.062
          ctx.beginPath()
          ctx.moveTo(X(0), Y(fy))
          ctx.lineTo(X(1), Y(fy))
          ctx.stroke()
        }
        // wall/floor seam
        ctx.fillStyle = 'rgba(0,0,0,0.22)'
        ctx.fillRect(X(0), Y(0.47), dw, dh * 0.008)
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

      // ── cubicles: an office of one's own for every seated bot ──
      const cubTint = room.wash ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.03)'
      for (const key of DESK_SEATS) {
        const bx = SPOTS[key].x
        const left = X(bx - BAY_HALF), right = X(bx + BAY_HALF)
        // back panel
        ctx.fillStyle = room.wallBot
        ctx.fillRect(left, Y(0.505), right - left, dh * 0.425)
        ctx.fillStyle = cubTint
        ctx.fillRect(left, Y(0.505), right - left, dh * 0.425)
        // baseboard inside the bay
        ctx.fillStyle = 'rgba(0,0,0,0.18)'
        ctx.fillRect(left, Y(0.905), right - left, dh * 0.02)
        // pinboard notes (two per bay, colors vary by bay)
        const noteC = ['#d9b24a', '#7fb2d9', '#d97fa0', '#8fd98f']
        const b0 = Math.floor(bx * 23)
        ctx.save()
        ctx.translate(X(bx + BAY_HALF * 0.52), Y(0.545))
        ctx.rotate(-0.04)
        ctx.fillStyle = noteC[b0 % 4]
        ctx.fillRect(0, 0, S * 0.028, S * 0.028)
        ctx.rotate(0.09)
        ctx.fillStyle = noteC[(b0 + 1) % 4]
        ctx.fillRect(S * 0.012, S * 0.036, S * 0.028, S * 0.028)
        ctx.restore()
        // personal touch on the floor corner
        const acc = b0 % 3
        const ax = X(bx - BAY_HALF * 0.62), ay = Y(0.905)
        if (acc === 0) {
          ctx.fillStyle = '#7a5230'
          ctx.fillRect(ax - S * 0.016, ay - S * 0.030, S * 0.032, S * 0.030)
          ctx.fillStyle = '#4f8f4a'
          ctx.beginPath(); ctx.ellipse(ax, ay - S * 0.046, S * 0.024, S * 0.020, 0, 0, Math.PI * 2); ctx.fill()
        } else if (acc === 1) {
          ctx.fillStyle = '#d9d4c4'
          ctx.fillRect(ax - S * 0.020, ay - S * 0.014, S * 0.040, S * 0.014)
          ctx.fillRect(ax - S * 0.017, ay - S * 0.026, S * 0.034, S * 0.012)
        } else {
          ctx.fillStyle = '#b45a4a'
          ctx.fillRect(ax - S * 0.013, ay - S * 0.026, S * 0.026, S * 0.026)
          ctx.fillStyle = '#8a4536'
          ctx.fillRect(ax + S * 0.011, ay - S * 0.020, S * 0.008, S * 0.004)
        }
      }
      // divider walls (drawn after panels so edges are crisp)
      for (const key of DESK_SEATS) {
        const bx = SPOTS[key].x
        for (const side of [-1, 1]) {
          const wx = X(bx + side * BAY_HALF)
          ctx.fillStyle = '#39424c'
          ctx.fillRect(wx - S * 0.007, Y(0.495), S * 0.014, dh * 0.44)
          ctx.fillStyle = 'rgba(255,255,255,0.10)'
          ctx.fillRect(wx - S * 0.007, Y(0.495), S * 0.014, dh * 0.012)
        }
      }
      // the chief's open floor: a rug in front of the board
      {
        ctx.fillStyle = 'rgba(120,90,50,0.35)'
        ctx.beginPath()
        ctx.ellipse(X(0.52), Y(0.925), S * 0.30, dh * 0.035, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(200,160,100,0.25)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
      // corner plants
      for (const fx of [0.022, 0.978]) {
        const px2 = X(fx), py2 = Y(0.955)
        ctx.fillStyle = '#7a5230'
        ctx.fillRect(px2 - S * 0.026, py2 - S * 0.045, S * 0.052, S * 0.045)
        ctx.fillStyle = '#4f8f4a'
        ctx.beginPath(); ctx.ellipse(px2, py2 - S * 0.070, S * 0.040, S * 0.034, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#356534'
        ctx.beginPath(); ctx.ellipse(px2 - S * 0.024, py2 - S * 0.058, S * 0.020, S * 0.018, 0, 0, Math.PI * 2); ctx.fill()
      }

      // ── live tape on the board ──      // ── live tape on the board ──
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

      // bay monitors — each office's screen glows with its robot's status
      for (const key of DESK_SEATS) {
        const st = stations.find(s => s.key === key)
        const spot = SPOTS[key]
        if (!st || !spot) continue
        const mw = S * 0.105, mh = S * 0.085
        const mx = X(spot.x) - BAY_HALF * dw * 0.45 - mw / 2, my = Y(0.535)
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
          for (let i = 0; i <= 14; i++) {
            const px = mx + (i / 14) * mw
            const py = my + mh * 0.62 + Math.sin(now / 260 + i * 0.9 + spot.x * 20) * mh * 0.14
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
          }
          ctx.stroke()
        }
      }

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
        const H = S * POSE_H[s.action]
        const st = { working: s.present && !s.down, pending: s.pending, down: s.down }
        shadow(ctx, x, y, H * 0.55)
        drawBot(ctx, x, y, H, s.action, now, i, st, flip)
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
        const by = Math.max(dy + 6, Y(pick.y) - S * POSE_H[pick.action] * 1.14 - dh * 0.05)
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
  }, [])

  return (
    <div className="floor-frame">
      <canvas ref={canvasRef} />
    </div>
  )
}
