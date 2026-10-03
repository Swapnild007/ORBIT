import type { FlightRecord, FlightType } from '@/types'

const PROXY_URL = 'ws://localhost:4000/ws/flights'
const THROTTLE_MS = 2000

export class FlightClient {
  flights = new Map<string, FlightRecord>()
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
        if (msg.type !== 'flights' || !Array.isArray(msg.flights)) return

        // Batch replace: clear and rebuild
        this.flights.clear()
        for (const f of msg.flights) {
          if (f.onGround) continue
          if (f.lat == null || f.lon == null) continue

          const record: FlightRecord = {
            icao24: f.icao24,
            callsign: f.callsign ?? f.icao24.toUpperCase(),
            type: (f.type ?? 'other') as FlightType,
            originCountry: f.originCountry ?? '',
            lat: f.lat,
            lon: f.lon,
            altitude: f.altitude ?? 0,
            speed: f.speed ?? 0,
            heading: f.heading ?? 0,
            verticalRate: f.verticalRate ?? 0,
            onGround: false,
            lastUpdate: f.lastUpdate ?? Date.now(),
          }

          this.flights.set(record.icao24, record)
        }

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
