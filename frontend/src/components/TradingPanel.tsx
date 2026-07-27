import { useDashboardStore } from '../store/dashboardStore'
import type { OpenPosition, TradingMode } from '../types'

const INK = { text: '#f2f1f7', soft: '#a29db8', dim: '#575370' }
const ACCENT = '#8f5cff'
const GOLD = '#f5b451'
const GREEN = '#79ff98'
const AMBER = '#f0c040'
const RED = '#ff7060'
const MONO = '"Fira Code", monospace'
const HAIRLINE = '1px solid rgba(150,146,172,0.10)'
const GOLD_DIM_HEADER = 'rgba(245,180,81,0.7)'

function pnlColor(v: number) {
  return v > 0 ? GREEN : v < 0 ? RED : INK.soft
}

function fmtMoney(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`
}

function ModeLed({ mode }: { mode: TradingMode }) {
  const color = mode.status === 'alive' ? GREEN : mode.status === 'stale' ? RED : INK.dim
  return (
    <span style={{
      width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0,
      animation: mode.status === 'alive' ? 'led-pulse 2s ease-in-out infinite' : undefined,
    }} />
  )
}

function PositionRow({ p }: { p: OpenPosition }) {
  return (
    <div style={{ padding: '5px 0', borderTop: HAIRLINE }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: INK.text, fontFamily: MONO }}>
          {p.symbol}
          {p.adopted && (
            <span style={{ fontSize: 8, color: AMBER, marginLeft: 6, letterSpacing: '0.1em' }}>ADOPTED</span>
          )}
          {p.state === 'exiting' && (
            <span style={{ fontSize: 8, color: AMBER, marginLeft: 6, letterSpacing: '0.1em' }}>EXITING</span>
          )}
        </span>
        <span style={{ fontSize: 10.5, color: INK.soft, fontFamily: MONO }}>
          {p.quantity}× @ {p.entry.toFixed(2)}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 9.5, fontFamily: MONO }}>
        <span style={{ color: RED }}>stop {p.stop > 0 ? p.stop.toFixed(2) : '—'}</span>
        <span style={{ color: INK.dim }}>
          {p.broker_stop ? 'broker stop' : 'software stop'}
        </span>
        <span style={{ color: GREEN }}>tgt {p.target > 0 ? p.target.toFixed(2) : '—'}</span>
      </div>
    </div>
  )
}

function ModeSection({ label, mode }: { label: string; mode: TradingMode }) {
  const hb = mode.heartbeat_age_s
  return (
    <div style={{ padding: '9px 14px 8px', borderTop: HAIRLINE }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <ModeLed mode={mode} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: INK.text }}>
          {label}
        </span>
        <span style={{ fontSize: 9, color: INK.dim, fontFamily: MONO }}>
          {hb == null ? 'no heartbeat' : `hb ${hb}s`}
          {!mode.watchdog_armed && <span style={{ color: RED }}> · no watchdog</span>}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, fontFamily: MONO, color: pnlColor(mode.realized_today) }}>
          {fmtMoney(mode.realized_today)}
        </span>
      </div>

      {mode.open_positions.length === 0 && mode.closed_today.length === 0 && (
        <div style={{ fontSize: 10, color: INK.dim, padding: '6px 0 2px', fontFamily: MONO }}>
          flat — no positions today
        </div>
      )}
      {mode.open_positions.map((p) => <PositionRow key={p.symbol} p={p} />)}
      {mode.closed_today.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 0 2px', marginTop: 3, borderTop: HAIRLINE,
        }}>
          <span style={{ fontSize: 8, letterSpacing: '0.22em', color: INK.dim, textTransform: 'uppercase' }}>
            Closed today
          </span>
          <span style={{ flex: 1, borderTop: HAIRLINE }} />
        </div>
      )}
      {mode.closed_today.map((c, i) => (
        <div key={`${c.symbol}-${i}`} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          padding: '3px 0', opacity: 0.75,
        }}>
          <span style={{ fontSize: 10.5, color: INK.soft, fontFamily: MONO }}>
            {c.symbol}
            <span style={{ color: INK.dim, fontSize: 9, marginLeft: 6 }}>
              {c.quantity}× · {c.reason ?? 'closed'}
            </span>
          </span>
          <span style={{ fontSize: 10.5, fontFamily: MONO, color: pnlColor(c.pnl) }}>{fmtMoney(c.pnl)}</span>
        </div>
      ))}
    </div>
  )
}

export default function TradingPanel() {
  const trading = useDashboardStore((s) => s.trading)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
      background: 'rgba(9,7,15,0.72)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(150,146,172,0.16)',
    }}>
      {/* Header with market chip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px 8px', borderBottom: HAIRLINE, flexShrink: 0 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.22em', color: GOLD_DIM_HEADER, textTransform: 'uppercase' }}>
          Trading desk
        </span>
        {trading && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: trading.market.is_open ? GOLD : INK.dim,
              animation: trading.market.is_open ? 'led-pulse 1.6s ease-in-out infinite' : undefined,
            }} />
            <span style={{ fontSize: 9, letterSpacing: '0.14em', color: trading.market.is_open ? GOLD : INK.dim, fontFamily: MONO }}>
              {trading.market.is_open ? 'OPEN' : 'CLOSED'} · {trading.market.et} ET
            </span>
          </span>
        )}
      </div>

      {!trading && (
        <div style={{ padding: '14px', fontSize: 11, color: INK.dim }}>
          waiting for telemetry…
        </div>
      )}

      {trading && (
        <div style={{ overflowY: 'auto', minHeight: 0 }}>
          {trading.kill_switch && (
            <div style={{
              margin: '8px 14px 0', padding: '6px 10px',
              border: `1px solid ${AMBER}`, color: AMBER,
              fontSize: 10, letterSpacing: '0.12em', fontFamily: MONO,
            }}>
              KILL SWITCH ACTIVE — buys halted, exits still run
            </div>
          )}

          <ModeSection label="LIVE" mode={trading.modes.live} />
          <ModeSection label="PAPER" mode={trading.modes.paper} />

          {/* Last decision */}
          <div style={{ padding: '9px 14px 8px', borderTop: HAIRLINE }}>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', color: INK.dim, textTransform: 'uppercase', marginBottom: 4 }}>
              Last decision
            </div>
            {trading.last_decision ? (
              <>
                <div style={{ fontSize: 11, fontFamily: MONO }}>
                  <span style={{
                    color: trading.last_decision.action === 'buy' ? GREEN : ACCENT,
                    fontWeight: 700, letterSpacing: '0.1em',
                  }}>
                    {(trading.last_decision.action ?? '?').toUpperCase()}
                  </span>
                  {trading.last_decision.symbol && (
                    <span style={{ color: INK.text, marginLeft: 6 }}>{trading.last_decision.symbol}</span>
                  )}
                  <span style={{ color: INK.dim, marginLeft: 6, fontSize: 9 }}>
                    {trading.last_decision.at ? new Date(trading.last_decision.at).toLocaleTimeString([], { hour12: false }) : ''}
                  </span>
                </div>
                <div style={{ marginTop: 3, fontSize: 10, lineHeight: 1.5, color: INK.soft }}>
                  {trading.last_decision.thesis}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 10, color: INK.dim, fontFamily: MONO }}>no decisions yet</div>
            )}
          </div>

          {/* Alerts tail */}
          <div style={{ padding: '9px 14px 12px', borderTop: HAIRLINE }}>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', color: INK.dim, textTransform: 'uppercase', marginBottom: 4 }}>
              Alerts
            </div>
            {trading.alerts.length === 0 && (
              <div style={{ fontSize: 10, color: INK.dim, fontFamily: MONO }}>quiet — nothing to report</div>
            )}
            {trading.alerts.slice().reverse().map((line, i) => (
              <div key={i} style={{
                fontSize: 9.5, color: i === 0 ? INK.soft : INK.dim, fontFamily: MONO,
                padding: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {line.replace(/^\S+\s/, '')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
