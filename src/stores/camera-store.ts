import { create } from 'zustand'
import type { Camera } from '@/lib/camera-client'

interface CameraState {
  cameras: Map<string, Camera>
  version: number
  count: number
  visible: boolean
  lastFetch: number | null
  setCameras: (cameras: Camera[]) => void
  mergeCameras: (cameras: Camera[]) => void
  setVisible: (v: boolean) => void
}

export const useCameraStore = create<CameraState>()((set, get) => ({
  cameras: new Map(),
  version: 0,
  count: 0,
  visible: true,
  lastFetch: null,

  setCameras: (cameras) => {
    const map = new Map<string, Camera>()
    for (const c of cameras) map.set(c.id, c)
    set({ cameras: map, count: map.size, version: get().version + 1, lastFetch: Date.now() })
  },

  mergeCameras: (cameras) => {
    const existing = get().cameras
    let added = 0
    const merged = new Map(existing)
    for (const c of cameras) {
      if (!merged.has(c.id)) {
        merged.set(c.id, c)
        added++
      }
    }
    if (added > 0) {
      set({ cameras: merged, count: merged.size, version: get().version + 1 })
    }
  },

  setVisible: (v) => set({ visible: v }),
}))
