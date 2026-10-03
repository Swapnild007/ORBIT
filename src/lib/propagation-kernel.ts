import {
  propagate,
  gstime,
  eciToGeodetic,
  degreesLong,
  degreesLat,
} from 'satellite.js'
import type { SatellitePosition } from '@/types'

const EARTH_RADIUS = 6378.137 // km

export interface SatrecEntry {
  noradId: number
  satrec: Parameters<typeof propagate>[0]
}

export function propagateBatch(
  entries: SatrecEntry[],
  date: Date,
): SatellitePosition[] {
  const gmst = gstime(date)
  const results: SatellitePosition[] = []

  for (const { noradId, satrec } of entries) {
    try {
      const pv = propagate(satrec, date)
      if (!pv || typeof pv.position === 'boolean' || typeof pv.velocity === 'boolean') continue
      if (!pv.position || !pv.velocity) continue

      const pos = pv.position
      const vel = pv.velocity
    const geo = eciToGeodetic(pos, gmst)

    const vx = vel.x, vy = vel.y, vz = vel.z
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz)

    results.push({
      noradId,
      lat: degreesLat(geo.latitude),
      lon: degreesLong(geo.longitude),
      alt: geo.height,
      velocity: speed,
    })
    } catch { /* skip propagation errors */ }
  }

  return results
}


/** Map real altitude (km) to a display radius for the globe (radius=1).
 *  Logarithmic compression keeps LEO at ~1.05, MEO at ~1.18, GEO at ~1.20. */
export function displayRadius(altKm: number): number {
  return 1.015 + Math.log(1 + Math.max(0, altKm) / 200) * 0.035
}
