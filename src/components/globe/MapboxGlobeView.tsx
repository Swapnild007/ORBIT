import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { cn } from '@/lib/utils'
import { CONSTELLATIONS } from '@/data/constellations'
import { displayRadius } from '@/lib/propagation-kernel'
import { computeGroundTrack, splitAtAntimeridian, computeFootprint } from '@/lib/orbital'
import { useSatelliteStore } from '@/stores/satellite-store'
import { useVesselStore } from '@/stores/vessel-store'
import { useFlightStore } from '@/stores/flight-store'
import { useWeatherStore } from '@/stores/weather-store'
import { useNewsStore } from '@/stores/news-store'
import { useConflictStore } from '@/stores/conflict-store'
import { useCyberStore } from '@/stores/cyber-store'
import { useOsintStore } from '@/stores/osint-store'
import { usePortStore } from '@/stores/port-store'
import { useCameraStore } from '@/stores/camera-store'
import { useRFStore } from '@/stores/rf-store'
// import { useEconomicStore } from '@/stores/economic-store'
import { useInfrastructureStore, INFRASTRUCTURE_COLORS, type InfrastructureLayerType } from '@/stores/infrastructure-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useAppStore } from '@/stores/app-store'
import { WEATHER_TYPE_DOT_COLORS, NEWS_CATEGORY_DOT_COLORS, CONFLICT_TYPE_DOT_COLORS, CYBER_TYPE_DOT_COLORS, OSINT_PLATFORM_DOT_COLORS, RF_SOURCE_DOT_COLORS, PORT_SIZE_DOT_COLORS } from '@/lib/colors'
import { CoordinateHUD } from './CoordinateHUD'
import { MeasurementTool } from './MeasurementTool'
import { GeofenceTool } from './GeofenceTool'
import { MapScreenshot } from './MapScreenshot'
import type { ConstellationId, SatellitePosition, VesselRecord, FlightRecord, VesselType, FlightType, WeatherEvent, WeatherEventType, NewsEvent, NewsCategory, ConflictEvent, ConflictEventType, CyberEvent, CyberEventType, OsintPlatform, RFSpot } from '@/types'
import type { OsintPost } from '@/lib/osint-client'
import type { Port } from '@/lib/ports-client'
import type { Camera } from '@/lib/camera-client'
// import type { EconomicIndicator } from '@/lib/economic-client'
import type { PositionHistory } from '@/lib/position-history'

type MapStyle = 'dark' | 'light' | 'satellite'

const STYLES: Record<MapStyle, string> = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  light: 'mapbox://styles/mapbox/light-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
}

type VizMode = 'standard' | 'nvg' | 'thermal' | 'crt'

const VIZ_MODE_FILTERS: Record<VizMode, string> = {
  standard: 'none',
  nvg: 'brightness(1.6) contrast(1.3) saturate(0.3) sepia(1) hue-rotate(70deg) saturate(2.5)',
  thermal: 'grayscale(1) brightness(1.4) contrast(1.3)',
  crt: 'contrast(1.15) brightness(0.9) saturate(1.2)',
}

const FOG_CONFIGS: Record<MapStyle, mapboxgl.FogSpecification> = {
  dark: {
    'color': '#0a0a0a',
    'high-color': '#1a1a2e',
    'horizon-blend': 0.08,
    'space-color': '#09090b',
    'star-intensity': 0.4,
  },
  light: {
    'color': '#e0e8f0',
    'high-color': '#a8c4e0',
    'horizon-blend': 0.01,
    'space-color': '#09090b',
    'star-intensity': 0.4,
  },
  satellite: {
    'color': '#0a0a0a',
    'high-color': '#0a1628',
    'horizon-blend': 0.06,
    'space-color': '#09090b',
    'star-intensity': 0.5,
  },
}

const VESSEL_COLOR = '#22d3ee'
const FLIGHT_COLOR = '#eab308'
const EARTH_RADIUS_M = 6_371_000

function hexToString(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0')
}

const CONSTELLATION_COLORS = new Map<ConstellationId, string>(
  CONSTELLATIONS.map(c => [c.id, hexToString(c.color)])
)

type GeoJSONFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point>

function buildSatelliteGeoJSON(
  toggles: Map<ConstellationId, boolean>,
  getPositions: (id: ConstellationId) => SatellitePosition[],
  selectedSatId: number | null,
): GeoJSONFeatureCollection {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const [id, enabled] of toggles) {
    if (!enabled) continue
    const color = CONSTELLATION_COLORS.get(id) ?? '#ffffff'
    for (const pos of getPositions(id)) {
      const zOffset = (displayRadius(pos.alt) - 1.0) * EARTH_RADIUS_M
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [pos.lon, pos.lat] },
        properties: {
          noradId: pos.noradId,
          color,
          selected: pos.noradId === selectedSatId,
          zOffset,
        },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}

