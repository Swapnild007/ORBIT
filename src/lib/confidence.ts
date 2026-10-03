/**
 * Confidence scoring for events based on source authority, recency, and metadata.
 * Returns a score: 'low' | 'medium' | 'high'
 */

export type ConfidenceLevel = 'low' | 'medium' | 'high'

/** Source authority weights (higher = more authoritative) */
const SOURCE_AUTHORITY: Record<string, number> = {
  // Government/institutional
  usgs: 9,
  nws: 9,
  eonet: 8,
  acled: 8,
  ucdp: 8,
  ioda: 7,
  // Professional data
  abuseipdb: 6,
  gdelt: 5,
  celestrak: 9,
  wpi: 8,
  opensky: 7,
  aisstream: 7,
  // RF networks
  psk: 5,
  rbn: 5,
  satnogs: 6,
  // Social media
  reddit: 2,
  mastodon: 2,
  bluesky: 2,
}

interface ConfidenceInput {
  /** Data source identifier */
  source: string
  /** Timestamp of the event/report */
  time: number
  /** Whether the event has corroborating media/imagery */
  hasMedia?: boolean
  /** Severity or magnitude (higher = more likely to be verified) */
  severity?: number
  /** Number of corroborating sources (if known) */
  corroboratingCount?: number
}

/**
 * Compute confidence level based on source authority, recency, and metadata.
 * Score range: 0-10
 * - 0-3: low
 * - 4-6: medium
 * - 7-10: high
 */
export function computeConfidence(input: ConfidenceInput): ConfidenceLevel {
  let score = 0

  // Source authority (0-4 points)
  const authority = SOURCE_AUTHORITY[input.source.toLowerCase()] ?? 3
  score += (authority / 9) * 4

  // Recency (0-2 points) — fresher data is more confident
  const ageHours = (Date.now() - input.time) / (1000 * 60 * 60)
  if (ageHours < 1) score += 2
  else if (ageHours < 6) score += 1.5
  else if (ageHours < 24) score += 1
  else if (ageHours < 72) score += 0.5

  // Media presence (0-1 point)
  if (input.hasMedia) score += 1

  // Severity bump (0-1 point) — high severity events tend to get verified
  if (input.severity !== undefined) {
    if (input.severity >= 7) score += 1
    else if (input.severity >= 5) score += 0.5
  }

  // Corroboration (0-2 points)
  if (input.corroboratingCount !== undefined) {
    if (input.corroboratingCount >= 3) score += 2
    else if (input.corroboratingCount >= 2) score += 1.5
    else if (input.corroboratingCount >= 1) score += 1
  }

  if (score >= 7) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

export const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high: 'bg-green-400',
  medium: 'bg-yellow-400',
  low: 'bg-red-400',
}

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
}
