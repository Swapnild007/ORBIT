import { create } from 'zustand'
import { CONFLICT_EVENT_TYPES } from '@/types'
import type { ConflictEventType, ConflictEvent } from '@/types'

const STORAGE_KEY = 'eagle-eye-conflict-type-toggles'

function loadToggles(): Map<ConflictEventType, boolean> {
  const map = new Map<ConflictEventType, boolean>()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const obj = JSON.parse(stored) as Record<string, boolean>
      for (const t of CONFLICT_EVENT_TYPES) map.set(t, obj[t] ?? true)
      return map
    }
  } catch { /* ignore */ }
  for (const t of CONFLICT_EVENT_TYPES) map.set(t, true)
  return map
}

function saveToggles(toggles: Map<ConflictEventType, boolean>) {
  const obj: Record<string, boolean> = {}
  for (const [id, on] of toggles) obj[id] = on
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
}

interface ConflictState {
  events: Map<string, ConflictEvent>
  version: number
  count: number
  lastFetch: number | null
  errors: string[]
  typeToggles: Map<ConflictEventType, boolean>

  toggleType: (type: ConflictEventType) => void
  enableAllTypes: () => void
  disableAllTypes: () => void
}

export const useConflictStore = create<ConflictState>()((set, get) => ({
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
    const next = new Map<ConflictEventType, boolean>()
    for (const t of CONFLICT_EVENT_TYPES) next.set(t, true)
    saveToggles(next)
    set({ typeToggles: next })
  },

  disableAllTypes: () => {
    const next = new Map<ConflictEventType, boolean>()
    for (const t of CONFLICT_EVENT_TYPES) next.set(t, false)
    saveToggles(next)
    set({ typeToggles: next })
  },
}))
