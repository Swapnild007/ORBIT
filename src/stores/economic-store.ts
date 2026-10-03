import { create } from 'zustand'
import type { EconomicIndicator } from '@/lib/economic-client'
import { ECONOMIC_INDICATORS } from '@/lib/economic-client'

const STORAGE_KEY = 'eagle-eye-economic-toggles'

function loadToggles(): Map<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const obj = JSON.parse(stored) as Record<string, boolean>
      const map = new Map<string, boolean>()
      for (const ind of ECONOMIC_INDICATORS) map.set(ind.id, obj[ind.id] ?? true)
      return map
    }
  } catch { /* ignore */ }
  const map = new Map<string, boolean>()
  for (const ind of ECONOMIC_INDICATORS) map.set(ind.id, true)
  return map
}

function saveToggles(toggles: Map<string, boolean>) {
  const obj: Record<string, boolean> = {}
  for (const [id, on] of toggles) obj[id] = on
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
}

interface EconomicState {
  indicators: Map<string, EconomicIndicator>
  version: number
  count: number
  lastFetch: number | null
  errors: string[]
  indicatorToggles: Map<string, boolean>
  selectedIndicator: string
  toggleIndicator: (id: string) => void
  setSelectedIndicator: (id: string) => void
}

export const useEconomicStore = create<EconomicState>()((set, get) => ({
  indicators: new Map(),
  version: 0,
  count: 0,
  lastFetch: null,
  errors: [],
  indicatorToggles: loadToggles(),
  selectedIndicator: ECONOMIC_INDICATORS[0].id,

  toggleIndicator: (id) => {
    const next = new Map(get().indicatorToggles)
    next.set(id, !next.get(id))
    saveToggles(next)
    set({ indicatorToggles: next })
  },

  setSelectedIndicator: (id) => set({ selectedIndicator: id }),
}))
