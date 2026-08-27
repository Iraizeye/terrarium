// The office, in three layers (skill: terrarium-art — art lock Warm Ember):
//
//   Telemetry (real)                    /api/desk /api/company /api/home + store
//     → Office Director (tiny state machine, in this file)
//         strategy: idle | research      build: idle | coding
//         chief:    idle | brief | alert pit:   idle | check
//         hall:     idle | meet
//     → Pixi stage (officeStage.ts)     sprite-sheet clips + walk to mark
//     → overlay canvas (this file)      banner · bubbles · LEDs · packets ·
//                                       Nightbell · patrol · DEMO tag
//
// The stage plays clips; the Director decides them from REAL state only.
// Bubbles quote real artifacts (verdicts, RFC names, doctor lines, brief
// times) — never invented thoughts. Reduce Motion = the static painting.

import { useEffect, useRef, useState } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { getPhase } from '../theme'
import { MONO } from '../ui'
import {
  BOTS,
  type BotKey,
  CROP,
  createOfficeStage,
  type OfficeStage,
  type Orders,
} from './officeStage'

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

function words(text: string, max: number): string {
  const w = text.split(/\s+/)
  return w.length <= max ? text : `${w.slice(0, max).join(' ')}…`
}

function agoText(iso?: string | null): string {
  if (!iso) return 'no run yet'
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 60 * 48) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}

// regions/anchors in CROP space
const BANNER = { x: 128, y: 42, w: 1648, h: 98 }
const BUBBLE_STRAT = { cx: 605, top: 270 }
const BUBBLE_MEET = { cx: 1415, top: 272 }
const BUBBLE_BUILD = { cx: 620, top: 600 }
const CHIEF_BUBBLE = { cx: 1440, top: 640 }
const NIGHTBELL = { x: 1632, y: 766 } // the painted bell on the chief's table
const LEDS = {
  strategy: { x: 540, y: 585 },
  build: { x: 618, y: 905 },
  chief: { x: 1452, y: 905 },
  kernel: { x: 505, y: 1250 },
  live: { x: 722, y: 1252 },
  paper: { x: 1012, y: 1252 },
}
const PATROL = { x0: 430, x1: 1180, y: 1300, period: 19000 }
const AMBER = '#f5b84a'
const CREAM = '#efe3c8'

// each bot opens the panel that already tells its story — no new pages
const BOT_PANEL: Record<BotKey, string> = {
  strategy: 'panel-departments',
  meetA: 'panel-departments',
  meetB: 'panel-departments',
  build: 'panel-departments',
  chief: 'panel-desk',
  kernel: 'panel-trading',
  live: 'panel-trading',
  paper: 'panel-trading',
}

