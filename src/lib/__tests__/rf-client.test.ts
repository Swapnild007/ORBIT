import { describe, it, expect } from 'vitest'
import { parsePSKReporterSpots, parseRBNSpots, parseSatNOGSObservations, getFrequencyBand } from '../rf-client'

describe('parsePSKReporterSpots', () => {
  it('parses valid reception reports', () => {
    const result = parsePSKReporterSpots({
      receptionReport: [
        {
          senderCallsign: 'W1AW',
          receiverCallsign: 'DL1ABC',
          frequency: 14074000,
          mode: 'FT8',
          sNR: -12,
          senderLatitude: 41.7,
          senderLongitude: -72.7,
          receiverLatitude: 51.5,
          receiverLongitude: 10.4,
          flowStartSeconds: 1705300000,
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0].txCall).toBe('W1AW')
    expect(result[0].rxCall).toBe('DL1ABC')
    expect(result[0].frequency).toBe(14074000)
    expect(result[0].mode).toBe('FT8')
    expect(result[0].source).toBe('psk')
    expect(result[0].time).toBe(1705300000 * 1000)
  })

  it('filters entries without sender coordinates', () => {
    const result = parsePSKReporterSpots({
      receptionReport: [
        { senderCallsign: 'W1AW', receiverCallsign: 'DL1ABC', receiverLatitude: 51.5, receiverLongitude: 10.4 },
      ],
    })
    expect(result).toEqual([])
  })

  it('returns empty for invalid input', () => {
    expect(parsePSKReporterSpots({})).toEqual([])
    expect(parsePSKReporterSpots(null)).toEqual([])
  })
})

describe('parseRBNSpots', () => {
  it('parses valid spots', () => {
    const result = parseRBNSpots([
      {
        callsign: 'W1AW',
        de: 'KD2ABC',
        freq: 7025000,
        mode: 'CW',
        snr: 20,
        lat: 41.7,
        lon: -72.7,
        deLat: 40.7,
        deLon: -74.0,
        spotTime: 1705300000,
      },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('rbn')
    expect(result[0].frequency).toBe(7025000)
    expect(result[0].mode).toBe('CW')
  })

  it('filters entries without lat/lon', () => {
    const result = parseRBNSpots([{ callsign: 'W1AW' }])
    expect(result).toEqual([])
  })

  it('returns empty for non-array', () => {
    expect(parseRBNSpots({})).toEqual([])
    expect(parseRBNSpots(null)).toEqual([])
  })
})

describe('parseSatNOGSObservations', () => {
  it('parses valid observations', () => {
    const result = parseSatNOGSObservations([
      {
        id: 100,
        transmitter: { description: 'ISS APRS', downlink_low: 145800000, mode: 'FM' },
        station_name: 'GS-Alpha',
        station_lat: 52.5,
        station_lng: 13.4,
        start: '2024-01-15T10:00:00Z',
      },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('satnogs-100')
    expect(result[0].frequency).toBe(145800000)
    expect(result[0].rxCall).toBe('GS-Alpha')
    expect(result[0].source).toBe('satnogs')
  })

  it('returns empty for non-array', () => {
    expect(parseSatNOGSObservations({})).toEqual([])
  })
})

describe('getFrequencyBand', () => {
  it('returns correct band labels', () => {
    expect(getFrequencyBand(14_000_000)).toBe('HF')
    expect(getFrequencyBand(145_000_000)).toBe('VHF')
    expect(getFrequencyBand(435_000_000)).toBe('UHF')
    expect(getFrequencyBand(10_000_000_000)).toBe('SHF')
  })

  it('returns LF/MF for low frequencies', () => {
    expect(getFrequencyBand(1_000_000)).toBe('LF/MF')
  })

  it('returns EHF+ for very high frequencies', () => {
    expect(getFrequencyBand(50_000_000_000)).toBe('EHF+')
  })
})
