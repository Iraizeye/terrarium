import { useEffect, useRef, useState } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import type { CrewEvent, CrewMember, CrewStatus } from '../types'
import { GOLD, PHASES, getPhase } from '../theme'

// ── Palette ──────────────────────────────────────────────────────────────────

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
const LEGO_YELLOW = '#ffce3a'
const LEGO_YELLOW_SHADE = '#e0a81e'
const BRICK_COLORS = ['#e3000b', '#ffd500', '#0055bf', '#237841', '#ff7e14']

const SKIN = { accent: '#8f5cff', accentShade: '#6a3fd0', glow: 'rgba(143,92,255,0.5)' }
const CLAUDE_X = 0.24 // anchor as fraction of canvas width
const PX = 5

// Wall plaques — versions flown out of this room
const PLAQUES = ['v0.4', 'v0.5', 'v0.6', 'v0.7']

// ── Confetti (finished turns still deserve it) ───────────────────────────────

interface Confetto {
  x: number; y: number; vx: number; vy: number
  w: number; h: number; rot: number; vrot: number
  color: string; life: number
}

function spawnConfetti(pool: Confetto[], cx: number, cy: number) {
  for (let i = 0; i < 42; i++) {
    pool.push({
      x: cx + (Math.random() - 0.5) * 40,
      y: cy - 120 + (Math.random() - 0.5) * 30,
      vx: (Math.random() - 0.5) * 5,
      vy: -Math.random() * 6 - 2,
      w: 5 + Math.random() * 4,
      h: 3 + Math.random() * 3,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.3,
      color: BRICK_COLORS[i % BRICK_COLORS.length],
      life: 1,
    })
  }
}

