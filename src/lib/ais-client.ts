import type { VesselRecord, VesselType } from '@/types'

const PROXY_URL = 'ws://localhost:4000/ws/ais'
const THROTTLE_MS = 2000

export function mapShipType(typeCode: number): VesselType {
  if (typeCode >= 70 && typeCode <= 79) return 'cargo'
  if (typeCode >= 80 && typeCode <= 89) return 'tanker'
  if (typeCode >= 60 && typeCode <= 69) return 'passenger'
  if (typeCode === 30) return 'fishing'
  if (typeCode === 35) return 'military'
  if (typeCode >= 31 && typeCode <= 32) return 'tug'
  if (typeCode >= 36 && typeCode <= 37) return 'pleasure'
  return 'other'
}

export class AisClient {
  vessels = new Map<number, VesselRecord>()
  onUpdate: (() => void) | null = null

  private ws: WebSocket | null = null
  private throttleTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private dirty = false
  private _connected = false
  private _disposed = false

  get connected() {
    return this._connected
  }

  connect() {
    if (this.ws || this._disposed) return

    this.ws = new WebSocket(PROXY_URL)

    this.ws.onopen = () => {
      this._connected = true
      this.onUpdate?.()
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.MessageType !== 'PositionReport') return

        const meta = msg.MetaData
        const report = msg.Message?.PositionReport
        if (!meta || !report) return

        const mmsi = meta.MMSI
        if (!mmsi || typeof mmsi !== 'number') return

        const lat = report.Latitude ?? meta.latitude
        const lon = report.Longitude ?? meta.longitude
        if (lat == null || lon == null || (lat === 0 && lon === 0)) return

        const vessel: VesselRecord = {
          mmsi,
          name: (meta.ShipName ?? '').trim() || `MMSI ${mmsi}`,
          type: mapShipType(meta.ShipType ?? 0),
          lat,
          lon,
          speed: report.Sog ?? 0,
          course: report.Cog ?? 0,
          heading: report.TrueHeading ?? 0,
          navStatus: report.NavigationalStatus ?? 15,
          lastUpdate: Date.now(),
        }

        this.vessels.set(mmsi, vessel)
        this.dirty = true

        if (!this.throttleTimer) {
          this.throttleTimer = setTimeout(() => {
            this.throttleTimer = null
            if (this.dirty) {
              this.dirty = false
              this.onUpdate?.()
            }
          }, THROTTLE_MS)
        }
      } catch {
        // skip malformed messages
      }
    }

    this.ws.onclose = () => {
      this._connected = false
      this.ws = null
      this.onUpdate?.()
      // Reconnect after 3s
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null
        this.connect()
      }, 3000)
    }

    this.ws.onerror = () => {
      // onclose will fire after this
    }
  }

  disconnect() {
    this._disposed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer)
      this.throttleTimer = null
    }
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
    this._connected = false
  }
}
