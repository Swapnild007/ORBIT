import type { OmmRecord } from '@/types'

const BASE_URL = 'https://celestrak.org/NORAD/elements/gp.php'
const CACHE_TTL = 2 * 60 * 60 * 1000 // 2 hours

const cache = new Map<string, { data: OmmRecord[]; timestamp: number }>()

export async function fetchConstellation(group: string): Promise<OmmRecord[]> {
  const cached = cache.get(group)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  try {
    const res = await fetch(`${BASE_URL}?GROUP=${encodeURIComponent(group)}&FORMAT=json`)
    if (!res.ok) throw new Error(`CelesTrak ${res.status}`)
    const data: OmmRecord[] = await res.json()
    cache.set(group, { data, timestamp: Date.now() })
    return data
  } catch (err) {
    console.warn(`[CelesTrak] Failed to fetch group "${group}":`, err)
    return cached?.data ?? []
  }
}

export function getLastFetchTime(group: string): number | null {
  return cache.get(group)?.timestamp ?? null
}
