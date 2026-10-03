import { json2satrec, propagate, gstime, eciToGeodetic, degreesLong, degreesLat } from 'satellite.js'
import type { OmmRecord } from '@/types'

type SatRec = ReturnType<typeof json2satrec>

interface InitMessage {
  type: 'init'
  constellationId: string
  records: OmmRecord[]
}

interface PropagateMessage {
  type: 'propagate'
  timestamp: number
}

interface DisposeMessage {
  type: 'dispose'
  constellationId: string
}

// Store satrecs keyed by constellation
const satrecMap = new Map<string, { noradId: number; satrec: SatRec }[]>()

const ctx = self as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage: (msg: unknown, opts?: unknown) => void }

ctx.onmessage = (e: MessageEvent<InitMessage | PropagateMessage | DisposeMessage>) => {
  const msg = e.data

  if (msg.type === 'init') {
    const entries: { noradId: number; satrec: SatRec }[] = []
    for (const rec of msg.records) {
      try {
        // Cast needed because our OmmRecord CLASSIFICATION_TYPE is narrower than the union
        const satrec = json2satrec(rec as Parameters<typeof json2satrec>[0])
        if (satrec.error === 0) {
          entries.push({ noradId: rec.NORAD_CAT_ID, satrec })
        }
      } catch { /* skip bad records */ }
    }
    satrecMap.set(msg.constellationId, entries)
    ctx.postMessage({ type: 'init_done', constellationId: msg.constellationId, count: entries.length })
    return
  }

  if (msg.type === 'dispose') {
    satrecMap.delete(msg.constellationId)
    return
  }

  if (msg.type === 'propagate') {
    const date = new Date(msg.timestamp)
    const gmst = gstime(date)

    // Count total sats
    let total = 0
    for (const entries of satrecMap.values()) total += entries.length

    // 5 floats per satellite: noradId, lat, lon, alt, velocity
    const buffer = new Float64Array(total * 5)
    let offset = 0

    for (const entries of satrecMap.values()) {
      for (const { noradId, satrec } of entries) {
        try {
          const pv = propagate(satrec, date)
          if (!pv || typeof pv.position === 'boolean' || typeof pv.velocity === 'boolean') continue
          if (!pv.position || !pv.velocity) continue

          const geo = eciToGeodetic(pv.position, gmst)
          const vel = pv.velocity
          const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z)

          buffer[offset]     = noradId
          buffer[offset + 1] = degreesLat(geo.latitude)
          buffer[offset + 2] = degreesLong(geo.longitude)
          buffer[offset + 3] = geo.height
          buffer[offset + 4] = speed
          offset += 5
        } catch { /* skip propagation errors */ }
      }
    }

    const result = buffer.slice(0, offset)
    ctx.postMessage(
      { type: 'positions', buffer: result.buffer, count: offset / 5 },
      { transfer: [result.buffer] },
    )
  }
}
