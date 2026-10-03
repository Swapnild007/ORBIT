/**
 * Export utilities — entity data as CSV, GeoJSON, or JSON.
 */

interface ExportEntity {
  id: string
  domain: string
  name: string
  lat: number
  lon: number
  speed: number | null
  magnitude: number | null
  lastUpdate: number
}

export function exportCSV(entities: ExportEntity[], filename = 'eagle-eye-export.csv') {
  const header = 'id,domain,name,lat,lon,speed,magnitude,lastUpdate'
  const rows = entities.map(e =>
    `"${e.id}","${e.domain}","${e.name.replace(/"/g, '""')}",${e.lat},${e.lon},${e.speed ?? ''},${e.magnitude ?? ''},${new Date(e.lastUpdate).toISOString()}`
  )
  const csv = [header, ...rows].join('\n')
  download(csv, filename, 'text/csv')
}

export function exportGeoJSON(entities: ExportEntity[], filename = 'eagle-eye-export.geojson') {
  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: entities.map(e => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
      properties: {
        id: e.id,
        domain: e.domain,
        name: e.name,
        speed: e.speed,
        magnitude: e.magnitude,
        lastUpdate: new Date(e.lastUpdate).toISOString(),
      },
    })),
  }
  download(JSON.stringify(geojson, null, 2), filename, 'application/geo+json')
}

export function exportJSON(data: unknown, filename = 'eagle-eye-export.json') {
  download(JSON.stringify(data, null, 2), filename, 'application/json')
}

function download(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
