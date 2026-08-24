// UNDER GLASS — the sky lives the trading day.
//
// Green is the glasshouse; gold is the market's light through the panes.
// The UI stays a dark cool cockpit at all times — only the sky, the
// horizon, and a few warm accents move with the session:
//
//   night  market closed, nothing soon      — deep pre-dawn indigo, violet air
//   dawn   within 90 min of the open        — amber climbs the horizon
//   day    market open                      — golden horizon under the range
//   dusk   just after the close (16–19 ET)  — ember fade while reports write

import type { MarketClock } from './types'

export type Phase = 'night' | 'dawn' | 'day' | 'dusk'

export const GOLD = '#f5b451'
export const GOLD_DIM = 'rgba(245,180,81,0.55)'

export interface PhasePalette {
  /** page background layers, top to bottom (joined as CSS background) */
  sky: string[]
  /** fixed glow pinned to the bottom of the viewport */
  horizon: string
  /** fog blobs */
  fog1: string
  fog2: string
  /** floating particle rgb */
  particle: string
  /** canvas horizon band behind the baseplate: [inner, outer] rgba */
  stageGlow: [string, string]
}

export const PHASES: Record<Phase, PhasePalette> = {
  night: {
    sky: [
      'radial-gradient(circle at 50% 44%, rgba(70,190,140,0.10), transparent 18%)',
      'radial-gradient(circle at 50% 50%, rgba(40,120,90,0.07), transparent 36%)',
      'linear-gradient(180deg, #06110c 0%, #030a07 100%)',
    ],
    horizon: 'radial-gradient(ellipse 90% 26% at 50% 104%, rgba(60,180,130,0.11), transparent)',
    fog1: 'rgba(30,90,65,0.16)',
    fog2: 'rgba(20,70,50,0.13)',
    particle: '150,235,185',
    stageGlow: ['rgba(80,210,150,0.09)', 'rgba(80,210,150,0)'],
  },
  dawn: {
    sky: [
      'radial-gradient(circle at 50% 40%, rgba(80,200,150,0.10), transparent 20%)',
      'radial-gradient(ellipse 120% 42% at 50% 108%, rgba(220,160,60,0.13), transparent)',
      'linear-gradient(180deg, #071410 0%, #0d1b13 62%, #182413 100%)',
    ],
    horizon: 'radial-gradient(ellipse 85% 30% at 50% 104%, rgba(245,190,90,0.19), transparent)',
    fog1: 'rgba(40,110,75,0.15)',
    fog2: 'rgba(190,140,60,0.09)',
    particle: '215,235,170',
    stageGlow: ['rgba(245,190,90,0.15)', 'rgba(245,190,90,0)'],
  },
  day: {
    sky: [
      'radial-gradient(circle at 50% 38%, rgba(120,220,160,0.10), transparent 22%)',
      'radial-gradient(ellipse 130% 48% at 50% 110%, rgba(240,200,100,0.14), transparent)',
      'linear-gradient(180deg, #0b1a12 0%, #10231a 58%, #1c2c1c 100%)',
    ],
    horizon: 'radial-gradient(ellipse 88% 32% at 50% 104%, rgba(255,215,120,0.23), transparent)',
    fog1: 'rgba(60,140,95,0.13)',
    fog2: 'rgba(220,180,90,0.11)',
    particle: '230,245,185',
    stageGlow: ['rgba(255,215,120,0.18)', 'rgba(255,215,120,0)'],
  },
  dusk: {
    sky: [
      'radial-gradient(circle at 50% 42%, rgba(90,180,130,0.11), transparent 20%)',
      'radial-gradient(ellipse 120% 40% at 50% 108%, rgba(220,120,70,0.11), transparent)',
      'linear-gradient(180deg, #081209 0%, #101a0e 60%, #191d10 100%)',
    ],
    horizon: 'radial-gradient(ellipse 85% 28% at 50% 104%, rgba(240,145,85,0.16), transparent)',
    fog1: 'rgba(50,110,70,0.15)',
    fog2: 'rgba(200,110,70,0.09)',
    particle: '225,215,165',
    stageGlow: ['rgba(240,145,85,0.13)', 'rgba(240,145,85,0)'],
  },
}

