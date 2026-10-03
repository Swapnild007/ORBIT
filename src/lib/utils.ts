import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function utcTimeString(date: Date = new Date()): string {
  return [
    String(date.getUTCHours()).padStart(2, '0'),
    String(date.getUTCMinutes()).padStart(2, '0'),
    String(date.getUTCSeconds()).padStart(2, '0'),
  ].join(':') + 'Z'
}

export function utcDateString(date: Date = new Date()): string {
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${String(date.getUTCDate()).padStart(2, '0')} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

export function elapsedString(ms: number): string {
  const s = Math.floor(ms / 1000)
  return [
    String(Math.floor(s / 3600)).padStart(2, '0'),
    String(Math.floor((s % 3600) / 60)).padStart(2, '0'),
    String(s % 60).padStart(2, '0'),
  ].join(':')
}

/** Haversine great-circle distance in kilometres between two points */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371 // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Initial bearing (forward azimuth) in degrees from point 1 to point 2 */
export function initialBearing(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}