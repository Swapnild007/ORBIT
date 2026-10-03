import type { ConflictEvent, ConflictEventType } from '@/types'

interface ACLEDEvent {
  data_id: number
  event_date: string
  event_type: string
  sub_event_type: string
  actor1: string
  actor2: string
  fatalities: number
  latitude: number
  longitude: number
  notes: string
  source: string
  country: string
  admin1: string
}

function mapACLEDType(eventType: string): ConflictEventType {
  const lower = eventType.toLowerCase()
  if (lower.includes('battle')) return 'battle'
  if (lower.includes('protest')) return 'protest'
  if (lower.includes('riot')) return 'riot'
  if (lower.includes('explosion') || lower.includes('remote violence')) return 'explosion'
  if (lower.includes('violence against civilians')) return 'violence'
  if (lower.includes('strategic')) return 'strategic'
  return 'violence'
}

export function parseACLEDEvents(data: { data?: ACLEDEvent[] }): ConflictEvent[] {
  if (!data.data) return []
  return data.data.map(e => ({
    id: `acled-${e.data_id}`,
    type: mapACLEDType(e.event_type),
    title: `${e.event_type}${e.sub_event_type ? ': ' + e.sub_event_type : ''} — ${e.country}`,
    description: e.notes ?? '',
    actors: [e.actor1, e.actor2].filter(Boolean),
    fatalities: e.fatalities ?? 0,
    lat: e.latitude,
    lon: e.longitude,
    source: 'acled' as const,
    time: new Date(e.event_date).getTime(),
    lastUpdate: Date.now(),
  }))
}

interface UCDPEvent {
  id: number
  date_start: string
  type_of_violence: number
  where_description: string
  best: number
  latitude: number
  longitude: number
  side_a: string
  side_b: string
  source_article: string
  dyad_name: string
  country: string
}

function mapUCDPType(typeOfViolence: number): ConflictEventType {
  switch (typeOfViolence) {
    case 1: return 'battle'      // state-based
    case 2: return 'violence'    // non-state
    case 3: return 'violence'    // one-sided
    default: return 'violence'
  }
}

export function parseUCDPEvents(data: { Result?: UCDPEvent[] }): ConflictEvent[] {
  if (!data.Result) return []
  return data.Result.map(e => ({
    id: `ucdp-${e.id}`,
    type: mapUCDPType(e.type_of_violence),
    title: `${e.dyad_name || e.where_description} — ${e.country}`,
    description: e.source_article ?? '',
    actors: [e.side_a, e.side_b].filter(Boolean),
    fatalities: e.best ?? 0,
    lat: e.latitude,
    lon: e.longitude,
    source: 'ucdp' as const,
    time: new Date(e.date_start).getTime(),
    lastUpdate: Date.now(),
  }))
}
