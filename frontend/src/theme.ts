// The market phase — the one piece of "theme" that survived the redesigns.
// The building (RangeFloor) owns its own per-phase palettes; the rails are
// styled by ui.tsx. This module only answers: what part of the trading day
// is it?
//
//   night  after hours and overnight
//   dawn   the 90 minutes before the open
//   day    market open
//   dusk   just after the close (16–19 ET) — ember fade while reports write

import type { MarketClock } from './types'

export type Phase = 'night' | 'dawn' | 'day' | 'dusk'

const PHASE_NAMES: readonly Phase[] = ['night', 'dawn', 'day', 'dusk']

const DAWN_WINDOW_S = 90 * 60

/** Which part of the day are we in? `?phase=day` (etc.) forces one for previews. */
export function getPhase(market: MarketClock | null | undefined): Phase {
  const forced = new URLSearchParams(window.location.search).get('phase') as Phase | null
  if (forced && PHASE_NAMES.includes(forced)) return forced
  if (!market) return 'night'
  if (market.is_open) return 'day'
  if (market.seconds_to_change <= DAWN_WINDOW_S) return 'dawn'
  const hour = parseInt(market.et.slice(0, 2), 10)
  if (hour >= 16 && hour < 19) return 'dusk'
  return 'night'
}
