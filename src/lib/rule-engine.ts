import type { AlertRule } from '@/stores/alert-rule-store'
import type { Geofence } from '@/lib/persistence'

interface EntityInfo {
  domain: string
  id: string
  title: string
  description: string
  lat?: number
  lon?: number
  severity?: number
}

/** Haversine distance in km between two lat/lon points */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function inBbox(lat: number, lon: number, gf: Geofence): boolean {
  return lat >= gf.south && lat <= gf.north && lon >= gf.west && lon <= gf.east
}

/** Minimum cooldown between rule triggers for the same rule (ms) */
const RULE_COOLDOWN = 60_000

/**
 * Evaluate a single rule against an entity. Returns true if the rule matches.
 */
export function evaluateRule(
  rule: AlertRule,
  entity: EntityInfo,
  geofences: Geofence[],
): boolean {
  if (!rule.enabled) return false

  // Cooldown check
  if (rule.lastTriggered && Date.now() - rule.lastTriggered < RULE_COOLDOWN) return false

  switch (rule.trigger) {
    case 'domain':
      return rule.domains?.includes(entity.domain) ?? false

    case 'severity':
      return entity.severity !== undefined && entity.severity >= (rule.severityThreshold ?? 0)

    case 'keyword': {
      if (!rule.keywords?.length) return false
      const text = `${entity.title} ${entity.description}`.toLowerCase()
      return rule.keywords.some(kw => text.includes(kw.toLowerCase()))
    }

    case 'geofence': {
      if (!rule.geofenceId || entity.lat == null || entity.lon == null) return false
      if (rule.geofenceDomain && rule.geofenceDomain !== entity.domain) return false
      const gf = geofences.find(g => g.id === rule.geofenceId)
      if (!gf) return false
      return inBbox(entity.lat, entity.lon, gf)
    }

    case 'proximity': {
      if (rule.proximityLat == null || rule.proximityLon == null || rule.proximityRadiusKm == null) return false
      if (entity.lat == null || entity.lon == null) return false
      if (rule.proximityDomain && rule.proximityDomain !== entity.domain) return false
      const dist = haversineKm(entity.lat, entity.lon, rule.proximityLat, rule.proximityLon)
      return dist <= rule.proximityRadiusKm
    }

    default:
      return false
  }
}
