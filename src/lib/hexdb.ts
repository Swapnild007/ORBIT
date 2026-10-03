const PROXY = 'http://localhost:4000/api/hexdb'

export interface HexdbAircraft {
  ModeS: string
  Registration: string
  Manufacturer: string
  ICAOTypeCode: string
  Type: string
  RegisteredOwners: string
  OperatorFlagCode: string
}

export interface HexdbRoute {
  flight: string
  route: string        // e.g. "EGLL-KIAD"
  updatetime: number
}

export interface HexdbAirport {
  country_code: string
  region_name: string
  iata: string
  icao: string
  airport: string
  latitude: number
  longitude: number
}

export interface HexdbFlightInfo {
  aircraft: HexdbAircraft | null
  route: HexdbRoute | null
  origin: HexdbAirport | null
  destination: HexdbAirport | null
  imageUrl: string | null
}

export async function fetchFlightInfo(icao24: string, callsign: string): Promise<HexdbFlightInfo> {
  const hex = icao24.toUpperCase()
  const params = new URLSearchParams({ hex })
  if (callsign.trim()) params.set('callsign', callsign.trim())

  try {
    const res = await fetch(`${PROXY}/lookup?${params}`)
    if (!res.ok) return { aircraft: null, route: null, origin: null, destination: null, imageUrl: null }

    const data = await res.json()
    return {
      aircraft: data.aircraft ?? null,
      route: data.route ?? null,
      origin: data.origin ?? null,
      destination: data.destination ?? null,
      imageUrl: data.hasImage ? `${PROXY}/image?hex=${hex}` : null,
    }
  } catch {
    return { aircraft: null, route: null, origin: null, destination: null, imageUrl: null }
  }
}
