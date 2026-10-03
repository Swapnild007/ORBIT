import { useEffect } from 'react'
import { useCyberStore } from '@/stores/cyber-store'
import type { CyberEvent } from '@/types'

export function useCyberInit() {
  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch('/api/cyber/events')
        if (!res.ok) {
          useCyberStore.setState({ errors: [`HTTP ${res.status} from backend`] })
          return
        }
        const json = await res.json() as { events: CyberEvent[]; errors: string[] }
        if (cancelled) return

        const events = json.events ?? []
        const errors = json.errors ?? []

        const map = new Map<string, CyberEvent>()
        for (const e of events) {
          map.set(e.id, e)
        }

        useCyberStore.setState(s => ({
          events: map,
          count: map.size,
          lastFetch: Date.now(),
          errors,
          version: s.version + 1,
        }))
      } catch {
        useCyberStore.setState({ errors: ['Failed to connect to backend'] })
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
