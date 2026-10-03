import { create } from 'zustand'
import type { Port } from '@/lib/ports-client'

interface PortState {
  ports: Map<string, Port>
  version: number
  count: number
  visible: boolean
  lastFetch: number | null
  setPorts: (ports: Port[]) => void
  setVisible: (v: boolean) => void
}

export const usePortStore = create<PortState>()((set, get) => ({
  ports: new Map(),
  version: 0,
  count: 0,
  visible: true,
  lastFetch: null,

  setPorts: (ports) => {
    const map = new Map<string, Port>()
    for (const p of ports) map.set(p.id, p)
    set({ ports: map, count: map.size, version: get().version + 1, lastFetch: Date.now() })
  },

  setVisible: (v) => set({ visible: v }),
}))
