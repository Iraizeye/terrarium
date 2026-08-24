// THE TERRARIUM — a closed glass tank. Agents live in the garden.
// Every worker is real: five desk seats from /api/desk plus both trading
// daemons. Pending seats still show (dim, amber) so the crew is visible.
// 480x270 logical canvas, nearest-neighbor scale.

import { useEffect, useRef, useState } from 'react'
import { getPhase, type Phase } from '../theme'
import { useDashboardStore } from '../store/dashboardStore'
import type { BoardState, MarketClock, TradingStatus } from '../types'

const LW = 480
const LH = 270
const MONO = '"JetBrains Mono", "Fira Code", monospace'
const GLASS_L = 22
const GLASS_R = 458
const GLASS_T = 22
const GLASS_B = 236
const SOIL = 206
const BACK_Y = 146
const FRONT_Y = 182

const P = {
  room: '#070d0a',
  wood: '#3a2414', woodD: '#24160c', woodL: '#5a3820',
  brass: '#c4a05a', brassD: '#8a6a32',
  glass: 'rgba(210,240,225,0.07)',
  sheen: 'rgba(230,255,240,0.16)',
  soil: '#3a2a18', soilD: '#24180c', moss: '#3d6a38', mossL: '#5a8f4a',
  gravel: '#6a5a48',
  plant: '#4f8f4a', plantD: '#356534', plantL: '#6fae5c',
  mint: '#7de8a8', red: '#f0716a', amber: '#e0b34d', gold: '#d9a441',
  emerald: '#3ecf9a',
  text: '#eaf0e8', dim: '#93a396', ink: '#141414',
  bubble: '#f2f6ea', board: '#efe9d8', boardTxt: '#3a3a44',
  screenBg: '#0e1410',
  skins: ['#c5d0d6', '#a8b6be', '#8fa0aa', '#7a8b96'],
}

const SKY: Record<Phase, string> = {
  night: '#06120e',
  dawn: '#1c2a16',
  day: '#2e4024',
  dusk: '#1c2414',
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
  skin: string
  accent: string
  x: number
  row: number
  present: boolean
  down: boolean
  pending: boolean
  chip: string
  bubble: string | null
  screen: 'bars' | 'candles' | 'wave' | 'film' | 'list'
  kit: 'scan' | 'dish' | 'cam' | 'lamp' | 'live' | 'paper'
}

const STYLE: Record<string, { shirt: string; screen: Station['screen']; kit: Station['kit']; accent: string }> = {
  premarket: { shirt: '#4a7ab0', screen: 'list', kit: 'scan', accent: '#7eb4e8' },
  ops: { shirt: '#5a9a5a', screen: 'bars', kit: 'dish', accent: '#8fd48f' },
  content: { shirt: '#c05a8a', screen: 'film', kit: 'cam', accent: '#e890b8' },
  projects: { shirt: '#c8a04a', screen: 'list', kit: 'lamp', accent: '#e8c56a' },
  live: { shirt: '#e07050', screen: 'candles', kit: 'live', accent: '#f0a080' },
  paper: { shirt: '#7a9ab0', screen: 'candles', kit: 'paper', accent: '#a8c8d8' },
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

function seeded(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

function shade(hex: string, toward: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]
  const a = parse(hex), b = parse(toward)
  const m = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t)
  return `rgb(${m(0)},${m(1)},${m(2)})`
}

function deskY(row: number) { return row === 0 ? BACK_Y : FRONT_Y }

function shiftOf(phase: Phase): { txt: string; c: string } {
  if (phase === 'day') return { txt: 'MARKET OPEN', c: P.mint }
  if (phase === 'dawn') return { txt: 'DAWN RUN', c: P.amber }
  if (phase === 'dusk') return { txt: 'DUSK', c: '#e08a58' }
  return { txt: 'NIGHT', c: '#7ac0a0' }
}

function drawFern(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, seed: number, dark = false) {
  const stem = dark ? '#2a4a28' : P.plantD
  const leaf = dark ? '#3a6a38' : P.plant
  const tip = dark ? P.plantD : P.plantL
  px(ctx, x + 2, y - h, 2, h, stem)
  const n = 4 + Math.floor(seeded(seed) * 3)
  for (let i = 0; i < n; i++) {
    const yy = y - 4 - i * Math.max(3, Math.floor(h / (n + 1)))
    const span = 4 + Math.floor((1 - i / n) * 8)
    px(ctx, x + 2 - span, yy, span, 2, i % 2 ? tip : leaf)
    px(ctx, x + 4, yy + 1, span - 1, 2, i % 2 ? leaf : stem)
  }
}