// ---------------------------------------------------------------------------
// Theme variants — same stage, different skies. GREENHOUSE is the
// flagship; the variants keep the dark cockpit and swap the atmosphere.
// ---------------------------------------------------------------------------

export type ThemeName = 'greenhouse' | 'observatory' | 'embers'

export const THEME_NAMES: ThemeName[] = ['greenhouse', 'observatory', 'embers']

const OBSERVATORY: Record<Phase, PhasePalette> = {
  // Cold, still, high-altitude — steel blue and cyan, the desert at 14,000 ft.
  night: {
    sky: [
      'radial-gradient(circle at 50% 44%, rgba(90,140,220,0.13), transparent 18%)',
      'radial-gradient(circle at 50% 50%, rgba(50,90,180,0.08), transparent 36%)',
      'linear-gradient(180deg, #04070f 0%, #01040a 100%)',
    ],
    horizon: 'radial-gradient(ellipse 90% 26% at 50% 104%, rgba(80,140,210,0.11), transparent)',
    fog1: 'rgba(40,80,140,0.16)',
    fog2: 'rgba(30,60,120,0.13)',
    particle: '150,200,255',
    stageGlow: ['rgba(100,160,255,0.09)', 'rgba(100,160,255,0)'],
  },
  dawn: {
    sky: [
      'radial-gradient(circle at 50% 40%, rgba(90,150,220,0.12), transparent 20%)',
      'radial-gradient(ellipse 120% 42% at 50% 108%, rgba(90,190,200,0.12), transparent)',
      'linear-gradient(180deg, #030812 0%, #051019 62%, #0a1a20 100%)',
    ],
    horizon: 'radial-gradient(ellipse 85% 30% at 50% 104%, rgba(110,210,220,0.17), transparent)',
    fog1: 'rgba(50,110,160,0.15)',
    fog2: 'rgba(70,170,180,0.09)',
    particle: '170,225,235',
    stageGlow: ['rgba(110,210,220,0.14)', 'rgba(110,210,220,0)'],
  },
  day: {
    sky: [
      'radial-gradient(circle at 50% 38%, rgba(110,170,240,0.11), transparent 22%)',
      'radial-gradient(ellipse 130% 48% at 50% 110%, rgba(120,200,230,0.13), transparent)',
      'linear-gradient(180deg, #071224 0%, #081527 58%, #0c2029 100%)',
    ],
    horizon: 'radial-gradient(ellipse 88% 32% at 50% 104%, rgba(150,220,255,0.22), transparent)',
    fog1: 'rgba(60,120,190,0.13)',
    fog2: 'rgba(90,190,210,0.10)',
    particle: '190,235,255',
    stageGlow: ['rgba(150,220,255,0.17)', 'rgba(150,220,255,0)'],
  },
  dusk: {
    sky: [
      'radial-gradient(circle at 50% 42%, rgba(100,130,220,0.12), transparent 20%)',
      'radial-gradient(ellipse 120% 40% at 50% 108%, rgba(80,110,200,0.11), transparent)',
      'linear-gradient(180deg, #04060f 0%, #060a16 60%, #0a0f1e 100%)',
    ],
    horizon: 'radial-gradient(ellipse 85% 28% at 50% 104%, rgba(110,140,230,0.15), transparent)',
    fog1: 'rgba(50,70,150,0.15)',
    fog2: 'rgba(80,110,200,0.09)',
    particle: '170,190,245',
    stageGlow: ['rgba(110,140,230,0.12)', 'rgba(110,140,230,0)'],
  },
}

