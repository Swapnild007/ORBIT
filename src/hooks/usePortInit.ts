import { useEffect } from 'react'
import { usePortStore } from '@/stores/port-store'
import type { Port } from '@/lib/ports-client'

export function usePortInit() {
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/ports/data')
        if (!res.ok) return
        const json = await res.json() as { ports: Port[]; errors: string[] }
        if (cancelled) return

        const ports = json.ports ?? []
        usePortStore.getState().setPorts(ports)
      } catch {
        // Ports are non-critical, fail silently
      }
    }

    load()
    // Ports are mostly static, reload every 24 hours
    const interval = setInterval(load, 86_400_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])
}