function drawMossClump(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, seed: number) {
  px(ctx, x, y, w, 5, P.moss)
  px(ctx, x + 2, y - 3, w - 4, 4, P.mossL)
  if (seeded(seed) > 0.35) px(ctx, x + 3, y - 5, 4, 3, P.plantL)
  if (seeded(seed + 2) > 0.55) px(ctx, x + w - 8, y - 4, 3, 3, P.plant)
}

function drawVine(ctx: CanvasRenderingContext2D, t: number) {
  let x = GLASS_L + 4, y = GLASS_T + 6
  for (let i = 0; i < 18; i++) {
    x += Math.round(Math.sin(i / 2.4 + t / 4000) * 2)
    y += 8
    px(ctx, x, y, 2, 8, P.plantD)
    if (i % 2 === 0) px(ctx, x - 5, y + 2, 5, 3, P.plant)
    if (i % 3 === 0) px(ctx, x + 2, y + 1, 6, 3, P.plantL)
  }
}

function drawDriftwood(ctx: CanvasRenderingContext2D) {
  px(ctx, 148, SOIL - 8, 86, 6, '#6a4a2c')
  px(ctx, 150, SOIL - 12, 70, 5, '#8a6240')
  px(ctx, 168, SOIL - 18, 18, 8, '#5a3a20')
  px(ctx, 200, SOIL - 14, 12, 6, '#4a2e18')
}

function drawPool(ctx: CanvasRenderingContext2D, t: number) {
  const x = 392, y = SOIL - 6, w = 52, h = 12
  px(ctx, x, y, w, h, '#1a3a48')
  px(ctx, x + 2, y + 2, w - 4, h - 4, '#245a68')
  const ripple = Math.round(Math.sin(t / 700) * 2)
  px(ctx, x + 8 + ripple, y + 4, 18, 1, 'rgba(180,230,240,0.35)')
  px(ctx, x + 20 - ripple, y + 7, 14, 1, 'rgba(180,230,240,0.22)')
}

function drawMushrooms(ctx: CanvasRenderingContext2D, x: number, y: number) {
  px(ctx, x + 2, y - 6, 2, 6, '#d8c8a0')
  px(ctx, x, y - 10, 6, 4, '#c45a48')
  px(ctx, x + 8, y - 5, 2, 5, '#d8c8a0')
  px(ctx, x + 6, y - 8, 6, 3, '#e07060')
}

