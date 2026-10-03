import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PositionHistory } from '../position-history'

describe('PositionHistory', () => {
  let history: PositionHistory<string>

  beforeEach(() => {
    history = new PositionHistory()
    vi.spyOn(Date, 'now').mockReturnValue(1000)
  })

  it('returns empty trail for unknown key', () => {
    expect(history.getTrail('unknown')).toEqual([])
  })

  it('records first point', () => {
    history.record('a', 10, 20)
    const trail = history.getTrail('a')
    expect(trail).toHaveLength(1)
    expect(trail[0]).toEqual({ lon: 10, lat: 20, timestamp: 1000 })
  })

  it('skips points below MIN_DISTANCE_DEG threshold', () => {
    history.record('a', 10, 20)
    history.record('a', 10.0001, 20.0001) // < 0.0005° away
    expect(history.getTrail('a')).toHaveLength(1)
  })

  it('records points above MIN_DISTANCE_DEG threshold', () => {
    history.record('a', 10, 20)
    vi.spyOn(Date, 'now').mockReturnValue(2000)
    history.record('a', 10.001, 20.001) // > 0.0005° away
    expect(history.getTrail('a')).toHaveLength(2)
  })

  it('tracks multiple keys independently', () => {
    history.record('a', 10, 20)
    history.record('b', 30, 40)
    expect(history.getTrail('a')).toHaveLength(1)
    expect(history.getTrail('b')).toHaveLength(1)
    expect(history.getTrail('a')[0].lon).toBe(10)
    expect(history.getTrail('b')[0].lon).toBe(30)
  })

  it('works with numeric keys', () => {
    const numHistory = new PositionHistory<number>()
    numHistory.record(123, 10, 20)
    expect(numHistory.getTrail(123)).toHaveLength(1)
  })

  it('checks lat and lon independently for threshold', () => {
    history.record('a', 10, 20)
    // Move only in lon, but enough
    history.record('a', 10.001, 20)
    expect(history.getTrail('a')).toHaveLength(2)
  })
})
