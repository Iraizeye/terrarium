// The Pixi stage: Warm Ember painting + articulated sprite-sheet bots
// (skill: terrarium-art). Renderer half only — the Office Director hands
// each bot an order (clip + walk target + rail + visibility) and the stage
// performs it: stepped body clips, a head that rotates on its neck pivot
// (glances on its own clock, nods while working, turns while talking,
// blinks), whole-body waddle frames while walking, floor shadows, door
// fades, firelight. Reduce Motion renders the static painting.

import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'
import buildSheetUrl from '../../../assets/terrarium/traced/sheets/build.png'
import buildHeadUrl from '../../../assets/terrarium/traced/sheets/build-head.png'
import chiefSheetUrl from '../../../assets/terrarium/traced/sheets/chief.png'
import chiefHeadUrl from '../../../assets/terrarium/traced/sheets/chief-head.png'
import kernelSheetUrl from '../../../assets/terrarium/traced/sheets/kernel.png'
import kernelHeadUrl from '../../../assets/terrarium/traced/sheets/kernel-head.png'
import liveSheetUrl from '../../../assets/terrarium/traced/sheets/live.png'
import liveHeadUrl from '../../../assets/terrarium/traced/sheets/live-head.png'
import meetASheetUrl from '../../../assets/terrarium/traced/sheets/meet-a.png'
import meetAHeadUrl from '../../../assets/terrarium/traced/sheets/meet-a-head.png'
import meetBSheetUrl from '../../../assets/terrarium/traced/sheets/meet-b.png'
import meetBHeadUrl from '../../../assets/terrarium/traced/sheets/meet-b-head.png'
import paperSheetUrl from '../../../assets/terrarium/traced/sheets/paper.png'
import paperHeadUrl from '../../../assets/terrarium/traced/sheets/paper-head.png'
import strategySheetUrl from '../../../assets/terrarium/traced/sheets/strategy.png'
import strategyHeadUrl from '../../../assets/terrarium/traced/sheets/strategy-head.png'
import stageBgUrl from '../../../assets/terrarium/traced/stage-bg.png'

export const CROP = { sx: 55, sy: 95, sw: 1893, sh: 1350 }
const PAD_X = 10
const PAD_Y = 8
const HEAD_PAD = 14
const BODY_ROW = { idle: 0, work: 1, talk: 2, walk: 3 } as const
export type ClipName = 'idle' | 'work' | 'talk'
export const WALK_SPEED = 110 // CROP px per second
const FRAME_MS = 150 // stepped, hand-animated cadence

// sprite boxes in CROP space + neck fraction (must match generate_frames.py)
export const BOTS = {
  strategy: {
    url: strategySheetUrl,
    head: strategyHeadUrl,
    x: 489,
    y: 345,
    w: 156,
    h: 210,
    headFrac: 0.42,
  },
  meetA: {
    url: meetASheetUrl,
    head: meetAHeadUrl,
    x: 1217,
    y: 351,
    w: 160,
    h: 212,
    headFrac: 0.42,
  },
  meetB: {
    url: meetBSheetUrl,
    head: meetBHeadUrl,
    x: 1363,
    y: 351,
    w: 142,
    h: 212,
    headFrac: 0.42,
  },
  build: { url: buildSheetUrl, head: buildHeadUrl, x: 533, y: 680, w: 174, h: 260, headFrac: 0.38 },
  chief: {
    url: chiefSheetUrl,
    head: chiefHeadUrl,
    x: 1360,
    y: 655,
    w: 170,
    h: 285,
    headFrac: 0.34,
  },
  kernel: {
    url: kernelSheetUrl,
    head: kernelHeadUrl,
    x: 420,
    y: 1050,
    w: 150,
    h: 205,
    headFrac: 0.42,
  },
  live: { url: liveSheetUrl, head: liveHeadUrl, x: 660, y: 1050, w: 143, h: 205, headFrac: 0.42 },
  paper: {
    url: paperSheetUrl,
    head: paperHeadUrl,
    x: 950,
    y: 1050,
    w: 160,
    h: 205,
    headFrac: 0.42,
  },
} as const
export type BotKey = keyof typeof BOTS

// the painting's own flames (CROP space); the kernel candle rides its bot
const FLAMES = [
  { x: 380, y: 280, r: 62, seed: 1, lamp: true },
  { x: 1595, y: 295, r: 62, seed: 2, lamp: true },
  { x: 385, y: 635, r: 48, seed: 3, lamp: true },
  { x: 1565, y: 400, r: 26, seed: 4 },
  { x: 1592, y: 755, r: 26, seed: 5 },
  { x: 1745, y: 1110, r: 30, seed: 6 },
  { x: 562, y: 1105, r: 22, seed: 7, follow: 'kernel' as BotKey },
]

export interface BotOrder {
  clip: ClipName // what to play once the bot is on its mark
  tx: number // walk target, CROP px offset from home mark
  dim: boolean // sleeping station — dimmed, slow frames, no blink
  ty?: number // vertical offset (elevator ride puts a 3F bot on the mid rail)
  hidden?: boolean // inside the elevator car — fades out at the doors
  face?: -1 | 1 // talk partner direction: head turns that way
}
export type Orders = Record<BotKey, BotOrder>

