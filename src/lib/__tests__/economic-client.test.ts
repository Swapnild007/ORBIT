import { describe, it, expect } from 'vitest'
import { parseWorldBankData } from '../economic-client'

describe('parseWorldBankData', () => {
  it('parses valid World Bank response', () => {
    const result = parseWorldBankData(
      [
        { page: 1, pages: 1, total: 2 },
        [
          { country: { id: 'US', value: 'United States' }, date: '2023', value: 25462700000000 },
          { country: { id: 'CN', value: 'China' }, date: '2023', value: 17963200000000 },
        ],
      ],
      'NY.GDP.MKTP.CD',
      'GDP (current US$)',
    )

    expect(result).toHaveLength(2)
    expect(result[0].countryCode).toBe('US')
    expect(result[0].country).toBe('United States')
    expect(result[0].value).toBe(25462700000000)
    expect(result[0].year).toBe(2023)
    expect(result[0].indicatorId).toBe('NY.GDP.MKTP.CD')
    expect(result[0].lat).toBeCloseTo(37.09, 1)
  })

  it('skips countries not in centroid lookup', () => {
    const result = parseWorldBankData(
      [
        {},
        [
          { country: { id: 'ZZ', value: 'Unknown' }, date: '2023', value: 100 },
        ],
      ],
      'TEST',
      'Test',
    )
    expect(result).toEqual([])
  })

  it('skips entries with null value', () => {
    const result = parseWorldBankData(
      [
        {},
        [
          { country: { id: 'US', value: 'United States' }, date: '2023', value: null },
        ],
      ],
      'TEST',
      'Test',
    )
    expect(result).toEqual([])
  })

  it('returns empty for invalid format', () => {
    expect(parseWorldBankData({}, 'X', 'X')).toEqual([])
    expect(parseWorldBankData(null, 'X', 'X')).toEqual([])
    expect(parseWorldBankData([{}, 'not-array'], 'X', 'X')).toEqual([])
  })
})
