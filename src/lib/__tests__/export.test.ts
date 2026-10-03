import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportCSV, exportGeoJSON, exportJSON } from '../export'

// Mock DOM APIs
const mockClick = vi.fn()
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
const mockRevokeObjectURL = vi.fn()

beforeEach(() => {
  mockClick.mockClear()
  mockCreateObjectURL.mockClear()
  mockRevokeObjectURL.mockClear()

  vi.stubGlobal('URL', {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  })

  vi.spyOn(document, 'createElement').mockReturnValue({
    href: '',
    download: '',
    click: mockClick,
  } as unknown as HTMLAnchorElement)
})

const SAMPLE_ENTITIES = [
  { id: 'sat-1', domain: 'satellite', name: 'ISS', lat: 51.5, lon: -0.1, speed: 7660, magnitude: null, lastUpdate: 1705300000000 },
  { id: 'ves-1', domain: 'vessel', name: 'Ever Given', lat: 30.0, lon: 32.5, speed: 12, magnitude: null, lastUpdate: 1705300000000 },
]

describe('exportCSV', () => {
  it('generates CSV with header and rows', () => {
    exportCSV(SAMPLE_ENTITIES)

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
    expect(mockClick).toHaveBeenCalledTimes(1)
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1)

    const blob = (mockCreateObjectURL.mock.calls as unknown[][])[0][0] as Blob
    expect(blob.type).toBe('text/csv')
  })

  it('uses custom filename', () => {
    const mockAnchor = { href: '', download: '', click: vi.fn() }
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLAnchorElement)

    exportCSV(SAMPLE_ENTITIES, 'custom.csv')

    expect(mockAnchor.download).toBe('custom.csv')
  })

  it('handles empty array', () => {
    exportCSV([])
    expect(mockClick).toHaveBeenCalledTimes(1)
  })
})

describe('exportGeoJSON', () => {
  it('generates valid GeoJSON FeatureCollection', () => {
    exportGeoJSON(SAMPLE_ENTITIES)

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
    expect(mockClick).toHaveBeenCalledTimes(1)

    const blob = (mockCreateObjectURL.mock.calls as unknown[][])[0][0] as Blob
    expect(blob.type).toBe('application/geo+json')
  })
})

describe('exportJSON', () => {
  it('exports arbitrary data as JSON', () => {
    exportJSON({ test: true })

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
    expect(mockClick).toHaveBeenCalledTimes(1)

    const blob = (mockCreateObjectURL.mock.calls as unknown[][])[0][0] as Blob
    expect(blob.type).toBe('application/json')
  })
})