function drawTank(ctx: CanvasRenderingContext2D, phase: Phase, t: number) {
  px(ctx, 0, 0, LW, LH, P.room)

  // stand
  px(ctx, 10, GLASS_B + 4, LW - 20, 14, P.wood)
  px(ctx, 10, GLASS_B + 4, LW - 20, 3, P.woodL)
  px(ctx, 16, GLASS_B + 16, 12, 10, P.woodD)
  px(ctx, LW - 28, GLASS_B + 16, 12, 10, P.woodD)
  px(ctx, 6, LH - 6, LW - 12, 6, P.woodD)

  // sky through the back pane
  px(ctx, GLASS_L, GLASS_T, GLASS_R - GLASS_L, SOIL - GLASS_T, SKY[phase])
  if (phase === 'dawn' || phase === 'day') {
    const g = ctx.createLinearGradient(GLASS_L, GLASS_T, GLASS_L + 120, SOIL)
    g.addColorStop(0, phase === 'day' ? 'rgba(255,220,140,0.18)' : 'rgba(255,170,70,0.22)')
    g.addColorStop(1, 'rgba(255,200,90,0)')
    ctx.fillStyle = g
    ctx.fillRect(GLASS_L, GLASS_T, GLASS_R - GLASS_L, SOIL - GLASS_T)
    ctx.fillStyle = phase === 'day' ? 'rgba(255,230,160,0.06)' : 'rgba(255,180,80,0.08)'
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(GLASS_L + 30 + i * 18, GLASS_T)
      ctx.lineTo(GLASS_L + 70 + i * 28, SOIL)
      ctx.lineTo(GLASS_L + 78 + i * 28, SOIL)
      ctx.lineTo(GLASS_L + 36 + i * 18, GLASS_T)
      ctx.fill()
    }
  }
  if (phase === 'dusk') {
    const g = ctx.createLinearGradient(0, SOIL - 70, 0, SOIL)
    g.addColorStop(0, 'rgba(240,90,40,0)')
    g.addColorStop(1, 'rgba(220,90,50,0.26)')
    ctx.fillStyle = g
    ctx.fillRect(GLASS_L, SOIL - 70, GLASS_R - GLASS_L, 70)
  }

  // interior fog
  ctx.fillStyle = phase === 'night' ? 'rgba(40,80,60,0.10)' : 'rgba(200,230,210,0.06)'
  ctx.fillRect(GLASS_L, GLASS_T, GLASS_R - GLASS_L, 36)

  // substrate: gravel, charcoal, soil, moss cap
  px(ctx, GLASS_L, SOIL + 18, GLASS_R - GLASS_L, GLASS_B - SOIL - 18, '#5a4a38')
  px(ctx, GLASS_L, SOIL + 10, GLASS_R - GLASS_L, 10, '#2a2218')
  px(ctx, GLASS_L, SOIL, GLASS_R - GLASS_L, 14, P.soil)
  px(ctx, GLASS_L, SOIL, GLASS_R - GLASS_L, 3, P.moss)
  for (let i = 0; i < 30; i++) {
    px(ctx, GLASS_L + 4 + i * 14 + seeded(i * 4.1) * 5, SOIL + 16 + seeded(i) * 6, 3, 2, P.gravel)
  }

  drawMossClump(ctx, 28, SOIL - 2, 28, 1)
  drawMossClump(ctx, 118, SOIL - 1, 22, 2)
  drawMossClump(ctx, 250, SOIL - 3, 30, 3)
  drawMossClump(ctx, 400, SOIL - 1, 24, 4)
  drawDriftwood(ctx)
  drawPool(ctx, t)
  drawMushrooms(ctx, 70, SOIL)
  drawMushrooms(ctx, 330, SOIL + 2)

  // back ferns (darker, against the glass) — leave a clearing under the cloche and traders
  for (let i = 0; i < 12; i++) {
    const fx = 26 + i * 36 + seeded(i * 2.2) * 6
    if (fx > 200 && fx < 280) continue
    if (fx > 300 && fx < 450) continue
    drawFern(ctx, fx, SOIL, 22 + seeded(i * 7) * 28, i * 3, true)
  }
  drawVine(ctx, t)
  // a few brighter front ferns on the far left
  drawFern(ctx, 40, SOIL, 36, 21)
  drawFern(ctx, 58, SOIL, 24, 22)

  // hanging moss from the lid
  for (let i = 0; i < 8; i++) {
    const hx = 36 + i * 52 + Math.round(Math.sin(t / 1600 + i) * 1)
    const len = 12 + seeded(i * 9) * 16
    px(ctx, hx, GLASS_T, 2, len, P.plantD)
    px(ctx, hx - 3, GLASS_T + len - 3, 8, 5, i % 2 ? P.plant : P.plantL)
  }

  // dripping condensation
  for (let i = 0; i < 18; i++) {
    const dx = GLASS_L + 10 + seeded(i * 11.3) * (GLASS_R - GLASS_L - 20)
    const fall = (t / (40 + i * 7) + seeded(i * 3) * 80) % (SOIL - GLASS_T - 12)
    const dy = GLASS_T + 8 + fall
    px(ctx, dx, dy, 1, 3, 'rgba(220,255,240,0.32)')
  }

  if (phase === 'night') {
    for (let f = 0; f < 14; f++) {
      const span = GLASS_R - GLASS_L - 24
      const fx = GLASS_L + 12 + (seeded(f * 17.3) * span + t / (800 + f * 70)) % span
      const fy = GLASS_T + 18 + seeded(f * 31.7) * 100 + Math.sin(t / 700 + f * 2) * 4
      if (Math.sin(t / 380 + f * 5) > 0.05) {
        px(ctx, fx - 1, fy - 1, 3, 3, 'rgba(216,240,160,0.32)')
        px(ctx, fx, fy, 2, 2, '#e8f8b0')
      }
    }
  }

  // brass frame + rivets + latch
  px(ctx, GLASS_L - 7, GLASS_T - 7, GLASS_R - GLASS_L + 14, 7, P.brass)
  px(ctx, GLASS_L - 7, GLASS_B - 3, GLASS_R - GLASS_L + 14, 7, P.brass)
  px(ctx, GLASS_L - 7, GLASS_T - 7, 7, GLASS_B - GLASS_T + 11, P.brass)
  px(ctx, GLASS_R, GLASS_T - 7, 7, GLASS_B - GLASS_T + 11, P.brass)
  px(ctx, GLASS_L - 7, GLASS_T - 7, GLASS_R - GLASS_L + 14, 2, '#e8d090')
  const rivets = [
    [GLASS_L - 4, GLASS_T - 4], [GLASS_R + 1, GLASS_T - 4],
    [GLASS_L - 4, GLASS_B], [GLASS_R + 1, GLASS_B],
  ]
  for (const [rx, ry] of rivets) px(ctx, rx, ry, 3, 3, '#8a6a32')
  px(ctx, GLASS_R - 18, GLASS_T - 3, 10, 4, '#e8d090')
  px(ctx, GLASS_R - 16, GLASS_T + 1, 6, 6, P.brassD)

  // glass sheen
  ctx.fillStyle = P.sheen
  ctx.fillRect(GLASS_L + 8, GLASS_T + 4, 7, GLASS_B - GLASS_T - 10)
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.fillRect(GLASS_L, GLASS_T, GLASS_R - GLASS_L, 3)
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.fillRect(GLASS_R - 4, GLASS_T, 4, GLASS_B - GLASS_T)
}