function buildVesselGeoJSON(
  vessels: Map<number, VesselRecord>,
  selectedMmsi: number | null,
  vesselTypeToggles: Map<VesselType, boolean>,
  timelineCursor?: number,
): GeoJSONFeatureCollection {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const [mmsi, v] of vessels) {
    if (vesselTypeToggles.get(v.type) === false && mmsi !== selectedMmsi) continue
    if (timelineCursor && v.lastUpdate > timelineCursor) continue
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
      properties: {
        mmsi,
        heading: v.heading,
        selected: mmsi === selectedMmsi,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

function buildFlightGeoJSON(
  flights: Map<string, FlightRecord>,
  selectedIcao: string | null,
  flightTypeToggles: Map<FlightType, boolean>,
  timelineCursor?: number,
): GeoJSONFeatureCollection {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const [icao24, f] of flights) {
    if (flightTypeToggles.get(f.type) === false && icao24 !== selectedIcao) continue
    if (timelineCursor && f.lastUpdate > timelineCursor) continue
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
      properties: {
        icao24,
        callsign: f.callsign,
        heading: f.heading,
        selected: icao24 === selectedIcao,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

function buildWeatherGeoJSON(
  events: Map<string, WeatherEvent>,
  selectedEventId: string | null,
  typeToggles: Map<WeatherEventType, boolean>,
  timelineCursor?: number,
): GeoJSONFeatureCollection {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const [id, e] of events) {
    if (typeToggles.get(e.type) === false && id !== selectedEventId) continue
    if (timelineCursor && e.lastUpdate > timelineCursor) continue
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
      properties: {
        eventId: id,
        color: WEATHER_TYPE_DOT_COLORS[e.type] ?? '#a1a1aa',
        selected: id === selectedEventId,
        magnitude: e.magnitude,
        type: e.type,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

function buildWeatherAlertGeoJSON(
  events: Map<string, WeatherEvent>,
  typeToggles: Map<WeatherEventType, boolean>,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const [id, e] of events) {
    if (typeToggles.get(e.type) === false) continue
    if (!e.geometry) continue
    if (e.geometry.type !== 'Polygon' && e.geometry.type !== 'MultiPolygon') continue
    features.push({
      type: 'Feature',
      geometry: e.geometry,
      properties: { eventId: id, type: e.type },
    })
  }
  return { type: 'FeatureCollection', features }
}

function buildTrailGeoJSON(
  flightHistory: PositionHistory<string>,
  vesselHistory: PositionHistory<number>,
  selectedIcao: string | null,
  selectedMmsi: number | null,
): GeoJSONFeatureCollection {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []

  let trail: { lon: number; lat: number }[] = []
  let color = '#ffffff'

  if (selectedIcao) {
    trail = flightHistory.getTrail(selectedIcao)
    color = FLIGHT_COLOR
  } else if (selectedMmsi) {
    trail = vesselHistory.getTrail(selectedMmsi)
    color = VESSEL_COLOR
  }

  for (let i = 0; i < trail.length; i++) {
    const pt = trail[i]
    const opacity = trail.length > 1 ? 0.3 + 0.7 * (i / (trail.length - 1)) : 1
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pt.lon, pt.lat] },
      properties: { color, opacity },
    })
  }

  return { type: 'FeatureCollection', features }
}

function buildNewsGeoJSON(
  events: Map<string, NewsEvent>,
  selectedNewsId: string | null,
  categoryToggles: Map<NewsCategory, boolean>,
  timelineCursor?: number,
): GeoJSONFeatureCollection {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const [id, e] of events) {
    if (categoryToggles.get(e.category) === false) continue
    if (timelineCursor && e.lastUpdate > timelineCursor) continue
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
      properties: {
        newsId: id,
        color: NEWS_CATEGORY_DOT_COLORS[e.category] ?? '#a1a1aa',
        selected: id === selectedNewsId,
        tone: e.tone,
        category: e.category,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

function buildConflictGeoJSON(
  events: Map<string, ConflictEvent>,
  selectedConflictId: string | null,
  typeToggles: Map<ConflictEventType, boolean>,
  timelineCursor?: number,
): GeoJSONFeatureCollection {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const [id, e] of events) {
    if (typeToggles.get(e.type) === false && id !== selectedConflictId) continue
    if (timelineCursor && e.lastUpdate > timelineCursor) continue
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
      properties: {
        conflictId: id,
        color: CONFLICT_TYPE_DOT_COLORS[e.type] ?? '#f87171',
        selected: id === selectedConflictId,
        fatalities: e.fatalities,
        type: e.type,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

function buildCyberGeoJSON(
  events: Map<string, CyberEvent>,
  selectedCyberId: string | null,
  typeToggles: Map<CyberEventType, boolean>,
  timelineCursor?: number,
): GeoJSONFeatureCollection {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const [id, e] of events) {
    if (typeToggles.get(e.type) === false && id !== selectedCyberId) continue
    if (timelineCursor && e.lastUpdate > timelineCursor) continue
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
      properties: {
        cyberId: id,
        color: CYBER_TYPE_DOT_COLORS[e.type] ?? '#c084fc',
        selected: id === selectedCyberId,
        severity: e.severity,
        type: e.type,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

function buildOsintGeoJSON(
  posts: Map<string, OsintPost>,
  platformToggles: Map<OsintPlatform, boolean>,
  timelineCursor?: number,
): GeoJSONFeatureCollection {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const [id, p] of posts) {
    if (platformToggles.get(p.platform) === false) continue
    if (timelineCursor && p.lastUpdate > timelineCursor) continue
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: {
        osintId: id,
        color: OSINT_PLATFORM_DOT_COLORS[p.platform] ?? '#2dd4bf',
        platform: p.platform,
        text: p.text.slice(0, 60),
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

function buildPortGeoJSON(
  ports: Map<string, Port>,
  visible: boolean,
): GeoJSONFeatureCollection {
  if (!visible) return { type: 'FeatureCollection', features: [] }
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const [, p] of ports) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: {
        portId: p.id,
        color: PORT_SIZE_DOT_COLORS[p.size] ?? '#94a3b8',
        name: p.name,
        size: p.size,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

type RFSource = 'psk' | 'rbn' | 'satnogs'

function buildRFGeoJSON(
  spots: Map<string, RFSpot>,
  sourceToggles: Map<RFSource, boolean>,
  selectedRFId: string | null,
): GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.LineString | GeoJSON.Point>[] = []
  for (const [id, spot] of spots) {
    if (sourceToggles.get(spot.source) === false && id !== selectedRFId) continue
    const color = RF_SOURCE_DOT_COLORS[spot.source] ?? '#a78bfa'
    // Arc line from TX → RX (only if both have valid coords)
    if (spot.txLat !== 0 && spot.txLon !== 0 && spot.rxLat !== 0 && spot.rxLon !== 0) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [[spot.txLon, spot.txLat], [spot.rxLon, spot.rxLat]],
        },
        properties: { rfId: id, color, source: spot.source, snr: spot.snr },
      })
    }
    // RX station point
    if (spot.rxLat !== 0 && spot.rxLon !== 0) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [spot.rxLon, spot.rxLat] },
        properties: { rfId: id, color, source: spot.source, selected: id === selectedRFId },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}

// function buildEconomicGeoJSON(
//   indicators: Map<string, EconomicIndicator>,
//   selectedIndicator: string,
// ): GeoJSONFeatureCollection {
//   const features: GeoJSON.Feature<GeoJSON.Point>[] = []
//   for (const [, ind] of indicators) {
//     if (ind.indicatorId !== selectedIndicator) continue
//     if (ind.value == null) continue
//     const color = ECONOMIC_INDICATOR_DOT_COLORS[ind.indicatorId] ?? '#34d399'
//     features.push({
//       type: 'Feature',
//       geometry: { type: 'Point', coordinates: [ind.lon, ind.lat] },
//       properties: {
//         econId: ind.id,
//         color,
//         value: ind.value,
//         country: ind.country,
//         countryCode: ind.countryCode,
//       },
//     })
//   }
//   return { type: 'FeatureCollection', features }
// }

function buildCameraGeoJSON(
  cameras: Map<string, Camera>,
  visible: boolean,
): GeoJSONFeatureCollection {
  if (!visible) return { type: 'FeatureCollection', features: [] }
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const [, c] of cameras) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
      properties: { cameraId: c.id, title: c.title },
    })
  }
  return { type: 'FeatureCollection', features }
}

function createDotImage(size = 16): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  return ctx.getImageData(0, 0, size, size)
}

