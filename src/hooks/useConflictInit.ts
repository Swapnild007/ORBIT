import { useEffect } from 'react'
import { useConflictStore } from '@/stores/conflict-store'
import type { ConflictEvent } from '@/types'

export function useConflictInit() {
  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch('/api/conflicts/events')
        if (!res.ok) {
          useConflictStore.setState({ errors: [`HTTP ${res.status} from backend`] })
          return
        }
        const json = await res.json() as { events: ConflictEvent[]; errors: string[] }
        if (cancelled) return

        const events = json.events ?? []
        const errors = json.errors ?? []

        const map = new Map<string, ConflictEvent>()
        for (const e of events) {
          map.set(e.id, e)
        }

        useConflictStore.setState(s => ({
          events: map,
          count: map.size,
          lastFetch: Date.now(),
          errors,
          version: s.version + 1,
        }))
      } catch {
        useConflictStore.setState({ errors: ['Failed to connect to backend'] })
      }
    }

    poll()
    const interval = setInterval(poll, 1_800_000) // 30 min

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])
}