function drawCloche(ctx: CanvasRenderingContext2D, t: number, ok: boolean, pending: boolean) {
  const cx = 240, cy = 72
  px(ctx, cx - 26, cy + 22, 52, 4, P.brass)
  px(ctx, cx - 22, cy + 26, 44, 7, '#5a3a1c')
  px(ctx, cx - 16, cy + 32, 32, 3, P.moss)
  ctx.beginPath(); ctx.arc(cx, cy + 22, 30, Math.PI, 0)
  ctx.fillStyle = 'rgba(190,235,215,0.16)'; ctx.fill()
  ctx.beginPath(); ctx.arc(cx, cy + 22, 30, Math.PI, 0)
  ctx.strokeStyle = 'rgba(230,255,240,0.6)'; ctx.lineWidth = 1.6; ctx.stroke()
  px(ctx, cx - 5, cy - 12, 10, 2, 'rgba(230,255,240,0.7)')
  const sway = Math.round(Math.sin(t / 1100) * 1)
  px(ctx, cx - 1 + sway, cy + 4, 3, 18, P.plantD)
  px(ctx, cx - 12 + sway, cy + 2, 10, 7, P.plant)
  px(ctx, cx + 2 + sway, cy - 8, 10, 7, P.plantL)
  px(ctx, cx - 6 + sway, cy - 14, 8, 6, P.plant)
  px(ctx, cx + 6 + sway, cy + 6, 8, 6, P.plantD)
  const fx = cx + Math.cos(t / 800) * 16, fy = cy + 6 + Math.sin(t / 620) * 8
  if (Math.sin(t / 420) > -0.25) {
    px(ctx, fx - 2, fy - 2, 5, 5, ok ? 'rgba(125,232,168,0.45)' : 'rgba(224,179,77,0.38)')
    px(ctx, fx, fy, 2, 2, ok ? P.mint : pending ? P.amber : P.amber)
  }
  ctx.textAlign = 'center'
  ctx.font = `6px ${MONO}`
  ctx.fillStyle = P.gold
  ctx.fillText('CHIEF OF STAFF', cx, cy + 42)
  ctx.textAlign = 'left'
}