const EMBERS: Record<Phase, PhasePalette> = {
  // Fire watch — copper, rust, and coal; the range at the end of a hot day.
  night: {
    sky: [
      'radial-gradient(circle at 50% 44%, rgba(220,100,60,0.10), transparent 18%)',
      'radial-gradient(circle at 50% 50%, rgba(160,60,40,0.07), transparent 36%)',
      'linear-gradient(180deg, #0d0505 0%, #070202 100%)',
    ],
    horizon: 'radial-gradient(ellipse 90% 26% at 50% 104%, rgba(210,90,50,0.11), transparent)',
    fog1: 'rgba(130,50,30,0.16)',
    fog2: 'rgba(100,40,25,0.13)',
    particle: '255,180,140',
    stageGlow: ['rgba(230,110,60,0.10)', 'rgba(230,110,60,0)'],
  },
  dawn: {
    sky: [
      'radial-gradient(circle at 50% 40%, rgba(230,120,60,0.13), transparent 20%)',
      'radial-gradient(ellipse 120% 42% at 50% 108%, rgba(230,130,50,0.14), transparent)',
      'linear-gradient(180deg, #100504 0%, #170906 62%, #201007 100%)',
    ],
    horizon: 'radial-gradient(ellipse 85% 30% at 50% 104%, rgba(245,150,60,0.20), transparent)',
    fog1: 'rgba(160,70,35,0.16)',
    fog2: 'rgba(210,120,50,0.10)',
    particle: '250,190,140',
    stageGlow: ['rgba(245,150,60,0.16)', 'rgba(245,150,60,0)'],
  },
  day: {
    sky: [
      'radial-gradient(circle at 50% 38%, rgba(240,150,70,0.12), transparent 22%)',
      'radial-gradient(ellipse 130% 48% at 50% 110%, rgba(240,140,60,0.16), transparent)',
      'linear-gradient(180deg, #180b06 0%, #1d0e07 58%, #241108 100%)',
    ],
    horizon: 'radial-gradient(ellipse 88% 32% at 50% 104%, rgba(255,170,70,0.26), transparent)',
    fog1: 'rgba(180,90,40,0.14)',
    fog2: 'rgba(230,140,60,0.12)',
    particle: '255,210,160',
    stageGlow: ['rgba(255,170,70,0.20)', 'rgba(255,170,70,0)'],
  },
  dusk: {
    sky: [
      'radial-gradient(circle at 50% 42%, rgba(220,90,70,0.13), transparent 20%)',
      'radial-gradient(ellipse 120% 40% at 50% 108%, rgba(200,70,60,0.12), transparent)',
      'linear-gradient(180deg, #120406 0%, #170608 60%, #1c0808 100%)',
    ],
    horizon: 'radial-gradient(ellipse 85% 28% at 50% 104%, rgba(240,100,80,0.17), transparent)',
    fog1: 'rgba(150,45,45,0.16)',
    fog2: 'rgba(200,80,70,0.10)',
    particle: '245,160,150',
    stageGlow: ['rgba(240,100,80,0.13)', 'rgba(240,100,80,0)'],
  },
}

const THEMES: Record<ThemeName, Record<Phase, PhasePalette>> = {
  greenhouse: PHASES,
  observatory: OBSERVATORY,
  embers: EMBERS,
}

const THEME_KEY = 'terrarium.theme'
const LEGACY_THEME_KEY = 'rangewatch.theme'

/** Active theme: `?theme=` wins (previews/screenshots), else the saved pick. */
export function getTheme(): ThemeName {
  const forced = new URLSearchParams(window.location.search).get('theme') as ThemeName | null
  if (forced && forced in THEMES) return forced
  const raw = localStorage.getItem(THEME_KEY) ?? localStorage.getItem(LEGACY_THEME_KEY)
  const saved = (raw === 'mesa' ? 'greenhouse' : raw) as ThemeName | null
  return saved && saved in THEMES ? saved : 'greenhouse'
}

export function setTheme(name: ThemeName): void {
  localStorage.setItem(THEME_KEY, name)
}

/** The palette for this phase under the active theme. Canvas code calls this
 * per frame, so a theme switch propagates without a re-mount. */
export function palette(phase: Phase): PhasePalette {
  return THEMES[getTheme()][phase]
}

const DAWN_WINDOW_S = 90 * 60

/** Which sky are we under? `?phase=day` (etc.) forces one for previews. */
export function getPhase(market: MarketClock | null | undefined): Phase {
  const forced = new URLSearchParams(window.location.search).get('phase') as Phase | null
  if (forced && forced in PHASES) return forced
  if (!market) return 'night'
  if (market.is_open) return 'day'
  if (market.seconds_to_change <= DAWN_WINDOW_S) return 'dawn'
  const hour = parseInt(market.et.slice(0, 2), 10)
  if (hour >= 16 && hour < 19) return 'dusk'
  return 'night'
}
