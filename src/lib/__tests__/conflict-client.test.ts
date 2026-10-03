import { describe, it, expect } from 'vitest'
import { parseACLEDEvents, parseUCDPEvents } from '../conflict-client'

describe('parseACLEDEvents', () => {
  it('parses valid ACLED data', () => {
    const result = parseACLEDEvents({
      data: [
        {
          data_id: 123,
          event_date: '2024-01-10',
          event_type: 'Battles',
          sub_event_type: 'Armed clash',
          actor1: 'Military',
          actor2: 'Rebels',
          fatalities: 5,
          latitude: 15.5,
          longitude: 32.5,
          notes: 'Clash near border',
          source: 'Local media',
          country: 'Sudan',
          admin1: 'Khartoum',
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('acled-123')
    expect(result[0].type).toBe('battle')
    expect(result[0].fatalities).toBe(5)
    expect(result[0].actors).toEqual(['Military', 'Rebels'])
    expect(result[0].source).toBe('acled')
  })

  it('maps event types correctly', () => {
    const types: Array<[string, string]> = [
      ['Battles', 'battle'],
      ['Protests', 'protest'],
      ['Riots', 'riot'],
      ['Explosions/Remote violence', 'explosion'],
      ['Violence against civilians', 'violence'],
      ['Strategic developments', 'strategic'],
    ]
    for (const [input, expected] of types) {
      const result = parseACLEDEvents({
        data: [{
          data_id: 1, event_date: '2024-01-01', event_type: input, sub_event_type: '',
          actor1: '', actor2: '', fatalities: 0, latitude: 0, longitude: 0,
          notes: '', source: '', country: 'X', admin1: '',
        }],
      })
      expect(result[0].type).toBe(expected)
    }
  })

  it('returns empty array for missing data', () => {
    expect(parseACLEDEvents({})).toEqual([])
    expect(parseACLEDEvents({ data: [] })).toEqual([])
  })

  it('filters empty actors', () => {
    const result = parseACLEDEvents({
      data: [{
        data_id: 1, event_date: '2024-01-01', event_type: 'Battles', sub_event_type: '',
        actor1: 'Group A', actor2: '', fatalities: 0, latitude: 0, longitude: 0,
        notes: '', source: '', country: 'X', admin1: '',
      }],
    })
    expect(result[0].actors).toEqual(['Group A'])
  })
})

describe('parseUCDPEvents', () => {
  it('parses valid UCDP data', () => {
    const result = parseUCDPEvents({
      Result: [
        {
          id: 456,
          date_start: '2024-02-01',
          type_of_violence: 1,
          where_description: 'Northern region',
          best: 12,
          latitude: 48.5,
          longitude: 37.5,
          side_a: 'Government',
          side_b: 'Opposition',
          source_article: 'Reuters report',
          dyad_name: 'Gov vs Opp',
          country: 'Ukraine',
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ucdp-456')
    expect(result[0].type).toBe('battle')
    expect(result[0].fatalities).toBe(12)
    expect(result[0].source).toBe('ucdp')
  })

  it('maps violence types', () => {
    const cases: Array<[number, string]> = [
      [1, 'battle'],
      [2, 'violence'],
      [3, 'violence'],
      [99, 'violence'],
    ]
    for (const [input, expected] of cases) {
      const result = parseUCDPEvents({
        Result: [{
          id: 1, date_start: '2024-01-01', type_of_violence: input,
          where_description: '', best: 0, latitude: 0, longitude: 0,
          side_a: '', side_b: '', source_article: '', dyad_name: '', country: '',
        }],
      })
      expect(result[0].type).toBe(expected)
    }
  })

  it('returns empty array for missing Result', () => {
    expect(parseUCDPEvents({})).toEqual([])
    expect(parseUCDPEvents({ Result: [] })).toEqual([])
  })
})