function drawKit(ctx: CanvasRenderingContext2D, kit: Station['kit'], hx: number, hy: number, t: number, idle: boolean) {
  if (kit === 'scan') {
    const y = hy + 5 + (idle ? 0 : Math.floor((t / 180) % 4))
    px(ctx, hx + 4, y, 8, 1, idle ? '#3a5a4a' : '#9fffd8')
  } else if (kit === 'dish') {
    px(ctx, hx + 14, hy - 2, 5, 2, '#8aa')
    px(ctx, hx + 16, hy - 6, 2, 4, '#8aa')
  } else if (kit === 'cam') {
    px(ctx, hx + 2, hy + 4, 3, 3, '#2a1a22')
    px(ctx, hx + 11, hy + 4, 3, 3, '#2a1a22')
    if (!idle) px(ctx, hx + 3, hy + 5, 1, 1, P.red)
  } else if (kit === 'lamp') {
    px(ctx, hx + 3, hy - 2, 10, 2, '#c8a04a')
  } else if (kit === 'live') {
    px(ctx, hx + 1, hy + 1, 2, 10, P.red)
  } else {
    px(ctx, hx + 1, hy + 1, 2, 10, '#4a7ab0')
  }
}

function drawFigure(ctx: CanvasRenderingContext2D, x: number, y: number, s: Station,
                    t: number, i: number, pose: 'seated' | 'stand' | 'walk') {
  const idle = s.pending || s.down
  const fade = idle ? 0.22 : 0
  const metal = shade(s.skin, '#1a2018', fade)
  const shirt = shade(s.shirt, '#1a2018', fade)
  const bob = pose === 'seated' ? 0 : Math.round(Math.sin(t / 300 + i * 2) * 1)
  const type = !idle && pose === 'seated' && Math.floor(t / 140 + i) % 2 === 0 ? 1 : 0

  if (pose === 'walk') {
    const step = Math.floor(t / 140) % 2
    px(ctx, x + 3 + (step ? 1 : -1), y - 8, 4, 8, metal)
    px(ctx, x + 10 - (step ? 1 : -1), y - 8, 4, 8, metal)
  } else if (pose === 'stand') {
    px(ctx, x + 3, y - 8 + bob, 4, 8, metal); px(ctx, x + 10, y - 8 + bob, 4, 8, metal)
  }

  const by = pose === 'seated' ? y - 22 : y - 21 + bob
  px(ctx, x + 1, by, 15, 13, shirt)
  px(ctx, x + 1, by, 15, 2, metal)
  px(ctx, x - 1, by + 1, 3, 8, metal); px(ctx, x + 15, by + 1, 3, 8, metal)
  if (pose === 'seated' && !s.down) {
    px(ctx, x - 1, by + 9, 5, 2, metal)
    px(ctx, x + 12, by + 9 + type, 5, 2, metal)
  }
  const chestOn = !idle && Math.sin(t / 520 + i * 1.7) > -0.15
  px(ctx, x + 7, by + 4, 4, 3, s.down ? P.red : s.pending ? P.amber : chestOn ? P.mint : '#2a3a32')

  const hy = by - 14
  px(ctx, x + 3, hy, 12, 12, metal)
  px(ctx, x + 3, hy, 12, 3, shade(s.accent, '#1a2018', fade))
  px(ctx, x + 8, hy - 4, 2, 4, metal)
  const aOn = !idle && Math.floor((t + i * 700) / 900) % 2 === 0
  px(ctx, x + 7, hy - 7, 4, 4, s.down ? P.red : s.pending ? P.amber : aOn ? P.mint : '#3a4a40')
  const blink = Math.floor((t + i * 900) / 180) % 24 === 0
  if (s.down) {
    px(ctx, x + 5, hy + 6, 3, 1, P.red); px(ctx, x + 10, hy + 6, 3, 1, P.red)
  } else if (s.pending) {
    px(ctx, x + 5, hy + 5, 2, 2, P.amber); px(ctx, x + 11, hy + 5, 2, 2, P.amber)
  } else if (!blink) {
    px(ctx, x + 5, hy + 5, 2, 2, '#9fffd8'); px(ctx, x + 11, hy + 5, 2, 2, '#9fffd8')
    if (pose === 'seated') px(ctx, x + 4, hy + 4, 10, 5, 'rgba(127,232,168,0.12)')
  }
  px(ctx, x + 6, hy + 9, 6, 1, s.down ? P.red : '#1c2a22')
  drawKit(ctx, s.kit, x + 3, hy, t, idle)
}

const HANGOUTS: [number, number][] = [[56, 214], [240, 214], [400, 214]]
function ease(u: number): number { return u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u) }