export default function VesperFloor() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const stageRef = useRef<OfficeStage | null>(null)
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
    const host = hostRef.current
    const overlay = overlayRef.current
    if (!host || !overlay) return
    const ctx = overlay.getContext('2d')
    if (!ctx) return
    let disposed = false
    let raf = 0
    let lastNow = 0
    let lastW = 0
    let lastH = 0
    const params = new URLSearchParams(window.location.search)
    const frozenMs = Number(params.get('freeze')) || null
    const mailPreview = params.get('mail') === 'test'
    // ?office=demo — one scripted day cycle (research → handoff → build →
    // pit check → brief), DEMO plaque on the whole time, then real state
    const officeDemo = params.get('office') === 'demo'
    let demoT0: number | null = null
    const demoFired: Record<string, boolean> = {}
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let lastPreview = 0

    createOfficeStage(host).then((st) => {
      if (disposed) st.destroy()
      else stageRef.current = st
    })

    interface Packet {
      pts: [number, number][]
      t0: number
      dur: number
      kind: 'rfc' | 'brief'
    }
    const packets: Packet[] = []
    let seenStrategyAt: string | null | undefined
    let seenChiefRan: string | null | undefined
    let seenBuildAt: string | null | undefined
    let meetTalkUntil = 0 // real handoff opens ~8s of hall talk, then idle
    let buildBubbleUntil = 0
    // ── the handoff choreography (FLOORS are rails, ELEVATOR is vertical) ──
    // On a REAL RFC, strategy DELIVERS: walks the 3F rail to the elevator
    // carrying the folder, rides the car down (doors swallow the bot, the
    // folder shows in the shaft), steps onto the mid rail, walks to the
    // Build tablet, hands the folder over — Build works — then rides home.
    let handoffT0 = Number.NEGATIVE_INFINITY
    const ELEV_X = 985 // the shaft, both floors (CROP)
    const S_HOME = { cx: 489 + 156 / 2, feet: 345 + 210 + 6 } // strategy desk mark
    const B_HOME = { cx: 533 + 174 / 2, feet: 680 + 260 + 6 } // build tablet mark
    const S_DX = ELEV_X - S_HOME.cx // ≈ +418 along the 3F rail
    const RAIL_DY = B_HOME.feet - S_HOME.feet // 3F rail → mid rail
    const DELIVER_X = B_HOME.cx + 52 // hand-over spot beside the tablet
    const WALK_MS = (px: number) => Math.round((Math.abs(px) / 110) * 1000)
    const HO = (() => {
      const doors = 400 // fade at the elevator doors
      const shaft = 1500 // the car ride
      const walkS = WALK_MS(S_DX) // desk → elevator, 3F
      const walkD = WALK_MS(ELEV_X - DELIVER_X) // elevator → tablet, mid rail
      const enter = walkS // doors close on strategy
      const rideDown = enter + doors // folder visible in the shaft
      const exit2f = rideDown + shaft // doors open on the mid rail
      const deliver = exit2f + doors // walking to the tablet
      const handover = deliver + walkD + 400 // folder lands on the desk
      const back = handover + walkD // walked back to the elevator
      const rideUp = back + doors + shaft + doors // home floor again
      const done = rideUp + walkS // back at the desk
      return {
        doors,
        shaft,
        walkS,
        walkD,
        enter,
        rideDown,
        exit2f,
        deliver,
        handover,
        back,
        rideUp,
        done,
        workEnd: handover + 8000,
      }
    })()
    // pit checks: a fresh heartbeat sends each bot to its prop and back
    let prevLiveAge: number | null = null
    let prevPaperAge: number | null = null
    let liveExcT0 = Number.NEGATIVE_INFINITY
    let paperExcT0 = Number.NEGATIVE_INFINITY
    let kernelExcT0 = Number.NEGATIVE_INFINITY
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
      const dtMs = lastNow ? Math.min(100, rafNow - lastNow) : 16
      lastNow = rafNow
      const { seats, trading, company, doctor } = dataRef.current
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = host.getBoundingClientRect()
      overlay.width = rect.width * dpr
      overlay.height = rect.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, rect.width, rect.height)
      if (rect.width !== lastW || rect.height !== lastH) {
        lastW = rect.width
        lastH = rect.height
        stageRef.current?.resize()
      }

      const s = Math.min(rect.width / CROP.sw, rect.height / CROP.sh)
      const ox = (rect.width - CROP.sw * s) / 2
      const oy = (rect.height - CROP.sh * s) / 2
      viewRef.current = { s, ox, oy }
      const X = (cx: number) => ox + cx * s
      const Y = (cy: number) => oy + cy * s

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
      const notReady = /NOT READY/i.test(doctor?.line ?? '')
      const degraded = doctor?.green === false
      const noTel = !trading
      const warn = noTel || kill || notReady || degraded

      // ── real events → timers (first data load is a baseline, not an event) ──
      {
        if (company) {
          const at = company.strategy_at ?? null
          if (seenStrategyAt === undefined) seenStrategyAt = at
          else if (at && at !== seenStrategyAt) {
            handoffT0 = now
            meetTalkUntil = now + 8000
            seenStrategyAt = at
          }
          const ba = company.build_at ?? null
          if (seenBuildAt === undefined) seenBuildAt = ba
          else if (ba && ba !== seenBuildAt) {
            buildBubbleUntil = now + 6000
            seenBuildAt = ba
          }
        }
        if (chiefSeat) {
          const cr = chiefSeat.ran_at ?? null
          if (seenChiefRan === undefined) seenChiefRan = cr
          else if (cr && cr !== seenChiefRan) {
            spawnBrief(now)
            seenChiefRan = cr
          }
        }
        if (mailPreview && now - lastPreview > 24000) {
          lastPreview = now
          if (Math.floor(now / 24000) % 2) spawnBrief(now)
          else {
            handoffT0 = now
            meetTalkUntil = now + 8000
          }
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

      // ── the scripted demo day (labeled DEMO on the stage) ──
      let demo: { strat?: boolean; build?: boolean; chief?: boolean } = {}
      if (officeDemo) {
        if (demoT0 === null) demoT0 = now
        const t = now - demoT0
        if (t < 34000) {
          demo = {
            strat: t > 500 && t < 5000,
            chief: t > 28000 && t < 33000,
          }
          if (t > 5000 && !demoFired.rfc) {
            demoFired.rfc = true
            handoffT0 = now
            meetTalkUntil = now + 8000
          }
          if (t > 25000 && !demoFired.hb) {
            demoFired.hb = true
            liveExcT0 = now
            kernelExcT0 = now + 350
          }
          if (t > 29000 && !demoFired.brief) {
            demoFired.brief = true
            spawnBrief(now)
          }
        }
      }

      // ── the Office Director: telemetry in, named states out ──
      const talking = now < meetTalkUntil
      const strategyState = stratOn || demo.strat ? 'research' : 'idle'
      const buildState = buildOn || demo.build ? 'coding' : 'idle'
      const chiefState = warn ? 'alert' : chiefRan || demo.chief ? 'brief' : 'idle'
      const hallState = talking ? 'meet' : 'idle'
      const pitCheck = (t0: number, tx: number) => {
        const t = now - t0
        if (t < 0 || t > 2600) return { checking: false, tx: 0 }
        return { checking: true, tx: t < 1500 ? tx : 0 }
      }
      const kCheck = pitCheck(kernelExcT0, -10)
      const lCheck = pitCheck(liveExcT0, 10)
      const pCheck = pitCheck(paperExcT0, 8)
      // handoff phases: the sender rides the elevator and delivers in person
      const hoT = reduceMotion ? Number.POSITIVE_INFINITY : now - handoffT0
      const hoActive = hoT >= 0 && hoT < Math.max(HO.done, HO.workEnd)
      const inCar =
        hoActive && ((hoT >= HO.enter && hoT < HO.exit2f) || (hoT >= HO.back && hoT < HO.rideUp))
      const onMidRail = hoActive && hoT >= HO.exit2f && hoT < HO.rideUp
      let stratTx = 0
      if (hoActive) {
        if (hoT < HO.deliver)
          stratTx = S_DX // desk → elevator (and riding)
        else if (hoT < HO.handover)
          stratTx = DELIVER_X - S_HOME.cx // elevator → tablet
        else if (hoT < HO.back)
          stratTx = S_DX // tablet → elevator
        else if (hoT < HO.rideUp)
          stratTx = S_DX // riding up
        else stratTx = 0 // elevator → desk
      }
      const buildWorking = hoActive && hoT >= HO.handover && hoT < HO.workEnd

      // Director → stage orders (clip + walk target + dim)
      const orders: Orders = {
        strategy: {
          clip: strategyState === 'research' && !hoActive ? 'work' : 'idle',
          tx: stratTx,
          ty: onMidRail ? RAIL_DY : 0,
          hidden: inCar,
          dim: night && strategyState === 'idle' && !hoActive,
        },
        meetA: {
          clip: hallState === 'meet' ? 'talk' : 'idle',
          tx: hallState === 'meet' ? 34 : 0,
          dim: night && hallState === 'idle',
        },
        meetB: {
          clip: hallState === 'meet' ? 'talk' : 'idle',
          tx: hallState === 'meet' ? -34 : 0,
          dim: night && hallState === 'idle',
        },
        build: {
          clip: buildWorking || buildState === 'coding' ? 'work' : 'idle',
          tx: 0,
          dim: night && buildState === 'idle' && !hoActive,
        },
        chief: {
          clip: chiefState === 'alert' ? 'talk' : chiefState === 'brief' ? 'work' : 'idle',
          tx: 0,
          dim: night && chiefState === 'idle' && !chiefDown,
        },
        kernel: {
          clip: kCheck.checking ? 'work' : 'idle',
          tx: kCheck.tx,
          dim: false, // the pit never dims — SYSTEMS NEVER SLEEP
        },
        live: {
          clip: lCheck.checking ? 'work' : liveHb ? 'idle' : 'idle',
          tx: lCheck.tx,
          dim: !liveHb && !liveStale,
        },
        paper: {
          clip: pCheck.checking ? 'work' : 'idle',
          tx: pCheck.tx,
          dim: !paperHb && !paperStale,
        },
      }
      stageRef.current?.update(now, dtMs, orders, reduceMotion)

      // ── the banner: painted opaquely over the baked strip — doctor truth ──
      {
        const flat =
          (trading?.modes?.live?.open_positions?.length ?? 0) === 0 &&
          (trading?.modes?.paper?.open_positions?.length ?? 0) === 0
        let text: string
        if (noTel) text = 'TELEMETRY DOWN — NOT A VERDICT'
        else if (kill) text = 'KILL ACTIVE — BUYS HALTED'
        else if (notReady) text = `NOT READY — ${doctorCause(doctor?.line).toUpperCase()}`
        else if (degraded) text = `DEGRADED — ${doctorCause(doctor?.line).toUpperCase()}`
        else text = night && flat ? 'NIGHT WATCH · ALL QUIET' : 'ALL SYSTEMS GO'
        const bx = X(BANNER.x)
        const by = Y(BANNER.y)
        const bw = BANNER.w * s
        const bh = BANNER.h * s
        ctx.fillStyle = warn ? '#a8501e' : '#241610'
        ctx.beginPath()
        ctx.roundRect(bx, by, bw, bh, 10 * s)
        ctx.fill()
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

        // ── the Nightbell on the chief's table rings while doctor is unhappy ──
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

      // ── the RFC folder: carried on the rails, shown alone in the shaft ──
      if (hoActive && hoT < HO.workEnd) {
        let fx: number | null = null
        let fy = 0
        const offS = stageRef.current?.getOffset('strategy') ?? 0
        if (hoT < HO.enter) {
          fx = S_HOME.cx + offS + 45
          fy = S_HOME.feet - 95
        } else if (hoT >= HO.rideDown && hoT < HO.exit2f) {
          const p = (hoT - HO.rideDown) / HO.shaft
          const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
          fx = ELEV_X
          fy = 472 + (866 - 472) * e
        } else if (hoT >= HO.exit2f && hoT < HO.handover) {
          fx = S_HOME.cx + offS + 45
          fy = B_HOME.feet - 95
        } else if (hoT >= HO.handover) {
          fx = B_HOME.cx + 52
          fy = B_HOME.feet - 92
        }
        // fx === null → inside the elevator car with its courier
        if (fx !== null) {
          const w = 44 * s
          ctx.save()
          ctx.shadowColor = 'rgba(10,6,3,0.45)'
          ctx.shadowBlur = 6
          ctx.fillStyle = '#e8c94a'
          ctx.beginPath()
          ctx.roundRect(X(fx) - w / 2, Y(fy) - w * 0.34, w, w * 0.62, 3)
          ctx.fill()
          ctx.shadowColor = 'transparent'
          ctx.fillStyle = '#d9b433'
          ctx.fillRect(X(fx) - w / 2, Y(fy) - w * 0.34, w * 0.45, w * 0.16)
          ctx.restore()
        }
      }

      // ── bubbles: only real artifacts speak (truncated, never invented) ──
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

      const stratText =
        strategyState === 'research'
          ? company?.strategy_verdict
            ? words(company.strategy_verdict, 9)
            : 'writing the RFC'
          : night
            ? 'Quiet shift tonight'
            : null
      if (stratText) bubble(BUBBLE_STRAT.cx, BUBBLE_STRAT.top, stratText, 320)
      if (hallState === 'meet') {
        const rfcName = company?.rfcs?.[0]?.name
        bubble(
          BUBBLE_MEET.cx,
          BUBBLE_MEET.top,
          rfcName ? words(`RFC ${rfcName}`, 8) : 'RFC looks steady.',
          280,
        )
      }
      if (now < buildBubbleUntil && company?.build_at)
        bubble(BUBBLE_BUILD.cx, BUBBLE_BUILD.top, `shipped ${agoText(company.build_at)}`)
      const chiefText =
        chiefState === 'alert'
          ? words(doctorCause(doctor?.line) || 'telemetry down', 8)
          : chiefOk
            ? `brief filed ${agoText(chiefSeat?.ran_at)}`
            : null
      if (chiefText) bubble(CHIEF_BUBBLE.cx, CHIEF_BUBBLE.top, chiefText)

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
        const pts = p.pts.map(([bx2, by2]) => [X(bx2), Y(by2)] as [number, number])
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
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      stageRef.current?.destroy()
      stageRef.current = null
    }
  }, [])

  // ── pointer layer: click a bot → the panel that already tells its story ──
  const botAt = (px: number, py: number): BotKey | null => {
    const { s, ox, oy } = viewRef.current
    const cx = (px - ox) / s
    const cy = (py - oy) / s
    for (const key of Object.keys(BOTS) as BotKey[]) {
      const sp = BOTS[key]
      if (cx >= sp.x && cx <= sp.x + sp.w && cy >= sp.y && cy <= sp.y + sp.h) return key
    }
    return null
  }
  const botLabel = (key: BotKey): string => {
    const chiefSeat = seats.find((se) => se.name === 'chief')
    switch (key) {
      case 'strategy':
        return `STRATEGY · ${freshISO(company?.strategy_at) ? 'research' : 'idle'} · ${company?.strategy_at ? `rfc ${agoText(company.strategy_at)}` : 'quiet'}`
      case 'meetA':
      case 'meetB':
        return `HALL · ${company?.strategy_at ? `handoff ${agoText(company.strategy_at)}` : 'no handoff yet'}`
      case 'build':
        return `BUILD · ${freshISO(company?.build_at) ? 'coding' : 'idle'} · ${company?.build_at ? `shipped ${agoText(company.build_at)}` : 'nothing shipped'}`
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
    <div
      ref={hostRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        background: '#120a07',
      }}
    >
      <canvas
        ref={overlayRef}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onClick={onClick}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
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
