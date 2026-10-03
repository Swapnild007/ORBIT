const FLIGHT_SOURCE = process.env.FLIGHT_SOURCE ?? 'opensky'
const BASE_POLL_INTERVAL = 30_000 // 30s — 2,880 req/day, well within 4,000 credit budget
const MAX_POLL_INTERVAL = 300_000 // 5 min max backoff

const OPENSKY_TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'
const OPENSKY_CLIENT_ID = process.env.OPENSKY_CLIENT_ID ?? ''
const OPENSKY_CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET ?? ''

const clients = new Set<import('bun').ServerWebSocket<unknown>>()

// OAuth2 token cache
let accessToken: string | null = null
let tokenExpiresAt = 0

async function getOpenSkyToken(): Promise<string | null> {
  if (!OPENSKY_CLIENT_ID || !OPENSKY_CLIENT_SECRET) return null

  // Return cached token if still valid (refresh 60s before expiry)
  if (accessToken && Date.now() < tokenExpiresAt - 60_000) {
    return accessToken
  }

  const res = await fetch(OPENSKY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: OPENSKY_CLIENT_ID,
      client_secret: OPENSKY_CLIENT_SECRET,
    }),
  })

  if (!res.ok) {
    console.error(`[Flight] OAuth2 token request failed: ${res.status}`)
    accessToken = null
    return null
  }

  const json = await res.json()
  accessToken = json.access_token
  // Tokens expire in 30 min per docs; use reported expires_in if available
  tokenExpiresAt = Date.now() + (json.expires_in ?? 1800) * 1000
  console.log(`[Flight] OAuth2 token acquired, expires in ${json.expires_in ?? 1800}s`)
  return accessToken
}

interface FlightData {
  icao24: string
  callsign: string
  type: string
  originCountry: string
  lat: number
  lon: number
  altitude: number
  speed: number
  heading: number
  verticalRate: number
  onGround: boolean
  lastUpdate: number
}

// Military callsign prefixes
const MILITARY_PREFIXES = [
  'RCH', 'EVAC', 'DUKE', 'KING', 'JAKE', 'TOPCAT', 'NAVY', 'ARMY',
  'REACH', 'VALOR', 'HAWK', 'VIPER', 'BOLT', 'ROCK', 'FORCE',
]
const CARGO_AIRLINES = ['FDX', 'UPS', 'GTI', 'CLX', 'ABW', 'CKS', 'MPH', 'BOX', 'SQC']
const HELI_PREFIXES = ['LIFE', 'MEDEVAC', 'HELI', 'AIR1', 'MED']

function classifyFlight(callsign: string): string {
  const cs = callsign.toUpperCase().trim()
  if (!cs) return 'other'
  if (MILITARY_PREFIXES.some(p => cs.startsWith(p))) return 'military'
  if (CARGO_AIRLINES.some(a => cs.startsWith(a))) return 'cargo'
  if (HELI_PREFIXES.some(p => cs.startsWith(p))) return 'helicopter'
  // N-numbers are private aircraft (US registration)
  if (/^N\d/.test(cs)) return 'private'
  // Most 3-letter prefix + digits = commercial airline
  if (/^[A-Z]{3}\d/.test(cs)) return 'commercial'
  return 'other'
}

async function fetchOpenSky(): Promise<FlightData[] | null> {
  const token = await getOpenSkyToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const url = 'https://opensky-network.org/api/states/all'
  const res = await fetch(url, { headers })

  if (res.status === 401 && token) {
    // Token expired — clear and retry once
    console.warn('[Flight] OpenSky 401 — refreshing token')
    accessToken = null
    tokenExpiresAt = 0
    return fetchOpenSky()
  }
  if (res.status === 429) {
    console.warn(`[Flight] OpenSky 429 — backing off`)
    return null // signal rate-limited
  }
  if (!res.ok) {
    console.error(`[Flight] OpenSky HTTP ${res.status}`)
    return null
  }
  const json = await res.json() as { time: number; states: unknown[][] | null }
  if (!json.states) return []

  const flights: FlightData[] = []
  for (const s of json.states) {
    const icao24 = s[0] as string
    const callsign = ((s[1] as string) ?? '').trim()
    const originCountry = (s[2] as string) ?? ''
    const lon = s[5] as number | null
    const lat = s[6] as number | null
    const altitude = s[7] as number | null  // baro_alt in meters
    const onGround = s[8] as boolean
    const speed = s[9] as number | null      // m/s
    const heading = s[10] as number | null   // degrees
    const verticalRate = s[11] as number | null

    if (lat == null || lon == null) continue

    flights.push({
      icao24,
      callsign: callsign || icao24.toUpperCase(),
      type: classifyFlight(callsign),
      originCountry,
      lat,
      lon,
      altitude: altitude ?? 0,
      speed: speed ?? 0,
      heading: heading ?? 0,
      verticalRate: verticalRate ?? 0,
      onGround,
      lastUpdate: Date.now(),
    })
  }
  return flights
}

