import { describe, it, expect } from 'vitest'
import { parseGdeltArticles, parseGdeltGeo } from '../news-client'

describe('parseGdeltArticles', () => {
  it('parses valid articles', () => {
    const result = parseGdeltArticles({
      articles: [
        {
          url: 'https://example.com/1',
          title: 'Military attack in Syria',
          seendate: '2024-01-15T10:00:00Z',
          domain: 'example.com',
          tone: -3.5,
          socialimage: 'https://img.example.com/1.jpg',
          themes: ['WAR', 'MILITARY'],
        },
        {
          url: 'https://example.com/2',
          title: 'Stock market rally',
          seendate: '2024-01-15T11:00:00Z',
          domain: 'finance.com',
          tone: 5.2,
        },
      ],
    })

    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('Military attack in Syria')
    expect(result[0].category).toBe('conflict')
    expect(result[0].source).toBe('example.com')
    expect(result[0].tone).toBe(-3.5)
    expect(result[0].imageUrl).toBe('https://img.example.com/1.jpg')
    expect(result[1].category).toBe('economy')
    expect(result[1].tone).toBe(5.2)
  })

  it('returns empty array when no articles', () => {
    expect(parseGdeltArticles({})).toEqual([])
    expect(parseGdeltArticles({ articles: [] })).toEqual([])
  })

  it('handles missing fields gracefully', () => {
    const result = parseGdeltArticles({
      articles: [{ url: '', title: '', seendate: '' }],
    })
    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('other')
    expect(result[0].imageUrl).toBeNull()
  })

  it('classifies categories correctly', () => {
    const cases: Array<[string, string]> = [
      ['Earthquake hits region', 'disaster'],
      ['Parliament vote results announced', 'politics'],
      ['AI breakthrough in silicon valley', 'technology'],
      ['Virus outbreak reported', 'health'],
      ['Climate change deforestation', 'environment'],
    ]
    for (const [title, expected] of cases) {
      const result = parseGdeltArticles({ articles: [{ url: '', title, seendate: '' }] })
      expect(result[0].category).toBe(expected)
    }
  })
})

describe('parseGdeltGeo', () => {
  it('parses valid GeoJSON features', () => {
    const result = parseGdeltGeo({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [35.5, 33.9] },
          properties: {
            name: 'Military clash in Beirut',
            tone: -4.2,
            count: 15,
            urllist: 'https://a.com<br/>https://b.com',
          },
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0].lat).toBe(33.9)
    expect(result[0].lon).toBe(35.5)
    expect(result[0].tone).toBe(-4.2)
    expect(result[0].articleCount).toBe(15)
    expect(result[0].url).toBe('https://a.com')
    expect(result[0].category).toBe('conflict')
  })

  it('returns empty array for missing features', () => {
    expect(parseGdeltGeo({ type: 'FeatureCollection', features: [] })).toEqual([])
    expect(parseGdeltGeo({ type: 'FeatureCollection' } as any)).toEqual([])
  })

  it('skips non-Point geometries', () => {
    const result = parseGdeltGeo({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: {} },
      ],
    })
    expect(result).toEqual([])
  })
})
