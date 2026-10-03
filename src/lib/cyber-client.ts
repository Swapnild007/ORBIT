import type { CyberEvent, CyberEventType } from '@/types'

interface AbuseIPDBEntry {
  ipAddress: string
  abuseConfidenceScore: number
  countryCode: string
  totalReports: number
  lastReportedAt: string
}

// Simple IP geolocation lookup table not feasible here.
// The server proxy adds lat/lon from a GeoIP database.
export function parseAbuseIPDB(data: {
  data?: Array<Partial<AbuseIPDBEntry> & { lat?: number; lon?: number; city?: string; geoCountry?: string }>
}): CyberEvent[] {
  if (!data.data) return []
  return data.data
    .filter(e => e.lat != null && e.lon != null && e.ipAddress)
    .map((e, i) => {
      const confidence = e.abuseConfidenceScore ?? 0
      const reports = e.totalReports ?? 0
      const location = [e.city, e.geoCountry ?? e.countryCode].filter(Boolean).join(', ')
      return {
        id: `abuse-${e.ipAddress}-${i}`,
        type: (confidence > 95 ? 'ddos' : 'scan') as CyberEventType,
        title: `Abuse report: ${e.ipAddress} (${location})`,
        description: reports > 0
          ? `${reports} reports, confidence ${confidence}%`
          : `Confidence ${confidence}%`,
        ip: e.ipAddress!,
        lat: e.lat!,
        lon: e.lon!,
        severity: Math.min(10, Math.round(confidence / 10)),
        source: 'abuseipdb' as const,
        time: e.lastReportedAt ? new Date(e.lastReportedAt).getTime() : Date.now(),
        lastUpdate: Date.now(),
      }
    })
}

interface IODASignal {
  entityType: string
  entityCode: string
  entityName: string
  datasource: string
  from: number
  until: number
  level: string
}

export function parseIODASignals(data: { data?: IODASignal[] }, geoLookup: Map<string, { lat: number; lon: number }>): CyberEvent[] {
  if (!data.data) return []
  return data.data
    .filter(e => {
      const geo = geoLookup.get(e.entityCode)
      return geo != null && e.level === 'critical'
    })
    .map(e => {
      const geo = geoLookup.get(e.entityCode)!
      return {
        id: `ioda-${e.entityCode}-${e.from}`,
        type: 'outage' as CyberEventType,
        title: `Internet outage: ${e.entityName}`,
        description: `${e.datasource} detected ${e.level} outage`,
        ip: null,
        lat: geo.lat,
        lon: geo.lon,
        severity: 8,
        source: 'ioda' as const,
        time: e.from * 1000,
        lastUpdate: Date.now(),
      }
    })
}
