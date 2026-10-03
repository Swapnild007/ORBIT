import { create } from 'zustand'
import { NEWS_CATEGORIES } from '@/types'
import type { NewsCategory, NewsEvent } from '@/types'

const STORAGE_KEY = 'eagle-eye-news-category-toggles'

function loadToggles(): Map<NewsCategory, boolean> {
  const map = new Map<NewsCategory, boolean>()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const obj = JSON.parse(stored) as Record<string, boolean>
      for (const t of NEWS_CATEGORIES) map.set(t, obj[t] ?? true)
      return map
    }
  } catch { /* ignore */ }
  for (const t of NEWS_CATEGORIES) map.set(t, true)
  return map
}

function saveToggles(toggles: Map<NewsCategory, boolean>) {
  const obj: Record<string, boolean> = {}
  for (const [id, on] of toggles) obj[id] = on
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
}

interface NewsState {
  events: Map<string, NewsEvent>
  version: number
  count: number
  lastFetch: number | null
  errors: string[]
  categoryToggles: Map<NewsCategory, boolean>

  toggleCategory: (cat: NewsCategory) => void
  enableAllCategories: () => void
  disableAllCategories: () => void
}

export const useNewsStore = create<NewsState>()((set, get) => ({
  events: new Map(),
  version: 0,
  count: 0,
  lastFetch: null,
  errors: [],
  categoryToggles: loadToggles(),

  toggleCategory: (cat) => {
    const next = new Map(get().categoryToggles)
    next.set(cat, !get().categoryToggles.get(cat))
    saveToggles(next)
    set({ categoryToggles: next })
  },

  enableAllCategories: () => {
    const next = new Map<NewsCategory, boolean>()
    for (const t of NEWS_CATEGORIES) next.set(t, true)
    saveToggles(next)
    set({ categoryToggles: next })
  },

  disableAllCategories: () => {
    const next = new Map<NewsCategory, boolean>()
    for (const t of NEWS_CATEGORIES) next.set(t, false)
    saveToggles(next)
    set({ categoryToggles: next })
  },
}))
