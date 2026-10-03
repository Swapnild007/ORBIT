import { describe, it, expect } from 'vitest'
import { VESSEL_TYPE_COLORS, VESSEL_TYPE_DOT_COLORS, FLIGHT_TYPE_COLORS, FLIGHT_TYPE_DOT_COLORS, WEATHER_TYPE_COLORS, WEATHER_TYPE_DOT_COLORS } from '../colors'
import { VESSEL_TYPES, FLIGHT_TYPES, WEATHER_EVENT_TYPES } from '@/types'

describe('color constants completeness', () => {
  it('has a badge color for every vessel type', () => {
    for (const type of VESSEL_TYPES) {
      expect(VESSEL_TYPE_COLORS[type], `missing badge color for vessel type "${type}"`).toBeDefined()
    }
  })

  it('has a dot color for every vessel type', () => {
    for (const type of VESSEL_TYPES) {
      expect(VESSEL_TYPE_DOT_COLORS[type], `missing dot color for vessel type "${type}"`).toBeDefined()
    }
  })

  it('has a badge color for every flight type', () => {
    for (const type of FLIGHT_TYPES) {
      expect(FLIGHT_TYPE_COLORS[type], `missing badge color for flight type "${type}"`).toBeDefined()
    }
  })

  it('has a dot color for every flight type', () => {
    for (const type of FLIGHT_TYPES) {
      expect(FLIGHT_TYPE_DOT_COLORS[type], `missing dot color for flight type "${type}"`).toBeDefined()
    }
  })

  it('has a badge color for every weather event type', () => {
    for (const type of WEATHER_EVENT_TYPES) {
      expect(WEATHER_TYPE_COLORS[type], `missing badge color for weather type "${type}"`).toBeDefined()
    }
  })

  it('has a dot color for every weather event type', () => {
    for (const type of WEATHER_EVENT_TYPES) {
      expect(WEATHER_TYPE_DOT_COLORS[type], `missing dot color for weather type "${type}"`).toBeDefined()
    }
  })

  it('dot colors are valid hex strings', () => {
    for (const color of Object.values(VESSEL_TYPE_DOT_COLORS)) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
    for (const color of Object.values(FLIGHT_TYPE_DOT_COLORS)) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
    for (const color of Object.values(WEATHER_TYPE_DOT_COLORS)) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})