function workerPose(s: Station, i: number, t: number, reduced: boolean): { x: number; y: number; pose: 'seated' | 'stand' | 'walk' } {
  const dy = deskY(s.row)
  const home = { x: s.x + 10, y: dy + 4, pose: 'seated' as const }
  if (s.down || s.pending || reduced) return home
  if (!s.present) return home
  const BLOCK = 22000
  const block = Math.floor(t / BLOCK)
  const r = seeded(i * 131 + block * 17)
  if (r < 0.82) return home
  const dest = HANGOUTS[Math.floor(seeded(i * 77 + block * 13) * HANGOUTS.length)]
  const u = (t % BLOCK) / BLOCK
  const feet: [number, number] = [s.x + 10, dy + 22]
  let fx: number, fy: number, pose: 'stand' | 'walk'
  if (u < 0.28) { const k = ease(u / 0.28); fx = feet[0] + (dest[0] - feet[0]) * k; fy = feet[1] + (dest[1] - feet[1]) * k; pose = 'walk' }
  else if (u < 0.72) { fx = dest[0]; fy = dest[1]; pose = 'stand' }
  else { const k = ease((u - 0.72) / 0.28); fx = dest[0] + (feet[0] - dest[0]) * k; fy = dest[1] + (feet[1] - dest[1]) * k; pose = 'walk' }
  if (u > 0.97) return home
  return { x: fx, y: fy, pose }
}

function drawScreen(ctx: CanvasRenderingContext2D, kind: Station['screen'], x: number, y: number,
                    t: number, alive: boolean, seed: number) {
  px(ctx, x, y, 28, 16, '#101418'); px(ctx, x + 1, y + 1, 26, 14, P.screenBg)
  if (!alive) {
    px(ctx, x + 4, y + 6, 20, 2, '#24322c')
    return
  }
  const c = P.mint
  if (kind === 'candles') {
    for (let b = 0; b < 6; b++) {
      const h = 3 + Math.floor(seeded(seed + b + Math.floor(t / 2400)) * 8)
      const up = seeded(seed * 2 + b + Math.floor(t / 2400)) > 0.45
      px(ctx, x + 3 + b * 4, y + 13 - h, 2, h, up ? P.mint : P.red)
    }
  } else if (kind === 'bars') {
    for (let b = 0; b < 5; b++) {
      const h = 3 + Math.floor(seeded(seed + b) * 9 + Math.sin(t / 900 + b) * 2)
      px(ctx, x + 3 + b * 4.5, y + 13 - h, 3, h, c)
    }
  } else if (kind === 'film') {
    for (let f = 0; f < 3; f++) px(ctx, x + 3 + f * 8, y + 3, 6, 9, ['#c05a8a', '#d9a441', '#4a7ab0'][f])
  } else {
    for (let l = 0; l < 4; l++) px(ctx, x + 3, y + 3 + l * 3, 10 + seeded(seed + l) * 10, 2, l ? '#41616a' : c)
  }
}

function drawSlab(ctx: CanvasRenderingContext2D, s: Station, t: number, seed: number) {
  const dy = deskY(s.row)
  const glow = s.present && !s.down
  px(ctx, s.x - 2, dy, 42, 10, '#5a4a38')
  px(ctx, s.x, dy - 2, 38, 4, glow ? '#6a8a58' : '#4a5a40')
  px(ctx, s.x + 4, dy + 8, 8, 4, P.moss)
  drawScreen(ctx, s.screen, s.x + 6, dy - 18, t, glow, seed)
  ctx.textAlign = 'center'
  ctx.font = `5px ${MONO}`
  ctx.fillStyle = s.down ? P.red : s.pending ? P.amber : P.text
  ctx.fillText(s.label, s.x + 19, dy + 18)
  ctx.fillStyle = s.down ? P.red : s.pending ? P.amber : P.dim
  ctx.fillText(s.chip, s.x + 19, dy + 24)
  ctx.textAlign = 'left'
}

