/**
 * Unified Eagle Eye backend server.
 * Consolidates AIS proxy, flight proxy, and HexDB proxy into a single service.
 *
 * WebSocket endpoints:
 *   /ws/ais     — AIS position reports from AISStream.io
 *   /ws/flights — Aircraft positions from OpenSky / ADS-B Exchange
 *
 * HTTP endpoints:
 *   /api/hexdb/lookup?hex=ICAO24&callsign=CALLSIGN — Aircraft metadata
 *   /api/hexdb/image?hex=ICAO24                     — Aircraft photo proxy
 */

const PORT = Number(process.env.EAGLE_EYE_PORT ?? 4000)

// ─── AIS PROXY ──────────────────────────────────────────────────────────────

const AIS_API_KEY = process.env.AIS_API_KEY ?? ''
const aisClients = new Set<import('bun').ServerWebSocket<{ path: string }>>()
let aisUpstream: WebSocket | null = null

function connectAisUpstream() {
  if (!AIS_API_KEY) {
    console.warn('[AIS] Missing AIS_API_KEY — AIS proxy disabled')
    return
  }

  aisUpstream = new WebSocket('wss://stream.aisstream.io/v0/stream')

  aisUpstream.onopen = () => {
    console.log('[AIS] Connected to AISStream.io')
    aisUpstream!.send(JSON.stringify({
      APIKey: AIS_API_KEY,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FilterMessageTypes: ['PositionReport'],
    }))
  }

  let relayCount = 0
  aisUpstream.onmessage = (event) => {
    const data = typeof event.data === 'string'
      ? event.data
      : Buffer.isBuffer(event.data)
        ? event.data.toString()
        : String(event.data)

    for (const client of aisClients) {
      try { client.send(data) } catch { /* skip */ }
    }

    relayCount++
    if (relayCount % 100 === 0) {
      console.log(`[AIS] Relayed ${relayCount} messages`)
    }
  }

  aisUpstream.onclose = () => {
    console.log('[AIS] Upstream closed, reconnecting in 5s...')
    setTimeout(connectAisUpstream, 5000)
  }

  aisUpstream.onerror = (err) => {
    console.error('[AIS] Upstream error:', err)
  }
}

connectAisUpstream()

// ─── FLIGHT PROXY ───────────────────────────────────────────────────────────

const FLIGHT_SOURCE = process.env.FLIGHT_SOURCE ?? 'opensky'
const BASE_POLL_INTERVAL = 30_000
const MAX_POLL_INTERVAL = 300_000

const OPENSKY_TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'
const OPENSKY_CLIENT_ID = process.env.OPENSKY_CLIENT_ID ?? ''
const OPENSKY_CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET ?? ''

const flightClients = new Set<import('bun').ServerWebSocket<{ path: string }>>()

let accessToken: string | null = null
let tokenExpiresAt = 0

async function getOpenSkyToken(): Promise<string | null> {
  if (!OPENSKY_CLIENT_ID || !OPENSKY_CLIENT_SECRET) return null
  if (accessToken && Date.now() < tokenExpiresAt - 60_000) return accessToken

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
  tokenExpiresAt = Date.now() + (json.expires_in ?? 1800) * 1000
  console.log(`[Flight] OAuth2 token acquired, expires in ${json.expires_in ?? 1800}s`)
  return accessToken
}

// ─── ACLED OAuth Token Management ────────────────────────────────────────
const ACLED_TOKEN_URL = 'https://acleddata.com/oauth/token'
const ACLED_AUTH_EMAIL = process.env.ACLED_EMAIL ?? ''
const ACLED_AUTH_PASSWORD = process.env.ACLED_PASSWORD ?? ''
let acledAccessToken: string | null = null
let acledTokenExpiresAt = 0
let acledRefreshToken = process.env.ACLED_REFRESH_TOKEN ?? ''

async function getACLEDToken(): Promise<string | null> {
  if (!ACLED_AUTH_EMAIL || !ACLED_AUTH_PASSWORD) return null
  if (acledAccessToken && Date.now() < acledTokenExpiresAt - 5 * 60_000) return acledAccessToken

  // Try refresh token first
  if (acledRefreshToken) {
    try {
      const res = await fetch(ACLED_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: acledRefreshToken,
          client_id: 'acled',
        }),
      })
      if (res.ok) {
        const json = await res.json()
        acledAccessToken = json.access_token
        acledTokenExpiresAt = Date.now() + (json.expires_in ?? 86400) * 1000
        acledRefreshToken = json.refresh_token ?? acledRefreshToken
        console.log(`[ACLED] Token acquired via refresh_token, expires in ${json.expires_in ?? 86400}s`)
        return acledAccessToken
      }
      console.warn(`[ACLED] Refresh token failed (${res.status}), falling back to password grant`)
    } catch (err) {
      console.warn(`[ACLED] Refresh token error: ${(err as Error).message}`)
    }
  }

  // Fallback: password grant
  try {
    const res = await fetch(ACLED_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        username: ACLED_AUTH_EMAIL,
        password: ACLED_AUTH_PASSWORD,
        client_id: 'acled',
      }),
    })
    if (!res.ok) {
      console.error(`[ACLED] Password grant failed: ${res.status}`)
      acledAccessToken = null
      return null
    }
    const json = await res.json()
    acledAccessToken = json.access_token
    acledTokenExpiresAt = Date.now() + (json.expires_in ?? 86400) * 1000
    acledRefreshToken = json.refresh_token ?? ''
    console.log(`[ACLED] Token acquired via password grant, expires in ${json.expires_in ?? 86400}s`)
    return acledAccessToken
  } catch (err) {
    console.error(`[ACLED] Password grant error: ${(err as Error).message}`)
    acledAccessToken = null
    return null
  }
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

import { classifyFlight } from '../src/lib/classify-flight'

