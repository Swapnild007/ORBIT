import { describe, it, expect } from 'vitest'
import { classifyFlight } from '../classify-flight'

describe('classifyFlight', () => {
  it('returns "other" for empty string', () => {
    expect(classifyFlight('')).toBe('other')
  })

  it('returns "other" for whitespace-only', () => {
    expect(classifyFlight('   ')).toBe('other')
  })

  describe('military', () => {
    it.each([
      'RCH123', 'EVAC01', 'DUKE42', 'KING01', 'JAKE99',
      'TOPCAT1', 'NAVY01', 'ARMY01', 'REACH01', 'VALOR1',
      'HAWK01', 'VIPER1', 'BOLT01', 'ROCK01', 'FORCE1',
    ])('classifies %s as military', (cs) => {
      expect(classifyFlight(cs)).toBe('military')
    })

    it('is case-insensitive', () => {
      expect(classifyFlight('rch123')).toBe('military')
    })
  })

  describe('cargo', () => {
    it.each([
      'FDX123', 'UPS456', 'GTI789', 'CLX001', 'ABW002',
      'CKS003', 'MPH004', 'BOX005', 'SQC006',
    ])('classifies %s as cargo', (cs) => {
      expect(classifyFlight(cs)).toBe('cargo')
    })
  })

  describe('helicopter', () => {
    it.each([
      'LIFE01', 'MEDEVAC1', 'HELI01', 'AIR101', 'MED01',
    ])('classifies %s as helicopter', (cs) => {
      expect(classifyFlight(cs)).toBe('helicopter')
    })
  })

  describe('private', () => {
    it('classifies N-numbers as private', () => {
      expect(classifyFlight('N12345')).toBe('private')
      expect(classifyFlight('N1')).toBe('private')
    })

    it('does not match N without digit', () => {
      expect(classifyFlight('NAVY01')).not.toBe('private')
    })
  })

  describe('commercial', () => {
    it('classifies 3-letter + digit as commercial', () => {
      expect(classifyFlight('UAL123')).toBe('commercial')
      expect(classifyFlight('DAL456')).toBe('commercial')
      expect(classifyFlight('BAW789')).toBe('commercial')
    })
  })

  describe('other', () => {
    it('returns other for unrecognized patterns', () => {
      expect(classifyFlight('UNKNOWN')).toBe('other')
      expect(classifyFlight('AB')).toBe('other')
    })
  })
})
