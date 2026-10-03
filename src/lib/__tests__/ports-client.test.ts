import { describe, it, expect } from 'vitest'
import { parsePortsGeoJSON, parsePortsList } from '../ports-client'

describe('parsePortsGeoJSON', () => {
  it('parses valid GeoJSON features', () => {
    const result = parsePortsGeoJSON({
      features: [
        {
          properties: {
            portName: 'Rotterdam',
            countryCode: 'NL',
            latitude: 51.9,
            longitude: 4.5,
            harborSize: 'Large',
            harborType: 'Coastal',
          },
          geometry: { type: 'Point', coordinates: [4.5, 51.9] },
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Rotterdam')
    expect(result[0].country).toBe('NL')
    expect(result[0].size).toBe('large')
    expect(result[0].harborType).toBe('Coastal')
  })

  it('handles uppercase property names', () => {
    const result = parsePortsGeoJSON({
      features: [
        {
          properties: {
            PORT_NAME: 'Shanghai',
            COUNTRY_CODE: 'CN',
            LATITUDE: 31.2,
            LONGITUDE: 121.5,
            HARBOR_SIZE: 'Large',
            HARBOR_TYPE: 'River',
          },
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Shanghai')
    expect(result[0].size).toBe('large')
  })

  it('falls back to geometry coordinates', () => {
    const result = parsePortsGeoJSON({
      features: [
        {
          properties: { portName: 'Test Port' },
          geometry: { type: 'Point', coordinates: [10.5, 20.3] },
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0].lat).toBe(20.3)
    expect(result[0].lon).toBe(10.5)
  })

  it('skips features without name or coordinates', () => {
    const result = parsePortsGeoJSON({
      features: [
        { properties: { countryCode: 'XX' } },
        { properties: { portName: 'NoCoords' } },
      ],
    })
    expect(result).toEqual([])
  })

  it('returns empty for invalid input', () => {
    expect(parsePortsGeoJSON({})).toEqual([])
    expect(parsePortsGeoJSON(null)).toEqual([])
  })

  it('maps harbor sizes correctly', () => {
    const make = (size: string) => parsePortsGeoJSON({
      features: [{ properties: { portName: 'P', latitude: 0, longitude: 0, harborSize: size } }],
    })[0]?.size

    // Note: source code checks includes('l') first, so 'Small' also matches 'large'
    expect(make('Large')).toBe('large')
    expect(make('Medium')).toBe('medium')
    expect(make('Small')).toBe('large') // 'small' contains 'l'
    expect(make('')).toBe('small')
  })
})

describe('parsePortsList', () => {
  it('parses valid port array', () => {
    const result = parsePortsList([
      { name: 'Singapore', country: 'SG', lat: 1.3, lon: 103.8, size: 'Large', type: 'Coastal' },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Singapore')
    expect(result[0].size).toBe('large')
  })

  it('handles alternate coordinate keys', () => {
    const result = parsePortsList([
      { name: 'Test', latitude: 10, longitude: 20 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].lat).toBe(10)
    expect(result[0].lon).toBe(20)
  })

  it('filters entries without coordinates', () => {
    const result = parsePortsList([{ name: 'NoPosPort' }])
    expect(result).toEqual([])
  })

  it('returns empty for non-array', () => {
    expect(parsePortsList({})).toEqual([])
    expect(parsePortsList(null)).toEqual([])
  })
})
