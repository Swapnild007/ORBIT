import { create } from 'zustand'
import { CONSTELLATIONS } from '@/data/constellations'
import { getLastFetchTime } from '@/lib/celestrak'
import type { ConstellationId, SatellitePosition, SatelliteRecord } from '@/types'

const STORAGE_KEY = 'eagle-eye-toggles'

function loadToggles(): Map<ConstellationId, boolean> {
  const map = new Map<ConstellationId, boolean>()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const obj = JSON.parse(stored) as Record<string, boolean>
      for (const c of CONSTELLATIONS) map.set(c.id, obj[c.id] ?? c.defaultOn)
      return map
    }
  } catch { /* ignore */ }
  for (const c of CONSTELLATIONS) map.set(c.id, c.defaultOn)
  return map
}

function saveToggles(toggles: Map<ConstellationId, boolean>) {
  const obj: Record<string, boolean> = {}
  for (const [id, on] of toggles) obj[id] = on
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
}

export interface SatelliteStats {
  totalTracked: number
  enabledCount: number
  constellationCount: number
  lastFetchTime: number | null
}

// Module-level mutable state for high-frequency position updates.
// Components access via getPositions/getSatellites and subscribe to `version` for updates.
let positionsData = new Map<ConstellationId, SatellitePosition[]>()
let satellitesData = new Map<ConstellationId, SatelliteRecord[]>()

interface SatelliteState {
  toggles: Map<ConstellationId, boolean>
  version: number
  loading: Set<ConstellationId>

  toggle: (id: ConstellationId) => void
  enableAll: () => void
  disableAll: () => void
  getPositions: (id: ConstellationId) => SatellitePosition[]
  getSatellites: (id: ConstellationId) => SatelliteRecord[]
  getStats: () => SatelliteStats
}

export const useSatelliteStore = create<SatelliteState>()((set, get) => ({
  toggles: loadToggles(),
  version: 0,
  loading: new Set<ConstellationId>(),

  toggle: (id) => {
    const next = new Map(get().toggles)
    next.set(id, !get().toggles.get(id))
    saveToggles(next)
    set({ toggles: next })
  },

  enableAll: () => {
    const next = new Map<ConstellationId, boolean>()
    for (const c of CONSTELLATIONS) next.set(c.id, true)
    saveToggles(next)
    set({ toggles: next })
  },

  disableAll: () => {
    const next = new Map<ConstellationId, boolean>()
    for (const c of CONSTELLATIONS) next.set(c.id, false)
    saveToggles(next)
    set({ toggles: next })
  },

  getPositions: (id) => positionsData.get(id) ?? [],
  getSatellites: (id) => satellitesData.get(id) ?? [],

  getStats: () => {
    const { toggles } = get()
    let totalTracked = 0, enabledCount = 0, constellationCount = 0
    let lastFetchTime: number | null = null
    for (const c of CONSTELLATIONS) {
      const sats = satellitesData.get(c.id)
      if (sats) totalTracked += sats.length
      if (toggles.get(c.id)) {
        constellationCount++
        if (sats) {
          enabledCount += sats.length
          const ft = getLastFetchTime(c.celestrakGroup)
          if (ft && (!lastFetchTime || ft > lastFetchTime)) lastFetchTime = ft
        }
      }
    }
    return { totalTracked, enabledCount, constellationCount, lastFetchTime }
  },
}))

// Internal mutators used by the satellite init hook
export function _setPositionsData(p: Map<ConstellationId, SatellitePosition[]>) {
  positionsData = p
}

export function _setSatellitesForConstellation(id: ConstellationId, sats: SatelliteRecord[]) {
  satellitesData = new Map(satellitesData).set(id, sats)
}

export function _removeConstellation(id: ConstellationId) {
  const nextSats = new Map(satellitesData)
  nextSats.delete(id)
  satellitesData = nextSats
  const nextPos = new Map(positionsData)
  nextPos.delete(id)
  positionsData = nextPos
}
