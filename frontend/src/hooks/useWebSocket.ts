import { useEffect, useRef } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import type { CrewEventMessage, StatusUpdate } from '../types'

const WS_URL = '/ws'

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelayRef = useRef(1000)
  const unmountedRef = useRef(false)
  const connectRef = useRef<() => void>(() => {})

  connectRef.current = () => {
    if (unmountedRef.current) return
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}${WS_URL}`)
    wsRef.current = ws

    ws.onopen = () => {
      if (unmountedRef.current) return
      const { setConnected, setLastUpdate } = useDashboardStore.getState()
      setConnected(true)
      setLastUpdate(new Date())
      reconnectDelayRef.current = 1000
    }

    ws.onmessage = (event) => {
      if (unmountedRef.current) return
      try {
        const msg = JSON.parse(event.data)
        const store = useDashboardStore.getState()
        store.setLastUpdate(new Date())

        if (msg.type === 'crew_event') {
          const ce = msg as CrewEventMessage
          if (ce.crew) store.setCrew(ce.crew)
          if (ce.event) store.addCrewEvent(ce.event)
          return
        }
        if (msg.type === 'status_update') {
          const su = msg as StatusUpdate
          if (su.services) store.setServices(su.services)
          if (su.system && 'cpu_pct' in su.system) store.setSystem(su.system)
          if (su.trading && 'market' in su.trading) store.setTrading(su.trading)
          if (su.usage && 'available' in su.usage) store.setUsage(su.usage)
          if (su.fleet && 'agents' in su.fleet) store.setFleet(su.fleet)
          if (su.board && 'arms' in su.board) store.setBoard(su.board)
        }
      } catch {
        // malformed frame — ignore
      }
    }

    ws.onclose = () => {
      if (unmountedRef.current) return
      useDashboardStore.getState().setConnected(false)
      const delay = Math.min(reconnectDelayRef.current, 30000)
      reconnectDelayRef.current = Math.min(delay * 2, 30000)
      reconnectTimeoutRef.current = setTimeout(() => connectRef.current(), delay)
    }
  }

  useEffect(() => {
    unmountedRef.current = false
    connectRef.current()
    return () => {
      unmountedRef.current = true
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      wsRef.current?.close()
    }
  }, [])

  const isConnected = useDashboardStore((s) => s.isConnected)
  const lastUpdate = useDashboardStore((s) => s.lastUpdate)
  return { isConnected, lastUpdate }
}
