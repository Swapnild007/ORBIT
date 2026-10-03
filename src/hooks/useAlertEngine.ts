import { useEffect, useRef } from 'react'
import { useWeatherStore } from '@/stores/weather-store'
import { useConflictStore } from '@/stores/conflict-store'
import { useCyberStore } from '@/stores/cyber-store'
import { useVesselStore } from '@/stores/vessel-store'
import { useFlightStore } from '@/stores/flight-store'
import { useAlertStore } from '@/stores/alert-store'
import { useGeofenceStore } from '@/stores/geofence-store'
import { useSatelliteStore } from '@/stores/satellite-store'
import { useAlertRuleStore } from '@/stores/alert-rule-store'
import { evaluateRule } from '@/lib/rule-engine'
import type { Geofence } from '@/lib/persistence'

function inBbox(lat: number, lon: number, gf: Geofence): boolean {
  return lat >= gf.south && lat <= gf.north && lon >= gf.west && lon <= gf.east
}

/**
 * Watches data stores and auto-generates alerts for significant events:
 * - Earthquakes M5.0+
 * - High-fatality conflicts (fatalities > 10)
 * - Critical cyber threats (severity >= 8)
 * - Military vessels/aircraft appearing
 * - Geofence enter/exit for vessels, flights, and satellites
 */
