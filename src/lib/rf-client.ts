/**
 * RF Spectrum data parsers for PSK Reporter and Reverse Beacon Network.
 */

import type { RFSpot } from '@/types'

/**
 * Parse PSK Reporter spots.
 * PSK Reporter returns XML or JSON with reception reports.
 */
export function parsePSKReporterSpots(json: unknown): RFSpot[] {
  const data = json as { receptionReport?: Array<{
    senderCallsign?: string; receiverCallsign?: string
    frequency?: number; mode?: string; sNR?: number
    senderLocator?: string; receiverLocator?: string
    senderDXCC?: string; receiverDXCC?: string
    flowStartSeconds?: number
    senderLatitude?: number; senderLongitude?: number
    receiverLatitude?: number; receiverLongitude?: number
  }> }

  if (!Array.isArray(data?.receptionReport)) return []

  return data.receptionReport!
    .filter(r => r.senderLatitude != null && r.receiverLatitude != null)
    .map((r, i) => ({
      id: `psk-${r.senderCallsign}-${r.receiverCallsign}-${i}`,
      frequency: r.frequency ?? 0,
      mode: r.mode ?? 'unknown',
      txCall: r.senderCallsign ?? '',
      txLat: r.senderLatitude ?? 0,
      txLon: r.senderLongitude ?? 0,
      rxCall: r.receiverCallsign ?? '',
      rxLat: r.receiverLatitude ?? 0,
      rxLon: r.receiverLongitude ?? 0,
      snr: r.sNR ?? 0,
      time: (r.flowStartSeconds ?? 0) * 1000 || Date.now(),
      source: 'psk' as const,
    }))
}

/**
 * Parse Reverse Beacon Network spots.
 */
export function parseRBNSpots(json: unknown): RFSpot[] {
  const data = json as Array<{
    callsign?: string; de?: string
    freq?: number; frequency?: number
    mode?: string; snr?: number; db?: number
    time?: string; spotTime?: number
    lat?: number; lon?: number
    deLat?: number; deLon?: number
  }>

  if (!Array.isArray(data)) return []

  return data
    .filter(s => s.lat != null && s.lon != null)
    .map((s, i) => ({
      id: `rbn-${s.callsign}-${s.de}-${i}`,
      frequency: s.freq ?? s.frequency ?? 0,
      mode: s.mode ?? 'CW',
      txCall: s.callsign ?? '',
      txLat: s.lat ?? 0,
      txLon: s.lon ?? 0,
      rxCall: s.de ?? '',
      rxLat: s.deLat ?? 0,
      rxLon: s.deLon ?? 0,
      snr: s.snr ?? s.db ?? 0,
      time: s.spotTime ? s.spotTime * 1000 : Date.now(),
      source: 'rbn' as const,
    }))
}

/**
 * Parse SatNOGS ground station observations.
 */
export function parseSatNOGSObservations(json: unknown): RFSpot[] {
  const data = json as Array<{
    id?: number
    transmitter?: { description?: string; downlink_low?: number; mode?: string }
    station_name?: string; station_lat?: number; station_lng?: number
    start?: string
  }>

  if (!Array.isArray(data)) return []

  return data
    .filter(o => o.station_lat != null && o.station_lng != null)
    .map(o => ({
      id: `satnogs-${o.id}`,
      frequency: o.transmitter?.downlink_low ?? 0,
      mode: o.transmitter?.mode ?? 'unknown',
      txCall: o.transmitter?.description ?? 'SAT',
      txLat: 0, txLon: 0, // satellite position unknown without TLE
      rxCall: o.station_name ?? '',
      rxLat: o.station_lat ?? 0,
      rxLon: o.station_lng ?? 0,
      snr: 0,
      time: o.start ? new Date(o.start).getTime() : Date.now(),
      source: 'satnogs' as const,
    }))
}

// Frequency band labels
export const RF_BANDS: Record<string, [number, number]> = {
  'HF': [3_000_000, 30_000_000],
  'VHF': [30_000_000, 300_000_000],
  'UHF': [300_000_000, 3_000_000_000],
  'SHF': [3_000_000_000, 30_000_000_000],
}

export function getFrequencyBand(freq: number): string {
  for (const [band, [low, high]] of Object.entries(RF_BANDS)) {
    if (freq >= low && freq < high) return band
  }
  return freq < 3_000_000 ? 'LF/MF' : 'EHF+'
}
