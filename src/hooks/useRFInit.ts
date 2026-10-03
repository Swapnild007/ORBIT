import { useEffect } from 'react'
import { useRFStore } from '@/stores/rf-store'
import type { RFSpot } from '@/types'

export function useRFInit() {
  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch('/api/rf/spots')
        if (!res.ok) return
        const json = await res.json() as { spots: RFSpot[]; errors: string[] }
        if (cancelled) return

        const spots = json.spots ?? []
        useRFStore.getState().setSpots(spots)
      } catch {
        // RF data is non-critical
      }
    }

    poll()
    const interval = setInterval(poll, 300_000) // 5 min
    return () => { cancelled = true; clearInterval(interval) }
  }, [])
}