export function useAlertEngine() {
  const weatherVersion = useWeatherStore(s => s.version)
  const conflictVersion = useConflictStore(s => s.version)
  const cyberVersion = useCyberStore(s => s.version)
  const vesselVersion = useVesselStore(s => s.version)
  const flightVersion = useFlightStore(s => s.version)
  const satelliteVersion = useSatelliteStore(s => s.version)
  const geofences = useGeofenceStore(s => s.geofences)
  const rules = useAlertRuleStore(s => s.rules)

  const seenRef = useRef(new Set<string>())
  // Track which entities are inside each geofence for exit detection
  // Key: "gfId:entityType:entityId", Value: true if currently inside
  const insideRef = useRef(new Map<string, boolean>())

  // Earthquake alerts
  useEffect(() => {
    const events = useWeatherStore.getState().events
    const addAlert = useAlertStore.getState().addAlert
    const seen = seenRef.current

    for (const [, e] of events) {
      const key = `wx-${e.id}`
      if (seen.has(key)) continue
      seen.add(key)

      if (e.type === 'earthquake' && e.magnitude !== null && e.magnitude >= 5.0) {
        addAlert({
          title: `M${e.magnitude.toFixed(1)} Earthquake`,
          description: e.title,
          severity: e.magnitude >= 7.0 ? 'critical' : e.magnitude >= 6.0 ? 'warning' : 'info',
          domain: 'weather',
          entityId: e.id,
        })
      }
      if (e.type === 'volcano') {
        addAlert({
          title: 'Volcanic Activity',
          description: e.title,
          severity: 'warning',
          domain: 'weather',
          entityId: e.id,
        })
      }
    }
  }, [weatherVersion])

  // Conflict alerts
  useEffect(() => {
    const events = useConflictStore.getState().events
    const addAlert = useAlertStore.getState().addAlert
    const seen = seenRef.current

    for (const [, e] of events) {
      const key = `con-${e.id}`
      if (seen.has(key)) continue
      seen.add(key)

      if (e.fatalities >= 10) {
        addAlert({
          title: `${e.type.charAt(0).toUpperCase() + e.type.slice(1)} — ${e.fatalities} fatalities`,
          description: e.title,
          severity: e.fatalities >= 50 ? 'critical' : 'warning',
          domain: 'conflict',
          entityId: e.id,
        })
      }
    }
  }, [conflictVersion])

  // Cyber alerts
  useEffect(() => {
    const events = useCyberStore.getState().events
    const addAlert = useAlertStore.getState().addAlert
    const seen = seenRef.current

    for (const [, e] of events) {
      const key = `cyb-${e.id}`
      if (seen.has(key)) continue
      seen.add(key)

      if (e.severity >= 8) {
        addAlert({
          title: `Critical ${e.type.toUpperCase()} Threat`,
          description: e.title,
          severity: 'critical',
          domain: 'cyber',
          entityId: e.id,
        })
      }
    }
  }, [cyberVersion])

  // Military vessel alerts
  useEffect(() => {
    const vessels = useVesselStore.getState().vessels
    const addAlert = useAlertStore.getState().addAlert
    const seen = seenRef.current

    for (const [, v] of vessels) {
      if (v.type !== 'military') continue
      const key = `mil-v-${v.mmsi}`
      if (seen.has(key)) continue
      seen.add(key)

      addAlert({
        title: 'Military Vessel Detected',
        description: `${v.name || `MMSI ${v.mmsi}`} at ${v.lat.toFixed(2)}, ${v.lon.toFixed(2)}`,
        severity: 'info',
        domain: 'vessel',
        entityId: String(v.mmsi),
      })
    }
  }, [vesselVersion])

  // Military aircraft alerts
  useEffect(() => {
    const flights = useFlightStore.getState().flights
    const addAlert = useAlertStore.getState().addAlert
    const seen = seenRef.current

    for (const [, f] of flights) {
      if (f.type !== 'military') continue
      const key = `mil-f-${f.icao24}`
      if (seen.has(key)) continue
      seen.add(key)

      addAlert({
        title: 'Military Aircraft Detected',
        description: `${f.callsign} (${f.originCountry}) at FL${Math.round(f.altitude * 3.28084 / 100)}`,
        severity: 'info',
        domain: 'flight',
        entityId: f.icao24,
      })
    }
  }, [flightVersion])

  // Geofence breach alerts — enter AND exit detection for vessels, flights, and satellites
  useEffect(() => {
    if (geofences.length === 0) return
    const addAlert = useAlertStore.getState().addAlert
    const inside = insideRef.current

    const vessels = useVesselStore.getState().vessels
    const flights = useFlightStore.getState().flights
    const satStore = useSatelliteStore.getState()

    for (const gf of geofences) {
      // --- Vessels ---
      for (const [, v] of vessels) {
        const trackKey = `${gf.id}:v:${v.mmsi}`
        const wasInside = inside.get(trackKey) ?? false
        const isInside = inBbox(v.lat, v.lon, gf)
        inside.set(trackKey, isInside)

        if (isInside && !wasInside && gf.alertOnEnter) {
          addAlert({
            title: `Vessel entered ${gf.name}`,
            description: `${v.name || `MMSI ${v.mmsi}`} entered geofence zone`,
            severity: 'warning',
            domain: 'vessel',
            entityId: String(v.mmsi),
          })
        }
        if (!isInside && wasInside && gf.alertOnExit) {
          addAlert({
            title: `Vessel exited ${gf.name}`,
            description: `${v.name || `MMSI ${v.mmsi}`} left geofence zone`,
            severity: 'info',
            domain: 'vessel',
            entityId: String(v.mmsi),
          })
        }
      }

      // --- Flights ---
      for (const [, f] of flights) {
        const trackKey = `${gf.id}:f:${f.icao24}`
        const wasInside = inside.get(trackKey) ?? false
        const isInside = inBbox(f.lat, f.lon, gf)
        inside.set(trackKey, isInside)

        if (isInside && !wasInside && gf.alertOnEnter) {
          addAlert({
            title: `Aircraft entered ${gf.name}`,
            description: `${f.callsign} entered geofence zone`,
            severity: 'warning',
            domain: 'flight',
            entityId: f.icao24,
          })
        }
        if (!isInside && wasInside && gf.alertOnExit) {
          addAlert({
            title: `Aircraft exited ${gf.name}`,
            description: `${f.callsign} left geofence zone`,
            severity: 'info',
            domain: 'flight',
            entityId: f.icao24,
          })
        }
      }

      // --- Satellites ---
      const toggles = satStore.toggles
      for (const [constId, enabled] of toggles) {
        if (!enabled) continue
        const positions = satStore.getPositions(constId)
        const satellites = satStore.getSatellites(constId)
        if (!positions) continue
        // Build noradId -> name lookup
        const nameMap = new Map<number, string>()
        for (const s of satellites) nameMap.set(s.noradId, s.name)

        for (const sat of positions) {
          const satName = nameMap.get(sat.noradId) ?? `NORAD ${sat.noradId}`
          const trackKey = `${gf.id}:s:${sat.noradId}`
          const wasInside = inside.get(trackKey) ?? false
          const isInside = inBbox(sat.lat, sat.lon, gf)
          inside.set(trackKey, isInside)

          if (isInside && !wasInside && gf.alertOnEnter) {
            addAlert({
              title: `Satellite over ${gf.name}`,
              description: `${satName} entered geofence zone at ${sat.alt.toFixed(0)}km alt`,
              severity: 'info',
              domain: 'satellite',
              entityId: String(sat.noradId),
            })
          }
          if (!isInside && wasInside && gf.alertOnExit) {
            addAlert({
              title: `Satellite left ${gf.name}`,
              description: `${satName} exited geofence zone`,
              severity: 'info',
              domain: 'satellite',
              entityId: String(sat.noradId),
            })
          }
        }
      }
    }
  }, [vesselVersion, flightVersion, satelliteVersion, geofences])

  // Custom alert rules evaluation
  useEffect(() => {
    const enabledRules = rules.filter(r => r.enabled)
    if (enabledRules.length === 0) return

    const addAlert = useAlertStore.getState().addAlert
    const updateRule = useAlertRuleStore.getState().updateRule
    const seen = seenRef.current

    // Collect all entities into a flat list for rule evaluation
    type EntityInfo = { domain: string; id: string; title: string; description: string; lat?: number; lon?: number; severity?: number }
    const entities: EntityInfo[] = []

    const vessels = useVesselStore.getState().vessels
    for (const [, v] of vessels) {
      entities.push({ domain: 'vessel', id: String(v.mmsi), title: v.name || `MMSI ${v.mmsi}`, description: `${v.type} vessel`, lat: v.lat, lon: v.lon })
    }

    const flights = useFlightStore.getState().flights
    for (const [, f] of flights) {
      entities.push({ domain: 'flight', id: f.icao24, title: f.callsign, description: `${f.type} aircraft from ${f.originCountry}`, lat: f.lat, lon: f.lon })
    }

    const weatherEvents = useWeatherStore.getState().events
    for (const [, e] of weatherEvents) {
      entities.push({ domain: 'weather', id: e.id, title: e.title, description: e.type, lat: e.lat, lon: e.lon, severity: e.magnitude ?? undefined })
    }

    const conflictEvents = useConflictStore.getState().events
    for (const [, e] of conflictEvents) {
      entities.push({ domain: 'conflict', id: e.id, title: e.title, description: `${e.type} — ${e.fatalities} fatalities`, lat: e.lat, lon: e.lon, severity: e.fatalities })
    }

    const cyberEvents = useCyberStore.getState().events
    for (const [, e] of cyberEvents) {
      entities.push({ domain: 'cyber', id: e.id, title: e.title, description: e.type, lat: e.lat, lon: e.lon, severity: e.severity })
    }

    const gfs = useGeofenceStore.getState().geofences

    for (const rule of enabledRules) {
      for (const entity of entities) {
        const key = `rule-${rule.id}-${entity.domain}-${entity.id}`
        if (seen.has(key)) continue

        if (evaluateRule(rule, entity, gfs)) {
          seen.add(key)
          addAlert({
            title: `Rule: ${rule.name}`,
            description: `${entity.title} — ${entity.description}`,
            severity: rule.alertSeverity,
            domain: entity.domain,
            entityId: entity.id,
          })
          updateRule(rule.id, { lastTriggered: Date.now() })
        }
      }
    }
  }, [rules, vesselVersion, flightVersion, weatherVersion, conflictVersion, cyberVersion])
}