async function fetchAdsbExchange(): Promise<FlightData[] | null> {
  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) {
    console.error('[Flight] Missing RAPIDAPI_KEY for ADS-B Exchange')
    return []
  }

  const lat = 40.0
  const lon = -74.0
  const dist = 250

  const res = await fetch(
    `https://adsbexchange-com1.p.rapidapi.com/v2/lat/${lat}/lon/${lon}/dist/${dist}/`,
    { headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': 'adsbexchange-com1.p.rapidapi.com' } },
  )
  if (res.status === 429) {
    console.warn(`[Flight] ADS-B Exchange 429 — backing off`)
    return null
  }
  if (!res.ok) {
    console.error(`[Flight] ADS-B Exchange HTTP ${res.status}`)
    return null
  }
  const json = await res.json() as { ac?: Array<Record<string, unknown>> }
  if (!json.ac) return []

  const flights: FlightData[] = []
  for (const ac of json.ac) {
    const icao24 = (ac.hex as string ?? '').toLowerCase()
    const callsign = ((ac.flight as string) ?? '').trim()
    const lat = ac.lat as number | null
    const lon = ac.lon as number | null
    if (lat == null || lon == null) continue

    // Convert: altitude ft→m, speed knots→m/s, vert rate fpm→m/s
    const altFt = (ac.alt_baro as number) ?? 0
    const spdKn = (ac.gs as number) ?? 0
    const vertFpm = (ac.baro_rate as number) ?? 0

    flights.push({
      icao24,
      callsign: callsign || icao24.toUpperCase(),
      type: classifyFlight(callsign),
      originCountry: '',
      lat,
      lon,
      altitude: altFt * 0.3048,
      speed: spdKn * 0.514444,
      heading: (ac.track as number) ?? 0,
      verticalRate: vertFpm * 0.00508,
      onGround: (ac.alt_baro as string) === 'ground',
      lastUpdate: Date.now(),
    })
  }
  return flights
}

let pollCount = 0
let currentInterval = BASE_POLL_INTERVAL
let consecutiveFailures = 0
let lastGoodPayload: string | null = null
let pollTimer: ReturnType<typeof setTimeout> | null = null

async function poll() {
  if (clients.size === 0) {
    pollTimer = setTimeout(poll, currentInterval)
    return
  }

  try {
    const flights = FLIGHT_SOURCE === 'adsb'
      ? await fetchAdsbExchange()
      : await fetchOpenSky()

    if (flights === null) {
      // Rate-limited or error — exponential backoff
      consecutiveFailures++
      currentInterval = Math.min(
        MAX_POLL_INTERVAL,
        BASE_POLL_INTERVAL * Math.pow(2, consecutiveFailures),
      )
      console.warn(`[Flight] Backoff: next poll in ${(currentInterval / 1000).toFixed(0)}s (failure #${consecutiveFailures})`)

      // Send last good data to any new clients so they aren't empty
      if (lastGoodPayload && clients.size > 0) {
        for (const client of clients) {
          try { client.send(lastGoodPayload) } catch { /* skip */ }
        }
      }
    } else {
      // Success — reset backoff
      consecutiveFailures = 0
      currentInterval = BASE_POLL_INTERVAL

      const payload = JSON.stringify({
        type: 'flights',
        flights,
        timestamp: Date.now(),
      })
      lastGoodPayload = payload

      for (const client of clients) {
        try { client.send(payload) } catch { /* skip */ }
      }

      pollCount++
      if (pollCount % 6 === 0) {
        console.log(`[Flight] Poll #${pollCount}: ${flights.length} aircraft, ${clients.size} clients`)
      }
    }
  } catch (err) {
    console.error('[Flight] Poll error:', err)
    consecutiveFailures++
    currentInterval = Math.min(
      MAX_POLL_INTERVAL,
      BASE_POLL_INTERVAL * Math.pow(2, consecutiveFailures),
    )
  }

  // Schedule next poll with current (possibly backed-off) interval
  pollTimer = setTimeout(poll, currentInterval)
}

// Start polling
poll()

Bun.serve({
  port: 4002,
  fetch(req, server) {
    if (server.upgrade(req)) return
    return new Response('Flight Proxy WebSocket server', { status: 200 })
  },
  websocket: {
    open(ws) {
      clients.add(ws)
      console.log(`[Flight] Client connected (${clients.size} total)`)
    },
    close(ws) {
      clients.delete(ws)
      console.log(`[Flight] Client disconnected (${clients.size} total)`)
    },
    message() {
      // Browser clients don't send messages
    },
  },
})

console.log(`[Flight] Proxy listening on ws://localhost:4002 (source: ${FLIGHT_SOURCE})`)

if (OPENSKY_CLIENT_ID && OPENSKY_CLIENT_SECRET) {
  console.log('[Flight] OpenSky OAuth2 credentials configured')
} else {
  console.warn('[Flight] OpenSky OAuth2 credentials missing — using anonymous access')
}
