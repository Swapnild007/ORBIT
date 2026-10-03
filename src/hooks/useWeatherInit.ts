import { useEffect } from 'react'
import { useWeatherStore } from '@/stores/weather-store'
import type { WeatherEvent } from '@/types'

export function useWeatherInit() {
  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch('/api/weather/events')
        if (!res.ok) {
          useWeatherStore.setState({ errors: [`HTTP ${res.status} from backend`] })
          return
        }
        const json = await res.json() as { events: WeatherEvent[]; errors: string[] }
        if (cancelled) return

        const events = json.events ?? []
        const errors = json.errors ?? []

        const map = new Map<string, WeatherEvent>()
        for (const e of events) {
          map.set(e.id, e)
        }

        useWeatherStore.setState(s => ({
          events: map,
          count: map.size,
          lastFetch: Date.now(),
          errors,
          version: s.version + 1,
        }))
      } catch {
        useWeatherStore.setState({ errors: ['Failed to connect to backend'] })
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
