// The stage: WARM EMBER TERRARIUM A — composed from the asset pack.
//
// Art lives in assets/terrarium/* (skill: terrarium-art; reference:
// docs/art/warm-ember-reference.png). This component PLACES sprites and
// draws only the live telemetry layer on top: the banner (doctor truth),
// eye glows and sleep lids, lamp/candle light, lock state, chart lines,
// bubbles, name tags, the patrol, and the RFC/brief packets. If it isn't
// telemetry or a sprite, it doesn't get drawn here.

import { useEffect, useRef, useState } from 'react'
import doorsUrl from '../../../assets/terrarium/elevator-doors.svg'
import bookshelfUrl from '../../../assets/terrarium/props/bookshelf.svg'
import candleUrl from '../../../assets/terrarium/props/candle.svg'
import chartsUrl from '../../../assets/terrarium/props/charts.svg'
import laptopUrl from '../../../assets/terrarium/props/laptop.svg'
import lockerUrl from '../../../assets/terrarium/props/locker.svg'
import nightbellUrl from '../../../assets/terrarium/props/nightbell.svg'
import passUrl from '../../../assets/terrarium/props/pass-stack.svg'
import plantUrl from '../../../assets/terrarium/props/plant.svg'
import tabletUrl from '../../../assets/terrarium/props/tablet.svg'
import chiefUrl from '../../../assets/terrarium/robot-chief-red.svg'
import idleUrl from '../../../assets/terrarium/robot-cream-idle.svg'
import laptopPoseUrl from '../../../assets/terrarium/robot-cream-laptop.svg'
import tabletPoseUrl from '../../../assets/terrarium/robot-cream-tablet.svg'
import talkUrl from '../../../assets/terrarium/robot-cream-talk.svg'
import stageBgUrl from '../../../assets/terrarium/stage-bg.svg'
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

const SPRITES: Record<string, HTMLImageElement> = {}
function sprite(url: string): HTMLImageElement {
  let img = SPRITES[url]
  if (!img) {
    img = new Image()
    img.src = url
    SPRITES[url] = img
  }
  return img
}

