import { describe, it, expect } from 'vitest'
import { parseWindyCameras, parseCameraList } from '../camera-client'

describe('parseWindyCameras', () => {
  it('parses valid Windy webcam data', () => {
    const result = parseWindyCameras({
      webcams: [
        {
          id: 'abc123',
          title: 'City Center Cam',
          location: { latitude: 48.86, longitude: 2.35, city: 'Paris', country: 'France' },
          image: { current: { preview: 'https://img.windy.com/preview.jpg' } },
          player: { day: { embed: 'https://windy.com/player/abc123' } },
          lastUpdatedOn: '2024-01-15T10:00:00Z',
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('cam-abc123')
    expect(result[0].title).toBe('City Center Cam')
    expect(result[0].lat).toBe(48.86)
    expect(result[0].lon).toBe(2.35)
    expect(result[0].city).toBe('Paris')
    expect(result[0].thumbnail).toBe('https://img.windy.com/preview.jpg')
    expect(result[0].playerUrl).toBe('https://windy.com/player/abc123')
  })

  it('filters webcams without location', () => {
    const result = parseWindyCameras({
      webcams: [
        { id: '1', title: 'No Location', location: {} },
      ],
    })
    expect(result).toEqual([])
  })

  it('returns empty for missing webcams', () => {
    expect(parseWindyCameras({})).toEqual([])
    expect(parseWindyCameras(null)).toEqual([])
  })

  it('handles missing optional fields', () => {
    const result = parseWindyCameras({
      webcams: [
        { id: '1', location: { latitude: 10, longitude: 20 } },
      ],
    })
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Unknown Camera')
    expect(result[0].thumbnail).toBe('')
    expect(result[0].playerUrl).toBeNull()
  })
})

describe('parseCameraList', () => {
  it('parses generic camera array', () => {
    const result = parseCameraList([
      { id: 'cam1', name: 'Traffic Cam', lat: 40.7, lon: -74.0, thumbnail: 'https://img.com/1.jpg', city: 'New York', country: 'US' },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Traffic Cam')
    expect(result[0].lat).toBe(40.7)
  })

  it('handles alternate coordinate keys', () => {
    const result = parseCameraList([
      { name: 'Cam', latitude: 51.5, longitude: -0.1 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].lat).toBe(51.5)
  })

  it('filters entries without coordinates', () => {
    const result = parseCameraList([{ name: 'No Pos' }])
    expect(result).toEqual([])
  })

  it('returns empty for non-array', () => {
    expect(parseCameraList({})).toEqual([])
    expect(parseCameraList(null)).toEqual([])
  })
})
