import { describe, it, expect } from 'vitest'
import { mapShipType } from '../ais-client'

describe('mapShipType', () => {
  it('maps cargo range (70-79)', () => {
    expect(mapShipType(70)).toBe('cargo')
    expect(mapShipType(75)).toBe('cargo')
    expect(mapShipType(79)).toBe('cargo')
  })

  it('maps tanker range (80-89)', () => {
    expect(mapShipType(80)).toBe('tanker')
    expect(mapShipType(85)).toBe('tanker')
    expect(mapShipType(89)).toBe('tanker')
  })

  it('maps passenger range (60-69)', () => {
    expect(mapShipType(60)).toBe('passenger')
    expect(mapShipType(65)).toBe('passenger')
    expect(mapShipType(69)).toBe('passenger')
  })

  it('maps fishing (30)', () => {
    expect(mapShipType(30)).toBe('fishing')
  })

  it('maps military (35)', () => {
    expect(mapShipType(35)).toBe('military')
  })

  it('maps tug (31-32)', () => {
    expect(mapShipType(31)).toBe('tug')
    expect(mapShipType(32)).toBe('tug')
  })

  it('maps pleasure (36-37)', () => {
    expect(mapShipType(36)).toBe('pleasure')
    expect(mapShipType(37)).toBe('pleasure')
  })

  it('maps boundary values to other', () => {
    expect(mapShipType(29)).toBe('other')
    expect(mapShipType(33)).toBe('other')
    expect(mapShipType(34)).toBe('other')
    expect(mapShipType(38)).toBe('other')
    expect(mapShipType(59)).toBe('other')
    expect(mapShipType(90)).toBe('other')
  })

  it('maps zero and unknown to other', () => {
    expect(mapShipType(0)).toBe('other')
    expect(mapShipType(999)).toBe('other')
  })
})
