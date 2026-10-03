import { useEffect, useState } from 'react'
import type mapboxgl from 'mapbox-gl'

interface CoordinateHUDProps {
  map: mapboxgl.Map | null
}

export function CoordinateHUD({ map }: CoordinateHUDProps) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [zoom, setZoom] = useState<number>(1.8)

  useEffect(() => {
    if (!map) return

    const onMouseMove = (e: mapboxgl.MapMouseEvent) => {
      setCoords({ lat: e.lngLat.lat, lon: e.lngLat.lng })
    }
    const onMouseLeave = () => setCoords(null)
    const onZoom = () => setZoom(map.getZoom())

    map.on('mousemove', onMouseMove)
    map.getCanvas().addEventListener('mouseleave', onMouseLeave)
    map.on('zoom', onZoom)

    return () => {
      map.off('mousemove', onMouseMove)
      try { map.getCanvas().removeEventListener('mouseleave', onMouseLeave) } catch { /* map already destroyed */ }
      map.off('zoom', onZoom)
    }
  }, [map])

  return (
    <div className="absolute bottom-3 left-3 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-md px-3 py-1.5 font-mono text-[11px] text-zinc-400 flex items-center gap-3 pointer-events-none select-none">
      {coords ? (
        <>
          <span>
            <span className="text-zinc-600">LAT </span>
            <span className="text-zinc-300">{coords.lat.toFixed(4)}°</span>
          </span>
          <span>
            <span className="text-zinc-600">LON </span>
            <span className="text-zinc-300">{coords.lon.toFixed(4)}°</span>
          </span>
        </>
      ) : (
        <span className="text-zinc-600">— —</span>
      )}
      <span className="border-l border-zinc-700 pl-3">
        <span className="text-zinc-600">Z </span>
        <span className="text-zinc-300">{zoom.toFixed(1)}</span>
      </span>
    </div>
  )
}
