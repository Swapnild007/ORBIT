import { useEffect } from 'react'
import { useVesselStore } from '@/stores/vessel-store'
import { useAlertStore } from '@/stores/alert-store'
import { updateVesselTracking, detectDarkVessels, cleanupDarkTracking } from '@/lib/dark-vessel'

/**
 * Monitors vessel positions and generates alerts when vessels go dark
 * (stop transmitting AIS) especially in geofenced areas.
 */
export function useDarkVesselDetection() {
  const vesselVersion = useVesselStore(s => s.version)

  useEffect(() => {
    const vessels = useVesselStore.getState().vessels

    // Update tracking with current positions
    updateVesselTracking(vessels)

    // Detect dark vessels
    const darkVessels = detectDarkVessels(vessels)
    const { addAlert } = useAlertStore.getState()

    for (const dv of darkVessels) {
      addAlert({
        title: `AIS Dark: ${dv.name || `MMSI ${dv.mmsi}`}`,
        description: dv.inGeofence
          ? `Vessel went silent ${dv.silentMinutes}min ago in geofence "${dv.inGeofence}". Last: ${dv.lastLat.toFixed(2)}°, ${dv.lastLon.toFixed(2)}°`
          : `Vessel went silent ${dv.silentMinutes}min ago. Last: ${dv.lastLat.toFixed(2)}°, ${dv.lastLon.toFixed(2)}°`,
        severity: dv.inGeofence ? 'critical' : 'warning',
        domain: 'maritime',
        entityId: `dark-${dv.mmsi}`,
      })
    }

    // Periodic cleanup
    cleanupDarkTracking()
  }, [vesselVersion])
}