function drawBubble(ctx: CanvasRenderingContext2D, cx: number, y: number, text: string, accent: string) {
  ctx.font = `6px ${MONO}`
  const w = Math.min(ctx.measureText(text).width + 10, 160)
  const x = Math.max(GLASS_L + 4, Math.min(GLASS_R - w - 4, cx - w / 2))
  px(ctx, x - 1, y - 1, w + 2, 13, accent)
  px(ctx, x, y, w, 11, P.bubble)
  px(ctx, cx - 2, y + 11, 4, 3, accent)
  ctx.fillStyle = P.ink
  ctx.fillText(text, x + 5, y + 8)
}

function drawMarker(ctx: CanvasRenderingContext2D, trading: TradingStatus | null, board: BoardState | null) {
  px(ctx, 84, SOIL - 22, 3, 22, '#5a3a1c')
  px(ctx, 36, 52, 86, 38, '#efe4c8')
  px(ctx, 36, 52, 86, 2, '#5a3a1c')
  ctx.font = `5px ${MONO}`; ctx.fillStyle = '#6a4a28'
  ctx.fillText('THESIS', 42, 62)
  const raw = trading?.last_decision?.thesis ?? ''
  const gist = (raw.length > 14 ? raw : board?.arms?.live?.gist ?? (raw || 'no ruling yet')).slice(0, 42)
  ctx.fillStyle = '#3a3a28'
  let line = ''; let ln = 0
  for (const w of gist.split(' ')) {
    if (ctx.measureText(line + ' ' + w).width > 74 && line) {
      ctx.fillText(line, 42, 70 + ln * 6); line = w; ln++
      if (ln > 2) break
    } else line = (line ? line + ' ' : '') + w
  }
  if (ln <= 2 && line) ctx.fillText(line, 42, 70 + ln * 6)
  ctx.fillStyle = trading?.kill_switch ? '#b04a3a' : '#8a6a2a'
  ctx.fillText(trading?.kill_switch ? 'KILL ON' : 'flat by close', 42, 86)
}

function fmtClock(mkt: MarketClock | null): string {
  if (!mkt?.et) return '--:--'
  const m = mkt.et.match(/\d{1,2}:\d{2}/)
  return m ? m[0] : '--:--'
}

function tickerCells(trading: TradingStatus | null, board: BoardState | null): { txt: string; c: string }[] {
  const cells: { txt: string; c: string }[] = []
  for (const mode of ['live', 'paper'] as const) {
    for (const p of trading?.modes?.[mode]?.open_positions ?? []) cells.push({ txt: `${p.symbol} HELD`, c: P.gold })
  }
  for (const c of board?.arms?.live?.candidates ?? []) {
    const up = c.move_pct >= 0
    cells.push({ txt: `${c.symbol} ${up ? '+' : ''}${c.move_pct.toFixed(1)}%`, c: up ? P.mint : P.red })
  }
  for (const a of (trading?.alerts ?? []).slice(0, 3)) cells.push({ txt: a.slice(0, 42), c: P.dim })
  if (!cells.length) cells.push({ txt: trading?.market?.is_open ? 'quiet tape' : 'market closed — night crew on', c: P.dim })
  return cells
}

