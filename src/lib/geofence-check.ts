import type { Geofence } from '@/lib/persistence'

/**
 * Check if a lat/lon point is inside a geofence bounding box.
 */
export function isInsideGeofence(lat: number, lon: number, gf: Geofence): boolean {
  return lat >= gf.south && lat <= gf.north && lon >= gf.west && lon <= gf.east
}
