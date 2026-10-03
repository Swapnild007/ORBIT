import { create } from 'zustand'

export type InfrastructureLayerType = 'cables' | 'pipelines' | 'nuclear' | 'chokepoints'

export const INFRASTRUCTURE_LAYERS: InfrastructureLayerType[] = ['cables', 'pipelines', 'nuclear', 'chokepoints']

export const INFRASTRUCTURE_LABELS: Record<InfrastructureLayerType, string> = {
  cables: 'Undersea Cables',
  pipelines: 'Pipelines',
  nuclear: 'Nuclear Facilities',
  chokepoints: 'Chokepoints',
}

export const INFRASTRUCTURE_COLORS: Record<InfrastructureLayerType, string> = {
  cables: '#06b6d4',     // cyan
  pipelines: '#f59e0b',  // amber
  nuclear: '#ef4444',    // red
  chokepoints: '#a78bfa', // violet
}

const STORAGE_KEY = 'eagle-eye-infrastructure-toggles'

function loadToggles(): Map<InfrastructureLayerType, boolean> {
  const map = new Map<InfrastructureLayerType, boolean>()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const obj = JSON.parse(stored) as Record<string, boolean>
      for (const l of INFRASTRUCTURE_LAYERS) map.set(l, obj[l] ?? false)
      return map
    }
  } catch { /* ignore */ }
  for (const l of INFRASTRUCTURE_LAYERS) map.set(l, false)
  return map
}

function saveToggles(toggles: Map<InfrastructureLayerType, boolean>) {
  const obj: Record<string, boolean> = {}
  for (const [id, on] of toggles) obj[id] = on
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
}

interface InfrastructureState {
  toggles: Map<InfrastructureLayerType, boolean>
  toggle: (layer: InfrastructureLayerType) => void
}

export const useInfrastructureStore = create<InfrastructureState>()((set, get) => ({
  toggles: loadToggles(),
  toggle: (layer) => {
    const next = new Map(get().toggles)
    next.set(layer, !next.get(layer))
    saveToggles(next)
    set({ toggles: next })
  },
}))
