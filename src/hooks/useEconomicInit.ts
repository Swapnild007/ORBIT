import { useEffect } from 'react'
import { useEconomicStore } from '@/stores/economic-store'
import type { EconomicIndicator } from '@/lib/economic-client'

export function useEconomicInit() {
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/economic/indicators')
        if (!res.ok) {
          useEconomicStore.setState({ errors: [`HTTP ${res.status} from backend`] })
          return
        }
        const json = await res.json() as { indicators: EconomicIndicator[]; errors: string[] }
        if (cancelled) return

        const indicators = json.indicators ?? []
        const errors = json.errors ?? []
        const map = new Map<string, EconomicIndicator>()
        for (const ind of indicators) map.set(ind.id, ind)

        useEconomicStore.setState(s => ({
          indicators: map,
          count: map.size,
          lastFetch: Date.now(),
          errors,
          version: s.version + 1,
        }))
      } catch {
        useEconomicStore.setState({ errors: ['Failed to connect to backend'] })
      }
    }

    load()
    // Economic data updates daily
    const interval = setInterval(load, 3_600_000) // 1 hour
    return () => { cancelled = true; clearInterval(interval) }
  }, [])
}
