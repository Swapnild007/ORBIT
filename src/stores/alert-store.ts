import { create } from 'zustand'

export interface AlertItem {
  id: string
  title: string
  description: string
  severity: 'info' | 'warning' | 'critical'
  domain: string
  entityId: string | null
  time: number
  acknowledged: boolean
}

const MAX_ALERTS = 500

interface AlertState {
  alerts: AlertItem[]
  unacknowledgedCount: number
  addAlert: (alert: Omit<AlertItem, 'id' | 'time' | 'acknowledged'>) => void
  acknowledge: (id: string) => void
  acknowledgeAll: () => void
  clear: () => void
}

export const useAlertStore = create<AlertState>()((set, get) => ({
  alerts: [],
  unacknowledgedCount: 0,

  addAlert: (alert) => {
    // Deduplicate by domain + entityId (or title + description if no entityId)
    const existing = get().alerts
    if (alert.entityId) {
      if (existing.some(a => a.domain === alert.domain && a.entityId === alert.entityId)) return
    } else {
      if (existing.some(a => a.title === alert.title && a.description === alert.description)) return
    }

    const newAlert: AlertItem = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      time: Date.now(),
      acknowledged: false,
    }
    set(s => {
      const next = [newAlert, ...s.alerts].slice(0, MAX_ALERTS)
      return { alerts: next, unacknowledgedCount: next.filter(a => !a.acknowledged).length }
    })
  },

  acknowledge: (id) => {
    set(s => {
      const next = s.alerts.map(a => a.id === id ? { ...a, acknowledged: true } : a)
      return { alerts: next, unacknowledgedCount: next.filter(a => !a.acknowledged).length }
    })
  },

  acknowledgeAll: () => {
    set({ alerts: [], unacknowledgedCount: 0 })
  },

  clear: () => set({ alerts: [], unacknowledgedCount: 0 }),
}))
