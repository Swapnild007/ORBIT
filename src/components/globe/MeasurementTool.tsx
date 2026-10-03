import { useEffect, useState, useCallback, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { haversineDistance, initialBearing } from '@/lib/utils'

interface MeasurementToolProps {
  map: mapboxgl.Map | null
}

interface Waypoint {
  lon: number
  lat: number
}

const SOURCE_ID = 'measurement-line'
const LAYER_ID = 'measurement-line-layer'
const POINTS_SOURCE_ID = 'measurement-points'
const POINTS_LAYER_ID = 'measurement-points-layer'

function buildLineGeoJSON(waypoints: Waypoint[]): GeoJSON.FeatureCollection {
  if (waypoints.length < 2) return { type: 'FeatureCollection', features: [] }
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: waypoints.map(w => [w.lon, w.lat]),
      },
      properties: {},
    }],
  }
}

function buildPointsGeoJSON(waypoints: Waypoint[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: waypoints.map((w, i) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [w.lon, w.lat] },
      properties: { index: i },
    })),
  }
}

function computeTotals(waypoints: Waypoint[]) {
  let totalKm = 0
  let bearing = 0
  for (let i = 1; i < waypoints.length; i++) {
    totalKm += haversineDistance(waypoints[i - 1].lat, waypoints[i - 1].lon, waypoints[i].lat, waypoints[i].lon)
  }
  if (waypoints.length >= 2) {
    bearing = initialBearing(waypoints[0].lat, waypoints[0].lon, waypoints[waypoints.length - 1].lat, waypoints[waypoints.length - 1].lon)
  }
  const totalNm = totalKm * 0.539957
  return { totalKm, totalNm, bearing }
}

export function MeasurementTool({ map }: MeasurementToolProps) {
  const [active, setActive] = useState(false)
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const waypointsRef = useRef<Waypoint[]>([])

  // Keep ref in sync
  useEffect(() => { waypointsRef.current = waypoints }, [waypoints])

  // Add/remove map sources and layers
  useEffect(() => {
    if (!map || !active) return

    const addLayers = () => {
      if (map.getSource(SOURCE_ID)) return

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': '#f97316',
          'line-width': 2,
          'line-dasharray': [4, 2],
        },
      })

      map.addSource(POINTS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: POINTS_LAYER_ID,
        type: 'circle',
        source: POINTS_SOURCE_ID,
        paint: {
          'circle-radius': 5,
          'circle-color': '#f97316',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })
    }

    if (map.isStyleLoaded()) addLayers()
    map.on('style.load', addLayers)

    return () => {
      map.off('style.load', addLayers)
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getLayer(POINTS_LAYER_ID)) map.removeLayer(POINTS_LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      if (map.getSource(POINTS_SOURCE_ID)) map.removeSource(POINTS_SOURCE_ID)
    }
  }, [map, active])

  // Click handler for placing waypoints
  useEffect(() => {
    if (!map || !active) return

    const onClick = (e: mapboxgl.MapMouseEvent) => {
      e.originalEvent.stopPropagation()
      const newWaypoints = [...waypointsRef.current, { lon: e.lngLat.lng, lat: e.lngLat.lat }]
      setWaypoints(newWaypoints)

      const lineSrc = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      if (lineSrc) lineSrc.setData(buildLineGeoJSON(newWaypoints))

      const ptsSrc = map.getSource(POINTS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      if (ptsSrc) ptsSrc.setData(buildPointsGeoJSON(newWaypoints))
    }

    map.on('click', onClick)
    map.getCanvas().style.cursor = 'crosshair'

    return () => {
      map.off('click', onClick)
      map.getCanvas().style.cursor = ''
    }
  }, [map, active])

  const handleToggle = useCallback(() => {
    if (active) {
      // Deactivate — clear waypoints and layers
      setWaypoints([])
      if (map) {
        const lineSrc = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
        if (lineSrc) lineSrc.setData({ type: 'FeatureCollection', features: [] })
        const ptsSrc = map.getSource(POINTS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
        if (ptsSrc) ptsSrc.setData({ type: 'FeatureCollection', features: [] })
      }
    }
    setActive(!active)
  }, [active, map])

  const handleClear = useCallback(() => {
    setWaypoints([])
    if (map) {
      const lineSrc = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      if (lineSrc) lineSrc.setData({ type: 'FeatureCollection', features: [] })
      const ptsSrc = map.getSource(POINTS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      if (ptsSrc) ptsSrc.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [map])

  const handleUndo = useCallback(() => {
    const newWaypoints = waypointsRef.current.slice(0, -1)
    setWaypoints(newWaypoints)
    if (map) {
      const lineSrc = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      if (lineSrc) lineSrc.setData(buildLineGeoJSON(newWaypoints))
      const ptsSrc = map.getSource(POINTS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      if (ptsSrc) ptsSrc.setData(buildPointsGeoJSON(newWaypoints))
    }
  }, [map])

  const totals = waypoints.length >= 2 ? computeTotals(waypoints) : null

  return (
    <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
      {/* Toggle button */}
      <button
        onClick={handleToggle}
        className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md border backdrop-blur-sm transition-colors ${
          active
            ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
            : 'bg-zinc-900/90 text-zinc-400 border-zinc-700 hover:text-zinc-200'
        }`}
      >
        {active ? 'Measuring' : 'Measure'}
      </button>

      {/* Results panel */}
      {active && waypoints.length > 0 && (
        <div className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-md px-3 py-2 font-mono text-[11px] min-w-[180px]">
          <div className="text-zinc-500 mb-1.5">
            {waypoints.length} point{waypoints.length !== 1 ? 's' : ''}
          </div>

          {totals && (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500">Distance</span>
                <span className="text-zinc-300">{totals.totalKm.toFixed(2)} km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Nautical</span>
                <span className="text-zinc-300">{totals.totalNm.toFixed(2)} nm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Bearing</span>
                <span className="text-zinc-300">{totals.bearing.toFixed(1)}°</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-2 pt-2 border-t border-zinc-700">
            <button
              onClick={handleUndo}
              disabled={waypoints.length === 0}
              className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 text-[10px] uppercase tracking-wider"
            >
              Undo
            </button>
            <button
              onClick={handleClear}
              className="text-zinc-500 hover:text-zinc-300 text-[10px] uppercase tracking-wider"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
