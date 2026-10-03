import { create } from 'zustand'
import { persistGeofences, loadGeofences, type Geofence } from '@/lib/persistence'

interface GeofenceState {
  geofences: Geofence[]
  loaded: boolean
  addGeofence: (gf: Omit<Geofence, 'id'>) => void
  removeGeofence: (id: string) => void
  loadFromDB: () => Promise<void>
}

export const useGeofenceStore = create<GeofenceState>()((set, get) => ({
  geofences: [],
  loaded: false,

  addGeofence: (gf) => {
    const newGf: Geofence = {
      ...gf,
      id: `gf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }
    const next = [...get().geofences, newGf]
    set({ geofences: next })
    persistGeofences(next).catch(() => {})
  },

  removeGeofence: (id) => {
    const next = get().geofences.filter(g => g.id !== id)
    set({ geofences: next })
    persistGeofences(next).catch(() => {})
  },

  loadFromDB: async () => {
    if (get().loaded) return
    const saved = await loadGeofences()
    set({ geofences: saved, loaded: true })
  },
}))
