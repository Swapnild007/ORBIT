import { useEffect } from 'react'
import { useNewsStore } from '@/stores/news-store'
import type { NewsEvent } from '@/types'

export function useNewsInit() {
  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch('/api/news/events')
        if (!res.ok) {
          useNewsStore.setState({ errors: [`HTTP ${res.status} from backend`] })
          return
        }
        const json = await res.json() as { events: NewsEvent[]; errors: string[] }
        if (cancelled) return

        const events = json.events ?? []
        const errors = json.errors ?? []

        const map = new Map<string, NewsEvent>()
        for (const e of events) {
          map.set(e.id, e)
        }

        useNewsStore.setState(s => ({
          events: map,
          count: map.size,
          lastFetch: Date.now(),
          errors,
          version: s.version + 1,
        }))
      } catch {
        useNewsStore.setState({ errors: ['Failed to connect to backend'] })
      }
    }

    poll()
    const interval = setInterval(poll, 300_000) // 5 min

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])
}
