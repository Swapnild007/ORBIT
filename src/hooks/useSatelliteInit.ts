import { useRef, useEffect } from 'react'
import { CONSTELLATIONS } from '@/data/constellations'
import { fetchConstellation } from '@/lib/celestrak'
import { Propagator } from '@/lib/propagator'
import {
  useSatelliteStore,
  _setPositionsData,
  _setSatellitesForConstellation,
  _removeConstellation,
} from '@/stores/satellite-store'
import type { ConstellationId } from '@/types'

const PROPAGATION_INTERVAL = 2000

export function useSatelliteInit() {
  const propagatorRef = useRef<Propagator | null>(null)
  const prevTogglesRef = useRef(new Map<ConstellationId, boolean>())
  const toggles = useSatelliteStore(s => s.toggles)

  if (!propagatorRef.current) {
    propagatorRef.current = new Propagator()
  }

  // Handle toggle changes — fetch/load/unload constellations
  useEffect(() => {
    const propagator = propagatorRef.current!
    const prev = prevTogglesRef.current

    for (const c of CONSTELLATIONS) {
      const wasOn = prev.get(c.id) ?? false
      const isOn = toggles.get(c.id) ?? false

      if (isOn && !wasOn) {
        useSatelliteStore.setState(s => ({
          loading: new Set([...s.loading, c.id]),
        }))
        fetchConstellation(c.celestrakGroup)
          .then(records => {
            const sats = propagator.loadConstellation(c.id, records)
            _setSatellitesForConstellation(c.id, sats)
            useSatelliteStore.setState(s => {
              const loading = new Set(s.loading)
              loading.delete(c.id)
              return { loading }
            })
            propagator.propagate().then(positions => {
              _setPositionsData(positions)
              useSatelliteStore.setState(s => ({ version: s.version + 1 }))
            })
          })
          .catch(err => {
            console.warn(`[Satellite] Failed to load ${c.id}:`, err)
            useSatelliteStore.setState(s => {
              const loading = new Set(s.loading)
              loading.delete(c.id)
              return { loading }
            })
          })
      } else if (!isOn && wasOn) {
        propagator.unloadConstellation(c.id)
        _removeConstellation(c.id)
        useSatelliteStore.setState(s => ({ version: s.version + 1 }))
      }
    }

    prevTogglesRef.current = new Map(toggles)
  }, [toggles])

  // Propagation loop
  useEffect(() => {
    const propagator = propagatorRef.current!
    const timer = setInterval(async () => {
      try {
        const positions = await propagator.propagate()
        _setPositionsData(positions)
        useSatelliteStore.setState(s => ({ version: s.version + 1 }))
      } catch (err) {
        console.warn('[Propagation]', err)
      }
    }, PROPAGATION_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  // Cleanup
  useEffect(() => {
    return () => propagatorRef.current?.dispose()
  }, [])
}