function addEntityLayers(map: mapboxgl.Map) {
  if (map.getSource('entity-trail')) return

  if (!map.hasImage('sat-dot')) {
    map.addImage('sat-dot', createDotImage(16), { sdf: true })
  }

  map.addSource('entity-trail', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'entity-trail-layer',
    type: 'circle',
    source: 'entity-trail',
    paint: {
      'circle-radius': 1.5,
      'circle-color': ['get', 'color'],
      'circle-opacity': ['get', 'opacity'],
    },
  })

  map.addSource('satellites', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'satellites-layer',
    type: 'symbol',
    source: 'satellites',
    layout: {
      'icon-image': 'sat-dot',
      'icon-size': ['case', ['get', 'selected'], 1.0, 0.4],
      'icon-allow-overlap': true,
      'symbol-elevation-reference': 'sea',
    } as mapboxgl.SymbolLayerSpecification['layout'],
    paint: {
      'icon-color': ['get', 'color'],
      'icon-opacity': ['case', ['get', 'selected'], 1, 0.7],
      'symbol-z-offset': ['get', 'zOffset'],
    } as mapboxgl.SymbolLayerSpecification['paint'],
  })

  // --- Orbital track (ground track line for selected satellite) ---
  map.addSource('orbital-track', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'orbital-track-layer',
    type: 'line',
    source: 'orbital-track',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 1.5,
      'line-opacity': 0.7,
      'line-dasharray': [4, 3],
    },
  })

  // --- Sensor footprint (coverage circle for selected satellite) ---
  map.addSource('sat-footprint', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'sat-footprint-fill',
    type: 'fill',
    source: 'sat-footprint',
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': 0.08,
    },
  })
  map.addLayer({
    id: 'sat-footprint-outline',
    type: 'line',
    source: 'sat-footprint',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 1,
      'line-opacity': 0.4,
    },
  })

  // --- Vessels ---
  map.addSource('vessels', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'vessels-layer',
    type: 'circle',
    source: 'vessels',
    paint: {
      'circle-radius': ['case', ['get', 'selected'], 4, 2],
      'circle-color': VESSEL_COLOR,
      'circle-opacity': ['case', ['get', 'selected'], 1, 0.7],
      'circle-stroke-width': ['case', ['get', 'selected'], 1.5, 0],
      'circle-stroke-color': VESSEL_COLOR,
    },
  })

  // --- Flights ---
  map.addSource('flights', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'flights-layer',
    type: 'circle',
    source: 'flights',
    paint: {
      'circle-radius': ['case', ['get', 'selected'], 4, 2],
      'circle-color': FLIGHT_COLOR,
      'circle-opacity': ['case', ['get', 'selected'], 1, 0.7],
      'circle-stroke-width': ['case', ['get', 'selected'], 1.5, 0],
      'circle-stroke-color': FLIGHT_COLOR,
    },
  })

  // Weather alert polygons
  map.addSource('weather-alerts', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'weather-alerts-fill',
    type: 'fill',
    source: 'weather-alerts',
    paint: {
      'fill-color': '#fb7185',
      'fill-opacity': 0.15,
    },
  })
  map.addLayer({
    id: 'weather-alerts-outline',
    type: 'line',
    source: 'weather-alerts',
    paint: {
      'line-color': '#fb7185',
      'line-width': 1.5,
      'line-opacity': 0.6,
    },
  })

  // --- Weather events ---
  map.addSource('weather-events', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'weather-events-layer',
    type: 'circle',
    source: 'weather-events',
    paint: {
      'circle-radius': [
        'case',
        ['get', 'selected'], 5,
        ['==', ['get', 'type'], 'earthquake'],
        ['interpolate', ['linear'], ['coalesce', ['get', 'magnitude'], 2], 0, 2, 5, 4, 9, 6],
        3,
      ],
      'circle-color': ['get', 'color'],
      'circle-opacity': ['case', ['get', 'selected'], 1, 0.7],
      'circle-stroke-width': ['case', ['get', 'selected'], 1.5, 0],
      'circle-stroke-color': ['get', 'color'],
    },
  })

  // --- News events ---
  map.addSource('news-events', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'news-events-layer',
    type: 'circle',
    source: 'news-events',
    paint: {
      'circle-radius': ['case', ['get', 'selected'], 4, 2],
      'circle-color': ['get', 'color'],
      'circle-opacity': ['case', ['get', 'selected'], 1, 0.6],
      'circle-stroke-width': ['case', ['get', 'selected'], 1.5, 0],
      'circle-stroke-color': ['get', 'color'],
    },
  })

  // --- Conflict events ---
  map.addSource('conflict-events', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'conflict-events-layer',
    type: 'circle',
    source: 'conflict-events',
    paint: {
      'circle-radius': [
        'case',
        ['get', 'selected'], 5,
        ['interpolate', ['linear'], ['coalesce', ['get', 'fatalities'], 0], 0, 2, 10, 4, 100, 6],
      ],
      'circle-color': ['get', 'color'],
      'circle-opacity': ['case', ['get', 'selected'], 1, 0.7],
      'circle-stroke-width': ['case', ['get', 'selected'], 1.5, 0],
      'circle-stroke-color': ['get', 'color'],
    },
  })

  // --- Cyber events ---
  map.addSource('cyber-events', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'cyber-events-layer',
    type: 'circle',
    source: 'cyber-events',
    paint: {
      'circle-radius': [
        'case',
        ['get', 'selected'], 4,
        ['interpolate', ['linear'], ['coalesce', ['get', 'severity'], 1], 1, 2, 5, 3, 10, 5],
      ],
      'circle-color': ['get', 'color'],
      'circle-opacity': ['case', ['get', 'selected'], 1, 0.6],
      'circle-stroke-width': ['case', ['get', 'selected'], 1.5, 0],
      'circle-stroke-color': ['get', 'color'],
    },
  })

  // --- OSINT posts ---
  map.addSource('osint-posts', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'osint-posts-layer',
    type: 'circle',
    source: 'osint-posts',
    paint: {
      'circle-radius': 2,
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.7,
      'circle-stroke-width': 0.5,
      'circle-stroke-color': '#2dd4bf',
    },
  })

  // --- Ports (no clustering, zoom-dependent) ---
  map.addSource('ports', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'ports-layer',
    type: 'circle',
    source: 'ports',
    minzoom: 4,
    paint: {
      'circle-radius': ['match', ['get', 'size'], 'large', 3, 'medium', 2, 1.5],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.7,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#1e3a5f',
    },
  })

  // --- RF Spectrum arcs ---
  map.addSource('rf-spots', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'rf-arcs-layer',
    type: 'line',
    source: 'rf-spots',
    filter: ['==', '$type', 'LineString'],
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 1.5,
      'line-opacity': ['interpolate', ['linear'], ['coalesce', ['get', 'snr'], 5], 0, 0.2, 10, 0.5, 30, 0.8],
    },
  })
  map.addLayer({
    id: 'rf-stations-layer',
    type: 'circle',
    source: 'rf-spots',
    filter: ['==', '$type', 'Point'],
    paint: {
      'circle-radius': 2,
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.6,
    },
  })

  // --- Cameras (zoom-dependent) ---
  map.addSource('cameras', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: 'cameras-layer',
    type: 'circle',
    source: 'cameras',
    paint: {
      'circle-radius': ['case', ['get', 'selected'], 4, 2],
      'circle-color': '#38bdf8',
      'circle-opacity': ['case', ['get', 'selected'], 1, 0.7],
      'circle-stroke-width': ['case', ['get', 'selected'], 1.5, 0],
      'circle-stroke-color': '#0ea5e9',
    },
  })

  // --- Infrastructure overlays ---
  // Undersea cables
  map.addSource('infra-cables', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: 'infra-cables-layer', type: 'line', source: 'infra-cables',
    paint: { 'line-color': INFRASTRUCTURE_COLORS.cables, 'line-width': 1.5, 'line-opacity': 0.6 },
  })

  // Pipelines
  map.addSource('infra-pipelines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: 'infra-pipelines-layer', type: 'line', source: 'infra-pipelines',
    paint: { 'line-color': INFRASTRUCTURE_COLORS.pipelines, 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [6, 3] },
  })

  // Nuclear facilities
  map.addSource('infra-nuclear', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: 'infra-nuclear-layer', type: 'circle', source: 'infra-nuclear',
    paint: {
      'circle-radius': 4, 'circle-color': INFRASTRUCTURE_COLORS.nuclear,
      'circle-opacity': 0.8, 'circle-stroke-width': 2, 'circle-stroke-color': INFRASTRUCTURE_COLORS.nuclear, 'circle-stroke-opacity': 0.4,
    },
  })

  // Maritime chokepoints
  map.addSource('infra-chokepoints', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: 'infra-chokepoints-fill', type: 'fill', source: 'infra-chokepoints',
    paint: { 'fill-color': INFRASTRUCTURE_COLORS.chokepoints, 'fill-opacity': 0.1 },
  })
  map.addLayer({
    id: 'infra-chokepoints-outline', type: 'line', source: 'infra-chokepoints',
    paint: { 'line-color': INFRASTRUCTURE_COLORS.chokepoints, 'line-width': 1.5, 'line-opacity': 0.5 },
  })

  // --- Economic indicators (disabled) ---
  // map.addSource('economic', {
  //   type: 'geojson',
  //   data: { type: 'FeatureCollection', features: [] },
  // })
  // map.addLayer({
  //   id: 'economic-layer',
  //   type: 'circle',
  //   source: 'economic',
  //   paint: {
  //     'circle-radius': ['interpolate', ['linear'], ['abs', ['coalesce', ['get', 'value'], 0]], 0, 2, 1e12, 7],
  //     'circle-color': ['get', 'color'],
  //     'circle-opacity': 0.5,
  //     'circle-stroke-width': 1,
  //     'circle-stroke-color': ['get', 'color'],
  //     'circle-stroke-opacity': 0.8,
  //   },
  // })
}

