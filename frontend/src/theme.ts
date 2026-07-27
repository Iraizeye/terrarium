// FIRST LIGHT — the sky lives the trading day.
//
// Violet is the agent's color (and the iris's petals); gold is the market's
// (and the iris's beard). The UI itself stays a dark cockpit at all times —
// only the sky, the horizon, and a few warm accents move with the session:
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
      'radial-gradient(circle at 50% 44%, rgba(140,80,255,0.16), transparent 18%)',
      'radial-gradient(circle at 50% 50%, rgba(90,40,200,0.09), transparent 36%)',
      'linear-gradient(180deg, #07030f 0%, #04010a 100%)',
    ],
    horizon: 'radial-gradient(ellipse 90% 26% at 50% 104%, rgba(120,70,220,0.12), transparent)',
    fog1: 'rgba(80,30,140,0.18)',
    fog2: 'rgba(60,20,120,0.14)',
    particle: '190,150,255',
    stageGlow: ['rgba(140,90,255,0.10)', 'rgba(140,90,255,0)'],
  },
  dawn: {
    sky: [
      'radial-gradient(circle at 50% 40%, rgba(140,80,255,0.14), transparent 20%)',
      'radial-gradient(ellipse 120% 42% at 50% 108%, rgba(200,110,50,0.14), transparent)',
      'linear-gradient(180deg, #070312 0%, #0a0616 62%, #150b18 100%)',
    ],
    horizon: 'radial-gradient(ellipse 85% 30% at 50% 104%, rgba(245,166,60,0.20), transparent)',
    fog1: 'rgba(120,50,150,0.16)',
    fog2: 'rgba(190,110,60,0.10)',
    particle: '235,180,140',
    stageGlow: ['rgba(245,166,60,0.16)', 'rgba(245,166,60,0)'],
  },
  day: {
    sky: [
      'radial-gradient(circle at 50% 38%, rgba(120,90,255,0.12), transparent 22%)',
      'radial-gradient(ellipse 130% 48% at 50% 110%, rgba(230,140,60,0.16), transparent)',
      'linear-gradient(180deg, #090820 0%, #0c0a22 58%, #1a0f1a 100%)',
    ],
    horizon: 'radial-gradient(ellipse 88% 32% at 50% 104%, rgba(255,180,80,0.26), transparent)',
    fog1: 'rgba(110,60,180,0.14)',
    fog2: 'rgba(220,140,70,0.12)',
    particle: '245,200,150',
    stageGlow: ['rgba(255,180,80,0.20)', 'rgba(255,180,80,0)'],
  },
  dusk: {
    sky: [
      'radial-gradient(circle at 50% 42%, rgba(150,80,220,0.14), transparent 20%)',
      'radial-gradient(ellipse 120% 40% at 50% 108%, rgba(210,90,80,0.13), transparent)',
      'linear-gradient(180deg, #0a0414 0%, #100616 60%, #190a14 100%)',
    ],
    horizon: 'radial-gradient(ellipse 85% 28% at 50% 104%, rgba(255,120,90,0.18), transparent)',
    fog1: 'rgba(140,50,140,0.16)',
    fog2: 'rgba(200,90,80,0.10)',
    particle: '235,160,150',
    stageGlow: ['rgba(255,120,90,0.14)', 'rgba(255,120,90,0)'],
  },
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
