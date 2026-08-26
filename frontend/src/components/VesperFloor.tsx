// Path B — motion-rich sprites, traced from the reference (skill: terrarium-art).
//
// assets/terrarium/traced/* is the Warm Ember painting taken apart:
// stage-bg.png is the illustration with the characters and baked bubbles
// inpainted away, and each robot is a feathered-alpha crop of the SAME
// painted pixels, pasted back at its origin — so at rest the stage is the
// reference, and every character can move. No robot geometry is invented.
// The code owns the LIVE layer:
//   · the banner region (painted opaquely over the baked one — doctor truth)
//   · the eight robot sprites — idle by default; motion only when state
//     says so (typing bob on fresh strategy, hall lean-in on a real
//     handoff, pit sway on fresh heartbeats). Never constant walking.
//   · speech bubbles — drawn only when there is something true to say
//   · station state LEDs (STRATEGY BUILD CHIEF KERNEL LIVE PAPER)
//   · a patrol light gliding the pit floor on a fresh live heartbeat
//   · the RFC folder / brief envelope packets
// Baked lamp-light and eyes are the painting's own; sleeping stations dim
// their sprite, and state is carried by the LED layer, which never lies.

import { useEffect, useRef, useState } from 'react'
import buildBotUrl from '../../../assets/terrarium/traced/robot-build.png'
import chiefBotUrl from '../../../assets/terrarium/traced/robot-chief.png'
import kernelBotUrl from '../../../assets/terrarium/traced/robot-kernel.png'
import liveBotUrl from '../../../assets/terrarium/traced/robot-live.png'
import meetABotUrl from '../../../assets/terrarium/traced/robot-meet-a.png'
import meetBBotUrl from '../../../assets/terrarium/traced/robot-meet-b.png'
import paperBotUrl from '../../../assets/terrarium/traced/robot-paper.png'
import strategyBotUrl from '../../../assets/terrarium/traced/robot-strategy.png'
import stageBgUrl from '../../../assets/terrarium/traced/stage-bg.png'
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

const IMG_CACHE = new Map<string, HTMLImageElement>()
function image(url: string): HTMLImageElement {
  let im = IMG_CACHE.get(url)
  if (!im) {
    im = new Image()
    im.src = url
    IMG_CACHE.set(url, im)
  }
  return im
}

// ── the crop of the illustration inside the source PNG ──────────────────────
const CROP = { sx: 55, sy: 95, sw: 1893, sh: 1350 }
// sprite origins: the full-image trace boxes shifted into CROP space
// (generate_traced.py box minus the crop offset)
// eyes: the painted amber eyes (CROP space) — the active/talk poses breathe
// extra glow onto them; the chief's smoked visor has none, so no glow there
const SPRITES = {
  strategy: {
    url: strategyBotUrl,
    x: 489,
    y: 345,
    w: 156,
    h: 210,
    eyes: [
      [545, 395],
      [580, 395],
    ],
  },
  meetA: {
    url: meetABotUrl,
    x: 1217,
    y: 351,
    w: 160,
    h: 212,
    eyes: [
      [1250, 397],
      [1285, 400],
    ],
  },
  meetB: {
    url: meetBBotUrl,
    x: 1363,
    y: 351,
    w: 142,
    h: 212,
    eyes: [
      [1407, 403],
      [1443, 405],
    ],
  },
  build: {
    url: buildBotUrl,
    x: 533,
    y: 680,
    w: 174,
    h: 260,
    eyes: [
      [617, 733],
      [647, 733],
    ],
  },
  chief: { url: chiefBotUrl, x: 1360, y: 655, w: 170, h: 285, eyes: [] },
  kernel: {
    url: kernelBotUrl,
    x: 420,
    y: 1050,
    w: 150,
    h: 205,
    eyes: [
      [477, 1077],
      [513, 1079],
    ],
  },
  live: {
    url: liveBotUrl,
    x: 660,
    y: 1050,
    w: 143,
    h: 205,
    eyes: [
      [747, 1079],
      [780, 1081],
    ],
  },
  paper: {
    url: paperBotUrl,
    x: 950,
    y: 1050,
    w: 160,
    h: 205,
    eyes: [
      [1007, 1081],
      [1043, 1083],
    ],
  },
}
// regions/anchors in CROP space
const BANNER = { x: 128, y: 42, w: 1648, h: 98 }
const BUBBLE_STRAT = { cx: 605, top: 270 } // where "Quiet shift tonight" lived
const BUBBLE_MEET = { cx: 1415, top: 272 } // where "RFC looks steady." lived
const CHIEF_BUBBLE = { cx: 1440, top: 640 }
const NIGHTBELL = { x: 1632, y: 766 } // the painted bell on the chief's table
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

