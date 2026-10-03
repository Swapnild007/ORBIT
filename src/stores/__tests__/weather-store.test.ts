import { describe, it, expect, beforeEach } from 'vitest'
import { useWeatherStore } from '../weather-store'
import type { WeatherEvent } from '@/types'

function makeEvent(overrides: Partial<WeatherEvent> = {}): WeatherEvent {
  return {
    id: 'test-1',
    type: 'earthquake',
    title: 'Test Earthquake',
    description: 'A test event',
    lat: 34.0,
    lon: -118.5,
    magnitude: 4.5,
    geometry: null,
    source: 'usgs',
    time: Date.now(),
    expires: null,
    lastUpdate: Date.now(),
    ...overrides,
  }
}

describe('weather-store', () => {
  beforeEach(() => {
    useWeatherStore.setState({
      events: new Map(),
      version: 0,
      count: 0,
      lastFetch: null,
    })
  })

  it('starts with empty events', () => {
    const state = useWeatherStore.getState()
    expect(state.events.size).toBe(0)
    expect(state.count).toBe(0)
  })

  it('updates events and increments version', () => {
    const event = makeEvent()
    const map = new Map<string, WeatherEvent>()
    map.set(event.id, event)

    useWeatherStore.setState(s => ({
      events: map,
      count: map.size,
      version: s.version + 1,
      lastFetch: Date.now(),
    }))

    const state = useWeatherStore.getState()
    expect(state.events.size).toBe(1)
    expect(state.count).toBe(1)
    expect(state.version).toBe(1)
    expect(state.lastFetch).not.toBeNull()
  })

  describe('type toggles', () => {
    it('starts with all types enabled', () => {
      const { typeToggles } = useWeatherStore.getState()
      for (const [, on] of typeToggles) {
        expect(on).toBe(true)
      }
    })

    it('toggleType flips a single type', () => {
      useWeatherStore.getState().toggleType('earthquake')
      expect(useWeatherStore.getState().typeToggles.get('earthquake')).toBe(false)

      useWeatherStore.getState().toggleType('earthquake')
      expect(useWeatherStore.getState().typeToggles.get('earthquake')).toBe(true)
    })

    it('disableAllTypes sets all to false', () => {
      useWeatherStore.getState().disableAllTypes()
      const { typeToggles } = useWeatherStore.getState()
      for (const [, on] of typeToggles) {
        expect(on).toBe(false)
      }
    })

    it('enableAllTypes sets all to true', () => {
      useWeatherStore.getState().disableAllTypes()
      useWeatherStore.getState().enableAllTypes()
      const { typeToggles } = useWeatherStore.getState()
      for (const [, on] of typeToggles) {
        expect(on).toBe(true)
      }
    })
  })
})
