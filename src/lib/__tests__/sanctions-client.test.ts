import { describe, it, expect } from 'vitest'
import { parseSanctionResults } from '../sanctions-client'

describe('parseSanctionResults', () => {
  it('parses high-score results', () => {
    const result = parseSanctionResults({
      results: [
        {
          id: 'Q123',
          caption: 'Bad Actor Inc',
          schema: 'Company',
          datasets: ['us_ofac_sdn', 'eu_sanctions'],
          properties: { country: ['RU', 'BY'] },
          score: 0.95,
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Bad Actor Inc')
    expect(result[0].schema).toBe('Company')
    expect(result[0].datasets).toEqual(['us_ofac_sdn', 'eu_sanctions'])
    expect(result[0].countries).toEqual(['RU', 'BY'])
    expect(result[0].score).toBe(0.95)
  })

  it('filters low-score results (< 0.7)', () => {
    const result = parseSanctionResults({
      results: [
        { id: '1', caption: 'Low Match', score: 0.5 },
        { id: '2', caption: 'High Match', score: 0.8 },
      ],
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('High Match')
  })

  it('returns empty for non-array results', () => {
    expect(parseSanctionResults({})).toEqual([])
    expect(parseSanctionResults(null)).toEqual([])
    expect(parseSanctionResults({ results: 'not-array' })).toEqual([])
  })

  it('handles missing optional fields', () => {
    const result = parseSanctionResults({
      results: [{ score: 0.9 }],
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Unknown')
    expect(result[0].schema).toBe('Thing')
    expect(result[0].datasets).toEqual([])
    expect(result[0].countries).toEqual([])
  })
})
