import { useEffect } from 'react'
import { FlightClient } from '@/lib/flight-client'
import { useFlightStore } from '@/stores/flight-store'

export function useFlightInit() {
  useEffect(() => {
    const client = new FlightClient()
    const { history } = useFlightStore.getState()

    client.onUpdate = () => {
      for (const [icao24, f] of client.flights) {
        history.record(icao24, f.lon, f.lat)
      }
      useFlightStore.setState(s => ({
        flights: client.flights,
        connected: client.connected,
        count: client.flights.size,
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
