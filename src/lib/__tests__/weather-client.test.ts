import { describe, it, expect } from 'vitest'
import { parseUSGSEarthquakes, parseEONETEvents, parseNWSAlerts } from '../weather-client'

describe('parseUSGSEarthquakes', () => {
  it('parses valid GeoJSON into WeatherEvent[]', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          id: 'us7000test',
          properties: {
            title: 'M 5.2 - 10 km SSW of Somewhere',
            mag: 5.2,
            place: '10 km SSW of Somewhere',
            time: 1700000000000,
            updated: 1700000100000,
          },
          geometry: { type: 'Point', coordinates: [-118.5, 34.0, 10.0] },
        },
      ],
    }

    const events = parseUSGSEarthquakes(geojson)
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('usgs-us7000test')
    expect(events[0].type).toBe('earthquake')
    expect(events[0].title).toBe('M 5.2 - 10 km SSW of Somewhere')
    expect(events[0].lat).toBe(34.0)
    expect(events[0].lon).toBe(-118.5)
    expect(events[0].magnitude).toBe(5.2)
    expect(events[0].source).toBe('usgs')
    expect(events[0].time).toBe(1700000000000)
  })

  it('returns [] for empty features', () => {
    expect(parseUSGSEarthquakes({ features: [] })).toEqual([])
  })

  it('returns [] for null/undefined input', () => {
    expect(parseUSGSEarthquakes(null)).toEqual([])
    expect(parseUSGSEarthquakes(undefined)).toEqual([])
  })

  it('skips features with missing coordinates', () => {
    const geojson = {
      features: [
        { id: 'a', properties: { title: 'Test', mag: 1 }, geometry: { type: 'Point', coordinates: [] } },
        { id: 'b', properties: { title: 'Test', mag: 1 }, geometry: null },
      ],
    }
    expect(parseUSGSEarthquakes(geojson)).toEqual([])
  })

  it('handles missing magnitude gracefully', () => {
    const geojson = {
      features: [{
        id: 'x',
        properties: { title: 'Unknown quake' },
        geometry: { type: 'Point', coordinates: [0, 0, 0] },
      }],
    }
    const events = parseUSGSEarthquakes(geojson)
    expect(events).toHaveLength(1)
    expect(events[0].magnitude).toBeNull()
  })
})

describe('parseEONETEvents', () => {
  it('parses open events with correct types', () => {
    const json = {
      events: [
        {
          id: 'EONET_1234',
          title: 'Wildfire - California',
          description: null,
          categories: [{ id: 'wildfires', title: 'Wildfires' }],
          geometry: [
            { date: '2024-01-01T00:00:00Z', type: 'Point', coordinates: [-120.5, 37.0] },
          ],
        },
      ],
    }

    const events = parseEONETEvents(json)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('wildfire')
    expect(events[0].title).toBe('Wildfire - California')
    expect(events[0].lat).toBe(37.0)
    expect(events[0].lon).toBe(-120.5)
    expect(events[0].source).toBe('eonet')
  })

  it('maps volcano category correctly', () => {
    const json = {
      events: [{
        id: 'V1',
        title: 'Eruption',
        categories: [{ id: 'volcanoes' }],
        geometry: [{ date: '2024-01-01T00:00:00Z', type: 'Point', coordinates: [100, 0] }],
      }],
    }
    expect(parseEONETEvents(json)[0].type).toBe('volcano')
  })

  it('uses most recent geometry entry', () => {
    const json = {
      events: [{
        id: 'S1',
        title: 'Storm',
        categories: [{ id: 'severeStorms' }],
        geometry: [
          { date: '2024-01-01T00:00:00Z', type: 'Point', coordinates: [10, 20] },
          { date: '2024-01-02T00:00:00Z', type: 'Point', coordinates: [30, 40] },
        ],
      }],
    }
    const events = parseEONETEvents(json)
    expect(events[0].lon).toBe(30)
    expect(events[0].lat).toBe(40)
  })

  it('returns [] for empty/invalid input', () => {
    expect(parseEONETEvents(null)).toEqual([])
    expect(parseEONETEvents({ events: [] })).toEqual([])
  })

  it('skips events without geometry', () => {
    const json = {
      events: [{ id: 'X', title: 'No geo', categories: [{ id: 'wildfires' }], geometry: [] }],
    }
    expect(parseEONETEvents(json)).toEqual([])
  })
})

describe('parseNWSAlerts', () => {
  it('parses polygon geometry and preserves it', () => {
    const json = {
      features: [{
        id: 'nws-alert-1',
        properties: {
          id: 'alert-1',
          headline: 'Tornado Warning',
          description: 'Take cover immediately',
          severity: 'Extreme',
          event: 'Tornado Warning',
          onset: '2024-01-01T12:00:00Z',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[[-100, 35], [-99, 35], [-99, 36], [-100, 36], [-100, 35]]],
        },
      }],
    }

    const events = parseNWSAlerts(json)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('storm')
    expect(events[0].title).toBe('Tornado Warning')
    expect(events[0].geometry).not.toBeNull()
    expect(events[0].geometry!.type).toBe('Polygon')
    expect(events[0].source).toBe('nws')
    // Centroid should be roughly in the middle
    expect(events[0].lat).toBeCloseTo(35.4, 0)
    expect(events[0].lon).toBeCloseTo(-99.6, 0)
  })

  it('handles missing geometry by skipping', () => {
    const json = {
      features: [{
        properties: { id: 'a', headline: 'Test' },
        geometry: null,
      }],
    }
    expect(parseNWSAlerts(json)).toEqual([])
  })

  it('returns [] for empty/invalid input', () => {
    expect(parseNWSAlerts(null)).toEqual([])
    expect(parseNWSAlerts({ features: [] })).toEqual([])
  })

  it('handles MultiPolygon geometry', () => {
    const json = {
      features: [{
        properties: {
          id: 'mp-1',
          headline: 'Flood Warning',
          event: 'Flood Warning',
          onset: '2024-06-01T00:00:00Z',
        },
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [[[-90, 30], [-89, 30], [-89, 31], [-90, 31], [-90, 30]]],
          ],
        },
      }],
    }
    const events = parseNWSAlerts(json)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('flood')
    expect(events[0].geometry!.type).toBe('MultiPolygon')
  })

  it('classifies NWS event types correctly', () => {
    const make = (event: string) => ({
      features: [{
        properties: { id: 'x', event, onset: '2024-01-01T00:00:00Z' },
        geometry: { type: 'Polygon' as const, coordinates: [[[-90, 30], [-89, 30], [-89, 31], [-90, 30]]] },
      }],
    })

    expect(parseNWSAlerts(make('Flood Advisory'))[0].type).toBe('flood')
    expect(parseNWSAlerts(make('Flash Flood Warning'))[0].type).toBe('flood')
    expect(parseNWSAlerts(make('Severe Thunderstorm Warning'))[0].type).toBe('storm')
    expect(parseNWSAlerts(make('Hurricane Warning'))[0].type).toBe('storm')
    expect(parseNWSAlerts(make('Red Flag Warning'))[0].type).toBe('wildfire')
    expect(parseNWSAlerts(make('Winter Storm Warning'))[0].type).toBe('iceberg')
    expect(parseNWSAlerts(make('Excessive Heat Warning'))[0].type).toBe('drought')
    expect(parseNWSAlerts(make('Special Weather Statement'))[0].type).toBe('alert')
  })
})