// ── anchors in stage-bg space (1200 × 800) ──────────────────────────────────
const BG_W = 1200
const BG_H = 800
const G3 = 312
const G2 = 540
const G1 = 748
const PATROL = { x0: 300, x1: 700, period: 19000 }
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
          [215, G3 - 90],
          [626, G3 - 90],
          [626, G2 - 90],
          [340, G2 - 90],
        ],
      })
    const spawnBrief = (now: number) =>
      packets.length < 2 &&
      packets.push({
        kind: 'brief',
        t0: now,
        dur: 2600,
        pts: [
          [930, G2 - 120],
          [1120, G2 - 160],
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

      const s = Math.min(rect.width / BG_W, rect.height / BG_H)
      const ox = (rect.width - BG_W * s) / 2
      const oy = (rect.height - BG_H * s) / 2
      const X = (bx: number) => ox + bx * s
      const Y = (by: number) => oy + by * s
      ctx.fillStyle = '#120a07'
      ctx.fillRect(0, 0, rect.width, rect.height)

      const bg = sprite(stageBgUrl)
      if (bg.complete && bg.naturalWidth) ctx.drawImage(bg, ox, oy, BG_W * s, BG_H * s)

      const phase = getPhase(trading?.market)
      const night = phase === 'night'
      if (!night) {
        ctx.fillStyle = phase === 'day' ? 'rgba(255,225,170,0.05)' : 'rgba(240,150,80,0.05)'
        ctx.fillRect(X(96), Y(100), 1008 * s, 648 * s)
      }

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

      // ── the banner: the doctor's truth ──
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
        const bx = X(96)
        const by = Y(30)
        const bw = 1008 * s
        const bh = 54 * s
        ctx.fillStyle = warn ? '#a8501e' : '#241610'
        ctx.beginPath()
        ctx.roundRect(bx, by, bw, bh, 8 * s)
        ctx.fill()
        const ix = bx + 34 * s
        const iy = by + bh / 2
        if (warn) {
          ctx.fillStyle = CREAM
          ctx.beginPath()
          ctx.moveTo(ix, iy - bh * 0.26)
          ctx.lineTo(ix - bh * 0.26, iy + bh * 0.22)
          ctx.lineTo(ix + bh * 0.26, iy + bh * 0.22)
          ctx.closePath()
          ctx.fill()
          ctx.fillStyle = '#a8501e'
          ctx.font = `bold ${bh * 0.44}px ${MONO}`
          ctx.textAlign = 'center'
          ctx.fillText('!', ix, iy + bh * 0.15)
        } else {
          ctx.fillStyle = kill ? '#c94f42' : '#7fb069'
          ctx.beginPath()
          ctx.arc(ix, iy, bh * 0.13, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = warn ? CREAM : 'rgba(239,227,200,0.45)'
        ctx.font = `bold ${Math.max(11, bh * 0.42)}px ${MONO}`
        ctx.textAlign = 'left'
        ctx.fillText(text, ix + 26 * s, iy + bh * 0.15)
        const wx2 = bx + bw - 64 * s
        ctx.strokeStyle = warn ? 'rgba(239,227,200,0.85)' : 'rgba(239,227,200,0.4)'
        ctx.lineWidth = Math.max(1.5, bh * 0.06)
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath()
          ctx.arc(wx2, iy + bh * 0.18, bh * 0.14 * i, Math.PI * 1.22, Math.PI * 1.78)
          ctx.stroke()
        }
        ctx.fillStyle = warn ? 'rgba(239,227,200,0.85)' : 'rgba(239,227,200,0.4)'
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(
            bx + bw - 34 * s + i * 8 * s,
            iy + bh * 0.2 - (i + 1) * bh * 0.11,
            5 * s,
            (i + 1) * bh * 0.11,
          )
        }
      }

      // ── helpers ──
      const place = (url: string, bx: number, by: number, bw: number, bh: number) => {
        const img = sprite(url)
        if (img.complete && img.naturalWidth) ctx.drawImage(img, X(bx), Y(by), bw * s, bh * s)
      }
      const shadow = (bx: number, gy: number, bw: number) => {
        ctx.fillStyle = 'rgba(10,6,3,0.4)'
        ctx.save()
        ctx.translate(X(bx), Y(gy))
        ctx.scale(1, 0.3)
        ctx.beginPath()
        ctx.arc(0, 0, bw * s * 0.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      const eyes = (
        cx: number,
        groundY: number,
        h: number,
        state: { working: boolean; sleep: boolean; down: boolean },
      ) => {
        const ex = X(cx)
        const ey = Y(groundY - h + (46 / 132) * h)
        const r = h * s * 0.055
        const gap = h * s * 0.1
        if (state.sleep) {
          ctx.strokeStyle = 'rgba(245,184,74,0.5)'
          ctx.lineWidth = Math.max(1.2, h * s * 0.016)
          for (const sd of [-1, 1]) {
            ctx.beginPath()
            ctx.arc(ex + sd * gap, ey - r * 0.2, r * 0.8, Math.PI * 0.15, Math.PI * 0.85)
            ctx.stroke()
          }
          return
        }
        const blink = Math.floor((now + cx * 13) / 230) % 26 === 0
        const color = state.down ? '#f0716a' : AMBER
        for (const sd of [-1, 1]) {
          const px = ex + sd * gap
          if (!blink) {
            const g = ctx.createRadialGradient(px, ey, 1, px, ey, r * (state.working ? 3.4 : 2.2))
            g.addColorStop(0, state.working ? 'rgba(245,184,74,0.55)' : 'rgba(245,184,74,0.3)')
            g.addColorStop(1, 'rgba(245,184,74,0)')
            ctx.fillStyle = g
            ctx.beginPath()
            ctx.arc(px, ey, r * 3.4, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.ellipse(px, ey, r, blink ? r * 0.14 : r, 0, 0, Math.PI * 2)
          ctx.fill()
          if (!blink) {
            ctx.fillStyle = 'rgba(255,255,255,0.8)'
            ctx.beginPath()
            ctx.arc(px - r * 0.3, ey - r * 0.32, r * 0.22, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
      const flame = (bx: number, by: number, sc: number) => {
        const fl = 0.75 + 0.25 * Math.sin(now / 160 + bx)
        ctx.fillStyle = '#f6c05a'
        ctx.beginPath()
        ctx.ellipse(X(bx), Y(by), 4 * s * sc, 7 * s * sc * fl, 0, 0, Math.PI * 2)
        ctx.fill()
        const g = ctx.createRadialGradient(X(bx), Y(by), 1, X(bx), Y(by), 40 * s * sc)
        g.addColorStop(0, `rgba(246,192,90,${0.28 * fl})`)
        g.addColorStop(1, 'rgba(246,192,90,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(X(bx), Y(by), 40 * s * sc, 0, Math.PI * 2)
        ctx.fill()
      }
      const lampGlow = (bx: number, by: number, on: boolean, groundY: number) => {
        if (!on) return
        ctx.fillStyle = '#ffedc4'
        ctx.beginPath()
        ctx.ellipse(X(bx), Y(by), 13 * s, 5 * s, 0, 0, Math.PI * 2)
        ctx.fill()
        const cone = ctx.createLinearGradient(0, Y(by), 0, Y(groundY))
        cone.addColorStop(0, 'rgba(246,197,110,0.22)')
        cone.addColorStop(1, 'rgba(246,197,110,0.015)')
        ctx.fillStyle = cone
        ctx.beginPath()
        ctx.moveTo(X(bx - 26), Y(by))
        ctx.lineTo(X(bx + 26), Y(by))
        ctx.lineTo(X(bx + 105), Y(groundY))
        ctx.lineTo(X(bx - 105), Y(groundY))
        ctx.closePath()
        ctx.fill()
      }

      lampGlow(360, 142, stratOn, G3)
      lampGlow(1014, 140, meetOn, G3)
      lampGlow(318, 374, buildOn, G2)

      // elevator doors + R light
      place(doorsUrl, 556, 184, 140, 128)
      place(doorsUrl, 556, 392, 140, 148)
      {
        const rfcHot = freshISO(company?.strategy_at) || packets.some((p) => p.kind === 'rfc')
        ctx.fillStyle = rfcHot ? AMBER : '#3a2c1a'
        ctx.beginPath()
        ctx.arc(X(612), Y(334), 5 * s, 0, Math.PI * 2)
        ctx.fill()
      }

      // 3F: strategy corner + meet pair
      place(plantUrl, 118, G3 - 62, 46, 62)
      place(bookshelfUrl, 258, G3 - 66, 80, 66)
      shadow(215, G3, 70)
      place(laptopPoseUrl, 180, G3 - 100, 76, 100)
      eyes(218, G3, 100, { working: stratOn, sleep: night && !stratOn, down: false })
      place(laptopUrl, 236, G3 - 46, 42, 32)
      shadow(912, G3, 62)
      shadow(985, G3, 62)
      place(talkUrl, 878, G3 - 96, 72, 96)
      {
        const img = sprite(talkUrl)
        if (img.complete && img.naturalWidth) {
          ctx.save()
          ctx.translate(X(985), Y(G3 - 96))
          ctx.scale(-1, 1)
          ctx.drawImage(img, -36 * s, 0, 72 * s, 96 * s)
          ctx.restore()
        }
      }
      eyes(914, G3, 96, { working: meetOn, sleep: night && !meetOn, down: false })
      eyes(985, G3, 96, { working: meetOn, sleep: night && !meetOn, down: false })
      place(candleUrl, 1042, G3 - 66, 14, 26)
      flame(1049, G3 - 70, 1)
      place(plantUrl, 1076, G3 - 68, 30, 40)

      // 2F: build + chief
      shadow(330, G2, 66)
      place(tabletPoseUrl, 294, G2 - 100, 76, 100)
      eyes(332, G2, 100, { working: buildOn, sleep: night && !buildOn, down: false })
      place(tabletUrl, 314, G2 - 56, 38, 26)
      if (buildOn) {
        ctx.fillStyle = 'rgba(111,148,96,0.85)'
        ctx.fillRect(X(317), Y(G2 - 53.5), 32 * s, 21 * s)
      }
      shadow(930, G2, 78)
      place(chiefUrl, 886, G2 - 124, 90, 124)
      if (chiefDown) {
        ctx.fillStyle = 'rgba(240,113,106,0.55)'
        ctx.fillRect(X(910), Y(G2 - 84), 42 * s, 5 * s)
      } else if (night && !chiefRan) {
        ctx.strokeStyle = 'rgba(122,200,190,0.25)'
        ctx.lineWidth = Math.max(1, 2 * s)
        ctx.beginPath()
        ctx.moveTo(X(912), Y(G2 - 80))
        ctx.lineTo(X(950), Y(G2 - 80))
        ctx.stroke()
      }
      place(nightbellUrl, 1040, G2 - 96, 26, 30)
      {
        const tail3 = (trading?.alerts ?? []).slice(-3).join(' ')
        const ringing = /NOT READY|KILL|stranded|SEAT DOWN|stale/i.test(tail3)
        if (ringing) {
          const g = ctx.createRadialGradient(X(1053), Y(G2 - 84), 1, X(1053), Y(G2 - 84), 34 * s)
          g.addColorStop(0, 'rgba(240,113,106,0.4)')
          g.addColorStop(1, 'rgba(240,113,106,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(X(1053), Y(G2 - 84), 34 * s, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      place(candleUrl, 1028, G2 - 66, 14, 26)
      flame(1035, G2 - 70, 1)
      place(plantUrl, 1092, G2 - 66, 28, 38)

      // 1F: pit patrol
      place(lockerUrl, 150, G1 - 96, 46, 96)
      {
        const lockC = kill ? '#f0716a' : wd ? '#7fb069' : AMBER
        ctx.strokeStyle = lockC
        ctx.lineWidth = Math.max(1.5, 3 * s)
        ctx.beginPath()
        if (kill) ctx.arc(X(180), Y(G1 - 44), 7 * s, Math.PI * 0.9, Math.PI * 1.9)
        else ctx.arc(X(173), Y(G1 - 44), 7 * s, Math.PI, 0)
        ctx.stroke()
        ctx.fillStyle = lockC
        ctx.fillRect(X(166), Y(G1 - 44), 14 * s, 10 * s)
      }
      place(chartsUrl, 366, 588, 62, 44)
      place(chartsUrl, 438, 596, 54, 38)
      ctx.strokeStyle = liveHb ? '#7fb069' : '#4a3a28'
      ctx.lineWidth = Math.max(1, 1.6 * s)
      for (const [cx0, cy0, cw, chh] of [
        [370, 620, 54, 26],
        [441, 626, 48, 22],
      ] as const) {
        ctx.beginPath()
        for (let i = 0; i <= 10; i++) {
          const vx = X(cx0 + (i * cw) / 10)
          const vy = Y(cy0 - Math.abs(Math.sin(i * 1.7 + cx0)) * chh)
          if (i === 0) ctx.moveTo(vx, vy)
          else ctx.lineTo(vx, vy)
        }
        ctx.stroke()
      }
      place(passUrl, 660, G1 - 60, 54, 32)

      const pit: {
        cx: number
        tag: string
        st: { working: boolean; sleep: boolean; down: boolean }
        walk?: boolean
      }[] = [
        { cx: 255, tag: 'KERNEL', st: { working: wd && !kill, sleep: false, down: kill } },
        {
          cx: 420,
          tag: 'LIVE',
          st: { working: liveHb, sleep: night && !liveHb && !liveStale, down: liveStale },
          walk: liveHb,
        },
        {
          cx: 585,
          tag: 'PAPER',
          st: { working: paperHb, sleep: night && !paperHb && !paperStale, down: paperStale },
        },
      ]
      for (const p of pit) {
        let cx = p.cx
        let flip = false
        if (p.walk) {
          const t = (now % PATROL.period) / PATROL.period
          const goingRight = t < 0.5
          const uu = goingRight ? t * 2 : 1 - (t - 0.5) * 2
          cx = PATROL.x0 + (PATROL.x1 - PATROL.x0) * uu
          flip = !goingRight
        }
        shadow(cx, G1, 60)
        const img = sprite(idleUrl)
        if (img.complete && img.naturalWidth) {
          if (flip) {
            ctx.save()
            ctx.translate(X(cx), Y(G1 - 90))
            ctx.scale(-1, 1)
            ctx.drawImage(img, -34 * s, 0, 68 * s, 90 * s)
            ctx.restore()
          } else {
            ctx.drawImage(img, X(cx - 34), Y(G1 - 90), 68 * s, 90 * s)
          }
        }
        eyes(cx, G1, 90, p.st)
        ctx.font = `bold ${Math.max(8, 15 * s)}px ${MONO}`
        const tw = ctx.measureText(p.tag).width + 18 * s
        const tx = X(cx) - tw / 2
        const ty = Y(G1 - 90) - 30 * s
        ctx.save()
        ctx.shadowColor = 'rgba(18,10,6,0.4)'
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.roundRect(tx, ty, tw, 22 * s, 8 * s)
        ctx.moveTo(X(cx) - 5 * s, ty + 22 * s)
        ctx.lineTo(X(cx), ty + 29 * s)
        ctx.lineTo(X(cx) + 5 * s, ty + 22 * s)
        ctx.closePath()
        ctx.fillStyle = CREAM
        ctx.fill()
        ctx.shadowColor = 'transparent'
        ctx.fillStyle = '#3b2a1a'
        ctx.textAlign = 'center'
        ctx.fillText(p.tag, X(cx), ty + 15.5 * s)
        ctx.textAlign = 'left'
        ctx.restore()
        if (p.tag === 'KERNEL') flame(cx + 22, G1 - 62, 0.7)
        if (p.tag === 'PAPER') place(tabletUrl, cx + 12, G1 - 58, 26, 18)
      }
      place(candleUrl, 1072, G1 - 62, 14, 26)
      flame(1079, G1 - 66, 1)
      place(plantUrl, 1110, G1 - 60, 26, 34)
      {
        const pulse = 0.1 + 0.05 * Math.sin(now / 900)
        const g = ctx.createRadialGradient(X(980), Y(734), 1, X(980), Y(734), 110 * s)
        g.addColorStop(0, `rgba(232,138,46,${pulse})`)
        g.addColorStop(1, 'rgba(232,138,46,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.ellipse(X(980), Y(730), 118 * s, 48 * s, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── one speech bubble at a time ──
      const chiefBubble = chiefOk
        ? 'brief sent — floor is yours'
        : company?.strategy_verdict
          ? `strategy: ${company.strategy_verdict.slice(0, 26)}`
          : night
            ? 'night watch — no brief'
            : null
      const speakers: { cx: number; topY: number; text: string }[] = []
      const stratText = stratOn
        ? (company?.strategy_verdict ?? 'writing the RFC').slice(0, 30)
        : night
          ? 'Quiet shift tonight'
          : null
      if (stratText) speakers.push({ cx: 218, topY: G3 - 108, text: stratText })
      if (meetOn) speakers.push({ cx: 950, topY: G3 - 104, text: 'RFC looks steady.' })
      if (chiefBubble) speakers.push({ cx: 930, topY: G2 - 132, text: chiefBubble })
      if (speakers.length) {
        const pick = speakers[Math.floor(now / 5000) % speakers.length]
        ctx.font = `bold ${Math.max(9, 17 * s)}px ${MONO}`
        const tw = Math.min(ctx.measureText(pick.text).width + 26 * s, 380 * s)
        const bh2 = 30 * s
        const bx2 = Math.max(X(100), Math.min(X(1100) - tw, X(pick.cx) - tw / 2))
        const by2 = Y(pick.topY) - bh2 - 12 * s
        const tipX = Math.max(bx2 + 12 * s, Math.min(bx2 + tw - 12 * s, X(pick.cx)))
        ctx.save()
        ctx.shadowColor = 'rgba(18,10,6,0.45)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetY = 2
        ctx.beginPath()
        ctx.roundRect(bx2, by2, tw, bh2, 10 * s)
        ctx.moveTo(tipX - 6 * s, by2 + bh2)
        ctx.lineTo(tipX, by2 + bh2 + 9 * s)
        ctx.lineTo(tipX + 6 * s, by2 + bh2)
        ctx.closePath()
        ctx.fillStyle = CREAM
        ctx.fill()
        ctx.shadowColor = 'transparent'
        ctx.strokeStyle = 'rgba(217,164,65,0.55)'
        ctx.lineWidth = 1.2
        ctx.stroke()
        ctx.fillStyle = '#3b2a1a'
        ctx.textAlign = 'center'
        ctx.fillText(pick.text, bx2 + tw / 2, by2 + bh2 * 0.68)
        ctx.textAlign = 'left'
        ctx.restore()
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
        const w = 30 * s
        if (t <= 1) {
          ctx.save()
          ctx.shadowColor = 'rgba(10,6,3,0.4)'
          ctx.shadowBlur = 5
          if (p.kind === 'rfc') {
            ctx.fillStyle = '#e8c94a'
            ctx.beginPath()
            ctx.roundRect(qx - w / 2, qy - w * 0.34, w, w * 0.62, 2)
            ctx.fill()
            ctx.shadowColor = 'transparent'
            ctx.fillStyle = '#d9b433'
            ctx.fillRect(qx - w / 2, qy - w * 0.34, w * 0.45, w * 0.16)
          } else {
            ctx.fillStyle = CREAM
            ctx.beginPath()
            ctx.roundRect(qx - w / 2, qy - w * 0.3, w, w * 0.58, 2)
            ctx.fill()
            ctx.shadowColor = 'transparent'
            ctx.strokeStyle = 'rgba(217,164,65,0.55)'
            ctx.beginPath()
            ctx.moveTo(qx - w / 2, qy - w * 0.3)
            ctx.lineTo(qx, qy + w * 0.05)
            ctx.lineTo(qx + w / 2, qy - w * 0.3)
            ctx.stroke()
          }
          ctx.restore()
        } else {
          const f = (t - 1) / 0.1
          const g = ctx.createRadialGradient(qx, qy, 0, qx, qy, 40 * s)
          g.addColorStop(0, `rgba(232,201,74,${0.5 * (1 - f)})`)
          g.addColorStop(1, 'rgba(232,201,74,0)')
          ctx.fillStyle = g
          ctx.fillRect(qx - 40 * s, qy - 40 * s, 80 * s, 80 * s)
        }
      }

      const vg = ctx.createRadialGradient(
        rect.width / 2,
        rect.height * 0.55,
        rect.height * 0.3,
        rect.width / 2,
        rect.height * 0.55,
        rect.width * 0.7,
      )
      vg.addColorStop(0, 'rgba(0,0,0,0)')
      vg.addColorStop(1, 'rgba(10,5,2,0.3)')
      ctx.fillStyle = vg
      ctx.fillRect(0, 0, rect.width, rect.height)

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
