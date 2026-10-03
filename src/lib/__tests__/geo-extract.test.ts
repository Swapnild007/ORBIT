import { describe, it, expect } from 'vitest'
import { extractLocations } from '../geo-extract'

describe('extractLocations', () => {
  it('extracts country names', () => {
    const result = extractLocations('Tensions rise in Ukraine as Russia mobilizes forces')
    expect(result).toHaveLength(2)
    const names = result.map(r => r.name)
    expect(names).toContain('ukraine')
    expect(names).toContain('russia')
  })

  it('extracts city names', () => {
    const result = extractLocations('Protests erupt in Kyiv and Moscow')
    const names = result.map(r => r.name)
    expect(names).toContain('kyiv')
    expect(names).toContain('moscow')
  })

  it('returns lat/lon coordinates', () => {
    const result = extractLocations('Breaking news from Tokyo')
    expect(result).toHaveLength(1)
    expect(result[0].lat).toBeCloseTo(35.68, 1)
    expect(result[0].lon).toBeCloseTo(139.69, 1)
  })

  it('handles case insensitivity', () => {
    const result = extractLocations('CHINA and JAPAN sign trade deal')
    const names = result.map(r => r.name)
    expect(names).toContain('china')
    expect(names).toContain('japan')
  })

  it('returns empty for no matches', () => {
    expect(extractLocations('The quick brown fox jumps')).toEqual([])
    expect(extractLocations('')).toEqual([])
  })

  it('handles multi-word locations', () => {
    const result = extractLocations('Flights diverted from New York to Los Angeles')
    const names = result.map(r => r.name)
    expect(names).toContain('new york')
    expect(names).toContain('los angeles')
  })

  it('does not duplicate matches', () => {
    const result = extractLocations('Ukraine Ukraine Ukraine')
    expect(result).toHaveLength(1)
  })

  it('matches abbreviations', () => {
    const r1 = extractLocations('The UK announced new policy')
    expect(r1.map(r => r.name)).toContain('uk')

    const r2 = extractLocations('The US deployed forces')
    expect(r2.map(r => r.name)).toContain('us')
  })
})