// each bot opens the panel that already tells its story — no new pages
const BOT_PANEL: Record<keyof typeof SPRITES, string> = {
  strategy: 'panel-departments',
  meetA: 'panel-departments',
  meetB: 'panel-departments',
  build: 'panel-departments',
  chief: 'panel-desk',
  kernel: 'panel-trading',
  live: 'panel-trading',
  paper: 'panel-trading',
}

function agoText(iso?: string | null): string {
  if (!iso) return 'no run yet'
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 60 * 48) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}

export default function VesperFloor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const trading = useDashboardStore((s) => s.trading)
  const [seats, setSeats] = useState<DeskSeat[]>([])
  const [company, setCompany] = useState<CompanyStatus | null>(null)
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null)
  // the draw loop publishes its contain-fit so pointer math matches pixels
  const viewRef = useRef({ s: 1, ox: 0, oy: 0 })

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
    // ?office=demo — one scripted RFC handoff + one pit hb, then idle
    const officeDemo = params.get('office') === 'demo'
    let demoStage = officeDemo ? 0 : 3
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
    let meetTalkUntil = 0 // real handoff opens ~8s of hall talk, then idle
    // pit excursions: a fresh heartbeat sends each bot toward its prop and back
    let prevLiveAge: number | null = null
    let prevPaperAge: number | null = null
    let liveExcT0 = Number.NEGATIVE_INFINITY
    let paperExcT0 = Number.NEGATIVE_INFINITY
    let kernelExcT0 = Number.NEGATIVE_INFINITY
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
      viewRef.current = { s, ox, oy }
      const X = (cx: number) => ox + cx * s
      const Y = (cy: number) => oy + cy * s
      ctx.fillStyle = '#120a07'
      ctx.fillRect(0, 0, rect.width, rect.height)
      const img = image(stageBgUrl)
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
          meetTalkUntil = now + 8000
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
          else {
            spawnRfc(now)
            meetTalkUntil = now + 8000
          }
        }
        // scripted demo: one handoff at 1s, one pit heartbeat at 4s, done
        if (demoStage === 0 && now > 1000) {
          demoStage = 1
          spawnRfc(now)
          meetTalkUntil = now + 8000
        } else if (demoStage === 1 && now > 4000) {
          demoStage = 2
          liveExcT0 = now
        }
        // a heartbeat landing = age dropping back toward zero
        const la = trading?.modes?.live?.heartbeat_age_s ?? null
        if (la != null) {
          if (prevLiveAge != null && la < prevLiveAge - 4) {
            liveExcT0 = now
            if (wd && !kill) kernelExcT0 = now + 350 // the guard checks its lock
          }
          prevLiveAge = la
        }
        const pa = trading?.modes?.paper?.heartbeat_age_s ?? null
        if (pa != null) {
          if (prevPaperAge != null && pa < prevPaperAge - 4) paperExcT0 = now
          prevPaperAge = pa
        }
      }

      // ── the robots: traced sprites with a pose layer, idle by default ──
      // each painted robot already IS its job pose (laptop, tablet, talk);
      // pose = how the sprite is presented: idle static, active bobs and
      // breathes glow onto the painted eyes, talk leans in. Motion only on
      // real state — no constant walking, no fake busy. Sub-3px offsets sit
      // on the inpainted patches; feathered edges hide them.
      const talking = now < meetTalkUntil
      type Pose = 'idle' | 'active' | 'talk' | 'sleep'
      const bob = (period: number, amp: number, on: boolean, phase = 0) =>
        on && !reduceMotion ? Math.sin((now / period) * Math.PI * 2 + phase) * amp : 0
      const sprite = (
        sp: { url: string; x: number; y: number; w: number; h: number; eyes: number[][] },
        pose: Pose,
        dx = 0,
        dy = 0,
      ) => {
        const im = image(sp.url)
        if (!(im.complete && im.naturalWidth)) return
        if (pose === 'sleep') ctx.filter = 'brightness(0.55) saturate(0.85)'
        ctx.drawImage(im, X(sp.x + dx), Y(sp.y + dy), sp.w * s, sp.h * s)
        ctx.filter = 'none'
        if (pose === 'active' || pose === 'talk') {
          // breathe extra glow onto the painted amber eyes
          const pulse = reduceMotion ? 0.3 : 0.28 + 0.1 * Math.sin(now / 640)
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          for (const [ex, ey] of sp.eyes) {
            const gx = X(ex + dx)
            const gy = Y(ey + dy)
            const g = ctx.createRadialGradient(gx, gy, 1, gx, gy, 16 * s)
            g.addColorStop(0, `rgba(255,190,80,${pulse})`)
            g.addColorStop(1, 'rgba(255,190,80,0)')
            ctx.fillStyle = g
            ctx.beginPath()
            ctx.arc(gx, gy, 16 * s, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.restore()
        }
      }
      const pose = (on: boolean, sleeps: boolean): Pose =>
        on ? 'active' : night && sleeps ? 'sleep' : 'idle'
      const ease01 = (u: number) => {
        const c = Math.max(0, Math.min(1, u))
        return c < 0.5 ? 2 * c * c : 1 - (-2 * c + 2) ** 2 / 2
      }
      // strategy at the laptop — active while the RFC artifact is fresh
      sprite(SPRITES.strategy, pose(stratOn, true), 0, bob(3200, 1.5, stratOn))
      // hall pair — on a real handoff they STEP together (500ms ease in),
      // talk for ~8s with a nod, then ease back to their marks (600ms)
      const step =
        meetTalkUntil > 0 && !reduceMotion
          ? ease01((now - (meetTalkUntil - 8000)) / 500) * (1 - ease01((now - meetTalkUntil) / 600))
          : 0
      const meetPose: Pose = talking ? 'talk' : night ? 'sleep' : 'idle'
      sprite(SPRITES.meetA, meetPose, 14 * step, bob(1800, 1, talking))
      sprite(SPRITES.meetB, meetPose, -14 * step, bob(1800, 1, talking, Math.PI))
      // build at the tablet — active while the last commit is fresh
      sprite(SPRITES.build, pose(buildOn, true), 0, bob(2800, 1.5, buildOn))
      // chief: smoked visor, no eye glow — idle, gentle bob after a real run
      sprite(
        SPRITES.chief,
        night && !chiefRan && !chiefDown ? 'sleep' : 'idle',
        0,
        bob(3600, 1, chiefRan),
      )
      // the pit never dims — SYSTEMS NEVER SLEEP. A fresh heartbeat sends
      // each bot easing toward its prop (locker / charts / stack) and back;
      // between heartbeats they stand on their marks. Never constant walking.
      const exc = (t0: number) => {
        const t = now - t0
        if (reduceMotion || t < 0 || t > 1800) return 0
        if (t < 600) return ease01(t / 600)
        if (t < 1100) return 1
        return 1 - ease01((t - 1100) / 700)
      }
      sprite(SPRITES.kernel, wd && !kill ? 'active' : 'idle', -10 * exc(kernelExcT0), 0)
      sprite(
        SPRITES.live,
        liveHb ? 'active' : !liveStale ? 'sleep' : 'idle',
        10 * exc(liveExcT0),
        0,
      )
      sprite(
        SPRITES.paper,
        paperHb ? 'active' : !paperStale ? 'sleep' : 'idle',
        8 * exc(paperExcT0),
        0,
      )

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

        // ── the Nightbell on the chief's table glows while doctor is unhappy ──
        // same conditions as a warn banner; a green doctor leaves it a bell
        if (warn) {
          const ring = reduceMotion ? 0.45 : 0.34 + 0.22 * Math.sin(now / 800)
          const gx = X(NIGHTBELL.x)
          const gy = Y(NIGHTBELL.y)
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          const g = ctx.createRadialGradient(gx, gy, 1, gx, gy, 34 * s)
          g.addColorStop(0, `rgba(255,120,60,${ring})`)
          g.addColorStop(0.55, `rgba(255,140,70,${ring * 0.45})`)
          g.addColorStop(1, 'rgba(255,120,60,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(gx, gy, 34 * s, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      // ── ?office=demo is labeled — the stage never fakes silently ──
      if (officeDemo) {
        ctx.fillStyle = 'rgba(36,22,16,0.92)'
        ctx.beginPath()
        ctx.roundRect(X(1655), Y(162), 116 * s, 46 * s, 8 * s)
        ctx.fill()
        ctx.strokeStyle = 'rgba(245,184,74,0.55)'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = AMBER
        ctx.font = `bold ${Math.max(10, 26 * s)}px ${MONO}`
        ctx.textAlign = 'center'
        ctx.fillText('DEMO', X(1713), Y(195))
        ctx.textAlign = 'left'
      }

      // ── bubbles: drawn only when there is something true to say ──
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
      if (stratText) bubble(BUBBLE_STRAT.cx, BUBBLE_STRAT.top, stratText, 320)
      if (talking) bubble(BUBBLE_MEET.cx, BUBBLE_MEET.top, 'RFC looks steady.', 280)
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
      if (liveHb && !reduceMotion) {
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
      if (reduceMotion) packets.length = 0
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

  // ── pointer layer: every bot is clickable — it opens the panel that ──
  // already tells its story, and hovers say name + last real event
  const botAt = (px: number, py: number): keyof typeof SPRITES | null => {
    const { s, ox, oy } = viewRef.current
    const cx = (px - ox) / s
    const cy = (py - oy) / s
    for (const key of Object.keys(SPRITES) as (keyof typeof SPRITES)[]) {
      const sp = SPRITES[key]
      if (cx >= sp.x && cx <= sp.x + sp.w && cy >= sp.y && cy <= sp.y + sp.h) return key
    }
    return null
  }
  const botLabel = (key: keyof typeof SPRITES): string => {
    const chiefSeat = seats.find((se) => se.name === 'chief')
    switch (key) {
      case 'strategy':
        return `STRATEGY · ${company?.strategy_at ? `rfc ${agoText(company.strategy_at)}` : 'quiet'}`
      case 'meetA':
      case 'meetB':
        return `HALL · ${company?.strategy_at ? `handoff ${agoText(company.strategy_at)}` : 'no handoff yet'}`
      case 'build':
        return `BUILD · ${company?.build_at ? `shipped ${agoText(company.build_at)}` : 'nothing shipped'}`
      case 'chief':
        return chiefSeat?.status === 'failed'
          ? 'CHIEF · last run FAILED'
          : `CHIEF · brief ${agoText(chiefSeat?.ran_at)}`
      case 'kernel':
        return trading?.kill_switch
          ? 'KERNEL · KILL ACTIVE'
          : `KERNEL · watchdog ${trading?.modes?.live?.watchdog_armed || trading?.modes?.paper?.watchdog_armed ? 'armed' : 'off'}`
      case 'live':
      case 'paper': {
        const m = trading?.modes?.[key]
        if (!m) return `${key.toUpperCase()} · no telemetry`
        return m.status === 'alive'
          ? `${key.toUpperCase()} · hb ${Math.round(m.heartbeat_age_s ?? 0)}s ago`
          : `${key.toUpperCase()} · ${m.status}`
      }
    }
  }
  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const key = botAt(e.clientX - r.left, e.clientY - r.top)
    setHover(key ? { x: e.clientX - r.left, y: e.clientY - r.top, text: botLabel(key) } : null)
  }
  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const key = botAt(e.clientX - r.left, e.clientY - r.top)
    if (!key) return
    const el = document.getElementById(BOT_PANEL[key])
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    el.animate(
      [
        { boxShadow: `0 0 0 2px ${AMBER}66, 0 8px 24px rgba(16,10,4,0.34)` },
        { boxShadow: '0 8px 24px rgba(16,10,4,0.34)' },
      ],
      { duration: 1400, easing: 'ease-out' },
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <canvas
        ref={canvasRef}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onClick={onClick}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          minHeight: 0,
          cursor: hover ? 'pointer' : 'default',
        }}
      />
      {hover && (
        <div
          style={{
            position: 'absolute',
            left: Math.max(8, hover.x - 60),
            top: Math.max(8, hover.y - 40),
            background: 'rgba(36,22,16,0.94)',
            border: '1px solid rgba(245,184,74,0.4)',
            borderRadius: 6,
            color: CREAM,
            fontFamily: MONO,
            fontSize: 11,
            padding: '4px 8px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {hover.text}
        </div>
      )}
    </div>
  )
}