async function fetchOpenSky(): Promise<FlightData[] | null> {
  const token = await getOpenSkyToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch('https://opensky-network.org/api/states/all', { headers })

  if (res.status === 401 && token) {
    console.warn('[Flight] OpenSky 401 — refreshing token')
    accessToken = null
    tokenExpiresAt = 0
    return fetchOpenSky()
  }
  if (res.status === 429) {
    console.warn('[Flight] OpenSky 429 — backing off')
    return null
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
    const altitude = s[7] as number | null
    const onGround = s[8] as boolean
    const speed = s[9] as number | null
    const heading = s[10] as number | null
    const verticalRate = s[11] as number | null

    if (lat == null || lon == null) continue

    flights.push({
      icao24,
      callsign: callsign || icao24.toUpperCase(),
      type: classifyFlight(callsign),
      originCountry,
      lat, lon,
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

  const res = await fetch(
    'https://adsbexchange-com1.p.rapidapi.com/v2/lat/40.0/lon/-74.0/dist/250/',
    { headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': 'adsbexchange-com1.p.rapidapi.com' } },
  )
  if (res.status === 429) {
    console.warn('[Flight] ADS-B Exchange 429 — backing off')
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

    flights.push({
      icao24,
      callsign: callsign || icao24.toUpperCase(),
      type: classifyFlight(callsign),
      originCountry: '',
      lat, lon,
      altitude: ((ac.alt_baro as number) ?? 0) * 0.3048,
      speed: ((ac.gs as number) ?? 0) * 0.514444,
      heading: (ac.track as number) ?? 0,
      verticalRate: ((ac.baro_rate as number) ?? 0) * 0.00508,
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

async function poll() {
  if (flightClients.size === 0) {
    setTimeout(poll, currentInterval)
    return
  }

  try {
    const flights = FLIGHT_SOURCE === 'adsb'
      ? await fetchAdsbExchange()
      : await fetchOpenSky()

    if (flights === null) {
      consecutiveFailures++
      currentInterval = Math.min(MAX_POLL_INTERVAL, BASE_POLL_INTERVAL * Math.pow(2, consecutiveFailures))
      console.warn(`[Flight] Backoff: next poll in ${(currentInterval / 1000).toFixed(0)}s (failure #${consecutiveFailures})`)
      if (lastGoodPayload && flightClients.size > 0) {
        for (const client of flightClients) {
          try { client.send(lastGoodPayload) } catch { /* skip */ }
        }
      }
    } else {
      consecutiveFailures = 0
      currentInterval = BASE_POLL_INTERVAL
      const payload = JSON.stringify({ type: 'flights', flights, timestamp: Date.now() })
      lastGoodPayload = payload
      for (const client of flightClients) {
        try { client.send(payload) } catch { /* skip */ }
      }
      pollCount++
      if (pollCount % 6 === 0) {
        console.log(`[Flight] Poll #${pollCount}: ${flights.length} aircraft, ${flightClients.size} clients`)
      }
    }
  } catch (err) {
    console.error('[Flight] Poll error:', err)
    consecutiveFailures++
    currentInterval = Math.min(MAX_POLL_INTERVAL, BASE_POLL_INTERVAL * Math.pow(2, consecutiveFailures))
  }

  setTimeout(poll, currentInterval)
}

poll()

// ─── WEATHER PROXY ──────────────────────────────────────────────────────────

import { parseUSGSEarthquakes, parseEONETEvents, parseNWSAlerts } from '../src/lib/weather-client'

interface WeatherCacheEntry {
  events: unknown[]
  errors: string[]
  fetchedAt: number
}

let weatherCache: WeatherCacheEntry | null = null
const WEATHER_CACHE_TTL = 300_000 // 5 min

const EONET_ENDPOINTS = [
  'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100',
  'https://eonet.sci.gsfc.nasa.gov/api/v3/events?status=open&limit=100',
  'https://api.nasa.gov/EONET/events?status=open&limit=100&api_key=DEMO_KEY',
]

async function fetchEONETWithFallback(
  withTimeout: (url: string, opts?: RequestInit) => Promise<Response>,
): Promise<ReturnType<typeof parseEONETEvents>> {
  const attemptErrors: string[] = []

  for (let i = 0; i < EONET_ENDPOINTS.length; i++) {
    const url = EONET_ENDPOINTS[i]
    const label = i === 0 ? 'primary' : `fallback ${i}`
    try {
      const r = await withTimeout(url)
      if (r.ok) {
        const json = await r.json()
        const events = parseEONETEvents(json)
        if (i > 0) console.log(`[Weather] EONET ${label} succeeded with ${events.length} events`)
        return events
      }
      attemptErrors.push(`${label}: HTTP ${r.status}`)
      console.warn(`[Weather] EONET ${label} returned HTTP ${r.status}`)
    } catch (err) {
      attemptErrors.push(`${label}: ${(err as Error).message}`)
      console.warn(`[Weather] EONET ${label} failed: ${(err as Error).message}`)
    }
  }

  throw new Error(`All endpoints failed (${attemptErrors.join('; ')})`)
}

const SOURCE_NAMES = ['USGS Earthquakes', 'NASA EONET', 'NWS Alerts'] as const

async function fetchWeatherEvents(): Promise<{ events: unknown[]; errors: string[] }> {
  if (weatherCache && Date.now() - weatherCache.fetchedAt < WEATHER_CACHE_TTL) {
    return { events: weatherCache.events, errors: weatherCache.errors }
  }

  const FETCH_TIMEOUT = 15_000 // 15s per upstream API
  const withTimeout = (url: string, opts?: RequestInit) =>
    fetch(url, { ...opts, signal: AbortSignal.timeout(FETCH_TIMEOUT) })

  const results = await Promise.allSettled([
    withTimeout('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(json => parseUSGSEarthquakes(json)),
    fetchEONETWithFallback(withTimeout),
    withTimeout('https://api.weather.gov/alerts/active', {
      headers: { 'User-Agent': 'EagleEye/1.0 (weather-dashboard)' },
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(json => parseNWSAlerts(json)),
  ])

  const events: unknown[] = []
  const errors: string[] = []
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      events.push(...result.value)
    } else if (result.status === 'rejected') {
      const msg = `${SOURCE_NAMES[i]}: ${result.reason?.message ?? 'Unknown error'}`
      errors.push(msg)
      console.warn(`[Weather] ${msg}`)
    }
  }

  weatherCache = { events, errors, fetchedAt: Date.now() }
  console.log(`[Weather] Fetched ${events.length} events, ${errors.length} source errors`)
  return { events, errors }
}

async function handleWeatherEvents(): Promise<Response> {
  try {
    const { events, errors } = await fetchWeatherEvents()
    return Response.json({ events, errors }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('[Weather] Fetch error:', err)
    return Response.json({ events: [], errors: ['All sources failed'] }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }
}

async function handleWeatherConditions(url: URL): Promise<Response> {
  const lat = url.searchParams.get('lat')
  const lon = url.searchParams.get('lon')
  if (!lat || !lon) return Response.json({ error: 'lat and lon required' }, { status: 400 })

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,surface_pressure,weather_code`
    )
    if (!res.ok) return Response.json({ error: 'upstream error' }, { status: 502 })
    const data = await res.json()
    return Response.json(data, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch {
    return Response.json({ error: 'fetch error' }, { status: 502 })
  }
}

// ─── NEWS PROXY (GDELT + NewsData + Currents + RSS) ───────────────────────

import { parseGdeltGeo, parseNewsdataArticles, parseCurrentsArticles, parseRssItems } from '../src/lib/news-client'

interface NewsSourceCache { events: unknown[]; fetchedAt: number }
let gdeltCache: NewsSourceCache | null = null
let newsdataCache: NewsSourceCache | null = null
let currentsCache: NewsSourceCache | null = null
let rssCache: NewsSourceCache | null = null

const GDELT_TTL      = 300_000    // 5 min
const NEWSDATA_TTL   = 1_800_000  // 30 min
const CURRENTS_TTL   = 900_000    // 15 min
const RSS_TTL        = 600_000    // 10 min

const NEWSDATA_KEY = process.env.NEWSDATA_API_KEY ?? ''
const CURRENTS_KEY = process.env.CURRENTS_API_KEY ?? ''

const RSS_FEEDS: Array<{ url: string; name: string }> = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', name: 'NYT' },
]

async function fetchGdeltNews(): Promise<unknown[]> {
  if (gdeltCache && Date.now() - gdeltCache.fetchedAt < GDELT_TTL) return gdeltCache.events
  const res = await fetch(
    'https://api.gdeltproject.org/api/v2/geo/geo?query=(conflict+OR+disaster+OR+crisis+OR+military+OR+earthquake)&format=geojson&timespan=24h',
    { signal: AbortSignal.timeout(15_000) },
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const events = parseGdeltGeo(await res.json())
  console.log(`[News] GDELT: ${events.length} geo events`)
  gdeltCache = { events, fetchedAt: Date.now() }
  return events
}

async function fetchNewsdataNews(): Promise<unknown[]> {
  if (!NEWSDATA_KEY) return []
  if (newsdataCache && Date.now() - newsdataCache.fetchedAt < NEWSDATA_TTL) return newsdataCache.events
  const res = await fetch(
    `https://newsdata.io/api/1/latest?apikey=${NEWSDATA_KEY}&q=conflict+OR+disaster+OR+military+OR+crisis&language=en&size=10`,
    { signal: AbortSignal.timeout(15_000) },
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const events = parseNewsdataArticles(await res.json())
  console.log(`[News] NewsData: ${events.length} articles`)
  newsdataCache = { events, fetchedAt: Date.now() }
  return events
}

async function fetchCurrentsNews(): Promise<unknown[]> {
  if (!CURRENTS_KEY) return []
  if (currentsCache && Date.now() - currentsCache.fetchedAt < CURRENTS_TTL) return currentsCache.events
  const res = await fetch(
    `https://api.currentsapi.services/v1/latest-news?apiKey=${CURRENTS_KEY}&language=en&category=world`,
    { signal: AbortSignal.timeout(15_000) },
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const events = parseCurrentsArticles(await res.json())
  console.log(`[News] Currents: ${events.length} articles`)
  currentsCache = { events, fetchedAt: Date.now() }
  return events
}

async function fetchRssNews(): Promise<unknown[]> {
  if (rssCache && Date.now() - rssCache.fetchedAt < RSS_TTL) return rssCache.events
  const allEvents: unknown[] = []
  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed.url, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) { console.warn(`[News] RSS ${feed.name}: HTTP ${res.status}`); continue }
      const xml = await res.text()
      const events = parseRssItems(xml, feed.name)
      allEvents.push(...events)
    } catch (err) {
      console.warn(`[News] RSS ${feed.name} failed: ${(err as Error).message}`)
    }
  }
  console.log(`[News] RSS: ${allEvents.length} articles (${RSS_FEEDS.map(f => f.name).join(', ')})`)
  rssCache = { events: allEvents, fetchedAt: Date.now() }
  return allEvents
}

/** Normalize title for deduplication */
function normTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

async function fetchNewsEvents(): Promise<{ events: unknown[]; errors: string[] }> {
  const errors: string[] = []
  const results = await Promise.allSettled([
    fetchGdeltNews(),
    fetchNewsdataNews(),
    fetchCurrentsNews(),
    fetchRssNews(),
  ])
  const sourceNames = ['GDELT', 'NewsData', 'Currents', 'RSS']
  const allEvents: unknown[] = []
  const seenTitles = new Set<string>()

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled') {
      for (const ev of r.value) {
        const title = normTitle((ev as { title?: string }).title ?? '')
        if (title && seenTitles.has(title)) continue
        if (title) seenTitles.add(title)
        allEvents.push(ev)
      }
    } else {
      errors.push(`${sourceNames[i]}: ${r.reason?.message ?? 'unknown error'}`)
      console.warn(`[News] ${sourceNames[i]} failed: ${r.reason?.message}`)
    }
  }

  return { events: allEvents, errors }
}

async function handleNewsEvents(): Promise<Response> {
  try {
    const { events, errors } = await fetchNewsEvents()
    return Response.json({ events, errors }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('[News] Fetch error:', err)
    return Response.json({ events: [], errors: ['News fetch failed'] }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }
}

// ─── CONFLICT PROXY ────────────────────────────────────────────────────────

import { parseACLEDEvents, parseUCDPEvents } from '../src/lib/conflict-client'

interface ConflictCacheEntry { events: unknown[]; errors: string[]; fetchedAt: number }
let conflictCache: ConflictCacheEntry | null = null
const CONFLICT_CACHE_TTL = 1_800_000 // 30 min

async function fetchConflictEvents(): Promise<{ events: unknown[]; errors: string[] }> {
  if (conflictCache && Date.now() - conflictCache.fetchedAt < CONFLICT_CACHE_TTL) {
    return { events: conflictCache.events, errors: conflictCache.errors }
  }

  const UCDP_TOKEN = process.env.UCDP_TOKEN ?? ''

  const fetchers: Array<Promise<ReturnType<typeof parseACLEDEvents>>> = []
  const fetcherNames: string[] = []

  // ACLED — auto-refreshing OAuth token
  const acledToken = await getACLEDToken()
  if (acledToken) {
    fetchers.push(
      fetch('https://acleddata.com/api/acled/read?limit=500', {
        signal: AbortSignal.timeout(15_000),
        headers: { 'Authorization': `Bearer ${acledToken}` },
      })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then(json => parseACLEDEvents(json))
    )
    fetcherNames.push('ACLED')
  }

  const ucdpHeaders: Record<string, string> = {}
  if (UCDP_TOKEN) ucdpHeaders['x-ucdp-access-token'] = UCDP_TOKEN
  fetchers.push(
    fetch('https://ucdpapi.pcr.uu.se/api/gedevents/25.1?pagesize=100', {
      signal: AbortSignal.timeout(15_000),
      headers: ucdpHeaders,
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(json => parseUCDPEvents(json))
  )
  fetcherNames.push('UCDP')

  const results = await Promise.allSettled(fetchers)

  const events: unknown[] = []
  const errors: string[] = []
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') events.push(...result.value)
    else {
      errors.push(`${fetcherNames[i]}: ${result.reason?.message ?? 'Unknown error'}`)
      console.warn(`[Conflict] ${fetcherNames[i]} failed: ${result.reason?.message}`)
    }
  }
  if (!acledToken) errors.push('ACLED: No credentials (set ACLED_EMAIL + ACLED_PASSWORD in .env)')

  conflictCache = { events, errors, fetchedAt: Date.now() }
  console.log(`[Conflict] ${events.length} events, ${errors.length} source errors`)
  return { events, errors }
}

async function handleConflictEvents(): Promise<Response> {
  try {
    const { events, errors } = await fetchConflictEvents()
    return Response.json({ events, errors }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('[Conflict] Fetch error:', err)
    return Response.json({ events: [], errors: ['All sources failed'] }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }
}

// ─── CYBER THREAT PROXY ───────────────────────────────────────────────────

import { parseAbuseIPDB } from '../src/lib/cyber-client'

interface CyberCacheEntry { events: unknown[]; errors: string[]; fetchedAt: number }
let cyberCache: CyberCacheEntry | null = null
const CYBER_CACHE_TTL = 1_800_000 // 30 min

const ABUSEIPDB_KEY = process.env.ABUSEIPDB_KEY ?? ''

async function fetchCyberEvents(): Promise<{ events: unknown[]; errors: string[] }> {
  if (cyberCache && Date.now() - cyberCache.fetchedAt < CYBER_CACHE_TTL) {
    return { events: cyberCache.events, errors: cyberCache.errors }
  }

  const events: unknown[] = []
  const errors: string[] = []

  // AbuseIPDB — fetch blacklist then batch-geolocate each IP
  if (ABUSEIPDB_KEY) {
    try {
      const res = await fetch('https://api.abuseipdb.com/api/v2/blacklist?confidenceMinimum=90&limit=50', {
        headers: { Key: ABUSEIPDB_KEY, Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blacklist = await res.json() as { data?: Array<{ ipAddress: string; abuseConfidenceScore: number; countryCode: string; totalReports: number; lastReportedAt: string }> }

      if (blacklist.data && blacklist.data.length > 0) {
        // Batch geolocate IPs using ip-api.com (free, up to 100 per batch, 15 req/min)
        const ipBatch = blacklist.data.map(e => e.ipAddress)
        const geoRes = await fetch('http://ip-api.com/batch?fields=query,lat,lon,city,country,countryCode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ipBatch),
          signal: AbortSignal.timeout(10_000),
        })

        if (geoRes.ok) {
          const geoData = await geoRes.json() as Array<{
            query: string; lat: number; lon: number
            city: string; country: string; countryCode: string
          }>
          const geoMap = new Map(geoData.filter(g => g.lat != null).map(g => [g.query, g]))

          const enriched = blacklist.data.map(e => {
            const geo = geoMap.get(e.ipAddress)
            return {
              ...e,
              lat: geo?.lat,
              lon: geo?.lon,
              totalReports: e.totalReports ?? 0,
              city: geo?.city,
              geoCountry: geo?.country,
            }
          })
          events.push(...parseAbuseIPDB({ data: enriched }))
          console.log(`[Cyber] AbuseIPDB: ${events.length} events geolocated via ip-api.com`)
        } else {
          console.warn(`[Cyber] ip-api.com batch failed: HTTP ${geoRes.status}, skipping geo`)
        }
      }
    } catch (err) {
      errors.push(`AbuseIPDB: ${(err as Error).message}`)
    }
  } else {
    errors.push('AbuseIPDB: No API key configured')
  }

  // IODA - internet outages (API may require registration now, skip if fails)
  try {
    const res = await fetch('https://api.ioda.inetintel.cc.gatech.edu/v2/signals/raw/country?from=-1h', {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    console.log('[Cyber] IODA check completed')
  } catch (err) {
    // IODA is supplementary, don't treat as hard error
    console.warn(`[Cyber] IODA unavailable: ${(err as Error).message}`)
  }

  cyberCache = { events, errors, fetchedAt: Date.now() }
  console.log(`[Cyber] ${events.length} events, ${errors.length} source errors`)
  return { events, errors }
}

async function handleCyberEvents(): Promise<Response> {
  try {
    const { events, errors } = await fetchCyberEvents()
    return Response.json({ events, errors }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('[Cyber] Fetch error:', err)
    return Response.json({ events: [], errors: ['All sources failed'] }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }
}

// ─── OSINT PROXY ─────────────────────────────────────────────────────────────

import { parseRedditPosts, parseMastodonPosts, parseBlueskyPosts } from '../src/lib/osint-client'

interface OsintCacheEntry { posts: unknown[]; errors: string[]; fetchedAt: number }
let osintCache: OsintCacheEntry | null = null
const OSINT_CACHE_TTL = 300_000 // 5 min

async function fetchOsintPosts(): Promise<{ posts: unknown[]; errors: string[] }> {
  if (osintCache && Date.now() - osintCache.fetchedAt < OSINT_CACHE_TTL) {
    return { posts: osintCache.posts, errors: osintCache.errors }
  }

  const results = await Promise.allSettled([
    fetch('https://www.reddit.com/r/worldnews/.json?limit=50', {
      headers: { 'User-Agent': 'EagleEye/1.0' },
      signal: AbortSignal.timeout(10_000),
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(json => parseRedditPosts(json)),
    fetch('https://mastodon.social/api/v1/trends/statuses?limit=40', {
      signal: AbortSignal.timeout(10_000),
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(json => parseMastodonPosts(json)),
    // Fetch from Bluesky news + OSINT accounts and merge
    Promise.all(
      ['apnews.com', 'reuters.com', 'bbc.com', 'sentdefender.bsky.social', 'osinttechnical.bsky.social', 'intelcrab.bsky.social', 'uaweapons.bsky.social', 'geoconfirmed.org', 'liveuamap.com'].map(actor =>
        fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${actor}&limit=15`, {
          signal: AbortSignal.timeout(10_000),
        })
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
          .then(json => parseBlueskyPosts(json))
          .catch(() => [] as ReturnType<typeof parseBlueskyPosts>)
      )
    ).then(arrays => arrays.flat()),
  ])

  const posts: unknown[] = []
  const errors: string[] = []
  const sourceNames = ['Reddit', 'Mastodon', 'Bluesky']
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') posts.push(...result.value)
    else {
      errors.push(`${sourceNames[i]}: ${result.reason?.message ?? 'Unknown error'}`)
      console.warn(`[OSINT] ${sourceNames[i]} failed: ${result.reason?.message}`)
    }
  }

  osintCache = { posts, errors, fetchedAt: Date.now() }
  console.log(`[OSINT] ${posts.length} geolocated posts, ${errors.length} source errors`)
  return { posts, errors }
}

async function handleOsintPosts(): Promise<Response> {
  try {
    const { posts, errors } = await fetchOsintPosts()
    return Response.json({ posts, errors }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('[OSINT] Fetch error:', err)
    return Response.json({ posts: [], errors: ['All sources failed'] }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }
}

// ─── ARTICLE EXTRACTOR ──────────────────────────────────────────────────────

import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

const articleCache = new Map<string, { data: unknown; fetchedAt: number }>()
const ARTICLE_CACHE_TTL = 600_000 // 10 min

async function handleArticleExtract(url: URL): Promise<Response> {
  const articleUrl = url.searchParams.get('url')
  if (!articleUrl) {
    return Response.json({ error: 'Missing url parameter' }, {
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }

  // Check cache
  const cached = articleCache.get(articleUrl)
  if (cached && Date.now() - cached.fetchedAt < ARTICLE_CACHE_TTL) {
    return Response.json(cached.data, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }

  try {
    const res = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15_000),
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const html = await res.text()
    const { document } = parseHTML(html)

    const reader = new Readability(document as any)
    const article = reader.parse()

    if (!article) {
      const data = { title: null, content: null, excerpt: null, siteName: null, error: 'Could not extract article' }
      return Response.json(data, {
        headers: { 'Access-Control-Allow-Origin': '*' },
      })
    }

    // Strip <img> tags from article content — they often fail due to
    // hotlink protection/CORS and cause layout shifts when retrying
    const cleanContent = article.content
      ?.replace(/<img[^>]*>/gi, '')
      ?.replace(/<figure[^>]*>\s*<\/figure>/gi, '')
      ?? null

    const data = {
      title: article.title,
      content: cleanContent,
      excerpt: article.excerpt,
      siteName: article.siteName,
      byline: article.byline,
    }

    articleCache.set(articleUrl, { data, fetchedAt: Date.now() })
    console.log(`[Article] Extracted: ${article.title?.slice(0, 60)}`)

    return Response.json(data, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.warn(`[Article] Extract failed for ${articleUrl}: ${(err as Error).message}`)
    return Response.json({ title: null, content: null, error: (err as Error).message }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }
}

// ─── OSINT COMMENTS ─────────────────────────────────────────────────────────

interface OsintComment {
  id: string
  author: string
  text: string
  htmlContent?: string
  time: number
  score?: number
  replies?: OsintComment[]
}

function parseRedditCommentTree(children: any[], maxDepth = 3, depth = 0): OsintComment[] {
  if (depth >= maxDepth || !Array.isArray(children)) return []
  const comments: OsintComment[] = []
  for (const child of children) {
    if (child.kind !== 't1' || !child.data) continue
    const d = child.data
    if (!d.body || d.body === '[deleted]' || d.body === '[removed]') continue
    comments.push({
      id: d.id,
      author: d.author ?? '[deleted]',
      text: d.body ?? '',
      time: (d.created_utc ?? 0) * 1000,
      score: d.score,
      replies: d.replies?.data?.children
        ? parseRedditCommentTree(d.replies.data.children, maxDepth, depth + 1)
        : undefined,
    })
  }
  return comments
}

async function fetchRedditComments(postUrl: string): Promise<OsintComment[]> {
  // postUrl is like https://reddit.com/r/worldnews/comments/abc123/title/
  const jsonUrl = postUrl.endsWith('/') ? `${postUrl}.json` : `${postUrl}/.json`
  const res = await fetch(jsonUrl, {
    headers: { 'User-Agent': 'EagleEye/1.0' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json() as any[]
  if (!Array.isArray(json) || json.length < 2) return []
  const commentListing = json[1]
  return parseRedditCommentTree(commentListing?.data?.children ?? [])
}

async function fetchMastodonComments(postUrl: string, postId: string): Promise<OsintComment[]> {
  // Extract instance from URL (e.g., mastodon.social from https://mastodon.social/@user/123)
  let instance: string
  try {
    instance = new URL(postUrl).hostname
  } catch {
    instance = 'mastodon.social'
  }
  const res = await fetch(`https://${instance}/api/v1/statuses/${postId}/context`, {
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json() as { descendants?: Array<{
    id?: string; content?: string; created_at?: string
    account?: { acct?: string }; favourites_count?: number
    in_reply_to_id?: string | null
  }> }

  const descendants = json.descendants ?? []
  // Build threaded structure
  const commentMap = new Map<string, OsintComment & { parentId?: string | null }>()
  for (const d of descendants) {
    if (!d.id || !d.content) continue
    const plainText = d.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    commentMap.set(d.id, {
      id: d.id,
      author: d.account?.acct ?? 'unknown',
      text: plainText,
      htmlContent: d.content,
      time: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
      score: d.favourites_count,
      parentId: d.in_reply_to_id,
      replies: [],
    })
  }

  // Thread them
  const roots: OsintComment[] = []
  for (const comment of commentMap.values()) {
    const parentId = (comment as any).parentId
    const parent = parentId ? commentMap.get(parentId) : null
    if (parent) {
      if (!parent.replies) parent.replies = []
      parent.replies.push(comment)
    } else {
      roots.push(comment)
    }
  }
  return roots
}

async function fetchBlueskyComments(postUri: string): Promise<OsintComment[]> {
  const res = await fetch(
    `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(postUri)}&depth=3`,
    { signal: AbortSignal.timeout(10_000) },
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json() as any

  function parseThread(replies: any[], depth = 0): OsintComment[] {
    if (!Array.isArray(replies) || depth >= 3) return []
    const comments: OsintComment[] = []
    for (const reply of replies) {
      const post = reply.post
      if (!post?.record?.text) continue
      comments.push({
        id: post.cid ?? post.uri ?? '',
        author: post.author?.handle ?? 'unknown',
        text: post.record.text,
        time: post.record.createdAt ? new Date(post.record.createdAt).getTime() : Date.now(),
        score: post.likeCount,
        replies: reply.replies ? parseThread(reply.replies, depth + 1) : undefined,
      })
    }
    return comments
  }

  return parseThread(json.thread?.replies ?? [])
}

const commentsCache = new Map<string, { data: unknown; fetchedAt: number }>()
const COMMENTS_CACHE_TTL = 300_000 // 5 min

async function handleOsintComments(url: URL): Promise<Response> {
  const platform = url.searchParams.get('platform')
  const postUrl = url.searchParams.get('url') ?? ''
  const postId = url.searchParams.get('id') ?? ''

  if (!platform) {
    return Response.json({ comments: [], error: 'Missing platform' }, {
      status: 400, headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }

  const cacheKey = `${platform}:${postUrl || postId}`
  const cached = commentsCache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < COMMENTS_CACHE_TTL) {
    return Response.json(cached.data, { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    let comments: OsintComment[] = []
    if (platform === 'reddit') {
      comments = await fetchRedditComments(postUrl)
    } else if (platform === 'mastodon') {
      comments = await fetchMastodonComments(postUrl, postId)
    } else if (platform === 'bluesky') {
      comments = await fetchBlueskyComments(postUrl)
    }

    const data = { comments, error: null }
    commentsCache.set(cacheKey, { data, fetchedAt: Date.now() })
    console.log(`[Comments] ${platform}: ${comments.length} top-level comments`)
    return Response.json(data, { headers: { 'Access-Control-Allow-Origin': '*' } })
  } catch (err) {
    console.warn(`[Comments] ${platform} failed: ${(err as Error).message}`)
    return Response.json({ comments: [], error: (err as Error).message }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }
}

// ─── SANCTIONS PROXY ─────────────────────────────────────────────────────────

import { parseSanctionResults } from '../src/lib/sanctions-client'

const sanctionsCache = new Map<string, { data: unknown; fetchedAt: number }>()
const SANCTIONS_CACHE_TTL = 3_600_000 // 1 hour

async function handleSanctionsCheck(url: URL): Promise<Response> {
  const query = url.searchParams.get('q')?.trim()
  if (!query) return Response.json({ error: 'q required' }, { status: 400 })

  const cacheKey = query.toLowerCase()
  const cached = sanctionsCache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < SANCTIONS_CACHE_TTL) {
    return Response.json(cached.data, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }

  try {
    const res = await fetch(
      `https://api.opensanctions.org/search/default?q=${encodeURIComponent(query)}&limit=5`,
      { signal: AbortSignal.timeout(10_000) },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const matches = parseSanctionResults(json)
    const result = { matches, query }
    sanctionsCache.set(cacheKey, { data: result, fetchedAt: Date.now() })
    return Response.json(result, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    return Response.json({ matches: [], error: (err as Error).message }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }
}

// ─── CAMERA PROXY ───────────────────────────────────────────────────────────

import { parseWindyCameras, parseCameraList } from '../src/lib/camera-client'

const WINDY_KEY = process.env.WINDY_WEBCAMS_KEY ?? ''

interface CameraCacheEntry { cameras: unknown[]; errors: string[]; fetchedAt: number }
let cameraCache: CameraCacheEntry | null = null
const CAMERA_CACHE_TTL = 600_000 // 10 min

// Sample points around the globe for broad camera coverage
const CAMERA_REGIONS: Array<{ lat: number; lon: number; label: string }> = [
  // North America
  { lat: 40.7, lon: -74.0, label: 'New York' },
  { lat: 34.0, lon: -118.2, label: 'Los Angeles' },
  { lat: 41.9, lon: -87.6, label: 'Chicago' },
  { lat: 25.8, lon: -80.2, label: 'Miami' },
  { lat: 49.3, lon: -123.1, label: 'Vancouver' },
  // Europe
  { lat: 51.5, lon: -0.1, label: 'London' },
  { lat: 48.9, lon: 2.3, label: 'Paris' },
  { lat: 52.5, lon: 13.4, label: 'Berlin' },
  { lat: 41.9, lon: 12.5, label: 'Rome' },
  { lat: 40.4, lon: -3.7, label: 'Madrid' },
  { lat: 59.9, lon: 10.8, label: 'Oslo' },
  { lat: 55.7, lon: 37.6, label: 'Moscow' },
  // Middle East
  { lat: 25.2, lon: 55.3, label: 'Dubai' },
  { lat: 24.5, lon: 54.7, label: 'Abu Dhabi' },
  { lat: 26.6, lon: 56.3, label: 'Strait of Hormuz' },
  { lat: 30.0, lon: 32.6, label: 'Suez Canal' },
  { lat: 31.8, lon: 35.2, label: 'Jerusalem' },
  { lat: 32.1, lon: 34.8, label: 'Tel Aviv' },
  { lat: 31.5, lon: 34.5, label: 'Gaza' },
  { lat: 33.9, lon: 35.5, label: 'Beirut' },
  { lat: 33.5, lon: 36.3, label: 'Damascus' },
  { lat: 36.2, lon: 37.2, label: 'Aleppo' },
  { lat: 33.3, lon: 44.4, label: 'Baghdad' },
  { lat: 36.3, lon: 43.1, label: 'Mosul' },
  { lat: 30.5, lon: 47.8, label: 'Basra' },
  { lat: 35.7, lon: 51.4, label: 'Tehran' },
  { lat: 32.7, lon: 51.7, label: 'Isfahan' },
  { lat: 34.5, lon: 69.2, label: 'Kabul' },
  { lat: 31.6, lon: 65.7, label: 'Kandahar' },
  { lat: 24.7, lon: 46.7, label: 'Riyadh' },
  { lat: 21.4, lon: 39.8, label: 'Jeddah' },
  { lat: 29.4, lon: 48.0, label: 'Kuwait City' },
  { lat: 15.4, lon: 44.2, label: 'Sanaa' },
  { lat: 12.8, lon: 45.0, label: 'Aden' },
  { lat: 23.6, lon: 58.5, label: 'Muscat' },
  // Asia
  { lat: 35.7, lon: 139.7, label: 'Tokyo' },
  { lat: 22.3, lon: 114.2, label: 'Hong Kong' },
  { lat: 1.3, lon: 103.8, label: 'Singapore' },
  { lat: 28.6, lon: 77.2, label: 'Delhi' },
  // South America
  { lat: -23.5, lon: -46.6, label: 'São Paulo' },
  { lat: -34.6, lon: -58.4, label: 'Buenos Aires' },
  // Africa / Oceania
  { lat: -33.9, lon: 18.4, label: 'Cape Town' },
  { lat: -33.9, lon: 151.2, label: 'Sydney' },
]

async function fetchCameras(): Promise<{ cameras: unknown[]; errors: string[] }> {
  if (cameraCache && Date.now() - cameraCache.fetchedAt < CAMERA_CACHE_TTL) {
    return { cameras: cameraCache.cameras, errors: cameraCache.errors }
  }

  const cameras: unknown[] = []
  const errors: string[] = []
  const seenIds = new Set<string>()

  if (WINDY_KEY) {
    // Fetch from multiple regions in parallel (batched to avoid rate limits)
    const batchSize = 5
    for (let i = 0; i < CAMERA_REGIONS.length; i += batchSize) {
      const batch = CAMERA_REGIONS.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(async (region) => {
          const res = await fetch(
            `https://api.windy.com/webcams/api/v3/webcams?nearby=${region.lat},${region.lon},250&limit=50&include=location,images,player`,
            {
              headers: { 'x-windy-api-key': WINDY_KEY },
              signal: AbortSignal.timeout(15_000),
            },
          )
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${region.label}`)
          const json = await res.json()
          const parsed = parseWindyCameras(json)
          return { region: region.label, parsed }
        })
      )
      for (const result of results) {
        if (result.status === 'fulfilled') {
          for (const cam of result.value.parsed) {
            if (!seenIds.has(cam.id)) {
              seenIds.add(cam.id)
              cameras.push(cam)
            }
          }
        } else {
          errors.push(`Windy: ${result.reason}`)
        }
      }
    }
    console.log(`[Cameras] Windy: ${cameras.length} cameras from ${CAMERA_REGIONS.length} regions`)
  } else {
    errors.push('Windy: No API key configured (WINDY_WEBCAMS_KEY)')
  }

  cameraCache = { cameras, errors, fetchedAt: Date.now() }
  return { cameras, errors }
}

async function handleCameras(_url: URL): Promise<Response> {
  try {
    const { cameras, errors } = await fetchCameras()
    return Response.json({ cameras, errors }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('[Cameras] Fetch error:', err)
    return Response.json({ cameras: [], errors: ['Fetch failed'] }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }
}

async function handleCameraScan(url: URL): Promise<Response> {
  const lat = parseFloat(url.searchParams.get('lat') ?? '0')
  const lon = parseFloat(url.searchParams.get('lon') ?? '0')
  const radius = Math.min(parseInt(url.searchParams.get('radius') ?? '250'), 250)

  if (!WINDY_KEY) {
    return Response.json({ cameras: [], errors: ['No API key'] }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }

  try {
    const res = await fetch(
      `https://api.windy.com/webcams/api/v3/webcams?nearby=${lat},${lon},${radius}&limit=50&include=location,images,player`,
      {
        headers: { 'x-windy-api-key': WINDY_KEY },
        signal: AbortSignal.timeout(15_000),
      },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const cameras = parseWindyCameras(json)
    console.log(`[Cameras] Scan ${lat.toFixed(1)},${lon.toFixed(1)}: ${cameras.length} cameras`)
    return Response.json({ cameras, errors: [] }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('[Cameras] Scan error:', err)
    return Response.json({ cameras: [], errors: [(err as Error).message] }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }
}

// ─── PORTS PROXY ────────────────────────────────────────────────────────────

import { parsePortsGeoJSON, parsePortsList } from '../src/lib/ports-client'

const MAJOR_PORTS = [
  { name: 'Shanghai', country: 'CN', lat: 31.23, lon: 121.47, size: 'Large', type: 'River' },
  { name: 'Singapore', country: 'SG', lat: 1.26, lon: 103.84, size: 'Large', type: 'Coastal' },
  { name: 'Ningbo-Zhoushan', country: 'CN', lat: 29.87, lon: 121.54, size: 'Large', type: 'Coastal' },
  { name: 'Shenzhen', country: 'CN', lat: 22.54, lon: 114.06, size: 'Large', type: 'Coastal' },
  { name: 'Guangzhou', country: 'CN', lat: 23.08, lon: 113.32, size: 'Large', type: 'River' },
  { name: 'Busan', country: 'KR', lat: 35.10, lon: 129.03, size: 'Large', type: 'Coastal' },
  { name: 'Qingdao', country: 'CN', lat: 36.07, lon: 120.38, size: 'Large', type: 'Coastal' },
  { name: 'Hong Kong', country: 'HK', lat: 22.29, lon: 114.17, size: 'Large', type: 'Coastal' },
  { name: 'Tianjin', country: 'CN', lat: 38.98, lon: 117.72, size: 'Large', type: 'Coastal' },
  { name: 'Rotterdam', country: 'NL', lat: 51.89, lon: 4.50, size: 'Large', type: 'River' },
  { name: 'Dubai (Jebel Ali)', country: 'AE', lat: 25.00, lon: 55.06, size: 'Large', type: 'Coastal' },
  { name: 'Port Klang', country: 'MY', lat: 3.00, lon: 101.39, size: 'Large', type: 'Coastal' },
  { name: 'Antwerp', country: 'BE', lat: 51.23, lon: 4.40, size: 'Large', type: 'River' },
  { name: 'Xiamen', country: 'CN', lat: 24.48, lon: 118.09, size: 'Large', type: 'Coastal' },
  { name: 'Kaohsiung', country: 'TW', lat: 22.61, lon: 120.29, size: 'Large', type: 'Coastal' },
  { name: 'Hamburg', country: 'DE', lat: 53.55, lon: 9.97, size: 'Large', type: 'River' },
  { name: 'Los Angeles', country: 'US', lat: 33.74, lon: -118.26, size: 'Large', type: 'Coastal' },
  { name: 'Long Beach', country: 'US', lat: 33.75, lon: -118.19, size: 'Large', type: 'Coastal' },
  { name: 'Tanjung Pelepas', country: 'MY', lat: 1.36, lon: 103.55, size: 'Large', type: 'Coastal' },
  { name: 'Laem Chabang', country: 'TH', lat: 13.08, lon: 100.88, size: 'Large', type: 'Coastal' },
  { name: 'Ho Chi Minh City', country: 'VN', lat: 10.77, lon: 106.70, size: 'Large', type: 'River' },
  { name: 'New York/New Jersey', country: 'US', lat: 40.68, lon: -74.04, size: 'Large', type: 'Coastal' },
  { name: 'Savannah', country: 'US', lat: 32.08, lon: -81.09, size: 'Large', type: 'River' },
  { name: 'Colombo', country: 'LK', lat: 6.94, lon: 79.85, size: 'Large', type: 'Coastal' },
  { name: 'Piraeus', country: 'GR', lat: 37.94, lon: 23.64, size: 'Large', type: 'Coastal' },
  { name: 'Felixstowe', country: 'GB', lat: 51.96, lon: 1.33, size: 'Large', type: 'Coastal' },
  { name: 'Valencia', country: 'ES', lat: 39.44, lon: -0.32, size: 'Large', type: 'Coastal' },
  { name: 'Algeciras', country: 'ES', lat: 36.13, lon: -5.44, size: 'Large', type: 'Coastal' },
  { name: 'Tanger Med', country: 'MA', lat: 35.87, lon: -5.50, size: 'Large', type: 'Coastal' },
  { name: 'Santos', country: 'BR', lat: -23.95, lon: -46.30, size: 'Large', type: 'Coastal' },
  { name: 'Yokohama', country: 'JP', lat: 35.44, lon: 139.64, size: 'Large', type: 'Coastal' },
  { name: 'Tokyo', country: 'JP', lat: 35.65, lon: 139.77, size: 'Large', type: 'Coastal' },
  { name: 'Kobe', country: 'JP', lat: 34.68, lon: 135.20, size: 'Large', type: 'Coastal' },
  { name: 'Mumbai (JNPT)', country: 'IN', lat: 18.95, lon: 72.95, size: 'Large', type: 'Coastal' },
  { name: 'Durban', country: 'ZA', lat: -29.87, lon: 31.03, size: 'Large', type: 'Coastal' },
  { name: 'Bremerhaven', country: 'DE', lat: 53.55, lon: 8.58, size: 'Large', type: 'Coastal' },
  { name: 'Suez Canal (Port Said)', country: 'EG', lat: 31.26, lon: 32.31, size: 'Large', type: 'Coastal' },
  { name: 'Panama Canal (Balboa)', country: 'PA', lat: 8.95, lon: -79.57, size: 'Large', type: 'Coastal' },
  { name: 'Strait of Malacca', country: 'MY', lat: 2.50, lon: 101.80, size: 'Medium', type: 'Coastal' },
  { name: 'Cape Town', country: 'ZA', lat: -33.92, lon: 18.44, size: 'Medium', type: 'Coastal' },
  { name: 'Sydney', country: 'AU', lat: -33.86, lon: 151.21, size: 'Medium', type: 'Coastal' },
  { name: 'Melbourne', country: 'AU', lat: -37.82, lon: 144.95, size: 'Medium', type: 'Coastal' },
  { name: 'Vancouver', country: 'CA', lat: 49.29, lon: -123.11, size: 'Large', type: 'Coastal' },
  { name: 'Houston', country: 'US', lat: 29.76, lon: -95.27, size: 'Large', type: 'River' },
  { name: 'Manzanillo', country: 'MX', lat: 19.05, lon: -104.32, size: 'Medium', type: 'Coastal' },
  { name: 'Cartagena', country: 'CO', lat: 10.39, lon: -75.51, size: 'Medium', type: 'Coastal' },
  { name: 'Callao', country: 'PE', lat: -12.05, lon: -77.14, size: 'Medium', type: 'Coastal' },
  { name: 'Mombasa', country: 'KE', lat: -4.04, lon: 39.67, size: 'Medium', type: 'Coastal' },
  { name: 'Dar es Salaam', country: 'TZ', lat: -6.82, lon: 39.29, size: 'Medium', type: 'Coastal' },
  { name: 'Murmansk', country: 'RU', lat: 68.97, lon: 33.09, size: 'Medium', type: 'Coastal' },
  { name: 'Vladivostok', country: 'RU', lat: 43.12, lon: 131.89, size: 'Medium', type: 'Coastal' },
  { name: 'Novorossiysk', country: 'RU', lat: 44.72, lon: 37.77, size: 'Medium', type: 'Coastal' },
  { name: 'Haifa', country: 'IL', lat: 32.82, lon: 34.99, size: 'Medium', type: 'Coastal' },
  { name: 'Karachi', country: 'PK', lat: 24.85, lon: 67.00, size: 'Large', type: 'Coastal' },
  { name: 'Chittagong', country: 'BD', lat: 22.33, lon: 91.81, size: 'Medium', type: 'River' },
  { name: 'Manila', country: 'PH', lat: 14.58, lon: 120.97, size: 'Large', type: 'Coastal' },
  { name: 'Jakarta (Tanjung Priok)', country: 'ID', lat: -6.10, lon: 106.87, size: 'Large', type: 'Coastal' },
  { name: 'Le Havre', country: 'FR', lat: 49.49, lon: 0.11, size: 'Large', type: 'Coastal' },
  { name: 'Genoa', country: 'IT', lat: 44.41, lon: 8.93, size: 'Medium', type: 'Coastal' },
  { name: 'Barcelona', country: 'ES', lat: 41.35, lon: 2.16, size: 'Medium', type: 'Coastal' },
  { name: 'Gdansk', country: 'PL', lat: 54.37, lon: 18.64, size: 'Medium', type: 'Coastal' },
  { name: 'Gothenburg', country: 'SE', lat: 57.71, lon: 11.97, size: 'Medium', type: 'Coastal' },
  { name: 'Jeddah', country: 'SA', lat: 21.49, lon: 39.19, size: 'Large', type: 'Coastal' },
  { name: 'Djibouti', country: 'DJ', lat: 11.59, lon: 43.15, size: 'Medium', type: 'Coastal' },
  { name: 'Aden', country: 'YE', lat: 12.79, lon: 45.03, size: 'Medium', type: 'Coastal' },
]

interface PortCacheEntry { ports: unknown[]; errors: string[]; fetchedAt: number }
let portCache: PortCacheEntry | null = null
const PORT_CACHE_TTL = 86_400_000 // 24 hours (static data)

async function fetchPorts(): Promise<{ ports: unknown[]; errors: string[] }> {
  if (portCache && Date.now() - portCache.fetchedAt < PORT_CACHE_TTL) {
    return { ports: portCache.ports, errors: portCache.errors }
  }

  const errors: string[] = []
  let ports: unknown[] = []

  // Try multiple port data sources with fallback to embedded data
  let fetched = false

  // Attempt 1: ArcGIS public FeatureServer (NGA WPI mirror)
  try {
    const res = await fetch(
      'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Port_Index/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson&resultRecordCount=2000',
      { signal: AbortSignal.timeout(20_000) },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    ports = parsePortsGeoJSON(json)
    if (ports.length > 0) {
      fetched = true
      console.log(`[Ports] ArcGIS WPI: ${ports.length} ports`)
    }
  } catch (err) {
    console.warn(`[Ports] ArcGIS failed: ${(err as Error).message}`)
  }

  // Fallback: embedded major world ports
  if (!fetched) {
    ports = parsePortsList(MAJOR_PORTS)
    console.log(`[Ports] Using embedded fallback: ${ports.length} ports`)
  }

  portCache = { ports, errors, fetchedAt: Date.now() }
  return { ports, errors }
}

async function handlePorts(): Promise<Response> {
  try {
    const { ports, errors } = await fetchPorts()
    return Response.json({ ports, errors }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('[Ports] Fetch error:', err)
    return Response.json({ ports: [], errors: ['Fetch failed'] }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }
}

// ─── RF SPECTRUM PROXY ──────────────────────────────────────────────────────

import { parsePSKReporterSpots, parseRBNSpots, parseSatNOGSObservations } from '../src/lib/rf-client'

interface RFCacheEntry { spots: unknown[]; errors: string[]; fetchedAt: number }
let rfCache: RFCacheEntry | null = null
const RF_CACHE_TTL = 300_000 // 5 min

async function fetchRFSpots(): Promise<{ spots: unknown[]; errors: string[] }> {
  if (rfCache && Date.now() - rfCache.fetchedAt < RF_CACHE_TTL) {
    return { spots: rfCache.spots, errors: rfCache.errors }
  }

  // PSK Reporter returns XML — fetch and convert to our format
  // RBN has no public JSON API — skip
  // SatNOGS observations API is the working source
  const results = await Promise.allSettled([
    fetch('https://retrieve.pskreporter.info/query?mode=FT8&rptlimit=100&flowStartSeconds=-900&statistics=0&noactive=1', {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/xml' },
    })
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const text = await r.text()
        // Parse XML reception reports into our format
        const spots: ReturnType<typeof parsePSKReporterSpots> = []
        const reportRegex = /<receptionReport[^>]*\s+senderCallsign="([^"]*)"[^>]*\s+receiverCallsign="([^"]*)"[^>]*\s+frequency="([^"]*)"[^>]*\s+mode="([^"]*)"[^>]*(?:\s+sNR="([^"]*)")?[^>]*(?:\s+senderLatitude="([^"]*)")?[^>]*(?:\s+senderLongitude="([^"]*)")?[^>]*(?:\s+receiverLatitude="([^"]*)")?[^>]*(?:\s+receiverLongitude="([^"]*)")?/g
        let match
        let idx = 0
        while ((match = reportRegex.exec(text)) !== null) {
          const sLat = parseFloat(match[6] ?? '')
          const sLon = parseFloat(match[7] ?? '')
          const rLat = parseFloat(match[8] ?? '')
          const rLon = parseFloat(match[9] ?? '')
          if (isNaN(sLat) || isNaN(rLat)) continue
          spots.push({
            id: `psk-${match[1]}-${match[2]}-${idx++}`,
            frequency: parseInt(match[3] ?? '0'),
            mode: match[4] ?? 'FT8',
            txCall: match[1] ?? '', txLat: sLat, txLon: sLon,
            rxCall: match[2] ?? '', rxLat: rLat, rxLon: rLon,
            snr: parseInt(match[5] ?? '0') || 0,
            time: Date.now(),
            source: 'psk' as const,
          })
        }
        console.log(`[RF] PSK Reporter: parsed ${spots.length} spots from XML`)
        return spots
      }),
    fetch('https://network.satnogs.org/api/observations/?format=json&status=good&ground_station=&satellite__norad_cat_id=&vetted_status=&page_size=50', {
      signal: AbortSignal.timeout(15_000),
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(json => parseSatNOGSObservations(json)),
  ])

  const spots: unknown[] = []
  const errors: string[] = []
  const sourceNames = ['PSK Reporter', 'SatNOGS']
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') spots.push(...result.value)
    else {
      errors.push(`${sourceNames[i]}: ${result.reason?.message ?? 'Unknown error'}`)
      console.warn(`[RF] ${sourceNames[i]} failed: ${result.reason?.message}`)
    }
  }

  rfCache = { spots, errors, fetchedAt: Date.now() }
  console.log(`[RF] ${spots.length} spots, ${errors.length} source errors`)
  return { spots, errors }
}

async function handleRFSpots(): Promise<Response> {
  try {
    const { spots, errors } = await fetchRFSpots()
    return Response.json({ spots, errors }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('[RF] Fetch error:', err)
    return Response.json({ spots: [], errors: ['All sources failed'] }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }
}

// ─── ECONOMIC DATA PROXY ────────────────────────────────────────────────────

import { parseWorldBankData, ECONOMIC_INDICATORS } from '../src/lib/economic-client'

interface EconCacheEntry { indicators: unknown[]; errors: string[]; fetchedAt: number }
let econCache: EconCacheEntry | null = null
const ECON_CACHE_TTL = 3_600_000 // 1 hour

async function fetchEconomicIndicators(): Promise<{ indicators: unknown[]; errors: string[] }> {
  if (econCache && Date.now() - econCache.fetchedAt < ECON_CACHE_TTL) {
    return { indicators: econCache.indicators, errors: econCache.errors }
  }

  const indicators: unknown[] = []
  const errors: string[] = []

  // Fetch latest year data for each indicator from World Bank
  const results = await Promise.allSettled(
    ECONOMIC_INDICATORS.map(ind =>
      fetch(
        `https://api.worldbank.org/v2/country/all/indicator/${ind.id}?format=json&per_page=300&date=2022:2024&MRV=1`,
        { signal: AbortSignal.timeout(15_000) },
      )
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then(json => parseWorldBankData(json, ind.id, ind.name))
    )
  )

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') indicators.push(...result.value)
    else {
      errors.push(`${ECONOMIC_INDICATORS[i].name}: ${result.reason?.message ?? 'Unknown error'}`)
      console.warn(`[Economic] ${ECONOMIC_INDICATORS[i].name} failed: ${result.reason?.message}`)
    }
  }

  econCache = { indicators, errors, fetchedAt: Date.now() }
  console.log(`[Economic] ${indicators.length} data points, ${errors.length} source errors`)
  return { indicators, errors }
}

async function handleEconomicIndicators(): Promise<Response> {
  try {
    const { indicators, errors } = await fetchEconomicIndicators()
    return Response.json({ indicators, errors }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    console.error('[Economic] Fetch error:', err)
    return Response.json({ indicators: [], errors: ['All sources failed'] }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }
}

// ─── HEXDB PROXY ────────────────────────────────────────────────────────────

const HEXDB = 'https://hexdb.io'

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

async function resolveImageUrl(hex: string): Promise<string | null> {
  try {
    const res = await fetch(`${HEXDB}/hex-image-thumb?hex=${hex}`)
    if (!res.ok) return null
    const text = (await res.text()).trim()
    return text.startsWith('http') ? text : null
  } catch { return null }
}

async function handleHexdbLookup(url: URL): Promise<Response> {
  const hex = (url.searchParams.get('hex') ?? '').toUpperCase()
  if (!hex) return Response.json({ error: 'hex required' }, { status: 400 })
  const callsign = (url.searchParams.get('callsign') ?? '').trim()

  const [aircraft, route] = await Promise.all([
    fetchJson(`${HEXDB}/api/v1/aircraft/${hex}`),
    callsign ? fetchJson(`${HEXDB}/api/v1/route/icao/${callsign}`) : null,
  ])

  let origin = null
  let destination = null
  const routeStr = (route as { route?: string })?.route
  if (routeStr) {
    const parts = routeStr.split('-')
    if (parts.length === 2) {
      ;[origin, destination] = await Promise.all([
        fetchJson(`${HEXDB}/api/v1/airport/icao/${parts[0]}`),
        fetchJson(`${HEXDB}/api/v1/airport/icao/${parts[1]}`),
      ])
    }
  }

  const imageUrl = await resolveImageUrl(hex)
  return Response.json(
    { aircraft, route, origin, destination, hasImage: imageUrl !== null },
    { headers: { 'Access-Control-Allow-Origin': '*' } },
  )
}

async function handleHexdbImage(url: URL): Promise<Response> {
  const hex = (url.searchParams.get('hex') ?? '').toUpperCase()
  if (!hex) return new Response('hex required', { status: 400 })

  const realUrl = await resolveImageUrl(hex)
  if (!realUrl) return new Response('not found', { status: 404 })

  try {
    const imgRes = await fetch(realUrl)
    if (!imgRes.ok) return new Response('not found', { status: 404 })
    return new Response(imgRes.body, {
      headers: {
        'Content-Type': imgRes.headers.get('Content-Type') ?? 'image/jpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return new Response('fetch error', { status: 502 })
  }
}

// ─── UNIFIED SERVER ─────────────────────────────────────────────────────────

Bun.serve<{ path: string }>({
  port: PORT,
  idleTimeout: 60, // seconds — weather fetches can be slow
  async fetch(req, server) {
    const url = new URL(req.url)

    // WebSocket upgrade — differentiate by path
    if (url.pathname === '/ws/ais') {
      if (server.upgrade(req, { data: { path: '/ws/ais' } })) return
      return new Response('WebSocket upgrade failed', { status: 400 })
    }
    if (url.pathname === '/ws/flights') {
      if (server.upgrade(req, { data: { path: '/ws/flights' } })) return
      return new Response('WebSocket upgrade failed', { status: 400 })
    }

    // HTTP API routes
    if (url.pathname === '/api/weather/events') return handleWeatherEvents()
    if (url.pathname === '/api/weather/conditions') return handleWeatherConditions(url)
    if (url.pathname === '/api/news/events') return handleNewsEvents()
    if (url.pathname === '/api/conflicts/events') return handleConflictEvents()
    if (url.pathname === '/api/cyber/events') return handleCyberEvents()
    if (url.pathname === '/api/osint/posts') return handleOsintPosts()
    if (url.pathname === '/api/article/extract') return handleArticleExtract(url)
    if (url.pathname === '/api/osint/comments') return handleOsintComments(url)
    if (url.pathname === '/api/sanctions/check') return handleSanctionsCheck(url)
    if (url.pathname === '/api/cameras/nearby') return handleCameras(url)
    if (url.pathname === '/api/cameras/scan') return handleCameraScan(url)
    if (url.pathname === '/api/ports/data') return handlePorts()
    if (url.pathname === '/api/rf/spots') return handleRFSpots()
    if (url.pathname === '/api/economic/indicators') return handleEconomicIndicators()
    if (url.pathname === '/api/hexdb/lookup') return handleHexdbLookup(url)
    if (url.pathname === '/api/hexdb/image') return handleHexdbImage(url)

    // Legacy compatibility routes (single-port clients)
    if (url.pathname === '/lookup') return handleHexdbLookup(url)
    if (url.pathname === '/image') return handleHexdbImage(url)

    // Health check
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        ais: { connected: aisUpstream?.readyState === WebSocket.OPEN, clients: aisClients.size },
        flights: { source: FLIGHT_SOURCE, clients: flightClients.size, polls: pollCount },
      })
    }

    return new Response('Eagle Eye Backend', { status: 200 })
  },
  websocket: {
    open(ws) {
      if (ws.data.path === '/ws/ais') {
        aisClients.add(ws)
        console.log(`[AIS] Client connected (${aisClients.size} total)`)
      } else if (ws.data.path === '/ws/flights') {
        flightClients.add(ws)
        console.log(`[Flight] Client connected (${flightClients.size} total)`)
        // Send last known data to new clients
        if (lastGoodPayload) {
          try { ws.send(lastGoodPayload) } catch { /* skip */ }
        }
      }
    },
    close(ws) {
      if (ws.data.path === '/ws/ais') {
        aisClients.delete(ws)
        console.log(`[AIS] Client disconnected (${aisClients.size} total)`)
      } else if (ws.data.path === '/ws/flights') {
        flightClients.delete(ws)
        console.log(`[Flight] Client disconnected (${flightClients.size} total)`)
      }
    },
    message() {
      // Browser clients don't send messages
    },
  },
})

console.log(`[Eagle Eye] Backend listening on :${PORT}`)
console.log(`  WebSocket: /ws/ais, /ws/flights`)
console.log(`  HTTP API:  /api/weather/events, /api/weather/conditions, /api/news/events, /api/conflicts/events, /api/cyber/events`)
console.log(`             /api/osint/posts, /api/sanctions/check, /api/ports/data, /api/rf/spots, /api/economic/indicators`)
console.log(`             /api/hexdb/lookup, /api/hexdb/image`)
console.log(`  Health:    /health`)
if (AIS_API_KEY) console.log('[AIS] API key configured')
else console.warn('[AIS] Missing AIS_API_KEY — AIS proxy disabled')
if (OPENSKY_CLIENT_ID && OPENSKY_CLIENT_SECRET) console.log('[Flight] OpenSky OAuth2 credentials configured')
else console.warn('[Flight] OpenSky OAuth2 credentials missing — using anonymous access')
console.log(`[Flight] Source: ${FLIGHT_SOURCE}`)

// Pre-fetch weather data on startup so the first client request is fast
fetchWeatherEvents().catch(() => console.warn('[Weather] Initial fetch failed — will retry on first request'))
