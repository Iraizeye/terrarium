// The stage IS the reference painting (skill: terrarium-art).
//
// docs/art/warm-ember-reference.png is drawn as the full stage — no robot
// geometry is invented here. The code owns only the LIVE layer on top:
//   · the banner region (painted opaquely over the baked one — doctor truth)
//   · speech bubbles (live text over the baked spots; soft shadow-patches
//     when state says silence, so the painting never speaks out of turn)
//   · station state LEDs (STRATEGY BUILD CHIEF KERNEL LIVE PAPER)
//   · a patrol light gliding the pit floor on a fresh live heartbeat
//   · the RFC folder / brief envelope packets
// Baked lamp-light and eyes are accepted as the painting's own; state is
// carried by the LED layer, which never lies.

import { useEffect, useRef, useState } from 'react'
import referenceUrl from '../assets-stage-reference.png'
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

let REF: HTMLImageElement | null = null
function refImage(): HTMLImageElement {
  if (!REF) {
    REF = new Image()
    REF.src = referenceUrl
  }
  return REF
}

// ── the crop of the illustration inside the source PNG ──────────────────────
const CROP = { sx: 55, sy: 95, sw: 1893, sh: 1350 }
// regions/anchors in CROP space
const BANNER = { x: 128, y: 42, w: 1648, h: 98 }
const BUBBLE_STRAT = { cx: 605, top: 270, w: 370, h: 96 } // baked "Quiet shift tonight"
const BUBBLE_MEET = { cx: 1415, top: 272, w: 306, h: 82 } // baked "RFC looks steady."
const CHIEF_BUBBLE = { cx: 1440, top: 640 }
const LEDS = {
  strategy: { x: 540, y: 585, label: 'STRATEGY' },
  build: { x: 618, y: 905, label: 'BUILD' },
  chief: { x: 1452, y: 905, label: 'CHIEF' },
  kernel: { x: 505, y: 1250, label: 'KERNEL' },
  live: { x: 722, y: 1252, label: 'LIVE' },
  paper: { x: 1012, y: 1252, label: 'PAPER' },
}
const PATROL = { x0: 430, x1: 1180, y: 1300, period: 19000 }
const AMBER = '#f5b84a'
const CREAM = '#efe3c8'

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
    const spawnRfc = (now: number) =>
      packets.length < 2 &&
      packets.push({
        kind: 'rfc',
        t0: now,
        dur: 4200,
        pts: [
          [560, 480],
          [985, 480],
          [985, 860],
          [660, 860],
        ],
      })
    const spawnBrief = (now: number) =>
      packets.length < 2 &&
      packets.push({
        kind: 'brief',
        t0: now,
        dur: 2600,
        pts: [
          [1450, 820],
          [1760, 770],
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
      ctx.imageSmoothingQuality = 'high'

      // contain-fit the cropped illustration
      const s = Math.min(rect.width / CROP.sw, rect.height / CROP.sh)
      const ox = (rect.width - CROP.sw * s) / 2
      const oy = (rect.height - CROP.sh * s) / 2
      const X = (cx: number) => ox + cx * s
      const Y = (cy: number) => oy + cy * s
      ctx.fillStyle = '#120a07'
      ctx.fillRect(0, 0, rect.width, rect.height)
      const img = refImage()
      if (img.complete && img.naturalWidth) {
        ctx.drawImage(img, CROP.sx, CROP.sy, CROP.sw, CROP.sh, ox, oy, CROP.sw * s, CROP.sh * s)
      }

      // ── telemetry ──
      const night = getPhase(trading?.market) === 'night'
      const chiefSeat = seats.find((se) => se.name === 'chief')
      const chiefRan = freshISO(chiefSeat?.ran_at)
      const chiefOk = chiefSeat?.status === 'ok'
      const chiefDown = chiefSeat?.status === 'failed'
      const stratOn = freshISO(company?.strategy_at)
      const buildOn = freshISO(company?.build_at)
      const meetOn = stratOn && buildOn
      const liveHb = trading?.modes?.live?.status === 'alive'
      const liveStale = trading?.modes?.live?.status === 'stale'
      const paperHb = trading?.modes?.paper?.status === 'alive'
      const paperStale = trading?.modes?.paper?.status === 'stale'
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

      // ── the banner: painted opaquely over the baked strip — doctor truth ──
      {
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
        const bw = BANNER.w * s
        const bh = BANNER.h * s
        ctx.fillStyle = warn ? '#a8501e' : '#241610'
        ctx.beginPath()
        ctx.roundRect(bx, by, bw, bh, 10 * s)
        ctx.fill()
        // subtle top glint like the painting's
        ctx.fillStyle = 'rgba(255,235,190,0.12)'
        ctx.fillRect(bx, by, bw, 4 * s)
        const ix = bx + 60 * s
        const iy = by + bh / 2
        if (warn) {
          ctx.fillStyle = CREAM
          ctx.beginPath()
          ctx.moveTo(ix, iy - bh * 0.28)
          ctx.lineTo(ix - bh * 0.28, iy + bh * 0.24)
          ctx.lineTo(ix + bh * 0.28, iy + bh * 0.24)
          ctx.closePath()
          ctx.fill()
          ctx.fillStyle = '#a8501e'
          ctx.font = `bold ${bh * 0.44}px ${MONO}`
          ctx.textAlign = 'center'
          ctx.fillText('!', ix, iy + bh * 0.16)
        } else {
          ctx.fillStyle = kill ? '#c94f42' : '#7fb069'
          ctx.beginPath()
          ctx.arc(ix, iy, bh * 0.14, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = warn ? CREAM : 'rgba(239,227,200,0.5)'
        ctx.font = `bold ${Math.max(12, bh * 0.5)}px ${MONO}`
        ctx.textAlign = 'left'
        ctx.fillText(text, ix + 40 * s, iy + bh * 0.18)
        const wx2 = bx + bw - 120 * s
        ctx.strokeStyle = warn ? 'rgba(239,227,200,0.85)' : 'rgba(239,227,200,0.4)'
        ctx.lineWidth = Math.max(1.5, bh * 0.06)
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath()
          ctx.arc(wx2, iy + bh * 0.2, bh * 0.15 * i, Math.PI * 1.22, Math.PI * 1.78)
          ctx.stroke()
        }
        ctx.fillStyle = warn ? 'rgba(239,227,200,0.85)' : 'rgba(239,227,200,0.4)'
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(
            bx + bw - 70 * s + i * 14 * s,
            iy + bh * 0.24 - (i + 1) * bh * 0.13,
            9 * s,
            (i + 1) * bh * 0.13,
          )
        }
      }

      // ── bubble ownership: patch when silent, live text when speaking ──
      const patch = (r: { cx: number; top: number; w: number; h: number }) => {
        ctx.save()
        ctx.shadowColor = 'rgba(18,10,6,0.9)'
        ctx.shadowBlur = 22 * s
        const g = ctx.createLinearGradient(0, Y(r.top), 0, Y(r.top + r.h))
        g.addColorStop(0, '#241711')
        g.addColorStop(1, '#2c1c13')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.roundRect(X(r.cx - r.w / 2), Y(r.top), r.w * s, r.h * s, 14 * s)
        ctx.fill()
        ctx.restore()
      }
      const bubble = (cx: number, top: number, text: string, minW = 0) => {
        ctx.font = `bold ${Math.max(10, 30 * s)}px ${MONO}`
        const tw = Math.max(minW * s, Math.min(ctx.measureText(text).width + 44 * s, 620 * s))
        const bh2 = 58 * s
        const bx2 = Math.max(X(60), Math.min(X(1830) - tw, X(cx) - tw / 2))
        const by2 = Y(top)
        const tipX = Math.max(bx2 + 20 * s, Math.min(bx2 + tw - 20 * s, X(cx)))
        ctx.save()
        ctx.shadowColor = 'rgba(18,10,6,0.5)'
        ctx.shadowBlur = 10
        ctx.shadowOffsetY = 3
        ctx.beginPath()
        ctx.roundRect(bx2, by2, tw, bh2, 16 * s)
        ctx.moveTo(tipX - 11 * s, by2 + bh2)
        ctx.lineTo(tipX, by2 + bh2 + 16 * s)
        ctx.lineTo(tipX + 11 * s, by2 + bh2)
        ctx.closePath()
        ctx.fillStyle = CREAM
        ctx.fill()
        ctx.shadowColor = 'transparent'
        ctx.strokeStyle = 'rgba(120,90,50,0.4)'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = '#2c2118'
        ctx.textAlign = 'center'
        ctx.fillText(text, bx2 + tw / 2, by2 + bh2 * 0.66)
        ctx.textAlign = 'left'
        ctx.restore()
      }

      const stratText = stratOn
        ? (company?.strategy_verdict ?? 'writing the RFC').slice(0, 30)
        : night
          ? 'Quiet shift tonight'
          : null
      if (stratText) bubble(BUBBLE_STRAT.cx, BUBBLE_STRAT.top, stratText, BUBBLE_STRAT.w)
      else patch(BUBBLE_STRAT)
      if (meetOn) bubble(BUBBLE_MEET.cx, BUBBLE_MEET.top, 'RFC looks steady.', BUBBLE_MEET.w)
      else patch(BUBBLE_MEET)
      const chiefBubble = chiefOk
        ? 'brief sent — floor is yours'
        : company?.strategy_verdict
          ? `strategy: ${company.strategy_verdict.slice(0, 24)}`
          : null
      if (chiefBubble) bubble(CHIEF_BUBBLE.cx, CHIEF_BUBBLE.top, chiefBubble)

      // ── station LEDs: the honest state layer over the painting ──
      const led = (x: number, y: number, state: 'on' | 'idle' | 'down' | 'sleep') => {
        const color =
          state === 'down'
            ? '#f0716a'
            : state === 'on'
              ? '#7fb069'
              : state === 'sleep'
                ? 'rgba(148,130,100,0.65)'
                : AMBER
        if (state === 'on' || state === 'down') {
          const g = ctx.createRadialGradient(X(x), Y(y), 1, X(x), Y(y), 22 * s)
          g.addColorStop(0, color.startsWith('#') ? `${color}88` : color)
          g.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(X(x), Y(y), 22 * s, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = '#1a100a'
        ctx.beginPath()
        ctx.arc(X(x), Y(y), 9 * s, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(X(x), Y(y), 6 * s, 0, Math.PI * 2)
        ctx.fill()
      }
      led(LEDS.strategy.x, LEDS.strategy.y, stratOn ? 'on' : night ? 'sleep' : 'idle')
      led(LEDS.build.x, LEDS.build.y, buildOn ? 'on' : night ? 'sleep' : 'idle')
      led(
        LEDS.chief.x,
        LEDS.chief.y,
        chiefDown ? 'down' : chiefRan ? 'on' : night ? 'sleep' : 'idle',
      )
      led(LEDS.kernel.x, LEDS.kernel.y, kill ? 'down' : wd ? 'on' : 'idle')
      led(LEDS.live.x, LEDS.live.y, liveStale ? 'down' : liveHb ? 'on' : 'sleep')
      led(LEDS.paper.x, LEDS.paper.y, paperStale ? 'down' : paperHb ? 'on' : 'sleep')

      // ── patrol light: glides the pit floor only on a fresh live heartbeat ──
      if (liveHb) {
        const t = (now % PATROL.period) / PATROL.period
        const goingRight = t < 0.5
        const uu = goingRight ? t * 2 : 1 - (t - 0.5) * 2
        const px = PATROL.x0 + (PATROL.x1 - PATROL.x0) * uu
        const g = ctx.createRadialGradient(X(px), Y(PATROL.y), 1, X(px), Y(PATROL.y), 46 * s)
        g.addColorStop(0, 'rgba(245,184,74,0.4)')
        g.addColorStop(1, 'rgba(245,184,74,0)')
        ctx.fillStyle = g
        ctx.save()
        ctx.translate(X(px), Y(PATROL.y))
        ctx.scale(1, 0.35)
        ctx.beginPath()
        ctx.arc(0, 0, 46 * s, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // ── packets ──
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i]
        const t = (now - p.t0) / p.dur
        if (t > 1.1) {
          packets.splice(i, 1)
          continue
        }
        const tt = Math.min(1, t)
        const pts = p.pts.map(([bx, by]) => [X(bx), Y(by)] as [number, number])
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
        const w = 46 * s
        if (t <= 1) {
          ctx.save()
          ctx.shadowColor = 'rgba(10,6,3,0.45)'
          ctx.shadowBlur = 6
          if (p.kind === 'rfc') {
            ctx.fillStyle = '#e8c94a'
            ctx.beginPath()
            ctx.roundRect(qx - w / 2, qy - w * 0.34, w, w * 0.62, 3)
            ctx.fill()
            ctx.shadowColor = 'transparent'
            ctx.fillStyle = '#d9b433'
            ctx.fillRect(qx - w / 2, qy - w * 0.34, w * 0.45, w * 0.16)
          } else {
            ctx.fillStyle = CREAM
            ctx.beginPath()
            ctx.roundRect(qx - w / 2, qy - w * 0.3, w, w * 0.58, 3)
            ctx.fill()
            ctx.shadowColor = 'transparent'
            ctx.strokeStyle = 'rgba(120,90,50,0.55)'
            ctx.beginPath()
            ctx.moveTo(qx - w / 2, qy - w * 0.3)
            ctx.lineTo(qx, qy + w * 0.05)
            ctx.lineTo(qx + w / 2, qy - w * 0.3)
            ctx.stroke()
          }
          ctx.restore()
        } else {
          const f = (t - 1) / 0.1
          const g = ctx.createRadialGradient(qx, qy, 0, qx, qy, 56 * s)
          g.addColorStop(0, `rgba(232,201,74,${0.5 * (1 - f)})`)
          g.addColorStop(1, 'rgba(232,201,74,0)')
          ctx.fillStyle = g
          ctx.fillRect(qx - 56 * s, qy - 56 * s, 112 * s, 112 * s)
        }
      }

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
