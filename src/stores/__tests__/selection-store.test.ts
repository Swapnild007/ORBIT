import { describe, it, expect, beforeEach } from 'vitest'
import { useSelectionStore } from '../selection-store'

describe('selection-store', () => {
  beforeEach(() => {
    useSelectionStore.setState({
      selectedSatId: null,
      selectedMmsi: null,
      selectedIcao: null,
      selectedEventId: null,
    })
  })

  it('starts with nothing selected', () => {
    const state = useSelectionStore.getState()
    expect(state.selectedSatId).toBeNull()
    expect(state.selectedMmsi).toBeNull()
    expect(state.selectedIcao).toBeNull()
    expect(state.selectedEventId).toBeNull()
  })

  it('selecting satellite clears vessel and flight', () => {
    const { selectVessel } = useSelectionStore.getState()
    selectVessel(123456789)
    useSelectionStore.getState().selectSatellite(25544)

    const state = useSelectionStore.getState()
    expect(state.selectedSatId).toBe(25544)
    expect(state.selectedMmsi).toBeNull()
    expect(state.selectedIcao).toBeNull()
  })

  it('selecting vessel clears satellite and flight', () => {
    useSelectionStore.getState().selectSatellite(25544)
    useSelectionStore.getState().selectVessel(123456789)

    const state = useSelectionStore.getState()
    expect(state.selectedSatId).toBeNull()
    expect(state.selectedMmsi).toBe(123456789)
    expect(state.selectedIcao).toBeNull()
  })

  it('selecting flight clears satellite and vessel', () => {
    useSelectionStore.getState().selectSatellite(25544)
    useSelectionStore.getState().selectFlight('abc123')

    const state = useSelectionStore.getState()
    expect(state.selectedSatId).toBeNull()
    expect(state.selectedMmsi).toBeNull()
    expect(state.selectedIcao).toBe('abc123')
  })

  it('deselecting satellite only clears satellite', () => {
    useSelectionStore.getState().selectSatellite(25544)
    useSelectionStore.getState().selectSatellite(null)

    const state = useSelectionStore.getState()
    expect(state.selectedSatId).toBeNull()
  })

  it('deselecting vessel only clears vessel', () => {
    useSelectionStore.getState().selectVessel(123)
    useSelectionStore.getState().selectVessel(null)

    expect(useSelectionStore.getState().selectedMmsi).toBeNull()
  })

  it('deselecting flight only clears flight', () => {
    useSelectionStore.getState().selectFlight('abc')
    useSelectionStore.getState().selectFlight(null)

    expect(useSelectionStore.getState().selectedIcao).toBeNull()
  })

  it('selecting event clears satellite, vessel, and flight', () => {
    useSelectionStore.getState().selectSatellite(25544)
    useSelectionStore.getState().selectEvent('usgs-test-1')

    const state = useSelectionStore.getState()
    expect(state.selectedSatId).toBeNull()
    expect(state.selectedMmsi).toBeNull()
    expect(state.selectedIcao).toBeNull()
    expect(state.selectedEventId).toBe('usgs-test-1')
  })

  it('selecting satellite clears event', () => {
    useSelectionStore.getState().selectEvent('usgs-test-1')
    useSelectionStore.getState().selectSatellite(25544)

    expect(useSelectionStore.getState().selectedEventId).toBeNull()
    expect(useSelectionStore.getState().selectedSatId).toBe(25544)
  })

  it('deselecting event only clears event', () => {
    useSelectionStore.getState().selectEvent('usgs-test-1')
    useSelectionStore.getState().selectEvent(null)

    expect(useSelectionStore.getState().selectedEventId).toBeNull()
  })

  it('clearAll clears everything', () => {
    useSelectionStore.getState().selectEvent('test')
    useSelectionStore.getState().clearAll()

    const state = useSelectionStore.getState()
    expect(state.selectedSatId).toBeNull()
    expect(state.selectedMmsi).toBeNull()
    expect(state.selectedIcao).toBeNull()
    expect(state.selectedEventId).toBeNull()
  })
})
