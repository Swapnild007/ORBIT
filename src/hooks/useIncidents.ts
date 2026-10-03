import { useMemo } from 'react'
import { useWeatherStore } from '@/stores/weather-store'
import { useConflictStore } from '@/stores/conflict-store'
import { useCyberStore } from '@/stores/cyber-store'
import { useNewsStore } from '@/stores/news-store'
import { clusterIncidents, type CorrelatedEvent, type Incident } from '@/lib/correlation'

/**
 * Compute cross-domain incident clusters from all event stores.
 * Returns multi-domain incidents (events from 2+ domains in same area + timeframe).
 */
export function useIncidents(): Incident[] {
  const weatherVersion = useWeatherStore(s => s.version)
  const conflictVersion = useConflictStore(s => s.version)
  const cyberVersion = useCyberStore(s => s.version)
  const newsVersion = useNewsStore(s => s.version)

  return useMemo(() => {
    void weatherVersion; void conflictVersion; void cyberVersion; void newsVersion

    const events: CorrelatedEvent[] = []

    const weatherEvents = useWeatherStore.getState().events
    for (const [, e] of weatherEvents) {
      events.push({ domain: 'weather', id: e.id, title: e.title, source: e.source, lat: e.lat, lon: e.lon, time: e.time })
    }

    const conflictEvents = useConflictStore.getState().events
    for (const [, e] of conflictEvents) {
      events.push({ domain: 'conflict', id: e.id, title: e.title, source: e.source, lat: e.lat, lon: e.lon, time: e.time })
    }

    const cyberEvents = useCyberStore.getState().events
    for (const [, e] of cyberEvents) {
      events.push({ domain: 'cyber', id: e.id, title: e.title, source: e.source, lat: e.lat, lon: e.lon, time: e.time })
    }

    const newsEvents = useNewsStore.getState().events
    for (const [, e] of newsEvents) {
      events.push({ domain: 'news', id: e.id, title: e.title, source: e.source, lat: e.lat, lon: e.lon, time: e.time })
    }

    return clusterIncidents(events)
  }, [weatherVersion, conflictVersion, cyberVersion, newsVersion])
}
