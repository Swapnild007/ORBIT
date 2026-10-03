import { describe, it, expect } from 'vitest'
import { parseAbuseIPDB, parseIODASignals } from '../cyber-client'

describe('parseAbuseIPDB', () => {
  it('parses entries with geolocation', () => {
    const result = parseAbuseIPDB({
      data: [
        {
          ipAddress: '192.168.1.1',
          abuseConfidenceScore: 100,
          countryCode: 'CN',
          totalReports: 500,
          lastReportedAt: '2024-01-15T10:00:00Z',
          lat: 39.9,
          lon: 116.4,
        },
        {
          ipAddress: '10.0.0.1',
          abuseConfidenceScore: 80,
          countryCode: 'RU',
          totalReports: 50,
          lastReportedAt: '2024-01-15T09:00:00Z',
          lat: 55.8,
          lon: 37.6,
        },
      ],
    })

    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('ddos') // confidence > 95
    expect(result[0].ip).toBe('192.168.1.1')
    expect(result[0].severity).toBe(10)
    expect(result[1].type).toBe('scan') // confidence <= 95
    expect(result[1].severity).toBe(8)
  })

  it('filters entries without lat/lon', () => {
    const result = parseAbuseIPDB({
      data: [
        { ipAddress: '1.1.1.1', abuseConfidenceScore: 90, countryCode: 'US', totalReports: 10, lastReportedAt: '2024-01-01T00:00:00Z' },
      ],
    })
    expect(result).toEqual([])
  })

  it('returns empty array for missing data', () => {
    expect(parseAbuseIPDB({})).toEqual([])
  })
})

describe('parseIODASignals', () => {
  const geoLookup = new Map([
    ['US', { lat: 37.09, lon: -95.71 }],
    ['CN', { lat: 35.86, lon: 104.20 }],
  ])

  it('parses critical outage signals', () => {
    const result = parseIODASignals({
      data: [
        {
          entityType: 'country',
          entityCode: 'US',
          entityName: 'United States',
          datasource: 'bgp',
          from: 1705300000,
          until: 1705310000,
          level: 'critical',
        },
      ],
    }, geoLookup)

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('outage')
    expect(result[0].lat).toBe(37.09)
    expect(result[0].source).toBe('ioda')
    expect(result[0].time).toBe(1705300000 * 1000)
  })

  it('filters non-critical signals', () => {
    const result = parseIODASignals({
      data: [
        { entityType: 'country', entityCode: 'US', entityName: 'US', datasource: 'bgp', from: 0, until: 0, level: 'normal' },
      ],
    }, geoLookup)
    expect(result).toEqual([])
  })

  it('filters signals without geo lookup', () => {
    const result = parseIODASignals({
      data: [
        { entityType: 'country', entityCode: 'XX', entityName: 'Unknown', datasource: 'bgp', from: 0, until: 0, level: 'critical' },
      ],
    }, geoLookup)
    expect(result).toEqual([])
  })

  it('returns empty for missing data', () => {
    expect(parseIODASignals({}, geoLookup)).toEqual([])
  })
})
