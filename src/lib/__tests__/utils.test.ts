import { describe, it, expect } from 'vitest'
import { utcTimeString, utcDateString, elapsedString, cn } from '../utils'

describe('utcTimeString', () => {
  it('formats midnight', () => {
    expect(utcTimeString(new Date('2026-01-01T00:00:00Z'))).toBe('00:00:00Z')
  })

  it('formats noon', () => {
    expect(utcTimeString(new Date('2026-06-15T12:00:00Z'))).toBe('12:00:00Z')
  })

  it('pads single-digit values', () => {
    expect(utcTimeString(new Date('2026-01-01T03:05:09Z'))).toBe('03:05:09Z')
  })

  it('handles end of day', () => {
    expect(utcTimeString(new Date('2026-01-01T23:59:59Z'))).toBe('23:59:59Z')
  })
})

describe('utcDateString', () => {
  it('formats January 1st', () => {
    expect(utcDateString(new Date('2026-01-01T00:00:00Z'))).toBe('01 JAN 2026')
  })

  it('formats December 31st', () => {
    expect(utcDateString(new Date('2026-12-31T00:00:00Z'))).toBe('31 DEC 2026')
  })

  it('pads single-digit day', () => {
    expect(utcDateString(new Date('2026-03-05T00:00:00Z'))).toBe('05 MAR 2026')
  })

  it('handles all months', () => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    for (let i = 0; i < 12; i++) {
      const date = new Date(Date.UTC(2026, i, 15))
      expect(utcDateString(date)).toContain(months[i])
    }
  })
})

describe('elapsedString', () => {
  it('formats zero', () => {
    expect(elapsedString(0)).toBe('00:00:00')
  })

  it('formats one hour one minute one second', () => {
    expect(elapsedString(3661000)).toBe('01:01:01')
  })

  it('formats seconds only', () => {
    expect(elapsedString(45000)).toBe('00:00:45')
  })

  it('formats large values', () => {
    expect(elapsedString(86400000)).toBe('24:00:00')
  })

  it('rounds down partial seconds', () => {
    expect(elapsedString(1500)).toBe('00:00:01')
  })
})

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('resolves tailwind conflicts', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'end')).toBe('base end')
  })
})