const ENTITY_LAYERS = ['satellites-layer', 'vessels-layer', 'flights-layer', 'weather-events-layer', 'news-events-layer', 'conflict-events-layer', 'cyber-events-layer', 'osint-posts-layer', 'ports-layer', 'rf-stations-layer', 'cameras-layer'] as const

export function MapboxGlobeView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const cameraPopupRef = useRef<mapboxgl.Popup | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark')
  const [vizMode, setVizMode] = useState<VizMode>('standard')
  const [vizBrightness, setVizBrightness] = useState(1.4)
  const [vizContrast, setVizContrast] = useState(1.3)
  const [vizPopoverOpen, setVizPopoverOpen] = useState(false)
  const vizPopoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const layersReadyRef = useRef(false)

  // Read from stores
  const toggles = useSatelliteStore(s => s.toggles)
  const getPositions = useSatelliteStore(s => s.getPositions)
  const getSatellites = useSatelliteStore(s => s.getSatellites)
  const satVersion = useSatelliteStore(s => s.version)
  const vessels = useVesselStore(s => s.vessels)
  const vesselVersion = useVesselStore(s => s.version)
  const vesselTypeToggles = useVesselStore(s => s.typeToggles)
  const vesselHistory = useVesselStore(s => s.history)
  const flights = useFlightStore(s => s.flights)
  const flightVersion = useFlightStore(s => s.version)
  const flightTypeToggles = useFlightStore(s => s.typeToggles)
  const flightHistory = useFlightStore(s => s.history)
  const selectedSatId = useSelectionStore(s => s.selectedSatId)
  const weatherEvents = useWeatherStore(s => s.events)
  const weatherVersion = useWeatherStore(s => s.version)
  const weatherTypeToggles = useWeatherStore(s => s.typeToggles)
  const newsEvents = useNewsStore(s => s.events)
  const newsVersion = useNewsStore(s => s.version)
  const newsCategoryToggles = useNewsStore(s => s.categoryToggles)
  const conflictEvents = useConflictStore(s => s.events)
  const conflictVersion = useConflictStore(s => s.version)
  const conflictTypeToggles = useConflictStore(s => s.typeToggles)
  const cyberEvents = useCyberStore(s => s.events)
  const cyberVersion = useCyberStore(s => s.version)
  const cyberTypeToggles = useCyberStore(s => s.typeToggles)
  const osintPosts = useOsintStore(s => s.posts)
  const osintVersion = useOsintStore(s => s.version)
  const osintPlatformToggles = useOsintStore(s => s.platformToggles)
  const portData = usePortStore(s => s.ports)
  const portVersion = usePortStore(s => s.version)
  const portVisible = usePortStore(s => s.visible)
  const rfSpots = useRFStore(s => s.spots)
  const rfVersion = useRFStore(s => s.version)
  const rfSourceToggles = useRFStore(s => s.sourceToggles)
  // const econIndicators = useEconomicStore(s => s.indicators)
  // const econVersion = useEconomicStore(s => s.version)
  // const selectedIndicator = useEconomicStore(s => s.selectedIndicator)
  const cameraData = useCameraStore(s => s.cameras)
  const cameraVersion = useCameraStore(s => s.version)
  const cameraVisible = useCameraStore(s => s.visible)
  const infraToggles = useInfrastructureStore(s => s.toggles)
  const selectedMmsi = useSelectionStore(s => s.selectedMmsi)
  const selectedIcao = useSelectionStore(s => s.selectedIcao)
  const selectedEventId = useSelectionStore(s => s.selectedEventId)
  const selectedNewsId = useSelectionStore(s => s.selectedNewsId)
  const selectedConflictId = useSelectionStore(s => s.selectedConflictId)
  const selectedCyberId = useSelectionStore(s => s.selectedCyberId)
  const selectedRFId = useSelectionStore(s => s.selectedRFId)
  const selectedCameraId = useSelectionStore(s => s.selectedCameraId)
  const timelineCursor = useAppStore(s => s.timelineCursor)
  const timelineLive = useAppStore(s => s.timelineLive)
  const flyToTarget = useAppStore(s => s.flyToTarget)
  const clearFlyTo = useAppStore(s => s.clearFlyTo)

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current) return

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLES[mapStyle],
      projection: 'globe',
      center: [0, 20],
      zoom: 1.8,
    })

    map.on('style.load', () => {
      const styleName = map.getStyle().name ?? ''
      const fogKey = styleName.includes('Light') ? 'light' : styleName.includes('Satellite') ? 'satellite' : 'dark'
      map.setFog(FOG_CONFIGS[fogKey])
      addEntityLayers(map)
      layersReadyRef.current = true
    })

    // Click handlers use store actions directly (stable references)
    map.on('click', 'flights-layer', (e) => {
      if (e.features?.[0]?.properties?.icao24) {
        e.originalEvent.stopPropagation()
        useSelectionStore.getState().selectFlight(e.features[0].properties.icao24)
      }
    })
    map.on('click', 'vessels-layer', (e) => {
      if (e.features?.[0]?.properties?.mmsi) {
        e.originalEvent.stopPropagation()
        useSelectionStore.getState().selectVessel(e.features[0].properties.mmsi)
      }
    })
    map.on('click', 'satellites-layer', (e) => {
      if (e.features?.[0]?.properties?.noradId) {
        e.originalEvent.stopPropagation()
        useSelectionStore.getState().selectSatellite(e.features[0].properties.noradId)
      }
    })
    map.on('click', 'weather-events-layer', (e) => {
      if (e.features?.[0]?.properties?.eventId) {
        e.originalEvent.stopPropagation()
        useSelectionStore.getState().selectEvent(e.features[0].properties.eventId)
      }
    })
    map.on('click', 'news-events-layer', (e) => {
      if (e.features?.[0]?.properties?.newsId) {
        e.originalEvent.stopPropagation()
        useSelectionStore.getState().selectNews(e.features[0].properties.newsId)
      }
    })
    map.on('click', 'conflict-events-layer', (e) => {
      if (e.features?.[0]?.properties?.conflictId) {
        e.originalEvent.stopPropagation()
        useSelectionStore.getState().selectConflict(e.features[0].properties.conflictId)
      }
    })
    map.on('click', 'cyber-events-layer', (e) => {
      if (e.features?.[0]?.properties?.cyberId) {
        e.originalEvent.stopPropagation()
        useSelectionStore.getState().selectCyber(e.features[0].properties.cyberId)
      }
    })
    map.on('click', 'rf-stations-layer', (e) => {
      if (e.features?.[0]?.properties?.rfId) {
        e.originalEvent.stopPropagation()
        useSelectionStore.getState().selectRF(e.features[0].properties.rfId)
      }
    })
    map.on('click', 'cameras-layer', (e) => {
      if (e.features?.[0]?.properties?.cameraId) {
        e.originalEvent.stopPropagation()
        useSelectionStore.getState().selectCamera(e.features[0].properties.cameraId)
      }
    })

    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [...ENTITY_LAYERS] })
      if (features.length === 0) {
        useSelectionStore.getState().clearAll()
      }
    })

    for (const layer of ENTITY_LAYERS) {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
    }

    // Dynamic camera scan when zoomed in
    const SCAN_ZOOM_THRESHOLD = 5
    let scanTimer: ReturnType<typeof setTimeout> | null = null
    const scannedAreas = new Set<string>()

    map.on('moveend', () => {
      if (map.getZoom() < SCAN_ZOOM_THRESHOLD) return
      const center = map.getCenter()
      // Grid key to avoid re-scanning the same area (1-degree cells)
      const gridKey = `${Math.round(center.lat)},${Math.round(center.lng)}`
      if (scannedAreas.has(gridKey)) return

      if (scanTimer) clearTimeout(scanTimer)
      scanTimer = setTimeout(async () => {
        scannedAreas.add(gridKey)
        try {
          const res = await fetch(`/api/cameras/scan?lat=${center.lat.toFixed(2)}&lon=${center.lng.toFixed(2)}&radius=250`)
          if (!res.ok) return
          const json = await res.json() as { cameras: import('@/lib/camera-client').Camera[] }
          if (json.cameras?.length) {
            useCameraStore.getState().mergeCameras(json.cameras)
          }
        } catch { /* non-critical */ }
      }, 800)
    })

    mapRef.current = map
    setMapReady(true)

    return () => {
      if (scanTimer) clearTimeout(scanTimer)
      layersReadyRef.current = false
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStyleChange = useCallback((style: MapStyle) => {
    setMapStyle(style)
    const map = mapRef.current
    if (!map) return
    layersReadyRef.current = false
    map.setStyle(STYLES[style])
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const onStyleLoad = () => {
      map.setFog(FOG_CONFIGS[mapStyle])
      addEntityLayers(map)
      layersReadyRef.current = true
    }
    map.on('style.load', onStyleLoad)
    return () => { map.off('style.load', onStyleLoad) }
  }, [mapStyle])

  // --- Fly-to from region presets ---
  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyToTarget) return
    map.flyTo({ center: flyToTarget.center, zoom: flyToTarget.zoom, speed: 1.2 })
    clearFlyTo()
  }, [flyToTarget, clearFlyTo])

  // --- Fly-to on entity selection (once per selection change) ---
  const lastFlyToRef = useRef<string | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Build a key representing the current selection
    const selKey = `${selectedSatId}|${selectedMmsi}|${selectedIcao}|${selectedEventId}|${selectedNewsId}|${selectedConflictId}|${selectedCyberId}|${selectedRFId}|${selectedCameraId}`
    if (selKey === lastFlyToRef.current) return
    lastFlyToRef.current = selKey

    // Satellite selected
    if (selectedSatId !== null) {
      for (const [id, enabled] of toggles) {
        if (!enabled) continue
        const pos = getPositions(id).find(p => p.noradId === selectedSatId)
        if (pos) {
          map.flyTo({ center: [pos.lon, pos.lat], duration: 1500 })
          return
        }
      }
    }

    // Vessel selected
    if (selectedMmsi !== null) {
      const v = vessels.get(selectedMmsi)
      if (v) {
        map.flyTo({ center: [v.lon, v.lat], duration: 1500 })
        return
      }
    }

    // Flight selected
    if (selectedIcao !== null) {
      const f = flights.get(selectedIcao)
      if (f) {
        map.flyTo({ center: [f.lon, f.lat], duration: 1500 })
        return
      }
    }

    // Weather event selected
    if (selectedEventId !== null) {
      const e = weatherEvents.get(selectedEventId)
      if (e) {
        map.flyTo({ center: [e.lon, e.lat], duration: 1500 })
        return
      }
    }

    // News selected
    if (selectedNewsId !== null) {
      const e = newsEvents.get(selectedNewsId)
      if (e) {
        map.flyTo({ center: [e.lon, e.lat], duration: 1500 })
        return
      }
    }

    // Conflict selected
    if (selectedConflictId !== null) {
      const e = conflictEvents.get(selectedConflictId)
      if (e) {
        map.flyTo({ center: [e.lon, e.lat], duration: 1500 })
        return
      }
    }

    // Cyber selected
    if (selectedCyberId !== null) {
      const e = cyberEvents.get(selectedCyberId)
      if (e) {
        map.flyTo({ center: [e.lon, e.lat], duration: 1500 })
        return
      }
    }

    // RF spot selected
    if (selectedRFId !== null) {
      const spot = rfSpots.get(selectedRFId)
      if (spot) {
        map.flyTo({ center: [spot.rxLon, spot.rxLat], duration: 1500 })
        return
      }
    }

    // Camera selected
    if (selectedCameraId !== null) {
      const cam = cameraData.get(selectedCameraId)
      if (cam) {
        map.flyTo({ center: [cam.lon, cam.lat], duration: 1500 })
        return
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSatId, selectedMmsi, selectedIcao, selectedEventId, selectedNewsId, selectedConflictId, selectedCyberId, selectedRFId, selectedCameraId, toggles, getPositions, vessels, flights, weatherEvents, newsEvents, conflictEvents, cyberEvents, rfSpots, cameraData, vesselVersion, flightVersion, weatherVersion, newsVersion, conflictVersion, cyberVersion, rfVersion, cameraVersion])

  // Use timeline cursor only when not live
  const cursorForFilter = timelineLive ? undefined : timelineCursor

  // Dim non-selected nodes when any entity is selected
  const hasSelection = selectedSatId !== null || selectedMmsi !== null || selectedIcao !== null ||
    selectedEventId !== null || selectedNewsId !== null || selectedConflictId !== null ||
    selectedCyberId !== null || selectedRFId !== null || selectedCameraId !== null

  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return

    // Layers that use 'selected' property on features
    const circleLayers = ['vessels-layer', 'flights-layer', 'weather-events-layer', 'news-events-layer', 'conflict-events-layer', 'cyber-events-layer', 'rf-stations-layer', 'cameras-layer']
    const dimOpacity = 0.12
    const normalOpacity = 0.7

    for (const layerId of circleLayers) {
      if (!map.getLayer(layerId)) continue
      if (hasSelection) {
        map.setPaintProperty(layerId, 'circle-opacity', ['case', ['get', 'selected'], 1, dimOpacity])
      } else {
        map.setPaintProperty(layerId, 'circle-opacity', ['case', ['get', 'selected'], 1, normalOpacity])
      }
    }

    // Satellite symbol layer
    if (map.getLayer('satellites-layer')) {
      if (hasSelection) {
        map.setPaintProperty('satellites-layer', 'icon-opacity', ['case', ['get', 'selected'], 1, dimOpacity])
      } else {
        map.setPaintProperty('satellites-layer', 'icon-opacity', ['case', ['get', 'selected'], 1, 0.7])
      }
    }

    // OSINT and ports don't have 'selected' property — dim them uniformly
    for (const layerId of ['osint-posts-layer', 'ports-layer']) {
      if (!map.getLayer(layerId)) continue
      map.setPaintProperty(layerId, 'circle-opacity', hasSelection ? dimOpacity : normalOpacity)
    }
  }, [hasSelection, selectedSatId, selectedMmsi, selectedIcao, selectedEventId, selectedNewsId, selectedConflictId, selectedCyberId, selectedRFId, selectedCameraId])

  // Sync satellite data
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('satellites') as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(buildSatelliteGeoJSON(toggles, getPositions, selectedSatId))
  }, [satVersion, toggles, getPositions, selectedSatId])

  // Sync orbital track + footprint for selected satellite
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return

    const trackSrc = map.getSource('orbital-track') as mapboxgl.GeoJSONSource | undefined
    const footSrc = map.getSource('sat-footprint') as mapboxgl.GeoJSONSource | undefined
    const empty: GeoJSONFeatureCollection = { type: 'FeatureCollection', features: [] }

    if (selectedSatId === null) {
      if (trackSrc) trackSrc.setData(empty)
      if (footSrc) footSrc.setData(empty)
      return
    }

    // Find the satrec and color for the selected satellite
    let satrec: unknown = null
    let color = '#ff8800'
    for (const [cid] of toggles) {
      const sats = getSatellites(cid)
      const sat = sats.find(s => s.noradId === selectedSatId)
      if (sat) {
        satrec = sat.satrec
        color = CONSTELLATION_COLORS.get(cid) ?? '#ff8800'
        break
      }
    }

    if (!satrec) {
      if (trackSrc) trackSrc.setData(empty)
      if (footSrc) footSrc.setData(empty)
      return
    }

    // Compute ground track (next 90 min)
    const track = computeGroundTrack(satrec as Parameters<typeof import('satellite.js').propagate>[0])
    const segments = splitAtAntimeridian(track)

    const trackFeatures: GeoJSON.Feature[] = segments
      .filter(seg => seg.length >= 2)
      .map(seg => ({
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: seg.map(p => [p.lon, p.lat]),
        },
        properties: { color },
      }))

    if (trackSrc) trackSrc.setData({ type: 'FeatureCollection', features: trackFeatures })

    // Compute footprint from current position (closest point to now)
    const now = Date.now()
    const currentPos = track.reduce((best, p) =>
      Math.abs(p.time - now) < Math.abs(best.time - now) ? p : best
    , track[0])
    if (currentPos && footSrc) {
      const ring = computeFootprint(currentPos.lat, currentPos.lon, currentPos.alt)
      footSrc.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [ring] },
          properties: { color },
        }],
      })
    }
  }, [satVersion, selectedSatId, toggles, getSatellites])

  // Sync vessel data
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('vessels') as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(buildVesselGeoJSON(vessels, selectedMmsi, vesselTypeToggles, cursorForFilter))
  }, [vesselVersion, vessels, selectedMmsi, vesselTypeToggles, cursorForFilter])

  // Sync flight data
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('flights') as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(buildFlightGeoJSON(flights, selectedIcao, flightTypeToggles, cursorForFilter))
  }, [flightVersion, flights, selectedIcao, flightTypeToggles, cursorForFilter])

  // Sync weather data
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('weather-events') as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(buildWeatherGeoJSON(weatherEvents, selectedEventId, weatherTypeToggles, cursorForFilter))
    const alertSrc = map.getSource('weather-alerts') as mapboxgl.GeoJSONSource | undefined
    if (alertSrc) alertSrc.setData(buildWeatherAlertGeoJSON(weatherEvents, weatherTypeToggles))
  }, [weatherVersion, weatherEvents, selectedEventId, weatherTypeToggles, cursorForFilter])

  // Sync trail data
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('entity-trail') as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(buildTrailGeoJSON(flightHistory, vesselHistory, selectedIcao, selectedMmsi))
  }, [selectedIcao, selectedMmsi, flightVersion, vesselVersion, flightHistory, vesselHistory])

  // Sync news data
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('news-events') as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(buildNewsGeoJSON(newsEvents, selectedNewsId, newsCategoryToggles, cursorForFilter))
  }, [newsVersion, newsEvents, selectedNewsId, newsCategoryToggles, cursorForFilter])

  // Sync conflict data
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('conflict-events') as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(buildConflictGeoJSON(conflictEvents, selectedConflictId, conflictTypeToggles, cursorForFilter))
  }, [conflictVersion, conflictEvents, selectedConflictId, conflictTypeToggles, cursorForFilter])

  // Sync cyber data
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('cyber-events') as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(buildCyberGeoJSON(cyberEvents, selectedCyberId, cyberTypeToggles, cursorForFilter))
  }, [cyberVersion, cyberEvents, selectedCyberId, cyberTypeToggles, cursorForFilter])

  // Sync OSINT data
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('osint-posts') as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(buildOsintGeoJSON(osintPosts, osintPlatformToggles, cursorForFilter))
  }, [osintVersion, osintPosts, osintPlatformToggles, cursorForFilter])

  // Sync port data
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('ports') as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(buildPortGeoJSON(portData, portVisible))
  }, [portVersion, portData, portVisible])

  // Sync RF data
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('rf-spots') as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(buildRFGeoJSON(rfSpots, rfSourceToggles, selectedRFId))
  }, [rfVersion, rfSpots, rfSourceToggles, selectedRFId])

  // Sync economic data (disabled)
  // useEffect(() => {
  //   const map = mapRef.current
  //   if (!map || !layersReadyRef.current) return
  //   const src = map.getSource('economic') as mapboxgl.GeoJSONSource | undefined
  //   if (src) src.setData(buildEconomicGeoJSON(econIndicators, selectedIndicator))
  // }, [econVersion, econIndicators, selectedIndicator])

  // Sync camera data
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return
    const src = map.getSource('cameras') as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(buildCameraGeoJSON(cameraData, cameraVisible))
  }, [cameraVersion, cameraData, cameraVisible])

  // Sync infrastructure overlays
  const infraCacheRef = useRef<Map<InfrastructureLayerType, GeoJSON.FeatureCollection>>(new Map())
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReadyRef.current) return

    const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
    const layerSourceMap: Record<InfrastructureLayerType, string> = {
      cables: 'infra-cables',
      pipelines: 'infra-pipelines',
      nuclear: 'infra-nuclear',
      chokepoints: 'infra-chokepoints',
    }
    const fileMap: Record<InfrastructureLayerType, string> = {
      cables: '/data/undersea-cables.geojson',
      pipelines: '/data/pipelines.geojson',
      nuclear: '/data/nuclear-facilities.geojson',
      chokepoints: '/data/chokepoints.geojson',
    }

    for (const [layer, enabled] of infraToggles) {
      const src = map.getSource(layerSourceMap[layer]) as mapboxgl.GeoJSONSource | undefined
      if (!src) continue

      if (!enabled) {
        src.setData(empty)
        continue
      }

      // Load and cache GeoJSON on first enable
      const cached = infraCacheRef.current.get(layer)
      if (cached) {
        src.setData(cached)
      } else {
        fetch(fileMap[layer])
          .then(r => r.json())
          .then((geojson: GeoJSON.FeatureCollection) => {
            infraCacheRef.current.set(layer, geojson)
            const s = map.getSource(layerSourceMap[layer]) as mapboxgl.GeoJSONSource | undefined
            if (s && infraToggles.get(layer)) s.setData(geojson)
          })
          .catch(err => console.warn(`[Infrastructure] Failed to load ${layer}:`, err))
      }
    }
  }, [infraToggles])

  // Camera feed popup
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Remove previous popup without triggering selectCamera(null)
    if (cameraPopupRef.current) {
      // Remove all close listeners before removing to prevent clearing the new selection
      ;(cameraPopupRef.current as any)._listeners = {}
      cameraPopupRef.current.remove()
      cameraPopupRef.current = null
    }

    if (selectedCameraId === null) return

    const cam = cameraData.get(selectedCameraId)
    if (!cam) return

    const thumbSrc = cam.thumbnail || ''
    const popup = new mapboxgl.Popup({
      closeOnClick: false,
      closeButton: true,
      maxWidth: '220px',
      className: 'camera-feed-popup',
      offset: 12,
    })
      .setLngLat([cam.lon, cam.lat])
      .setHTML(`
        <div style="background:#18181b;border-radius:6px;overflow:hidden;font-family:'DM Mono',monospace;">
          ${thumbSrc ? `<img src="${thumbSrc}" alt="" style="width:200px;height:140px;object-fit:cover;display:block;" />` : '<div style="width:200px;height:140px;background:#27272a;display:flex;align-items:center;justify-content:center;color:#71717a;font-size:11px;">No feed</div>'}
          <div style="padding:6px 8px;">
            <div style="font-size:11px;color:#e4e4e7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cam.title}</div>
            <div style="font-size:10px;color:#71717a;margin-top:2px;">${cam.city}${cam.country ? `, ${cam.country}` : ''}</div>
          </div>
        </div>
      `)
      .addTo(map)

    popup.on('close', () => {
      // Only clear if this popup's camera is still the selected one
      if (useSelectionStore.getState().selectedCameraId === selectedCameraId) {
        useSelectionStore.getState().selectCamera(null)
      }
    })

    cameraPopupRef.current = popup

    return () => {
      if (cameraPopupRef.current) {
        ;(cameraPopupRef.current as any)._listeners = {}
        cameraPopupRef.current.remove()
        cameraPopupRef.current = null
      }
    }
  }, [selectedCameraId, cameraData])

  // Sync all data after style change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const syncAll = () => {
      const satSrc = map.getSource('satellites') as mapboxgl.GeoJSONSource | undefined
      if (satSrc) satSrc.setData(buildSatelliteGeoJSON(toggles, getPositions, selectedSatId))
      const vesselSrc = map.getSource('vessels') as mapboxgl.GeoJSONSource | undefined
      if (vesselSrc) vesselSrc.setData(buildVesselGeoJSON(vessels, selectedMmsi, vesselTypeToggles, cursorForFilter))
      const flightSrc = map.getSource('flights') as mapboxgl.GeoJSONSource | undefined
      if (flightSrc) flightSrc.setData(buildFlightGeoJSON(flights, selectedIcao, flightTypeToggles, cursorForFilter))
      const trailSrc = map.getSource('entity-trail') as mapboxgl.GeoJSONSource | undefined
      if (trailSrc) trailSrc.setData(buildTrailGeoJSON(flightHistory, vesselHistory, selectedIcao, selectedMmsi))
      const weatherSrc = map.getSource('weather-events') as mapboxgl.GeoJSONSource | undefined
      if (weatherSrc) weatherSrc.setData(buildWeatherGeoJSON(weatherEvents, selectedEventId, weatherTypeToggles, cursorForFilter))
      const alertSrc = map.getSource('weather-alerts') as mapboxgl.GeoJSONSource | undefined
      if (alertSrc) alertSrc.setData(buildWeatherAlertGeoJSON(weatherEvents, weatherTypeToggles))
      const newsSrc = map.getSource('news-events') as mapboxgl.GeoJSONSource | undefined
      if (newsSrc) newsSrc.setData(buildNewsGeoJSON(newsEvents, selectedNewsId, newsCategoryToggles, cursorForFilter))
      const conflictSrc = map.getSource('conflict-events') as mapboxgl.GeoJSONSource | undefined
      if (conflictSrc) conflictSrc.setData(buildConflictGeoJSON(conflictEvents, selectedConflictId, conflictTypeToggles, cursorForFilter))
      const cyberSrc = map.getSource('cyber-events') as mapboxgl.GeoJSONSource | undefined
      if (cyberSrc) cyberSrc.setData(buildCyberGeoJSON(cyberEvents, selectedCyberId, cyberTypeToggles, cursorForFilter))
      const osintSrc = map.getSource('osint-posts') as mapboxgl.GeoJSONSource | undefined
      if (osintSrc) osintSrc.setData(buildOsintGeoJSON(osintPosts, osintPlatformToggles, cursorForFilter))
      const portSrc = map.getSource('ports') as mapboxgl.GeoJSONSource | undefined
      if (portSrc) portSrc.setData(buildPortGeoJSON(portData, portVisible))
      const rfSrc = map.getSource('rf-spots') as mapboxgl.GeoJSONSource | undefined
      if (rfSrc) rfSrc.setData(buildRFGeoJSON(rfSpots, rfSourceToggles, selectedRFId))
      // const econSrc = map.getSource('economic') as mapboxgl.GeoJSONSource | undefined
      // if (econSrc) econSrc.setData(buildEconomicGeoJSON(econIndicators, selectedIndicator))
      const camSrc = map.getSource('cameras') as mapboxgl.GeoJSONSource | undefined
      if (camSrc) camSrc.setData(buildCameraGeoJSON(cameraData, cameraVisible))
    }
    map.on('style.load', syncAll)
    return () => { map.off('style.load', syncAll) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggles, getPositions, selectedSatId, satVersion, vessels, selectedMmsi, vesselVersion, vesselTypeToggles, flights, selectedIcao, flightVersion, flightTypeToggles, flightHistory, vesselHistory, weatherEvents, selectedEventId, weatherVersion, weatherTypeToggles, newsEvents, selectedNewsId, newsVersion, newsCategoryToggles, conflictEvents, selectedConflictId, conflictVersion, conflictTypeToggles, cyberEvents, selectedCyberId, cyberVersion, cyberTypeToggles, osintPosts, osintVersion, osintPlatformToggles, portData, portVersion, portVisible, rfSpots, rfVersion, rfSourceToggles, cameraData, cameraVersion, cameraVisible, cursorForFilter])

  const filterStyle = vizMode === 'thermal'
    ? `grayscale(1) brightness(${vizBrightness}) contrast(${vizContrast})`
    : vizMode === 'nvg'
    ? `brightness(${vizBrightness}) contrast(${vizContrast}) saturate(0.3) sepia(1) hue-rotate(70deg) saturate(2.5)`
    : VIZ_MODE_FILTERS[vizMode]

  return (
    <div className="fixed top-[46px] left-64 right-[272px] bottom-[34px]">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ filter: filterStyle }}
      />

      {/* CRT scanline + phosphor overlay */}
      {vizMode === 'crt' && (
        <>
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0px, rgba(0,0,0,0.25) 2px, transparent 2px, transparent 6px)',
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)',
            }}
          />
        </>
      )}

      {/* NVG green phosphor + vignette overlay */}
      {vizMode === 'nvg' && (
        <>
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(0,255,0,0.03) 0%, rgba(0,40,0,0.15) 60%, rgba(0,10,0,0.7) 100%)',
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.06) 0px, transparent 1px, transparent 2px)',
            }}
          />
        </>
      )}

      {/* Thermal FLIR vignette */}
      {vizMode === 'thermal' && (
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)',
          }}
        />
      )}

      {/* Map style toggle */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-20">
        <div className="flex w-fit rounded-md overflow-hidden border border-zinc-700 bg-zinc-900/90 backdrop-blur-sm">
          {(['dark', 'light', 'satellite'] as const).map((style, i) => (
            <button
              key={style}
              onClick={() => handleStyleChange(style)}
              className={cn(
                'px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors text-center',
                mapStyle === style
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'text-zinc-500 hover:text-zinc-300',
                i < 2 && 'border-r border-zinc-700',
              )}
            >
              {style === 'satellite' ? 'sat' : style}
            </button>
          ))}
        </div>

        {/* Visualization mode toggle */}
        <div
          className="flex w-fit rounded-md overflow-hidden border border-zinc-700 bg-zinc-900/90 backdrop-blur-sm"
          onMouseEnter={() => {
            if ((vizMode === 'nvg' || vizMode === 'thermal')) {
              if (vizPopoverTimeout.current) clearTimeout(vizPopoverTimeout.current)
              setVizPopoverOpen(true)
            }
          }}
          onMouseLeave={() => {
            vizPopoverTimeout.current = setTimeout(() => setVizPopoverOpen(false), 300)
          }}
        >
          {(['standard', 'nvg', 'thermal', 'crt'] as const).map((mode, i) => (
            <button
              key={mode}
              onClick={() => {
                setVizMode(mode)
                setVizPopoverOpen(mode === 'nvg' || mode === 'thermal')
                if ((mode === 'nvg' || mode === 'thermal') && mapStyle !== 'dark') {
                  handleStyleChange('dark')
                }
                if (mode === 'nvg') { setVizBrightness(1.6); setVizContrast(1.3) }
                else if (mode === 'thermal') { setVizBrightness(1.4); setVizContrast(1.3) }
              }}
              className={cn(
                'px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors text-center',
                vizMode === mode
                  ? mode === 'nvg' ? 'bg-green-500/20 text-green-400'
                    : mode === 'thermal' ? 'bg-red-500/20 text-red-400'
                    : mode === 'crt' ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-orange-500/20 text-orange-400'
                  : 'text-zinc-500 hover:text-zinc-300',
                i < 3 && 'border-r border-zinc-700',
              )}
            >
              {mode === 'standard' ? 'std' : mode}
            </button>
          ))}
        </div>

        {/* Brightness/Contrast popover — rendered outside the button row */}
        {(vizMode === 'nvg' || vizMode === 'thermal') && vizPopoverOpen && (
          <div
            className="w-48 bg-zinc-900/95 border border-zinc-700 rounded-md shadow-xl p-3 backdrop-blur-sm"
            onMouseEnter={() => {
              if (vizPopoverTimeout.current) clearTimeout(vizPopoverTimeout.current)
            }}
            onMouseLeave={() => {
              vizPopoverTimeout.current = setTimeout(() => setVizPopoverOpen(false), 300)
            }}
          >
            <div className="mb-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">Brightness</span>
                <span className="font-mono text-[9px] text-zinc-400">{vizBrightness.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.1"
                value={vizBrightness}
                onChange={(e) => setVizBrightness(parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-zinc-400"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">Contrast</span>
                <span className="font-mono text-[9px] text-zinc-400">{vizContrast.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={vizContrast}
                onChange={(e) => setVizContrast(parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-zinc-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* Map overlays */}
      <CoordinateHUD map={mapReady ? mapRef.current : null} />
      <MeasurementTool map={mapReady ? mapRef.current : null} />
      <GeofenceTool map={mapReady ? mapRef.current : null} />
      <div className="absolute top-3 left-[220px]">
        <MapScreenshot map={mapReady ? mapRef.current : null} />
      </div>
    </div>
  )
}
