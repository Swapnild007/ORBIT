export interface TrailPoint {
  lon: number
  lat: number
  timestamp: number
}

export class PositionHistory<K extends string | number> {
  private trails = new Map<K, TrailPoint[]>()
  private static MIN_DISTANCE_DEG = 0.0005 // ~55m at equator

  record(key: K, lon: number, lat: number): void {
    let trail = this.trails.get(key)
    if (!trail) {
      trail = []
      this.trails.set(key, trail)
    }
    if (trail.length > 0) {
      const last = trail[trail.length - 1]
      if (
        Math.abs(lat - last.lat) < PositionHistory.MIN_DISTANCE_DEG &&
        Math.abs(lon - last.lon) < PositionHistory.MIN_DISTANCE_DEG
      ) {
        return
      }
    }
    trail.push({ lon, lat, timestamp: Date.now() })
  }

  getTrail(key: K): TrailPoint[] {
    return this.trails.get(key) ?? []
  }
}
