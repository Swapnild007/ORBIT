import { create } from 'zustand'
import { WEATHER_EVENT_TYPES } from '@/types'
import type { WeatherEventType, WeatherEvent } from '@/types'

const STORAGE_KEY = 'eagle-eye-weather-type-toggles'

function loadToggles(): Map<WeatherEventType, boolean> {
  const map = new Map<WeatherEventType, boolean>()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const obj = JSON.parse(stored) as Record<string, boolean>
      for (const t of WEATHER_EVENT_TYPES) map.set(t, obj[t] ?? true)
      return map
    }
  } catch { /* ignore */ }
  for (const t of WEATHER_EVENT_TYPES) map.set(t, true)
  return map
}

function saveToggles(toggles: Map<WeatherEventType, boolean>) {
  const obj: Record<string, boolean> = {}
  for (const [id, on] of toggles) obj[id] = on
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
}

interface WeatherState {
  events: Map<string, WeatherEvent>
  version: number
  count: number
  lastFetch: number | null
  errors: string[]
  typeToggles: Map<WeatherEventType, boolean>

  toggleType: (type: WeatherEventType) => void
  enableAllTypes: () => void
  disableAllTypes: () => void
}

export const useWeatherStore = create<WeatherState>()((set, get) => ({
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
    const next = new Map<WeatherEventType, boolean>()
    for (const t of WEATHER_EVENT_TYPES) next.set(t, true)
    saveToggles(next)
    set({ typeToggles: next })
  },

  disableAllTypes: () => {
    const next = new Map<WeatherEventType, boolean>()
    for (const t of WEATHER_EVENT_TYPES) next.set(t, false)
    saveToggles(next)
    set({ typeToggles: next })
  },
}))
