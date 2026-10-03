import { create } from 'zustand'
import { VESSEL_TYPES } from '@/types'
import { PositionHistory } from '@/lib/position-history'
import type { VesselType, VesselRecord } from '@/types'

const STORAGE_KEY = 'eagle-eye-vessel-type-toggles'

function loadToggles(): Map<VesselType, boolean> {
  const map = new Map<VesselType, boolean>()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const obj = JSON.parse(stored) as Record<string, boolean>
      for (const t of VESSEL_TYPES) map.set(t, obj[t] ?? true)
      return map
    }
  } catch { /* ignore */ }
  for (const t of VESSEL_TYPES) map.set(t, true)
  return map
}

function saveToggles(toggles: Map<VesselType, boolean>) {
  const obj: Record<string, boolean> = {}
  for (const [id, on] of toggles) obj[id] = on
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
}

interface VesselState {
  vessels: Map<number, VesselRecord>
  version: number
  connected: boolean
  count: number
  history: PositionHistory<number>
  typeToggles: Map<VesselType, boolean>

  toggleType: (type: VesselType) => void
  enableAllTypes: () => void
  disableAllTypes: () => void
}

export const useVesselStore = create<VesselState>()((set, get) => ({
  vessels: new Map(),
  version: 0,
  connected: false,
  count: 0,
  history: new PositionHistory<number>(),
  typeToggles: loadToggles(),

  toggleType: (type) => {
    const next = new Map(get().typeToggles)
    next.set(type, !get().typeToggles.get(type))
    saveToggles(next)
    set({ typeToggles: next })
  },

  enableAllTypes: () => {
    const next = new Map<VesselType, boolean>()
    for (const t of VESSEL_TYPES) next.set(t, true)
    saveToggles(next)
    set({ typeToggles: next })
  },

  disableAllTypes: () => {
    const next = new Map<VesselType, boolean>()
    for (const t of VESSEL_TYPES) next.set(t, false)
    saveToggles(next)
    set({ typeToggles: next })
  },
}))
