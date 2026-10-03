import { haversineDistance } from '@/lib/utils'

export interface CorrelatedEntity {
  domain: string
  id: string
  name: string
  lat: number
  lon: number
  distance: number // km
}

export interface CorrelatedEvent {
  domain: string
  id: string
  title: string
  source: string
  lat: number
  lon: number
  time: number
}

export interface Incident {
  id: string
  events: CorrelatedEvent[]
  domains: string[]
  center: [number, number]
  radius: number // km
  timeSpan: [number, number] // [earliest, latest]
  sourceCount: number
}

/**
 * Find entities from other domains that are within `radiusKm` of the given point.
 * Uses haversine distance.
 */
export function findNearbyEntities(
  lat: number,
  lon: number,
  radiusKm: number,
  excludeId: string,
  sources: Array<{
    domain: string
    entities: Array<{ id: string; name: string; lat: number; lon: number }>
  }>,
): CorrelatedEntity[] {
  const results: CorrelatedEntity[] = []

  for (const source of sources) {
    for (const entity of source.entities) {
      if (entity.id === excludeId) continue
      const dist = haversineDistance(lat, lon, entity.lat, entity.lon)
      if (dist <= radiusKm) {
        results.push({
          domain: source.domain,
          id: entity.id,
          name: entity.name,
          lat: entity.lat,
          lon: entity.lon,
          distance: dist,
        })
      }
    }
  }

  return results.sort((a, b) => a.distance - b.distance)
}

/**
 * Cluster events across domains by spatial proximity (≤50km) and temporal proximity (≤1 hour).
 * Returns incidents where multiple domains report activity in the same area + timeframe.
 * Only returns multi-domain incidents (single-domain clusters are ignored).
 */
export function clusterIncidents(
  events: CorrelatedEvent[],
  spatialRadiusKm = 50,
  temporalWindowMs = 60 * 60 * 1000,
): Incident[] {
  if (events.length < 2) return []

  const assigned = new Set<string>()
  const incidents: Incident[] = []

  // Sort by time for consistent clustering
  const sorted = [...events].sort((a, b) => a.time - b.time)

  for (let i = 0; i < sorted.length; i++) {
    const seed = sorted[i]
    const seedKey = `${seed.domain}:${seed.id}`
    if (assigned.has(seedKey)) continue

    const cluster: CorrelatedEvent[] = [seed]
    assigned.add(seedKey)

    for (let j = i + 1; j < sorted.length; j++) {
      const candidate = sorted[j]
      const candKey = `${candidate.domain}:${candidate.id}`
      if (assigned.has(candKey)) continue

      // Check temporal proximity against any event in the cluster
      const withinTime = cluster.some(e => Math.abs(candidate.time - e.time) <= temporalWindowMs)
      if (!withinTime) continue

      // Check spatial proximity against any event in the cluster
      const withinSpace = cluster.some(e =>
        haversineDistance(candidate.lat, candidate.lon, e.lat, e.lon) <= spatialRadiusKm
      )
      if (!withinSpace) continue

      cluster.push(candidate)
      assigned.add(candKey)
    }

    // Only keep multi-domain clusters
    const domains = [...new Set(cluster.map(e => e.domain))]
    if (domains.length < 2) continue

    const sources = new Set(cluster.map(e => e.source))
    const lats = cluster.map(e => e.lat)
    const lons = cluster.map(e => e.lon)
    const times = cluster.map(e => e.time)

    const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length
    const centerLon = lons.reduce((a, b) => a + b, 0) / lons.length

    // Compute actual radius (max distance from center)
    const radius = Math.max(...cluster.map(e =>
      haversineDistance(centerLat, centerLon, e.lat, e.lon)
    ))

    incidents.push({
      id: `inc-${seed.domain}-${seed.id}`,
      events: cluster,
      domains,
      center: [centerLon, centerLat],
      radius,
      timeSpan: [Math.min(...times), Math.max(...times)],
      sourceCount: sources.size,
    })
  }

  return incidents.sort((a, b) => b.events.length - a.events.length)
}
