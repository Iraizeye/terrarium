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

/** The palette for this phase. Canvas code calls this per frame. */
export function palette(phase: Phase): PhasePalette {
  return PHASES[phase]
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
