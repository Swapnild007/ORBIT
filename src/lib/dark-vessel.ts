import type { VesselRecord } from '@/types'
import { useGeofenceStore } from '@/stores/geofence-store'
import { isInsideGeofence } from '@/lib/geofence-check'

export interface DarkVessel {
  mmsi: number
  name: string
  lastLat: number
  lastLon: number
  lastSeen: number
  silentMinutes: number
  inGeofence: string | null // geofence name if inside one
}

// Track last-seen timestamps per vessel
const lastSeen = new Map<number, { time: number; lat: number; lon: number; name: string }>()

const DARK_THRESHOLD_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Update tracking data with current vessel positions.
 * Call this on each vessel data update.
 */
export function updateVesselTracking(vessels: Map<number, VesselRecord>) {
  const now = Date.now()
  for (const [mmsi, v] of vessels) {
    lastSeen.set(mmsi, { time: now, lat: v.lat, lon: v.lon, name: v.name })
  }
}

/**
 * Detect vessels that have gone dark (stopped transmitting AIS).
 * A vessel is considered dark if:
 * 1. It was previously tracked (in lastSeen map)
 * 2. It's no longer in the current vessel list
 * 3. It's been silent for > DARK_THRESHOLD_MS
 * 4. Optionally: it was inside a geofence when last seen
 *
 * @param currentVessels - Currently active vessel map
 * @param geofenceOnly - If true, only flag vessels that were in a geofence
 */
export function detectDarkVessels(
  currentVessels: Map<number, VesselRecord>,
  geofenceOnly = false,
): DarkVessel[] {
  const now = Date.now()
  const dark: DarkVessel[] = []
  const geofences = useGeofenceStore.getState().geofences

  for (const [mmsi, last] of lastSeen) {
    // Still transmitting — skip
    if (currentVessels.has(mmsi)) continue

    const silentMs = now - last.time
    if (silentMs < DARK_THRESHOLD_MS) continue

    // Check if last known position was inside any geofence
    let inGeofence: string | null = null
    for (const gf of geofences) {
      if (isInsideGeofence(last.lat, last.lon, gf)) {
        inGeofence = gf.name
        break
      }
    }

    if (geofenceOnly && !inGeofence) continue

    dark.push({
      mmsi,
      name: last.name,
      lastLat: last.lat,
      lastLon: last.lon,
      lastSeen: last.time,
      silentMinutes: Math.floor(silentMs / 60_000),
      inGeofence,
    })
  }

  return dark.sort((a, b) => b.silentMinutes - a.silentMinutes)
}

/**
 * Clean up tracking data for vessels that have been dark for too long (>1 hour).
 */
export function cleanupDarkTracking() {
  const now = Date.now()
  const maxAge = 60 * 60 * 1000 // 1 hour
  for (const [mmsi, last] of lastSeen) {
    if (now - last.time > maxAge) lastSeen.delete(mmsi)
  }
}
