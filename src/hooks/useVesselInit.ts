import { useEffect } from 'react'
import { AisClient } from '@/lib/ais-client'
import { useVesselStore } from '@/stores/vessel-store'

export function useVesselInit() {
  useEffect(() => {
    const client = new AisClient()
    const { history } = useVesselStore.getState()

    client.onUpdate = () => {
      for (const [mmsi, v] of client.vessels) {
        history.record(mmsi, v.lon, v.lat)
      }
      useVesselStore.setState(s => ({
        vessels: client.vessels,
        connected: client.connected,
        count: client.vessels.size,
        version: s.version + 1,
      }))
    }

    client.connect()

    return () => {
      client.onUpdate = null
      client.disconnect()
    }
  }, [])
}
