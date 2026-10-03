import { create } from 'zustand'
import { CYBER_EVENT_TYPES } from '@/types'
import type { CyberEventType, CyberEvent } from '@/types'

const STORAGE_KEY = 'eagle-eye-cyber-type-toggles'

function loadToggles(): Map<CyberEventType, boolean> {
  const map = new Map<CyberEventType, boolean>()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const obj = JSON.parse(stored) as Record<string, boolean>
      for (const t of CYBER_EVENT_TYPES) map.set(t, obj[t] ?? true)
      return map
    }
  } catch { /* ignore */ }
  for (const t of CYBER_EVENT_TYPES) map.set(t, true)
  return map
}

function saveToggles(toggles: Map<CyberEventType, boolean>) {
  const obj: Record<string, boolean> = {}
  for (const [id, on] of toggles) obj[id] = on
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
}

interface CyberState {
  events: Map<string, CyberEvent>
  version: number
  count: number
  lastFetch: number | null
  errors: string[]
  typeToggles: Map<CyberEventType, boolean>

  toggleType: (type: CyberEventType) => void
  enableAllTypes: () => void
  disableAllTypes: () => void
}

export const useCyberStore = create<CyberState>()((set, get) => ({
  events: new Map(),
  version: 0,
  count: 0,
  lastFetch: null,
  errors: [],
  typeToggles: loadToggles(),

  toggleType: (type) => {
    const next = new Map(get().typeToggles)
    next.set(type, !get().typeToggles.get(type))
    saveToggles(next)
    set({ typeToggles: next })
  },

  enableAllTypes: () => {
    const next = new Map<CyberEventType, boolean>()
    for (const t of CYBER_EVENT_TYPES) next.set(t, true)
    saveToggles(next)
    set({ typeToggles: next })
  },

  disableAllTypes: () => {
    const next = new Map<CyberEventType, boolean>()
    for (const t of CYBER_EVENT_TYPES) next.set(t, false)
    saveToggles(next)
    set({ typeToggles: next })
  },
}))
