// RANGEWATCH types — mirrors backend/state.status_payload() exactly.

export interface ServiceHealth {
  name: string
  port: number
  status: 'up' | 'down'
}

export interface SystemMetrics {
  cpu_pct: number
  ram_pct: number
  ram_used_gb: number
  ram_total_gb: number
  disk_pct: number
  disk_used_gb: number
  disk_total_gb: number
  uptime_seconds: number
  load_1m: number
  trader_procs: number
  trader_ram_mb: number
}

export interface MarketClock {
  is_open: boolean
  seconds_to_change: number
  et: string
}

export interface OpenPosition {
  symbol: string
  quantity: number
  entry: number
  stop: number
  target: number
  state: string
  adopted: boolean
  broker_stop: boolean
}

export interface ClosedTrade {
  symbol: string
  quantity: number
  entry: number
  exit: number | null
  reason: string | null
  pnl: number
}

export interface TradingMode {
  status: 'alive' | 'stale' | 'unknown'
  heartbeat_age_s: number | null
  watchdog_armed: boolean
  open_positions: OpenPosition[]
  closed_today: ClosedTrade[]
  realized_today: number
  last_decision?: LastDecision | null
}

export interface LastDecision {
  at: string | null
  action: string | null
  symbol: string | null
  thesis: string
}

export interface TradingStatus {
  market: MarketClock
  kill_switch: boolean
  modes: Record<'paper' | 'live', TradingMode>
  last_decision: LastDecision | null
  alerts: string[]
}

export interface ClaudeUsage {
  available: boolean
  sessions_today?: number
  turns_today?: number
  input_tokens?: number
  output_tokens?: number
  cache_read_tokens?: number
  cache_write_tokens?: number
}

export interface BoardCandidate {
  symbol: string
  last: number | null
  rvol: number | null
  tech: string | null
  earn: string | null
  affordable: boolean
  move_pct: number
}

export interface BoardShadow {
  symbol: string
  mark: number
  last: number
  move_pct: number
  affordable: boolean
  first_seen: string
}

export interface BoardArm {
  cycle_at: string | null
  action: string | null
  action_symbol: string | null
  pass_reason: string | null
  bear_veto: boolean
  gist: string | null
  funnel: Record<string, number>
  candidates: BoardCandidate[]
  shadows: BoardShadow[]
}

export interface BoardState {
  available: boolean
  arms: Record<'paper' | 'live', BoardArm>
}

export type FleetState = 'live' | 'idle' | 'done'

export interface FleetAgent {
  project: string
  session: string
  state: FleetState
  age_s: number
  action: string | null
  model: string | null
  tokens: number
  turns: number
}

export interface AgentFleet {
  available: boolean
  agents: FleetAgent[]
}

export type CrewStatus = 'idle' | 'thinking' | 'working' | 'waiting'

export interface CrewMember {
  name: string
  role: string
  model: string
  status: CrewStatus
  activity: string | null
  tool: string | null
  task: string | null
  events_today: number
  last_event_at: string | null
}

export interface CrewEvent {
  id: string
  ts: string
  agent: string
  kind: 'hook' | 'tool' | 'thought' | 'lifecycle'
  text: string
  tool: string | null
  meta: Record<string, unknown>
}

export interface StatusUpdate {
  type: 'status_update'
  timestamp: string
  services: Record<string, ServiceHealth>
  system: SystemMetrics | null
  trading: TradingStatus | null
  usage: ClaudeUsage | null
  fleet: AgentFleet | null
  board: BoardState | null
}

export interface CrewEventMessage {
  type: 'crew_event'
  timestamp: string
  event: CrewEvent | null
  crew: Record<string, CrewMember>
}

export interface SessionEntry {
  ts: string
  role: string
  content: string
}