function stepConfetti(ctx: CanvasRenderingContext2D, pool: Confetto[], groundY: number) {
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

// ── LEGO minifig — Claude, solo shift ────────────────────────────────────────

function drawMinifig(ctx: CanvasRenderingContext2D, cx: number, groundY: number,
                     status: CrewStatus, t: number, celebrating: boolean, waving = false) {
  const working = status === 'working'
  const bobSpeed = celebrating ? 10 : working ? 7 : status === 'thinking' ? 3 : 1.6
  const bobAmp = celebrating ? 4 : working ? 1.2 : 1.6
  const bob = Math.sin(t * bobSpeed) * bobAmp
  const S = PX
  const y0 = groundY + bob * 2

  const Y = (gy: number) => y0 - gy * S
  const rect = (gx: number, gy: number, gw: number, gh: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(Math.round(cx + gx * S), Math.round(Y(gy)), Math.round(gw * S), Math.round(gh * S))
  }
  const X = (gx: number) => cx + gx * S

  const grd = ctx.createRadialGradient(cx, groundY + 4, 2, cx, groundY + 4, 62)
  grd.addColorStop(0, SKIN.glow)
  grd.addColorStop(1, 'transparent')
  ctx.fillStyle = grd
  ctx.beginPath()
  ctx.ellipse(cx, groundY + 4, 62, 13, 0, 0, Math.PI * 2)
  ctx.fill()

  // legs + hip
  rect(-3.6, 6.1, 3.2, 6.1, SKIN.accentShade)
  rect(0.4, 6.1, 3.2, 6.1, SKIN.accentShade)
  rect(-3.6, 0.9, 3.2, 0.9, '#1b1926')
  rect(0.4, 0.9, 3.2, 0.9, '#1b1926')
  rect(-0.35, 6.1, 0.7, 4.8, '#141220')
  rect(-3.9, 7.9, 7.8, 1.8, SKIN.accentShade)

  // torso
  ctx.fillStyle = SKIN.accent
  ctx.beginPath()
  const topW = 6.2 * S / 2, botW = 8.6 * S / 2
  ctx.moveTo(cx - topW, Y(15.3))
  ctx.lineTo(cx + topW, Y(15.3))
  ctx.lineTo(cx + botW, Y(7.9))
  ctx.lineTo(cx - botW, Y(7.9))
  ctx.closePath()
  ctx.fill()
  rect(-1.6, 13.2, 3.2, 2.6, 'rgba(0,0,0,0.30)')
  rect(-1.1, 12.7, 0.9, 0.9, STATUS[status])
  rect(0.25, 12.7, 0.9, 0.9, 'rgba(255,255,255,0.35)')
  rect(-1.4, 16.0, 2.8, 0.7, '#1b1926')

  // arms
  const claw = (px_: number, py: number) => {
    ctx.strokeStyle = LEGO_YELLOW
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.arc(X(px_), Y(py), 3.2, 0.35, Math.PI * 1.45)
    ctx.stroke()
  }
  const phase = Math.sin(t * 13)
  if (celebrating) {
    for (const s of [-1, 1] as const) {
      rect(s * 3.6 - 0.9 + (s < 0 ? -1.8 : 0) + 0.9 * (s < 0 ? 1 : 0), 17.6, 1.8, 3.0, SKIN.accentShade)
      rect(s * 5.0 + (s < 0 ? -1.8 : 0), 20.6, 1.8, 3.2, SKIN.accentShade)
      claw(s * 5.9, 21.4)
    }
  } else if (waving) {
    const wig = Math.sin(t * 12) * 1.1
    rect(2.7, 17.4, 1.8, 2.8, SKIN.accentShade)
    rect(3.4 + wig, 20.6, 1.8, 3.4, SKIN.accentShade)
    claw(4.3 + wig, 21.3)
    rect(-4.5, 15.0, 1.8, 5.4, SKIN.accentShade)
    claw(-3.6, 8.6)
  } else if (working) {
    const dip = phase > 0 ? 0.4 : 0
    rect(2.7, 15.0, 1.8, 2.4, SKIN.accentShade)
    rect(3.0, 12.9 - dip, 3.6, 1.6, SKIN.accentShade)
    claw(7.2, 12.4 - dip)
    rect(-4.5, 15.0, 1.8, 5.4, SKIN.accentShade)
    claw(-3.6, 8.6)
  } else {
    for (const s of [-1, 1] as const) {
      rect(s * 3.6 - 0.9, 15.0, 1.8, 5.4, SKIN.accentShade)
      claw(s * 3.6, 8.6)
    }
  }

  // head
  rect(-2.8, 21.6, 5.6, 5.6, LEGO_YELLOW)
  rect(-2.8, 16.8, 5.6, 0.8, LEGO_YELLOW_SHADE)
  rect(-1.5, 22.9, 3.0, 1.3, LEGO_YELLOW)
  rect(-3.1, 21.9, 6.2, 1.6, SKIN.accent)
  rect(-3.1, 21.9, 0.7, 3.2, SKIN.accent)
  rect(2.4, 21.9, 0.7, 3.2, SKIN.accent)

  // face
  const blink = (t % 4.3) > 4.12
  const eyeTop = 19.9 + (working ? -0.3 : status === 'thinking' ? 0.35 : 0)
  if (!blink) {
    rect(-1.7, eyeTop, 0.85, 0.95, '#20180a')
    rect(0.85, eyeTop, 0.85, 0.95, '#20180a')
  } else {
    rect(-1.7, eyeTop - 0.35, 0.85, 0.3, '#20180a')
    rect(0.85, eyeTop - 0.35, 0.85, 0.3, '#20180a')
  }
  ctx.strokeStyle = '#20180a'
  ctx.lineWidth = 1.8
  ctx.beginPath()
  const grinR = celebrating ? 5.2 : 4.0
  ctx.arc(cx, Y(18.9), grinR, Math.PI * 0.24, Math.PI * 0.76)
  ctx.stroke()
}

// ── Console, floor, plaques ──────────────────────────────────────────────────

function drawConsole(ctx: CanvasRenderingContext2D, cx: number, groundY: number,
                     active: boolean, t: number) {
  const y = groundY - 30 * PX
  const P = (gx: number, gy: number, gw: number, gh: number, c: string) => {
    ctx.fillStyle = c
    ctx.fillRect(Math.round(cx + gx * PX), Math.round(y + gy * PX), gw * PX, gh * PX)
  }
  P(7, 20, 10, 1.6, '#26233a')
  P(7.6, 21.6, 1.4, 8.6, '#1b1928')
  P(15, 21.6, 1.4, 8.6, '#1b1928')
  for (let i = 0; i < 4; i++) P(8 + i * 2.3, 19.5, 1.1, 0.5, '#312d48')
  P(15.2, 18.9, 1.3, 1.1, '#e3000b')
  P(15.45, 18.55, 0.8, 0.4, '#7a4a2b')
  P(8.4, 11, 8, 8, '#12101e')
  P(8.9, 11.5, 7, 7, active ? '#0d1f16' : '#0d0b16')
  P(11.6, 19, 1.6, 1.2, '#1b1928')
  P(8.4, 11, 8, 0.6, SKIN.accent)
  if (active) {
    for (let i = 0; i < 5; i++) {
      const lineT = (t * 2 + i * 0.9) % 4.5
      const w = 2 + ((i * 37 + Math.floor(t)) % 4)
      if (lineT < 4) P(9.3, 12.1 + lineT * 1.3, w, 0.55, i % 3 === 0 ? SKIN.accent : '#79ff98')
    }
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

function drawBaseplate(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number) {
  ctx.fillStyle = 'rgba(148,144,170,0.05)'
  ctx.fillRect(0, groundY + 2, w, h - groundY)
  for (let row = 0; row < 7; row++) {
    const yy = groundY + 14 + row * row * 5.5
    if (yy > h) break
    const scale = 1 + row * 0.35
    const rx = 5 * scale, ry = 1.8 * scale
    const spacing = 46 * scale
    const offset = (row % 2) * spacing * 0.5
    ctx.fillStyle = `rgba(148,144,170,${0.10 - row * 0.011})`
    for (let x = -offset; x < w + spacing; x += spacing) {
      ctx.beginPath()
      ctx.ellipse(x, yy, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
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

function drawThoughtDots(ctx: CanvasRenderingContext2D, cx: number, groundY: number, t: number) {
  const y = groundY - 26 * PX
  for (let i = 0; i < 3; i++) {
    const phase = Math.sin(t * 4 - i * 0.9)
    ctx.globalAlpha = 0.35 + Math.max(0, phase) * 0.65
    ctx.fillStyle = SKIN.accent
    ctx.fillRect(cx - 12 + i * 12, y - Math.max(0, phase) * 4, 6, 6)
  }
  ctx.globalAlpha = 1
}

function drawWaitingMark(ctx: CanvasRenderingContext2D, cx: number, groundY: number, t: number) {
  const y = groundY - 27 * PX + Math.sin(t * 5) * 3
  ctx.fillStyle = STATUS.waiting
  ctx.fillRect(cx - 2, y - 14, 5, 10)
  ctx.fillRect(cx - 2, y, 5, 4)
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

  // header — market clock replaces the old shift timer
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
  ctx.fillStyle = open ? GO : INK.dim
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
      borderTop: `2px solid ${SKIN.accent}`,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 32px -16px rgba(0,0,0,0.45)',
      zIndex: 5,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 15, letterSpacing: '0.14em', color: SKIN.accent, textTransform: 'uppercase', fontWeight: 700 }}>
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
        {member.role} · {member.model}
      </div>
      <div style={{
        marginTop: 7, fontSize: 11.5, color: INK.text, fontFamily: '"Fira Code", monospace',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minHeight: 16,
      }}>
        {member.activity ?? 'standing by'}
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
                color: filter === f ? SKIN.accent : INK.dim,
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
            <span style={{ color: SKIN.accent, fontSize: 10, flexShrink: 0 }}>{KIND_GLYPH[e.kind] ?? '·'}</span>
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

  // click routing: minifig -> wave; GO/NO-GO cell -> detail popover
  const handleStageClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const r = canvas.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    const w = canvas.width, groundY = canvas.height * 0.66

    const ax = w * CLAUDE_X
    if (Math.abs(x - ax) < 60 && y > groundY - 24 * PX - 20 && y < groundY + 12) {
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

  // finished turns -> confetti
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

    const confetti: Confetto[] = []
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
      drawBaseplate(ctx, w, h, groundY)
      drawPlaques(ctx, w, groundY)
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

      const member = state.crew.claude
      const status: CrewStatus = member?.status ?? 'idle'
      const cx = w * CLAUDE_X
      const cel = celebrateRef.current
      const celebrating = !!cel && cel.until > now
      const waving = waveRef.current > now
      if (cel && celebrating && !cel.spawned) {
        spawnConfetti(confetti, cx, groundY)
        cel.spawned = true
      }
      drawConsole(ctx, cx, groundY, status === 'working', t)
      drawMinifig(ctx, cx, groundY, status, t, celebrating, waving)
      if (!celebrating && status === 'thinking') drawThoughtDots(ctx, cx, groundY, t)
      if (!celebrating && status === 'waiting') drawWaitingMark(ctx, cx, groundY, t)

      stepConfetti(ctx, confetti, groundY)
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
      <span style={{ fontSize: 9, letterSpacing: '0.2em', color: INK.dim, flexShrink: 0 }}>LOGBOOK ▸</span>
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
          background: 'none', border: `1px solid ${SKIN.accent}`, color: SKIN.accent,
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
