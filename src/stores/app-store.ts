import { create } from 'zustand'
import type { NavView } from '@/types'

interface FlyToTarget {
  center: [number, number]
  zoom: number
  id: number
}

interface AppState {
  activeView: NavView
  sessionStart: number
  /** Start of the timeline window (ms timestamp). Default: 6 hours ago */
  timelineStart: number
  /** Current cursor position on the timeline (ms timestamp). Default: now */
  timelineCursor: number
  /** Whether the timeline is playing (cursor == live) */
  timelineLive: boolean
  /** Replay playback state */
  timelinePlaying: boolean
  /** Replay speed multiplier (1x, 2x, 5x, 10x) */
  timelineSpeed: number
  /** Pending fly-to target from region presets or other UI */
  flyToTarget: FlyToTarget | null
  setActiveView: (view: NavView) => void
  setTimelineCursor: (ms: number) => void
  setTimelineLive: (live: boolean) => void
  setTimelinePlaying: (playing: boolean) => void
  setTimelineSpeed: (speed: number) => void
  flyTo: (center: [number, number], zoom: number) => void
  clearFlyTo: () => void
}

const SIX_HOURS = 6 * 60 * 60 * 1000

export const useAppStore = create<AppState>()((set) => ({
  activeView: 'Globe',
  sessionStart: Date.now(),
  timelineStart: Date.now() - SIX_HOURS,
  timelineCursor: Date.now(),
  timelineLive: true,
  timelinePlaying: false,
  timelineSpeed: 1,
  flyToTarget: null,
  setActiveView: (view) => set({ activeView: view }),
  setTimelineCursor: (ms) => set({ timelineCursor: ms, timelineLive: false }),
  setTimelineLive: (live) => set(live ? { timelineLive: true, timelineCursor: Date.now(), timelinePlaying: false } : { timelineLive: live }),
  setTimelinePlaying: (playing) => set({ timelinePlaying: playing }),
  setTimelineSpeed: (speed) => set({ timelineSpeed: speed }),
  flyTo: (center, zoom) => set({ flyToTarget: { center, zoom, id: Date.now() }, activeView: 'Globe' }),
  clearFlyTo: () => set({ flyToTarget: null }),
}))
