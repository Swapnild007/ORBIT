import { useEffect, useRef } from 'react'
import { useSatelliteStore } from '@/stores/satellite-store'
import { useVesselStore } from '@/stores/vessel-store'
import { useFlightStore } from '@/stores/flight-store'
import { useWeatherStore } from '@/stores/weather-store'
import { useNewsStore } from '@/stores/news-store'
import { useConflictStore } from '@/stores/conflict-store'
import { useCyberStore } from '@/stores/cyber-store'
import { useOsintStore } from '@/stores/osint-store'
import { useAlertStore } from '@/stores/alert-store'
import { persistSnapshot, persistAlerts, loadAlerts } from '@/lib/persistence'

const SNAPSHOT_INTERVAL = 60_000 // 1 minute
const ALERT_PERSIST_INTERVAL = 30_000 // 30 seconds

export function usePersistence() {
  const initializedRef = useRef(false)

  // Load persisted alerts on startup
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    loadAlerts().then(persisted => {
      if (persisted.length === 0) return
      const store = useAlertStore.getState()
      // Only load if current store is empty (fresh session)
      if (store.alerts.length > 0) return
      for (const alert of persisted.sort((a, b) => b.time - a.time)) {
        store.addAlert({
          title: alert.title,
          description: alert.description,
          severity: alert.severity as 'info' | 'warning' | 'critical',
          domain: alert.domain,
          entityId: alert.entityId,
        })
      }
    }).catch(() => {})
  }, [])

  // Periodic timeseries snapshots
  useEffect(() => {
    const timer = setInterval(() => {
      const satStats = useSatelliteStore.getState().getStats()
      persistSnapshot({
        timestamp: Date.now(),
        satellites: satStats.enabledCount,
        vessels: useVesselStore.getState().count,
        flights: useFlightStore.getState().count,
        weather: useWeatherStore.getState().count,
        news: useNewsStore.getState().count,
        conflicts: useConflictStore.getState().count,
        cyber: useCyberStore.getState().count,
        osint: useOsintStore.getState().count,
        alerts: useAlertStore.getState().alerts.length,
      }).catch(() => {})
    }, SNAPSHOT_INTERVAL)

    return () => clearInterval(timer)
  }, [])

  // Periodic alert persistence
  useEffect(() => {
    const timer = setInterval(() => {
      const alerts = useAlertStore.getState().alerts
      persistAlerts(alerts).catch(() => {})
    }, ALERT_PERSIST_INTERVAL)

    return () => clearInterval(timer)
  }, [])
}