interface BotActor {
  root: Container
  body: Sprite
  headSprite: Sprite
  shadow: Graphics
  bodyFrames: Record<keyof typeof BODY_ROW, Texture[]>
  heads: { normal: Texture; blink: Texture; glow: Texture }
  home: { x: number; y: number }
  h: number
  headFrac: number
  hasEyes: boolean
  offset: number // current walk offset (CROP px)
  fade: number // 1 = visible, 0 = inside the elevator car
  seed: number
}

export interface OfficeStage {
  update: (now: number, dtMs: number, orders: Orders, reduceMotion: boolean) => void
  getOffset: (key: BotKey) => number
  resize: () => void
  destroy: () => void
}

export async function createOfficeStage(host: HTMLElement): Promise<OfficeStage> {
  const app = new Application()
  await app.init({
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  })
  app.canvas.style.position = 'absolute'
  app.canvas.style.inset = '0'
  host.prepend(app.canvas)

  const world = new Container()
  app.stage.addChild(world)

  const bgTex: Texture | null = await Assets.load(stageBgUrl).catch(() => null)
  if (bgTex) {
    const bg = new Sprite(
      new Texture({
        source: bgTex.source,
        frame: new Rectangle(CROP.sx, CROP.sy, CROP.sw, CROP.sh),
      }),
    )
    world.addChild(bg)
  }

  const botLayer = new Container()
  const glowLayer = new Container()
  world.addChild(botLayer)
  world.addChild(glowLayer)

  // soft radial: bright core fading to nothing — no visible circle edge
  const softGlow = (color: number, r: number) => {
    const g = new Graphics()
    for (let i = 5; i >= 1; i--) {
      g.circle(0, 0, (r * i) / 5)
      g.fill({ color, alpha: 0.06 * (6 - i) })
    }
    g.blendMode = 'add'
    return g
  }
  const flameGfx = FLAMES.map((f) => {
    const g = softGlow(0xffbe60, f.r)
    g.position.set(f.x, f.y)
    glowLayer.addChild(g)
    return g
  })
  const emblem = softGlow(0xff8c3c, 160)
  emblem.position.set(1410, 1160)
  glowLayer.addChild(emblem)

  const actors = {} as Record<BotKey, BotActor>
  let seedIdx = 0
  for (const key of Object.keys(BOTS) as BotKey[]) {
    const b = BOTS[key]
    const sheet: Texture | null = await Assets.load(b.url).catch(() => null)
    const headTex: Texture | null = await Assets.load(b.head).catch(() => null)
    if (!sheet || !headTex) continue
    const cw = b.w + 2 * PAD_X
    const ch = b.h + 2 * PAD_Y
    const bodyFrames = {} as BotActor['bodyFrames']
    for (const clip of Object.keys(BODY_ROW) as (keyof typeof BODY_ROW)[]) {
      bodyFrames[clip] = [0, 1, 2, 3].map(
        (col) =>
          new Texture({
            source: sheet.source,
            frame: new Rectangle(col * cw, BODY_ROW[clip] * ch, cw, ch),
          }),
      )
    }
    const headH = Math.round(b.h * b.headFrac)
    const hw = b.w + 2 * HEAD_PAD
    const hh = headH + 2 * HEAD_PAD
    const headCell = (i: number) =>
      new Texture({ source: headTex.source, frame: new Rectangle(i * hw, 0, hw, hh) })
    const heads = { normal: headCell(0), blink: headCell(1), glow: headCell(2) }

    const root = new Container()
    const home = { x: b.x + b.w / 2, y: b.y + b.h + PAD_Y }
    root.position.set(home.x, home.y)
    const shadow = new Graphics()
    shadow.ellipse(0, 0, b.w * 0.32, 9)
    shadow.fill({ color: 0x120a06, alpha: 1 })
    shadow.position.set(0, -2)
    shadow.alpha = 0.3
    const body = new Sprite(bodyFrames.idle[0])
    body.anchor.set(0.5, 1)
    const headSprite = new Sprite(heads.normal)
    // neck pivot: rotate around a point just above the cut line
    const pivotY = headH - 6 + HEAD_PAD
    headSprite.anchor.set(0.5, pivotY / hh)
    headSprite.position.set(0, -(b.h - (headH - 6)))
    root.addChild(shadow)
    root.addChild(body)
    root.addChild(headSprite)
    botLayer.addChild(root)
    actors[key] = {
      root,
      body,
      headSprite,
      shadow,
      bodyFrames,
      heads,
      home,
      h: b.h,
      headFrac: b.headFrac,
      hasEyes: key !== 'chief',
      offset: 0,
      fade: 1,
      seed: seedIdx++,
    }
  }

  const resize = () => {
    const w = host.clientWidth
    const h = host.clientHeight
    app.renderer.resize(w, h)
    const s = Math.min(w / CROP.sw, h / CROP.sh)
    world.scale.set(s)
    world.position.set((w - CROP.sw * s) / 2, (h - CROP.sh * s) / 2)
  }
  resize()

  const update = (now: number, dtMs: number, orders: Orders, reduceMotion: boolean) => {
    for (const key of Object.keys(actors) as BotKey[]) {
      const a = actors[key]
      const o = orders[key]
      if (!o) continue
      // walk toward the ordered mark at gait speed
      const d = o.tx - a.offset
      if (!reduceMotion && Math.abs(d) > 0.5) {
        const stepLen = (WALK_SPEED * dtMs) / 1000
        a.offset += Math.abs(d) <= stepLen ? d : Math.sign(d) * stepLen
      } else if (reduceMotion) {
        a.offset = o.tx
      }
      // elevator doors: fade out riding, fade back in on arrival
      const fadeTarget = o.hidden && !reduceMotion ? 0 : 1
      const fd = fadeTarget - a.fade
      if (Math.abs(fd) > 0.01) a.fade += Math.sign(fd) * Math.min(Math.abs(fd), dtMs / 350)
      else a.fade = fadeTarget
      const ty = o.ty ?? 0
      a.root.position.set(a.home.x + a.offset, a.home.y + ty)
      a.root.alpha = a.fade
      const walking = !reduceMotion && Math.abs(o.tx - a.offset) > 0.5
      // walking left reads better mirrored; home-facing is the painted pose
      a.root.scale.x = walking && d < 0 ? -1 : 1

      const cadence = o.dim ? FRAME_MS * 2 : FRAME_MS
      const frame = reduceMotion ? 0 : Math.floor(now / cadence + a.seed * 1.7) % 4
      if (walking) {
        // whole-body waddle frames carry the head
        a.body.texture = a.bodyFrames.walk[frame]
        a.headSprite.visible = false
        a.root.scale.y = 1
      } else {
        a.body.texture = a.bodyFrames[o.clip][frame]
        a.headSprite.visible = true
        // ── the head acts on its own ──
        let rot = 0
        let headTex = a.heads.normal
        if (!reduceMotion) {
          if (o.clip === 'work') {
            rot = 0.05 * Math.sin(now / 550 + a.seed * 2.1) // nodding at the desk
            if (a.hasEyes) headTex = a.heads.glow
          } else if (o.clip === 'talk') {
            rot = (o.face ?? 1) * 0.09 + 0.04 * Math.sin(now / 700 + a.seed) // turned to partner
            if (a.hasEyes) headTex = a.heads.glow
          } else {
            rot = 0.035 * Math.sin(now / 2300 + a.seed * 1.9) // idle drift
            // a scheduled glance — every bot looks around on its own clock
            const g = (now + a.seed * 3137) % 9600
            if (g < 1100 && !o.dim)
              rot += (a.seed % 2 ? 1 : -1) * 0.1 * Math.sin((Math.PI * g) / 1100)
          }
          // blink on the bot's own clock (never while dimmed)
          if (a.hasEyes && !o.dim) {
            const cycle = 3400 + ((a.seed * 811) % 2100)
            if ((now + a.seed * 1327) % cycle < 140) headTex = a.heads.blink
          }
          // an occasional full-body stretch, feet planted
          const st = (now + a.seed * 4211) % 14000
          a.root.scale.y = st < 600 && !o.dim ? 1 + 0.035 * Math.sin((Math.PI * st) / 600) : 1
          // tiny head bob keeps the stepped frames fluid
          a.headSprite.position.y =
            -(a.h - (Math.round(a.h * a.headFrac) - 6)) + 1.2 * Math.sin(now / 900 + a.seed)
        } else {
          a.root.scale.y = 1
        }
        a.headSprite.rotation = rot
        a.headSprite.texture = headTex
      }
      const tint = o.dim ? 0x9a8878 : 0xffffff
      a.body.tint = tint
      a.headSprite.tint = tint
      a.shadow.alpha = 0.3 * a.fade * (o.dim ? 0.6 : 1)
    }
    // firelight
    for (let i = 0; i < FLAMES.length; i++) {
      const f = FLAMES[i]
      const g = flameGfx[i]
      if (reduceMotion) {
        g.alpha = 0
        continue
      }
      const n =
        0.5 + 0.3 * Math.sin(now / 97 + f.seed * 5.1) + 0.2 * Math.sin(now / 233 + f.seed * 2.7)
      g.alpha = f.lamp ? 0.16 + 0.16 * n : 0.3 + 0.32 * n
      g.scale.set(1 + 0.07 * Math.sin(now / 141 + f.seed * 3.3))
      if (f.follow && actors[f.follow]) g.position.set(f.x + actors[f.follow].offset, f.y)
    }
    emblem.alpha = reduceMotion ? 0 : 0.05 + 0.05 * Math.sin(now / 2400)
  }

  return {
    update,
    getOffset: (key: BotKey) => actors[key]?.offset ?? 0,
    resize,
    destroy: () => {
      app.destroy(true, { children: true, texture: false })
    },
  }
}
