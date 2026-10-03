/**
 * Live camera feed parsers for Windy webcams.
 */

export interface Camera {
  id: string
  title: string
  lat: number
  lon: number
  thumbnail: string
  playerUrl: string | null
  city: string
  country: string
  lastUpdate: number
}

/**
 * Parse Windy webcams API v3 response.
 */
export function parseWindyCameras(json: unknown): Camera[] {
  const data = json as {
    webcams?: Array<{
      id?: string; webcamId?: number | string; title?: string
      location?: { latitude?: number; longitude?: number; city?: string; country?: string }
      image?: { current?: { preview?: string } }
      images?: { current?: { preview?: string } }
      player?: { day?: { embed?: string } }
      lastUpdatedOn?: string
    }>
  }

  if (!Array.isArray(data?.webcams)) return []

  return data.webcams
    .filter(c => c.location?.latitude != null && c.location?.longitude != null)
    .map(c => ({
      id: `cam-${c.webcamId ?? c.id}`,
      title: c.title ?? 'Unknown Camera',
      lat: c.location!.latitude!,
      lon: c.location!.longitude!,
      thumbnail: c.images?.current?.preview ?? c.image?.current?.preview ?? '',
      playerUrl: c.player?.day?.embed ?? null,
      city: c.location!.city ?? '',
      country: c.location!.country ?? '',
      lastUpdate: c.lastUpdatedOn ? new Date(c.lastUpdatedOn).getTime() : Date.now(),
    }))
}

/**
 * Parse a generic camera list (fallback format).
 */
export function parseCameraList(json: unknown): Camera[] {
  const data = json as Array<{
    id?: string; name?: string; title?: string
    lat?: number; lon?: number; latitude?: number; longitude?: number
    url?: string; thumbnail?: string; image?: string
    city?: string; country?: string
  }>

  if (!Array.isArray(data)) return []

  return data
    .filter(c => (c.lat ?? c.latitude) != null && (c.lon ?? c.longitude) != null)
    .map((c, i) => ({
      id: `cam-${c.id ?? i}`,
      title: c.name ?? c.title ?? 'Camera',
      lat: c.lat ?? c.latitude ?? 0,
      lon: c.lon ?? c.longitude ?? 0,
      thumbnail: c.thumbnail ?? c.image ?? '',
      playerUrl: c.url ?? null,
      city: c.city ?? '',
      country: c.country ?? '',
      lastUpdate: Date.now(),
    }))
}
