import { create } from 'zustand'

const STORAGE_KEY = 'eagle-eye-watchlist'

function loadWatchlist(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return new Set(JSON.parse(stored))
  } catch { /* ignore */ }
  return new Set()
}

function saveWatchlist(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
}

interface WatchlistState {
  watchlist: Set<string>
  toggle: (id: string) => void
  isWatched: (id: string) => boolean
  clear: () => void
}

export const useWatchlistStore = create<WatchlistState>()((set, get) => ({
  watchlist: loadWatchlist(),

  toggle: (id) => {
    const next = new Set(get().watchlist)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    saveWatchlist(next)
    set({ watchlist: next })
  },

  isWatched: (id) => get().watchlist.has(id),

  clear: () => {
    saveWatchlist(new Set())
    set({ watchlist: new Set() })
  },
}))
