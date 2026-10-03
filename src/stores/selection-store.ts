import { create } from 'zustand'

const CLEAR = {
  selectedSatId: null,
  selectedMmsi: null,
  selectedIcao: null,
  selectedEventId: null,
  selectedNewsId: null,
  selectedConflictId: null,
  selectedCyberId: null,
  selectedRFId: null,
  selectedCameraId: null,
}

interface SelectionState {
  selectedSatId: number | null
  selectedMmsi: number | null
  selectedIcao: string | null
  selectedEventId: string | null
  selectedNewsId: string | null
  selectedConflictId: string | null
  selectedCyberId: string | null
  selectedRFId: string | null
  selectedCameraId: string | null
  selectSatellite: (id: number | null) => void
  selectVessel: (mmsi: number | null) => void
  selectFlight: (icao: string | null) => void
  selectEvent: (id: string | null) => void
  selectNews: (id: string | null) => void
  selectConflict: (id: string | null) => void
  selectCyber: (id: string | null) => void
  selectRF: (id: string | null) => void
  selectCamera: (id: string | null) => void
  clearAll: () => void
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  ...CLEAR,

  selectSatellite: (id) => set(id !== null ? { ...CLEAR, selectedSatId: id } : { selectedSatId: null }),
  selectVessel: (mmsi) => set(mmsi !== null ? { ...CLEAR, selectedMmsi: mmsi } : { selectedMmsi: null }),
  selectFlight: (icao) => set(icao !== null ? { ...CLEAR, selectedIcao: icao } : { selectedIcao: null }),
  selectEvent: (id) => set(id !== null ? { ...CLEAR, selectedEventId: id } : { selectedEventId: null }),
  selectNews: (id) => set(id !== null ? { ...CLEAR, selectedNewsId: id } : { selectedNewsId: null }),
  selectConflict: (id) => set(id !== null ? { ...CLEAR, selectedConflictId: id } : { selectedConflictId: null }),
  selectCyber: (id) => set(id !== null ? { ...CLEAR, selectedCyberId: id } : { selectedCyberId: null }),
  selectRF: (id) => set(id !== null ? { ...CLEAR, selectedRFId: id } : { selectedRFId: null }),
  selectCamera: (id) => set(id !== null ? { ...CLEAR, selectedCameraId: id } : { selectedCameraId: null }),
  clearAll: () => set(CLEAR),
}))
