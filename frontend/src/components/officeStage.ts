// The Pixi stage: Warm Ember painting + sprite-sheet bots (skill: terrarium-art).
//
// This is the renderer HALF of the office. It knows nothing about telemetry:
// the Office Director (in VesperFloor) hands it per-bot orders — clip + walk
// target — and the stage plays stepped sprite-sheet clips (idle / work /
// walk / talk / blink) baked from the traced painting by generate_frames.py.
// Bots walk to their marks at a fixed gait; the walk clip plays itself
// whenever a bot is in transit. Firelight flickers on the painted flames.
// Reduce Motion renders the static painting: frame 0, no flicker, no walks.

import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'
import buildSheetUrl from '../../../assets/terrarium/traced/sheets/build.png'
import chiefSheetUrl from '../../../assets/terrarium/traced/sheets/chief.png'
import kernelSheetUrl from '../../../assets/terrarium/traced/sheets/kernel.png'
import liveSheetUrl from '../../../assets/terrarium/traced/sheets/live.png'
import meetASheetUrl from '../../../assets/terrarium/traced/sheets/meet-a.png'
import meetBSheetUrl from '../../../assets/terrarium/traced/sheets/meet-b.png'
import paperSheetUrl from '../../../assets/terrarium/traced/sheets/paper.png'
import strategySheetUrl from '../../../assets/terrarium/traced/sheets/strategy.png'
import stageBgUrl from '../../../assets/terrarium/traced/stage-bg.png'

export const CROP = { sx: 55, sy: 95, sw: 1893, sh: 1350 }
const PAD_X = 8
const PAD_Y = 6
const CLIP_ROW = { idle: 0, work: 1, walk: 2, talk: 3, blink: 4 } as const
export type ClipName = 'idle' | 'work' | 'walk' | 'talk'
const WALK_SPEED = 55 // CROP px per second — a purposeful shuffle
const FRAME_MS = 150 // stepped, hand-animated cadence

// sprite boxes in CROP space (origin + unpadded size) — must match the trace
export const BOTS = {
  strategy: { url: strategySheetUrl, x: 489, y: 345, w: 156, h: 210 },
  meetA: { url: meetASheetUrl, x: 1217, y: 351, w: 160, h: 212 },
  meetB: { url: meetBSheetUrl, x: 1363, y: 351, w: 142, h: 212 },
  build: { url: buildSheetUrl, x: 533, y: 680, w: 174, h: 260 },
  chief: { url: chiefSheetUrl, x: 1360, y: 655, w: 170, h: 285 },
  kernel: { url: kernelSheetUrl, x: 420, y: 1050, w: 150, h: 205 },
  live: { url: liveSheetUrl, x: 660, y: 1050, w: 143, h: 205 },
  paper: { url: paperSheetUrl, x: 950, y: 1050, w: 160, h: 205 },
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
}
export type Orders = Record<BotKey, BotOrder>

interface BotActor {
  sprite: Sprite
  frames: Record<keyof typeof CLIP_ROW, Texture[]>
  home: { x: number; y: number }
  offset: number // current walk offset (CROP px)
  seed: number
  blinkAt: number
}

export interface OfficeStage {
  update: (now: number, dtMs: number, orders: Orders, reduceMotion: boolean) => void
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

  const glowLayer = new Container()
  const botLayer = new Container()
  world.addChild(botLayer)
  world.addChild(glowLayer)

  const flameGfx = FLAMES.map((f) => {
    const g = new Graphics()
    g.circle(0, 0, f.r)
    g.fill({ color: 0xffbe60, alpha: 1 })
    g.blendMode = 'add'
    g.position.set(f.x, f.y)
    glowLayer.addChild(g)
    return g
  })
  const emblem = new Graphics()
  emblem.circle(0, 0, 190)
  emblem.fill({ color: 0xff8c3c, alpha: 1 })
  emblem.blendMode = 'add'
  emblem.position.set(1410, 1160)
  glowLayer.addChild(emblem)

  const actors = {} as Record<BotKey, BotActor>
  let seedIdx = 0
  for (const key of Object.keys(BOTS) as BotKey[]) {
    const b = BOTS[key]
    const sheet: Texture | null = await Assets.load(b.url).catch(() => null)
    if (!sheet) continue
    const cw = b.w + 2 * PAD_X
    const ch = b.h + 2 * PAD_Y
    const frames = {} as BotActor['frames']
    for (const clip of Object.keys(CLIP_ROW) as (keyof typeof CLIP_ROW)[]) {
      frames[clip] = [0, 1, 2, 3].map(
        (col) =>
          new Texture({
            source: sheet.source,
            frame: new Rectangle(col * cw, CLIP_ROW[clip] * ch, cw, ch),
          }),
      )
    }
    const sprite = new Sprite(frames.idle[0])
    sprite.anchor.set(0.5, 1)
    const home = { x: b.x + b.w / 2, y: b.y + b.h + PAD_Y }
    sprite.position.set(home.x, home.y)
    botLayer.addChild(sprite)
    actors[key] = {
      sprite,
      frames,
      home,
      offset: 0,
      seed: seedIdx++,
      blinkAt: 2000 + seedIdx * 900,
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
      a.sprite.position.set(a.home.x + a.offset, a.home.y)
      const walking = !reduceMotion && Math.abs(o.tx - a.offset) > 0.5
      const clip: keyof typeof CLIP_ROW = walking ? 'walk' : o.clip
      // stepped frames; sleeping stations breathe at half speed
      const cadence = o.dim ? FRAME_MS * 2 : FRAME_MS
      const frame = reduceMotion ? 0 : Math.floor(now / cadence + a.seed * 1.7) % 4
      let tex = a.frames[clip][frame]
      // blink on the bot's own clock (never while dimmed or reduced)
      if (!reduceMotion && !o.dim && clip !== 'walk') {
        const cycle = 3400 + ((a.seed * 811) % 2100)
        if ((now + a.seed * 1327) % cycle < 140) tex = a.frames.blink[0]
      }
      a.sprite.texture = tex
      a.sprite.tint = o.dim ? 0x9a8878 : 0xffffff
      a.sprite.alpha = 1
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
      g.alpha = f.lamp ? 0.05 + 0.05 * n : 0.1 + 0.11 * n
      g.scale.set(1 + 0.07 * Math.sin(now / 141 + f.seed * 3.3))
      if (f.follow && actors[f.follow]) g.position.set(f.x + actors[f.follow].offset, f.y)
    }
    emblem.alpha = reduceMotion ? 0 : 0.05 + 0.05 * Math.sin(now / 2400)
  }

  return {
    update,
    resize,
    destroy: () => {
      app.destroy(true, { children: true, texture: false })
    },
  }
}
