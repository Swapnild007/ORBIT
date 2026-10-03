import { create } from 'zustand'
import type { RFSpot } from '@/types'

const STORAGE_KEY = 'eagle-eye-rf-toggles'

type RFSource = 'psk' | 'rbn' | 'satnogs'

function loadToggles(): Map<RFSource, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return new Map(JSON.parse(stored))
  } catch { /* ignore */ }
  return new Map([['psk', true], ['rbn', true], ['satnogs', true]])
}

function saveToggles(toggles: Map<RFSource, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...toggles]))
}

interface RFState {
  spots: Map<string, RFSpot>
  sourceToggles: Map<RFSource, boolean>
  version: number
  count: number
  lastFetch: number | null
  setSpots: (spots: RFSpot[]) => void
  toggleSource: (s: RFSource) => void
}

export const useRFStore = create<RFState>()((set, get) => ({
  spots: new Map(),
  sourceToggles: loadToggles(),
  version: 0,
  count: 0,
  lastFetch: null,

  setSpots: (spots) => {
    const map = new Map<string, RFSpot>()
    for (const s of spots) map.set(s.id, s)
    set({ spots: map, count: map.size, version: get().version + 1, lastFetch: Date.now() })
  },

  toggleSource: (source) => {
    const next = new Map(get().sourceToggles)
    next.set(source, !next.get(source))
    saveToggles(next)
    set({ sourceToggles: next })
  },
}))
