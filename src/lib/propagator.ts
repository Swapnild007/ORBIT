import { json2satrec } from 'satellite.js'
import { propagateBatch, type SatrecEntry } from './propagation-kernel'
import type { ConstellationId, OmmRecord, SatellitePosition, SatelliteRecord } from '@/types'

type SatRec = ReturnType<typeof json2satrec>

const WORKER_THRESHOLD = 200

export class Propagator {
  private worker: Worker | null = null
  private mainEntries = new Map<ConstellationId, SatrecEntry[]>()
  private workerConstellations = new Set<ConstellationId>()
  private allSatellites = new Map<ConstellationId, SatelliteRecord[]>()
  private pendingResolve: ((positions: Map<ConstellationId, SatellitePosition[]>) => void) | null = null
  private workerPositions: SatellitePosition[] = []
  private totalWorkerSats = 0

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('./propagation.worker.ts', import.meta.url),
        { type: 'module' },
      )
      this.worker.onmessage = (e) => this.handleWorkerMessage(e)
    }
    return this.worker
  }

  private handleWorkerMessage(e: MessageEvent) {
    if (e.data.type === 'init_done') {
      // Worker initialized constellation
      return
    }

    if (e.data.type === 'positions') {
      const buffer = new Float64Array(e.data.buffer)
      const count = e.data.count as number
      this.workerPositions = []
      for (let i = 0; i < count; i++) {
        const off = i * 5
        this.workerPositions.push({
          noradId:  buffer[off],
          lat:      buffer[off + 1],
          lon:      buffer[off + 2],
          alt:      buffer[off + 3],
          velocity: buffer[off + 4],
        })
      }
      if (this.pendingResolve) {
        const resolve = this.pendingResolve
        this.pendingResolve = null
        resolve(this.buildResult())
      }
    }
  }

  loadConstellation(id: ConstellationId, records: OmmRecord[]): SatelliteRecord[] {
    const satellites: SatelliteRecord[] = []
    const entries: SatrecEntry[] = []

    for (const rec of records) {
      try {
        const satrec = json2satrec(rec as Parameters<typeof json2satrec>[0]) as SatRec
        if ((satrec as { error: number }).error !== 0) continue

        entries.push({ noradId: rec.NORAD_CAT_ID, satrec: satrec as SatrecEntry['satrec'] })
        satellites.push({
          noradId: rec.NORAD_CAT_ID,
          name: rec.OBJECT_NAME,
          constellationId: id,
          satrec,
          epoch: new Date(rec.EPOCH.endsWith('Z') ? rec.EPOCH : rec.EPOCH + 'Z'),
          inclination: rec.INCLINATION,
          period: 1440 / rec.MEAN_MOTION,
          eccentricity: rec.ECCENTRICITY,
        })
      } catch { /* skip bad records */ }
    }

    this.allSatellites.set(id, satellites)

    // Decide if this goes to worker or main thread
    if (entries.length > WORKER_THRESHOLD) {
      this.workerConstellations.add(id)
      this.mainEntries.delete(id)
      const worker = this.getWorker()
      worker.postMessage({ type: 'init', constellationId: id, records })
    } else {
      this.workerConstellations.delete(id)
      this.mainEntries.set(id, entries)
    }

    this.totalWorkerSats = 0
    for (const cid of this.workerConstellations) {
      this.totalWorkerSats += (this.allSatellites.get(cid)?.length ?? 0)
    }

    return satellites
  }

  unloadConstellation(id: ConstellationId) {
    this.mainEntries.delete(id)
    this.allSatellites.delete(id)
    if (this.workerConstellations.has(id)) {
      this.workerConstellations.delete(id)
      this.worker?.postMessage({ type: 'dispose', constellationId: id })
    }
  }

  async propagate(): Promise<Map<ConstellationId, SatellitePosition[]>> {
    const now = new Date()

    // Propagate main thread constellations
    for (const [id, entries] of this.mainEntries) {
      // Propagate synchronously for small constellations
      const positions = propagateBatch(entries, now)
      // Store temporarily — will be collected in buildResult
      this.mainEntries.set(id, entries) // entries unchanged, just trigger
    }

    // If no worker constellations, build result immediately
    if (this.workerConstellations.size === 0) {
      return this.buildResultSync(now)
    }

    // Request worker propagation
    const worker = this.getWorker()
    worker.postMessage({ type: 'propagate', timestamp: now.getTime() })

    // Wait for worker response
    return new Promise((resolve) => {
      this.pendingResolve = resolve
    })
  }

  private buildResultSync(date: Date): Map<ConstellationId, SatellitePosition[]> {
    const result = new Map<ConstellationId, SatellitePosition[]>()
    for (const [id, entries] of this.mainEntries) {
      result.set(id, propagateBatch(entries, date))
    }
    return result
  }

  private buildResult(): Map<ConstellationId, SatellitePosition[]> {
    const now = new Date()
    const result = new Map<ConstellationId, SatellitePosition[]>()

    // Main thread constellations
    for (const [id, entries] of this.mainEntries) {
      result.set(id, propagateBatch(entries, now))
    }

    // Worker positions — index by noradId to constellation
    const noradToConstellation = new Map<number, ConstellationId>()
    for (const [cid, sats] of this.allSatellites) {
      if (this.workerConstellations.has(cid)) {
        for (const s of sats) noradToConstellation.set(s.noradId, cid)
      }
    }

    for (const pos of this.workerPositions) {
      const cid = noradToConstellation.get(pos.noradId)
      if (!cid) continue
      let arr = result.get(cid)
      if (!arr) { arr = []; result.set(cid, arr) }
      arr.push(pos)
    }

    return result
  }

  getSatellites(id: ConstellationId): SatelliteRecord[] {
    return this.allSatellites.get(id) ?? []
  }

  dispose() {
    this.worker?.terminate()
    this.worker = null
    this.mainEntries.clear()
    this.workerConstellations.clear()
    this.allSatellites.clear()
  }
}
