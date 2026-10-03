/**
 * World Port Index parser.
 * Parses port data from NGA World Port Index or similar GeoJSON sources.
 */

export interface Port {
  id: string
  name: string
  country: string
  lat: number
  lon: number
  size: 'large' | 'medium' | 'small'
  harborType: string
  lastUpdate: number
}

export function parsePortsGeoJSON(json: unknown): Port[] {
  const data = json as { features?: Array<{
    properties?: {
      portName?: string; PORT_NAME?: string
      countryCode?: string; COUNTRY_CODE?: string
      latitude?: number; LATITUDE?: number
      longitude?: number; LONGITUDE?: number
      harborSize?: string; HARBOR_SIZE?: string; HARBOR_SZ?: string
      harborType?: string; HARBOR_TYPE?: string
    }
    geometry?: { type: string; coordinates: number[] }
  }> }

  if (!Array.isArray(data?.features)) return []

  const ports: Port[] = []
  for (const f of data.features!) {
    const p = f.properties
    if (!p) continue

    const name = p.portName ?? p.PORT_NAME ?? ''
    const country = p.countryCode ?? p.COUNTRY_CODE ?? ''
    const lat = p.latitude ?? p.LATITUDE ?? (f.geometry?.type === 'Point' ? f.geometry.coordinates[1] : null)
    const lon = p.longitude ?? p.LONGITUDE ?? (f.geometry?.type === 'Point' ? f.geometry.coordinates[0] : null)

    if (!name || lat == null || lon == null) continue

    const sizeRaw = (p.harborSize ?? p.HARBOR_SIZE ?? p.HARBOR_SZ ?? '').toLowerCase()
    const size: Port['size'] = sizeRaw.includes('l') ? 'large' : sizeRaw.includes('m') ? 'medium' : 'small'

    ports.push({
      id: `port-${name.replace(/\s+/g, '-').toLowerCase()}-${country}`,
      name,
      country,
      lat,
      lon,
      size,
      harborType: p.harborType ?? p.HARBOR_TYPE ?? 'unknown',
      lastUpdate: Date.now(),
    })
  }

  return ports
}

/**
 * Parse a simplified port list (JSON array format).
 */
export function parsePortsList(json: unknown): Port[] {
  const data = json as Array<{
    name?: string; country?: string
    lat?: number; lon?: number; latitude?: number; longitude?: number
    size?: string; type?: string
  }>

  if (!Array.isArray(data)) return []

  return data
    .filter(p => p.name && (p.lat ?? p.latitude) != null && (p.lon ?? p.longitude) != null)
    .map(p => ({
      id: `port-${(p.name ?? '').replace(/\s+/g, '-').toLowerCase()}-${p.country ?? ''}`,
      name: p.name ?? '',
      country: p.country ?? '',
      lat: p.lat ?? p.latitude ?? 0,
      lon: p.lon ?? p.longitude ?? 0,
      size: (p.size?.toLowerCase().includes('l') ? 'large' : p.size?.toLowerCase().includes('m') ? 'medium' : 'small') as Port['size'],
      harborType: p.type ?? 'unknown',
      lastUpdate: Date.now(),
    }))
}
