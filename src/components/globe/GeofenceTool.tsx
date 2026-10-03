import { useEffect, useState, useCallback, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { useGeofenceStore } from '@/stores/geofence-store'
import type { Geofence } from '@/lib/persistence'

interface GeofenceToolProps {
  map: mapboxgl.Map | null
}

const SOURCE_ID = 'geofence-zones'
const FILL_LAYER_ID = 'geofence-fill'
const OUTLINE_LAYER_ID = 'geofence-outline'
const LABEL_LAYER_ID = 'geofence-label'

function buildGeofenceGeoJSON(geofences: Geofence[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: geofences.map(gf => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [gf.west, gf.north],
          [gf.east, gf.north],
          [gf.east, gf.south],
          [gf.west, gf.south],
          [gf.west, gf.north],
        ]],
      },
      properties: { id: gf.id, name: gf.name },
    })),
  }
}

export function GeofenceTool({ map }: GeofenceToolProps) {
  const [drawing, setDrawing] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const startRef = useRef<{ lon: number; lat: number } | null>(null)
  const { geofences, addGeofence, removeGeofence, loadFromDB } = useGeofenceStore()

  // Load geofences from IndexedDB on mount
  useEffect(() => { loadFromDB() }, [loadFromDB])

  // Register map sources/layers for geofence visualization
  useEffect(() => {
    if (!map) return

    const addLayers = () => {
      if (map.getSource(SOURCE_ID)) return

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': '#f97316',
          'fill-opacity': 0.08,
        },
      })
      map.addLayer({
        id: OUTLINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': '#f97316',
          'line-width': 2,
          'line-dasharray': [4, 2],
          'line-opacity': 0.6,
        },
      })
      map.addLayer({
        id: LABEL_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-anchor': 'top',
          'text-offset': [0, 0.5],
        },
        paint: {
          'text-color': '#f97316',
          'text-halo-color': '#09090b',
          'text-halo-width': 1,
        },
      })
    }

    if (map.isStyleLoaded()) addLayers()
    map.on('style.load', addLayers)

    return () => {
      map.off('style.load', addLayers)
      try {
        if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID)
        if (map.getLayer(OUTLINE_LAYER_ID)) map.removeLayer(OUTLINE_LAYER_ID)
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch { /* map already destroyed */ }
    }
  }, [map])

  // Sync geofences to map
  useEffect(() => {
    if (!map) return
    const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(buildGeofenceGeoJSON(geofences))
  }, [map, geofences])

  // Drawing handlers
  useEffect(() => {
    if (!map || !drawing) return

    const onMouseDown = (e: mapboxgl.MapMouseEvent) => {
      e.preventDefault()
      startRef.current = { lon: e.lngLat.lng, lat: e.lngLat.lat }
      map.dragPan.disable()
    }

    const onMouseMove = (e: mapboxgl.MapMouseEvent) => {
      if (!startRef.current) return
      const s = startRef.current
      const preview: Geofence = {
        id: 'preview',
        name: 'New Zone',
        north: Math.max(s.lat, e.lngLat.lat),
        south: Math.min(s.lat, e.lngLat.lat),
        east: Math.max(s.lon, e.lngLat.lng),
        west: Math.min(s.lon, e.lngLat.lng),
        alertOnEnter: true,
        alertOnExit: false,
      }
      const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      if (src) src.setData(buildGeofenceGeoJSON([...geofences, preview]))
    }

    const onMouseUp = (e: mapboxgl.MapMouseEvent) => {
      map.dragPan.enable()
      if (!startRef.current) return
      const s = startRef.current
      startRef.current = null

      const north = Math.max(s.lat, e.lngLat.lat)
      const south = Math.min(s.lat, e.lngLat.lat)
      const east = Math.max(s.lon, e.lngLat.lng)
      const west = Math.min(s.lon, e.lngLat.lng)

      // Only create if area is meaningful (at least ~0.1 degree)
      if (Math.abs(north - south) < 0.05 || Math.abs(east - west) < 0.05) {
        const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
        if (src) src.setData(buildGeofenceGeoJSON(geofences))
        return
      }

      addGeofence({
        name: `Zone ${geofences.length + 1}`,
        north, south, east, west,
        alertOnEnter: true,
        alertOnExit: false,
      })
      setDrawing(false)
    }

    map.on('mousedown', onMouseDown)
    map.on('mousemove', onMouseMove)
    map.on('mouseup', onMouseUp)
    map.getCanvas().style.cursor = 'crosshair'

    return () => {
      map.off('mousedown', onMouseDown)
      map.off('mousemove', onMouseMove)
      map.off('mouseup', onMouseUp)
      map.getCanvas().style.cursor = ''
      map.dragPan.enable()
    }
  }, [map, drawing, geofences, addGeofence])

  const handleToggleDraw = useCallback(() => {
    setDrawing(!drawing)
    if (!drawing) setShowPanel(true)
  }, [drawing])

  return (
    <div className="absolute top-3 right-48 flex flex-col items-end gap-2">
      <div className="flex gap-1">
        <button
          onClick={handleToggleDraw}
          className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md border backdrop-blur-sm transition-colors ${
            drawing
              ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
              : 'bg-zinc-900/90 text-zinc-400 border-zinc-700 hover:text-zinc-200'
          }`}
        >
          {drawing ? 'Drawing...' : 'Geofence'}
        </button>
        {geofences.length > 0 && (
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="px-2 py-1.5 text-xs font-mono rounded-md border bg-zinc-900/90 text-zinc-400 border-zinc-700 hover:text-zinc-200 backdrop-blur-sm"
          >
            {geofences.length}
          </button>
        )}
      </div>

      {showPanel && geofences.length > 0 && (
        <div className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-md px-3 py-2 font-mono text-[11px] min-w-[200px] max-h-[200px] overflow-y-auto">
          <div className="text-zinc-500 mb-1.5 text-[10px] uppercase tracking-wider">Geofences</div>
          {geofences.map(gf => (
            <div key={gf.id} className="flex items-center justify-between py-1 border-b border-zinc-800/40">
              <span className="text-zinc-300 truncate flex-1">{gf.name}</span>
              <div className="flex gap-1.5 ml-2 flex-shrink-0">
                <span className="text-[9px] text-orange-400/60">
                  {gf.alertOnEnter ? 'ENT' : ''} {gf.alertOnExit ? 'EXT' : ''}
                </span>
                <button
                  onClick={() => removeGeofence(gf.id)}
                  className="text-zinc-600 hover:text-red-400 text-[10px]"
                >
                  x
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
