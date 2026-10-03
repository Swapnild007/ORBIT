export type NavView = 'Globe' | 'Objects' | 'Graph' | 'Signals' | 'Reports'

export type SatCategory = 'station' | 'comms' | 'nav' | 'weather' | 'earth-obs' | 'scientific' | 'military' | 'amateur'

export type ConstellationId =
  | 'iss' | 'starlink' | 'oneweb' | 'iridium' | 'iridium-next'
  | 'globalstar' | 'orbcomm' | 'ses' | 'intelsat' | 'telesat'
  | 'gps' | 'glonass' | 'galileo' | 'beidou'
  | 'noaa' | 'goes' | 'meteosat'
  | 'landsat' | 'sentinel' | 'planet'
  | 'science' | 'military-sat' | 'amateur'

export interface ConstellationMeta {
  id: ConstellationId
  name: string
  category: SatCategory
  celestrakGroup: string
  color: number
  defaultOn: boolean
}

export interface OmmRecord {
  OBJECT_NAME: string
  OBJECT_ID: string
  NORAD_CAT_ID: number
  EPOCH: string
  MEAN_MOTION: number
  ECCENTRICITY: number
  INCLINATION: number
  RA_OF_ASC_NODE: number
  ARG_OF_PERICENTER: number
  MEAN_ANOMALY: number
  CLASSIFICATION_TYPE: 'U' | 'C' | 'S'
  ELEMENT_SET_NO: number
  REV_AT_EPOCH: number
  BSTAR: number
  MEAN_MOTION_DOT: number
  MEAN_MOTION_DDOT: number
}

export interface SatelliteRecord {
  noradId: number
  name: string
  constellationId: ConstellationId
  satrec: unknown
  epoch: Date
  inclination: number
  period: number
  eccentricity: number
}

export interface SatellitePosition {
  noradId: number
  lat: number
  lon: number
  alt: number
  velocity: number
}

export type TrackingMode = 'satellites' | 'maritime' | 'flights'

export type VesselType = 'cargo' | 'tanker' | 'passenger' | 'fishing' | 'military' | 'tug' | 'pleasure' | 'other'

export const VESSEL_TYPES: VesselType[] = ['cargo', 'tanker', 'passenger', 'fishing', 'military', 'tug', 'pleasure', 'other']

export const VESSEL_TYPE_LABELS: Record<VesselType, string> = {
  cargo: 'Cargo',
  tanker: 'Tanker',
  passenger: 'Passenger',
  fishing: 'Fishing',
  military: 'Military',
  tug: 'Tug',
  pleasure: 'Pleasure',
  other: 'Other',
}

export type FlightType = 'commercial' | 'cargo' | 'military' | 'private' | 'helicopter' | 'other'

export const FLIGHT_TYPES: FlightType[] = ['commercial', 'cargo', 'military', 'private', 'helicopter', 'other']

export const FLIGHT_TYPE_LABELS: Record<FlightType, string> = {
  commercial: 'Commercial',
  cargo: 'Cargo',
  military: 'Military',
  private: 'Private',
  helicopter: 'Helicopter',
  other: 'Other',
}

export interface FlightRecord {
  icao24: string
  callsign: string
  type: FlightType
  originCountry: string
  lat: number
  lon: number
  altitude: number       // meters (barometric)
  speed: number          // m/s
  heading: number        // degrees
  verticalRate: number   // m/s
  onGround: boolean
  lastUpdate: number     // timestamp ms
}

export type WeatherEventType = 'earthquake' | 'wildfire' | 'volcano' | 'storm' | 'flood' | 'iceberg' | 'drought' | 'alert'

export const WEATHER_EVENT_TYPES: WeatherEventType[] = ['earthquake', 'wildfire', 'volcano', 'storm', 'flood', 'iceberg', 'drought', 'alert']

export const WEATHER_EVENT_LABELS: Record<WeatherEventType, string> = {
  earthquake: 'Earthquake',
  wildfire: 'Wildfire',
  volcano: 'Volcano',
  storm: 'Storm',
  flood: 'Flood',
  iceberg: 'Iceberg',
  drought: 'Drought',
  alert: 'Alert',
}

