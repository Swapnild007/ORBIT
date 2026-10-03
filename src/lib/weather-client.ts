import type { WeatherEvent, WeatherEventType } from '@/types'

/** Parse USGS GeoJSON earthquake feed into WeatherEvent[] */
export function parseUSGSEarthquakes(geojson: unknown): WeatherEvent[] {
  const data = geojson as { features?: unknown[] }
  if (!data?.features || !Array.isArray(data.features)) return []

  const events: WeatherEvent[] = []
  for (const f of data.features) {
    const feature = f as {
      id?: string
      properties?: {
        title?: string
        mag?: number | null
        place?: string
        time?: number
        updated?: number
        alert?: string
      }
      geometry?: { type: string; coordinates?: number[] }
    }

    const props = feature.properties
    if (!props) continue

    const coords = feature.geometry?.coordinates
    if (!coords || coords.length < 2) continue

    const lon = coords[0]
    const lat = coords[1]
    if (typeof lat !== 'number' || typeof lon !== 'number') continue
    if (isNaN(lat) || isNaN(lon)) continue

    events.push({
      id: `usgs-${feature.id ?? `${lat}-${lon}-${props.time ?? 0}`}`,
      type: 'earthquake',
      title: props.title ?? `M${props.mag ?? '?'} Earthquake`,
      description: props.place ?? '',
      lat,
      lon,
      magnitude: typeof props.mag === 'number' ? props.mag : null,
      geometry: null,
      source: 'usgs',
      time: props.time ?? Date.now(),
      expires: null,
      lastUpdate: props.updated ?? Date.now(),
    })
  }
  return events
}

const EONET_CATEGORY_MAP: Record<string, WeatherEventType> = {
  wildfires: 'wildfire',
  volcanoes: 'volcano',
  severeStorms: 'storm',
  floods: 'flood',
  seaLakeIce: 'iceberg',
  drought: 'drought',
  earthquakes: 'earthquake',
}

/** Parse NASA EONET v3 response into WeatherEvent[] */
export function parseEONETEvents(json: unknown): WeatherEvent[] {
  const data = json as { events?: unknown[] }
  if (!data?.events || !Array.isArray(data.events)) return []

  const events: WeatherEvent[] = []
  for (const e of data.events) {
    const event = e as {
      id?: string
      title?: string
      description?: string | null
      categories?: Array<{ id?: string; title?: string }>
      geometry?: Array<{ date?: string; type?: string; coordinates?: number[] | number[][] }>
    }

    if (!event.id || !event.title) continue

    const categoryId = event.categories?.[0]?.id ?? ''
    const type: WeatherEventType = EONET_CATEGORY_MAP[categoryId] ?? 'storm'

    // Use the most recent geometry entry
    const geo = event.geometry?.[event.geometry.length - 1]
    if (!geo?.coordinates) continue

    let lat: number
    let lon: number
    if (geo.type === 'Point' && Array.isArray(geo.coordinates) && typeof geo.coordinates[0] === 'number') {
      lon = geo.coordinates[0] as number
      lat = geo.coordinates[1] as number
    } else {
      continue
    }

    if (isNaN(lat) || isNaN(lon)) continue

    const time = geo.date ? new Date(geo.date).getTime() : Date.now()

    events.push({
      id: `eonet-${event.id}`,
      type,
      title: event.title,
      description: event.description ?? '',
      lat,
      lon,
      magnitude: null,
      geometry: null,
      source: 'eonet',
      time,
      expires: null,
      lastUpdate: time,
    })
  }
  return events
}

function classifyNWSEvent(event: string | undefined): WeatherEventType {
  if (!event) return 'alert'
  const e = event.toLowerCase()
  if (e.includes('flood')) return 'flood'
  if (e.includes('fire') || e.includes('red flag')) return 'wildfire'
  if (e.includes('volcano') || e.includes('ash')) return 'volcano'
  if (e.includes('ice') || e.includes('blizzard') || e.includes('winter') || e.includes('freeze') || e.includes('frost') || e.includes('cold') || e.includes('snow') || e.includes('sleet')) return 'iceberg'
  if (e.includes('drought') || e.includes('heat') || e.includes('excessive')) return 'drought'
  if (e.includes('earthquake') || e.includes('tsunami')) return 'earthquake'
  if (e.includes('tornado') || e.includes('thunderstorm') || e.includes('hurricane') || e.includes('tropical') || e.includes('wind') || e.includes('storm')) return 'storm'
  return 'alert'
}

/** Parse NWS alerts response into WeatherEvent[] */
export function parseNWSAlerts(json: unknown): WeatherEvent[] {
  const data = json as { features?: unknown[] }
  if (!data?.features || !Array.isArray(data.features)) return []

  const events: WeatherEvent[] = []
  for (const f of data.features) {
    const feature = f as {
      id?: string
      properties?: {
        id?: string
        headline?: string
        description?: string
        instruction?: string
        severity?: string
        event?: string
        onset?: string
        expires?: string
        sent?: string
      }
      geometry?: GeoJSON.Geometry | null
    }

    const props = feature.properties
    if (!props) continue

    // Skip expired alerts
    if (props.expires) {
      const expiresAt = new Date(props.expires).getTime()
      if (!isNaN(expiresAt) && expiresAt < Date.now()) continue
    }

    // Derive centroid from geometry if polygon, otherwise skip
    let lat = 0
    let lon = 0
    let geometry: GeoJSON.Geometry | null = null

    if (feature.geometry && feature.geometry.type === 'Polygon') {
      geometry = feature.geometry
      const coords = (feature.geometry as GeoJSON.Polygon).coordinates[0]
      if (coords && coords.length > 0) {
        let sumLat = 0, sumLon = 0
        for (const c of coords) {
          sumLon += c[0]
          sumLat += c[1]
        }
        lon = sumLon / coords.length
        lat = sumLat / coords.length
      }
    } else if (feature.geometry && feature.geometry.type === 'MultiPolygon') {
      geometry = feature.geometry
      const allCoords = (feature.geometry as GeoJSON.MultiPolygon).coordinates
      let sumLat = 0, sumLon = 0, count = 0
      for (const poly of allCoords) {
        for (const c of poly[0]) {
          sumLon += c[0]
          sumLat += c[1]
          count++
        }
      }
      if (count > 0) {
        lon = sumLon / count
        lat = sumLat / count
      }
    } else {
      continue
    }

    if (lat === 0 && lon === 0) continue

    const time = props.onset ? new Date(props.onset).getTime()
      : props.sent ? new Date(props.sent).getTime()
      : Date.now()

    events.push({
      id: `nws-${props.id ?? feature.id ?? `${lat}-${lon}`}`,
      type: classifyNWSEvent(props.event),
      title: props.headline ?? props.event ?? 'Weather Alert',
      description: props.description ?? '',
      lat,
      lon,
      magnitude: null,
      geometry,
      source: 'nws',
      time,
      expires: props.expires ? new Date(props.expires).getTime() : null,
      lastUpdate: Date.now(),
    })
  }
  return events
}
