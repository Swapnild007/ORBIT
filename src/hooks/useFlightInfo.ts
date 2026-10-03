import { useState, useEffect, useRef } from 'react'
import { fetchFlightInfo, type HexdbFlightInfo } from '@/lib/hexdb'

const EMPTY: HexdbFlightInfo = {
  aircraft: null,
  route: null,
  origin: null,
  destination: null,
  imageUrl: null,
}

export function useFlightInfo(icao24: string | null, callsign: string | null) {
  const [info, setInfo] = useState<HexdbFlightInfo>(EMPTY)
  const [loading, setLoading] = useState(false)
  const cacheRef = useRef(new Map<string, HexdbFlightInfo>())

  useEffect(() => {
    if (!icao24) {
      setInfo(EMPTY)
      return
    }

    const cached = cacheRef.current.get(icao24)
    if (cached) {
      setInfo(cached)
      return
    }

    let cancelled = false
    setLoading(true)

    fetchFlightInfo(icao24, callsign ?? '').then(result => {
      if (cancelled) return
      cacheRef.current.set(icao24, result)
      setInfo(result)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [icao24, callsign])

  return { info, loading }
}
