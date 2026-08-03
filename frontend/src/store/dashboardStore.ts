import { create } from 'zustand'
import type {
  AgentFleet, BoardState, ClaudeUsage, CrewEvent, CrewMember, ServiceHealth, SystemMetrics,
  TradingStatus,
} from '../types'

type OpsFilter = 'all' | 'tools' | 'events'

interface DashboardState {
  isConnected: boolean
  lastUpdate: Date | null

  services: Record<string, ServiceHealth>
  system: SystemMetrics | null
  trading: TradingStatus | null
  usage: ClaudeUsage | null
  fleet: AgentFleet | null
  board: BoardState | null

  crew: Record<string, CrewMember>
  crewEvents: CrewEvent[]
  opsFilter: OpsFilter

  setConnected: (connected: boolean) => void
  setLastUpdate: (date: Date) => void
  setServices: (services: Record<string, ServiceHealth>) => void
  setSystem: (system: SystemMetrics | null) => void
  setTrading: (trading: TradingStatus | null) => void
  setUsage: (usage: ClaudeUsage | null) => void
  setFleet: (fleet: AgentFleet | null) => void
  setBoard: (board: BoardState | null) => void
  setCrew: (crew: Record<string, CrewMember>) => void
  addCrewEvent: (event: CrewEvent) => void
  setCrewEvents: (events: CrewEvent[]) => void
  setOpsFilter: (filter: OpsFilter) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  isConnected: false,
  lastUpdate: null,

  services: {},
  system: null,
  trading: null,
  usage: null,
  fleet: null,
  board: null,

  crew: {},
  crewEvents: [],
  opsFilter: 'all',

  setConnected: (isConnected) => set({ isConnected }),
  setLastUpdate: (lastUpdate) => set({ lastUpdate }),
  setServices: (services) => set({ services }),
  setSystem: (system) => set({ system }),
  setTrading: (trading) => set({ trading }),
  setUsage: (usage) => set({ usage }),
  setFleet: (fleet) => set({ fleet }),
  setBoard: (board) => set({ board }),
  setCrew: (crew) => set({ crew }),
  addCrewEvent: (event) =>
    set((state) => ({ crewEvents: [event, ...state.crewEvents].slice(0, 200) })),
  setCrewEvents: (crewEvents) => set({ crewEvents: crewEvents.slice(0, 200) }),
  setOpsFilter: (opsFilter) => set({ opsFilter }),
}))
