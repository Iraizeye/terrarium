// TERRARIUM UI — one design system for every panel around the glass.
//
// The center stage keeps its painted sky; the rails, header, and footer
// share these tokens: zinc/slate neutrals, a single emerald accent, and
// consistent panel chrome. If a color or border isn't in here, a rail
// component shouldn't be using it.

import type { CSSProperties, ReactNode } from 'react'

export const UI = {
  // text ramp
  text: '#e8eaef',
  soft: '#9aa3b2',
  dim: '#5d6570',
  // the one accent
  accent: '#3ecf9a',
  accentDim: 'rgba(62,207,154,0.72)',
  accentSoft: 'rgba(62,207,154,0.12)',
  // semantic (kept close to the accent family, desaturated)
  green: '#4ade80',
  red: '#f0716a',
  amber: '#e0b34d',
  // surfaces
  surface: 'rgba(17,19,24,0.78)',
  surfaceSoft: 'rgba(24,27,33,0.66)',
  border: '1px solid rgba(148,163,184,0.14)',
  hairline: '1px solid rgba(148,163,184,0.09)',
  radius: 10,
} as const

export const MONO = '"JetBrains Mono", "Fira Code", monospace'

/** Shared panel shell — rounded surface, hairline border, inner top light. */
export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: 0,
      background: UI.surface,
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      border: UI.border, borderRadius: UI.radius,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(4,16,11,0.32)',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  )
}

/** Consistent panel header: emerald label, optional right-side slot. */
export function PanelHeader({ label, right, title }: { label: string; right?: ReactNode; title?: string }) {
  return (
    <div
      title={title}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '9px 14px 7px', borderBottom: UI.hairline, flexShrink: 0, gap: 8,
      }}
    >
      <span style={{ fontSize: 10, letterSpacing: '0.22em', color: UI.accentDim, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {right}
    </div>
  )
}

/** Empty state — tells a first-time visitor what WOULD appear here. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: '10px 14px', fontSize: 10.5, lineHeight: 1.55, color: UI.dim, fontFamily: MONO }}>
      {children}
    </div>
  )
}

/** Status dot with a hover explanation baked in. */
export function Led({ color, pulse, title }: { color: string; pulse?: boolean; title?: string }) {
  return (
    <span title={title} style={{
      width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0,
      animation: pulse ? 'led-pulse 2s ease-in-out infinite' : undefined,
    }} />
  )
}

/** Small pill button (filters, mode toggles). */
export function PillButton({ active, onClick, children, title }: {
  active?: boolean; onClick: () => void; children: ReactNode; title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
        padding: '2px 8px', cursor: 'pointer', fontFamily: MONO,
        background: active ? UI.accentSoft : 'transparent',
        border: `1px solid ${active ? 'rgba(62,207,154,0.35)' : 'rgba(148,163,184,0.16)'}`,
        borderRadius: 999,
        color: active ? UI.accent : UI.dim,
      }}
    >
      {children}
    </button>
  )
}

/** Two-line clamp that keeps the full text reachable on hover. */
export function Clamp2({ text, color, size = 9.5 }: { text: string; color?: string; size?: number }) {
  return (
    <div title={text} style={{
      fontSize: size, lineHeight: 1.45, color: color ?? UI.soft, fontFamily: MONO,
      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      overflowWrap: 'anywhere',
    }}>
      {text}
    </div>
  )
}