function stationsFrom(seats: DeskSeat[], trading: TradingStatus | null): Station[] {
  const out: Station[] = []
  const seatNames = ['premarket', 'ops', 'content', 'projects'] as const
  seatNames.forEach((name, i) => {
    const seat = seats.find(s => s.name === name)
    const st: SeatStatus = seat?.status ?? 'pending'
    out.push({
      key: name, label: name.toUpperCase(),
      shirt: STYLE[name].shirt, skin: P.skins[i % P.skins.length],
      accent: STYLE[name].accent, kit: STYLE[name].kit,
      x: (i < 2 ? 36 + i * 68 : 312 + (i - 2) * 68), row: 0,
      present: st === 'ok', down: st === 'failed', pending: st === 'pending',
      chip: st === 'ok' ? 'on shift' : st === 'failed' ? 'SEAT DOWN' : 'scheduled',
      bubble: st === 'failed' ? 'SEAT DOWN' : null,
      screen: STYLE[name].screen,
    })
  })
  ;(['live', 'paper'] as const).forEach((mode, i) => {
    const m = trading?.modes?.[mode]
    const aliveHb = m?.status === 'alive'
    const last = trading?.last_decision
    out.push({
      key: mode, label: mode === 'live' ? 'TRADER·LIVE' : 'TRADER·PAPER',
      shirt: STYLE[mode].shirt, skin: P.skins[(i + 2) % P.skins.length],
      accent: STYLE[mode].accent, kit: STYLE[mode].kit,
      x: 268 + i * 80, row: 1,
      present: aliveHb, down: m?.status === 'stale', pending: !aliveHb && m?.status !== 'stale',
      chip: aliveHb
        ? (m?.open_positions.length ? `${m.open_positions.length} open` : 'flat')
        : m?.status === 'stale' ? 'stale' : 'off shift',
      bubble: mode === 'live' && last?.action
        ? `${last.action.toUpperCase()}${last.symbol ? ' ' + last.symbol : ''}` : null,
      screen: 'candles',
    })
  })
  return out
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
    const id = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const dataRef = useRef({ seats, trading, board, system })
  dataRef.current = { seats, trading, board, system }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

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
      const phase = getPhase(mkt)
      const shift = shiftOf(phase)

      drawTank(ctx, phase, t)
      drawMarker(ctx, trading, board)
      drawCloche(ctx, t, seats.find(s => s.name === 'chief')?.status === 'ok',
        seats.find(s => s.name === 'chief')?.status === 'pending')

      px(ctx, 0, 0, LW, 16, '#081009')
      ctx.font = `7px ${MONO}`
      ctx.fillStyle = P.emerald; ctx.fillText('TERRARIUM', 8, 11)
      ctx.fillStyle = P.dim; ctx.fillText('UNDER GLASS', 72, 11)
      px(ctx, 140, 4, ctx.measureText(shift.txt).width + 8, 8, '#12211a')
      ctx.fillStyle = shift.c; ctx.fillText(shift.txt, 144, 11)
      ctx.font = `8px ${MONO}`; ctx.fillStyle = P.text
      ctx.fillText(fmtClock(mkt), LW - 36, 12)

      // ticker lives on the wooden stand, not in the garden
      ctx.font = `5px ${MONO}`
      const cells = tickerCells(trading, board)
      let total = 0
      for (const c of cells) total += ctx.measureText(c.txt).width + 14
      total = Math.max(total, LW - 24)
      const off = reduced ? 0 : -((t / 1000) * 16) % total
      for (let loop = 0; loop < 2; loop++) {
        let cx2 = 16 + off + loop * total
        for (const cell of cells) {
          ctx.fillStyle = '#8a6a2a'; ctx.fillText('+', cx2 - 8, GLASS_B + 13)
          ctx.fillStyle = cell.c; ctx.fillText(cell.txt, cx2, GLASS_B + 13)
          cx2 += ctx.measureText(cell.txt).width + 14
        }
      }

      const stations = stationsFrom(seats, trading)
      const poses = stations.map((s, i) => ({ s, i, p: workerPose(s, i, t, reduced) }))
      for (const { s, i, p } of poses) {
        if (p.pose === 'seated') drawFigure(ctx, p.x, p.y, s, t, i, 'seated')
      }
      for (let i = 0; i < stations.length; i++) drawSlab(ctx, stations[i], t, i * 17 + 3)
      for (const { s, i, p } of poses) {
        if (p.pose !== 'seated') drawFigure(ctx, p.x, p.y, s, t, i, p.pose)
      }

      const withBubbles = stations.filter(s => s.bubble)
      if (withBubbles.length) {
        const pick = withBubbles[Math.floor(t / 5000) % withBubbles.length]
        const pose = poses.find(x => x.s.key === pick.key)?.p
        const bx = pose?.x ?? pick.x + 10
        const by = Math.max(GLASS_T + 8, (pose?.y ?? deskY(pick.row)) - 46)
        drawBubble(ctx, bx + 8, by, pick.bubble!, pick.down ? P.red : P.gold)
      }

      const onShift = stations.filter(s => s.present && !s.down).length
      const waiting = stations.filter(s => s.pending).length
      const failedN = stations.filter(s => s.down).length
      ctx.font = `5px ${MONO}`; ctx.fillStyle = P.dim
      ctx.fillText(
        `on shift ${onShift}   waiting ${waiting}   failed ${failedN}   disk ${system ? system.disk_pct.toFixed(0) + '%' : '—'}`,
        10, LH - 3)

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
    <div className="floor-frame">
      <canvas ref={canvasRef} />
    </div>
  )
}
