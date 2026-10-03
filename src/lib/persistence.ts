/**
 * IndexedDB persistence for Eagle Eye.
 * Stores alerts (7 days), timeseries snapshots (24h), watchlist, and geofences.
 */

const DB_NAME = 'eagle-eye'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('alerts')) {
        const alertStore = db.createObjectStore('alerts', { keyPath: 'id' })
        alertStore.createIndex('time', 'time')
      }
      if (!db.objectStoreNames.contains('timeseries')) {
        const tsStore = db.createObjectStore('timeseries', { keyPath: 'timestamp' })
        tsStore.createIndex('timestamp', 'timestamp')
      }
      if (!db.objectStoreNames.contains('watchlist')) {
        db.createObjectStore('watchlist', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('geofences')) {
        db.createObjectStore('geofences', { keyPath: 'id' })
      }
    }
  })
}

// ─── Alerts ──────────────────────────────────────────────────────────────

export interface PersistedAlert {
  id: string
  title: string
  description: string
  severity: string
  domain: string
  entityId: string | null
  time: number
  acknowledged: boolean
}

const ALERT_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function persistAlerts(alerts: PersistedAlert[]): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction('alerts', 'readwrite')
    const store = tx.objectStore('alerts')

    // Clear old alerts
    const cutoff = Date.now() - ALERT_TTL
    const idx = store.index('time')
    const range = IDBKeyRange.upperBound(cutoff)
    const cursor = idx.openCursor(range)
    cursor.onsuccess = () => {
      const c = cursor.result
      if (c) { c.delete(); c.continue() }
    }

    // Write current alerts
    for (const alert of alerts) {
      store.put(alert)
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  } catch { /* IndexedDB unavailable */ }
}

export async function loadAlerts(): Promise<PersistedAlert[]> {
  try {
    const db = await openDB()
    const tx = db.transaction('alerts', 'readonly')
    const store = tx.objectStore('alerts')
    const req = store.getAll()
    return new Promise((resolve, reject) => {
      req.onsuccess = () => { db.close(); resolve(req.result ?? []) }
      req.onerror = () => { db.close(); reject(req.error) }
    })
  } catch { return [] }
}

// ─── Timeseries ──────────────────────────────────────────────────────────

export interface TimeseriesSnapshot {
  timestamp: number
  satellites: number
  vessels: number
  flights: number
  weather: number
  news: number
  conflicts: number
  cyber: number
  osint: number
  alerts: number
}

const TIMESERIES_TTL = 24 * 60 * 60 * 1000 // 24h

export async function persistSnapshot(snapshot: TimeseriesSnapshot): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction('timeseries', 'readwrite')
    const store = tx.objectStore('timeseries')

    // Clean old entries
    const cutoff = Date.now() - TIMESERIES_TTL
    const idx = store.index('timestamp')
    const range = IDBKeyRange.upperBound(cutoff)
    const cursor = idx.openCursor(range)
    cursor.onsuccess = () => {
      const c = cursor.result
      if (c) { c.delete(); c.continue() }
    }

    store.put(snapshot)

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  } catch { /* IndexedDB unavailable */ }
}

export async function loadTimeseries(): Promise<TimeseriesSnapshot[]> {
  try {
    const db = await openDB()
    const tx = db.transaction('timeseries', 'readonly')
    const store = tx.objectStore('timeseries')
    const req = store.getAll()
    return new Promise((resolve, reject) => {
      req.onsuccess = () => { db.close(); resolve(req.result ?? []) }
      req.onerror = () => { db.close(); reject(req.error) }
    })
  } catch { return [] }
}

// ─── Geofences ───────────────────────────────────────────────────────────

export interface Geofence {
  id: string
  name: string
  north: number
  south: number
  east: number
  west: number
  alertOnEnter: boolean
  alertOnExit: boolean
}

export async function persistGeofences(geofences: Geofence[]): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction('geofences', 'readwrite')
    const store = tx.objectStore('geofences')
    store.clear()
    for (const gf of geofences) store.put(gf)
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  } catch { /* IndexedDB unavailable */ }
}

export async function loadGeofences(): Promise<Geofence[]> {
  try {
    const db = await openDB()
    const tx = db.transaction('geofences', 'readonly')
    const store = tx.objectStore('geofences')
    const req = store.getAll()
    return new Promise((resolve, reject) => {
      req.onsuccess = () => { db.close(); resolve(req.result ?? []) }
      req.onerror = () => { db.close(); reject(req.error) }
    })
  } catch { return [] }
}
