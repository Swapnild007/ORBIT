import { create } from 'zustand'
import type { OsintPost } from '@/lib/osint-client'

const STORAGE_KEY = 'eagle-eye-osint-toggles'

type Platform = 'reddit' | 'mastodon' | 'bluesky'

function loadToggles(): Map<Platform, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return new Map(JSON.parse(stored))
  } catch { /* ignore */ }
  return new Map([['reddit', true], ['mastodon', true], ['bluesky', true]])
}

function saveToggles(toggles: Map<Platform, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...toggles]))
}

interface OsintState {
  posts: Map<string, OsintPost>
  platformToggles: Map<Platform, boolean>
  version: number
  count: number
  lastFetch: number | null
  setPosts: (posts: OsintPost[]) => void
  togglePlatform: (p: Platform) => void
}

export const useOsintStore = create<OsintState>()((set, get) => ({
  posts: new Map(),
  platformToggles: loadToggles(),
  version: 0,
  count: 0,
  lastFetch: null,

  setPosts: (posts) => {
    const map = new Map<string, OsintPost>()
    for (const p of posts) map.set(p.id, p)
    set({ posts: map, count: map.size, version: get().version + 1, lastFetch: Date.now() })
  },

  togglePlatform: (platform) => {
    const next = new Map(get().platformToggles)
    next.set(platform, !next.get(platform))
    saveToggles(next)
    set({ platformToggles: next })
  },
}))
