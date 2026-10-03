import {
  propagate,
  gstime,
  eciToGeodetic,
  degreesLong,
  degreesLat,
} from 'satellite.js'

const EARTH_RADIUS_KM = 6378.137

export interface OrbitalPoint {
  lat: number
  lon: number
  alt: number // km
  time: number // ms since epoch
}

/**
 * Compute future positions along a satellite's orbit.
 * Returns an array of lat/lon/alt points for the next `durationMin` minutes,
 * sampled every `stepSec` seconds.
 */
export function computeGroundTrack(
  satrec: Parameters<typeof propagate>[0],
  durationMin = 90,
  stepSec = 30,
  pastMin = 15,
): OrbitalPoint[] {
  const points: OrbitalPoint[] = []
  const now = Date.now()
  const pastSteps = Math.ceil((pastMin * 60) / stepSec)
  const futureSteps = Math.ceil((durationMin * 60) / stepSec)

  for (let i = -pastSteps; i <= futureSteps; i++) {
    const t = new Date(now + i * stepSec * 1000)
    try {
      const pv = propagate(satrec, t)
      if (!pv || typeof pv.position === 'boolean' || !pv.position) continue

      const gmst = gstime(t)
      const geo = eciToGeodetic(pv.position, gmst)

      points.push({
        lat: degreesLat(geo.latitude),
        lon: degreesLong(geo.longitude),
        alt: geo.height,
        time: t.getTime(),
      })
    } catch {
      // skip propagation errors
    }
  }

  return points
}

/**
 * Split a ground track into line segments, breaking only at antimeridian
 * crossings (where longitude wraps from +180 to -180 or vice versa).
 * Detected when consecutive points are on opposite sides of ±180 and the
 * raw difference exceeds 180°.
 */
export function splitAtAntimeridian(points: OrbitalPoint[]): OrbitalPoint[][] {
  if (points.length === 0) return []

  const segments: OrbitalPoint[][] = [[points[0]]]

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    // True antimeridian crossing: signs differ and the short-way-around distance > 180°
    const crossesAntimeridian =
      (prev.lon > 90 && curr.lon < -90) || (prev.lon < -90 && curr.lon > 90)
    if (crossesAntimeridian) {
      segments.push([curr])
    } else {
      segments[segments.length - 1].push(curr)
    }
  }

  return segments
}

/**
 * Compute a sensor footprint circle (coverage area) on the Earth's surface.
 * Uses the satellite's altitude to calculate the angular radius of the
 * coverage cone (line-of-sight to the horizon), then generates polygon points.
 *
 * @param lat - Satellite sub-point latitude
 * @param lon - Satellite sub-point longitude
 * @param altKm - Satellite altitude in km
 * @param numPoints - Number of polygon vertices (default 64)
 * @returns Array of [lon, lat] coordinate pairs forming the footprint polygon
 */
export function computeFootprint(
  lat: number,
  lon: number,
  altKm: number,
  numPoints = 64,
): [number, number][] {
  // Angular radius of the coverage area (line-of-sight to horizon)
  // cos(alpha) = R / (R + h) → alpha = acos(R / (R + h))
  const alpha = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altKm))

  const latRad = (lat * Math.PI) / 180
  const lonRad = (lon * Math.PI) / 180
  const coords: [number, number][] = []

  for (let i = 0; i <= numPoints; i++) {
    const bearing = (2 * Math.PI * i) / numPoints

    // Great circle destination formula
    const destLat = Math.asin(
      Math.sin(latRad) * Math.cos(alpha) +
      Math.cos(latRad) * Math.sin(alpha) * Math.cos(bearing)
    )
    const destLon = lonRad + Math.atan2(
      Math.sin(bearing) * Math.sin(alpha) * Math.cos(latRad),
      Math.cos(alpha) - Math.sin(latRad) * Math.sin(destLat)
    )

    coords.push([
      (destLon * 180) / Math.PI,
      (destLat * 180) / Math.PI,
    ])
  }

  return coords
}
