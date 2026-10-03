import { describe, it, expect } from 'vitest'
import { twoline2satrec } from 'satellite.js'
import { propagateBatch, displayRadius } from '../propagation-kernel'

// ISS TLE (epoch doesn't matter much for testing structure)
const ISS_TLE1 = '1 25544U 98067A   24045.53960880  .00020516  00000+0  36306-3 0  9995'
const ISS_TLE2 = '2 25544  51.6413 215.4478 0004756  51.9498  20.9518 15.50073240440140'

describe('displayRadius', () => {
  it('returns base value for ground level', () => {
    expect(displayRadius(0)).toBeCloseTo(1.015, 3)
  })

  it('increases with altitude', () => {
    const low = displayRadius(400)
    const high = displayRadius(35786)
    expect(low).toBeGreaterThan(1.015)
    expect(high).toBeGreaterThan(low)
  })

  it('clamps negative altitude to zero', () => {
    expect(displayRadius(-100)).toBeCloseTo(1.015, 3)
  })

  it('increases monotonically', () => {
    let prev = displayRadius(0)
    for (const alt of [100, 400, 1000, 20000, 35786]) {
      const cur = displayRadius(alt)
      expect(cur).toBeGreaterThan(prev)
      prev = cur
    }
  })
})

describe('propagateBatch', () => {
  it('returns empty array for empty input', () => {
    expect(propagateBatch([], new Date())).toEqual([])
  })

  it('propagates valid ISS TLE', () => {
    const satrec = twoline2satrec(ISS_TLE1, ISS_TLE2)
    const results = propagateBatch(
      [{ noradId: 25544, satrec }],
      new Date('2024-02-14T12:00:00Z'),
    )
    expect(results).toHaveLength(1)
    const pos = results[0]
    expect(pos.noradId).toBe(25544)
    expect(pos.lat).toBeGreaterThanOrEqual(-90)
    expect(pos.lat).toBeLessThanOrEqual(90)
    expect(pos.lon).toBeGreaterThanOrEqual(-180)
    expect(pos.lon).toBeLessThanOrEqual(180)
    expect(pos.alt).toBeGreaterThan(0)
    expect(pos.velocity).toBeGreaterThan(0)
  })

  it('does not crash on invalid satrec', () => {
    const badSatrec = { error: 1 } as unknown as Parameters<typeof propagateBatch>[0][0]['satrec']
    // Should not throw — either skips or returns NaN values
    expect(() => propagateBatch(
      [{ noradId: 99999, satrec: badSatrec }],
      new Date(),
    )).not.toThrow()
  })

  it('processes multiple entries', () => {
    const satrec = twoline2satrec(ISS_TLE1, ISS_TLE2)
    const results = propagateBatch(
      [
        { noradId: 25544, satrec },
        { noradId: 25545, satrec },
      ],
      new Date('2024-02-14T12:00:00Z'),
    )
    expect(results).toHaveLength(2)
  })
})