export interface WeatherEvent {
  id: string
  type: WeatherEventType
  title: string
  description: string
  lat: number
  lon: number
  magnitude: number | null
  geometry: GeoJSON.Geometry | null
  source: 'usgs' | 'eonet' | 'nws'
  time: number
  expires: number | null
  lastUpdate: number
}

// ─── News ──────────────────────────────────────────────────────────────────

export type NewsCategory = 'conflict' | 'politics' | 'disaster' | 'economy' | 'technology' | 'health' | 'environment' | 'other'

export const NEWS_CATEGORIES: NewsCategory[] = ['conflict', 'politics', 'disaster', 'economy', 'technology', 'health', 'environment', 'other']

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  conflict: 'Conflict',
  politics: 'Politics',
  disaster: 'Disaster',
  economy: 'Economy',
  technology: 'Technology',
  health: 'Health',
  environment: 'Environment',
  other: 'Other',
}

export interface NewsEvent {
  id: string
  title: string
  url: string
  source: string
  category: NewsCategory
  lat: number
  lon: number
  tone: number
  articleCount: number
  imageUrl: string | null
  time: number
  lastUpdate: number
}

// ─── Conflicts ─────────────────────────────────────────────────────────────

export type ConflictEventType = 'battle' | 'protest' | 'riot' | 'explosion' | 'violence' | 'strategic'

export const CONFLICT_EVENT_TYPES: ConflictEventType[] = ['battle', 'protest', 'riot', 'explosion', 'violence', 'strategic']

export const CONFLICT_EVENT_LABELS: Record<ConflictEventType, string> = {
  battle: 'Battle',
  protest: 'Protest',
  riot: 'Riot',
  explosion: 'Explosion',
  violence: 'Violence',
  strategic: 'Strategic',
}

export interface ConflictEvent {
  id: string
  type: ConflictEventType
  title: string
  description: string
  actors: string[]
  fatalities: number
  lat: number
  lon: number
  source: 'acled' | 'gdelt' | 'ucdp'
  time: number
  lastUpdate: number
}

// ─── Cyber & Infrastructure ────────────────────────────────────────────────

export type CyberEventType = 'ddos' | 'scan' | 'malware' | 'outage' | 'vulnerability'

export const CYBER_EVENT_TYPES: CyberEventType[] = ['ddos', 'scan', 'malware', 'outage', 'vulnerability']

export const CYBER_EVENT_LABELS: Record<CyberEventType, string> = {
  ddos: 'DDoS',
  scan: 'Scan',
  malware: 'Malware',
  outage: 'Outage',
  vulnerability: 'Vulnerability',
}

export interface CyberEvent {
  id: string
  type: CyberEventType
  title: string
  description: string
  ip: string | null
  lat: number
  lon: number
  severity: number
  source: 'abuseipdb' | 'ioda'
  time: number
  lastUpdate: number
}

export interface InfrastructureAsset {
  id: string
  type: 'cable' | 'power-plant' | 'landing-point'
  name: string
  lat: number
  lon: number
  metadata: Record<string, unknown>
}

// ─── RF Spectrum ───────────────────────────────────────────────────────────

export interface RFSpot {
  id: string
  frequency: number
  mode: string
  txCall: string
  txLat: number
  txLon: number
  rxCall: string
  rxLat: number
  rxLon: number
  snr: number
  time: number
  source: 'psk' | 'rbn' | 'satnogs'
}

// ─── OSINT ────────────────────────────────────────────────────────────────

export type OsintPlatform = 'reddit' | 'mastodon' | 'bluesky'

export const OSINT_PLATFORMS: OsintPlatform[] = ['reddit', 'mastodon', 'bluesky']

export const OSINT_PLATFORM_LABELS: Record<OsintPlatform, string> = {
  reddit: 'Reddit',
  mastodon: 'Mastodon',
  bluesky: 'Bluesky',
}

export interface VesselRecord {
  mmsi: number
  name: string
  type: VesselType
  lat: number
  lon: number
  speed: number       // knots (SOG)
  course: number      // degrees (COG)
  heading: number     // true heading
  navStatus: number   // AIS nav status code
  lastUpdate: number  // timestamp ms
}
