import { create } from 'zustand'
import { FLIGHT_TYPES } from '@/types'
import { PositionHistory } from '@/lib/position-history'
import type { FlightType, FlightRecord } from '@/types'

const STORAGE_KEY = 'eagle-eye-flight-type-toggles'

function loadToggles(): Map<FlightType, boolean> {
  const map = new Map<FlightType, boolean>()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const obj = JSON.parse(stored) as Record<string, boolean>
      for (const t of FLIGHT_TYPES) map.set(t, obj[t] ?? true)
      return map
    }
  } catch { /* ignore */ }
  for (const t of FLIGHT_TYPES) map.set(t, true)
  return map
}

function saveToggles(toggles: Map<FlightType, boolean>) {
  const obj: Record<string, boolean> = {}
  for (const [id, on] of toggles) obj[id] = on
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
}

interface FlightState {
  flights: Map<string, FlightRecord>
  version: number
  connected: boolean
  count: number
  history: PositionHistory<string>
  typeToggles: Map<FlightType, boolean>

  toggleType: (type: FlightType) => void
  enableAllTypes: () => void
  disableAllTypes: () => void
}

export const useFlightStore = create<FlightState>()((set, get) => ({
  flights: new Map(),
  version: 0,
  connected: false,
  count: 0,
  history: new PositionHistory<string>(),
  typeToggles: loadToggles(),

  toggleType: (type) => {
    const next = new Map(get().typeToggles)
    next.set(type, !get().typeToggles.get(type))
    saveToggles(next)
    set({ typeToggles: next })
  },

  enableAllTypes: () => {
    const next = new Map<FlightType, boolean>()
    for (const t of FLIGHT_TYPES) next.set(t, true)
    saveToggles(next)
    set({ typeToggles: next })
  },

  disableAllTypes: () => {
    const next = new Map<FlightType, boolean>()
    for (const t of FLIGHT_TYPES) next.set(t, false)
    saveToggles(next)
    set({ typeToggles: next })
  },
}))
