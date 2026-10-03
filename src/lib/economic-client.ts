/**
 * Economic data parsers for World Bank and FRED.
 */

export interface EconomicIndicator {
  id: string
  country: string
  countryCode: string
  indicator: string
  indicatorId: string
  value: number | null
  year: number
  lat: number
  lon: number
  lastUpdate: number
}

// Country centroids for mapping economic data
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  'US': [37.09, -95.71], 'CN': [35.86, 104.20], 'JP': [36.20, 138.25],
  'DE': [51.17, 10.45], 'GB': [55.38, -3.44], 'FR': [46.23, 2.21],
  'IN': [20.59, 78.96], 'IT': [41.87, 12.56], 'BR': [-14.24, -51.93],
  'CA': [56.13, -106.35], 'KR': [35.91, 127.77], 'RU': [61.52, 105.32],
  'AU': [-25.27, 133.78], 'ES': [40.46, -3.75], 'MX': [23.63, -102.55],
  'ID': [-0.79, 113.92], 'NL': [52.13, 5.29], 'SA': [23.89, 45.08],
  'TR': [38.96, 35.24], 'CH': [46.82, 8.23], 'PL': [51.92, 19.15],
  'SE': [60.13, 18.64], 'BE': [50.50, 4.47], 'AR': [-38.42, -63.62],
  'NO': [60.47, 8.47], 'AT': [47.52, 14.55], 'TH': [15.87, 100.99],
  'IL': [31.05, 34.85], 'ZA': [-30.56, 22.94], 'EG': [26.82, 30.80],
  'NG': [9.08, 8.68], 'PK': [30.38, 69.35], 'MY': [4.21, 101.98],
  'PH': [12.88, 121.77], 'SG': [1.35, 103.82], 'VN': [14.06, 108.28],
  'BD': [23.68, 90.36], 'CL': [-35.68, -71.54], 'CO': [4.57, -74.30],
  'UA': [48.38, 31.17], 'KE': [-0.02, 37.91], 'ET': [9.15, 40.49],
  'TW': [23.70, 120.96], 'AE': [23.42, 53.85], 'QA': [25.35, 51.18],
}

export function parseWorldBankData(json: unknown, indicatorId: string, indicatorName: string): EconomicIndicator[] {
  // World Bank returns [metadata, data]
  const arr = json as [unknown, Array<{
    country?: { id?: string; value?: string }
    date?: string
    value?: number | null
  }>]

  if (!Array.isArray(arr) || !Array.isArray(arr[1])) return []

  const results: EconomicIndicator[] = []
  for (const item of arr[1]) {
    const code = item.country?.id ?? ''
    const centroid = COUNTRY_CENTROIDS[code]
    if (!centroid || item.value == null) continue

    results.push({
      id: `wb-${indicatorId}-${code}-${item.date}`,
      country: item.country?.value ?? code,
      countryCode: code,
      indicator: indicatorName,
      indicatorId,
      value: item.value,
      year: parseInt(item.date ?? '0'),
      lat: centroid[0],
      lon: centroid[1],
      lastUpdate: Date.now(),
    })
  }

  return results
}

export const ECONOMIC_INDICATORS = [
  { id: 'NY.GDP.MKTP.CD', name: 'GDP (current US$)' },
  { id: 'NY.GDP.MKTP.KD.ZG', name: 'GDP Growth (annual %)' },
  { id: 'FP.CPI.TOTL.ZG', name: 'Inflation (CPI, annual %)' },
  { id: 'SL.UEM.TOTL.ZS', name: 'Unemployment (% of labor force)' },
  { id: 'BN.CAB.XOKA.CD', name: 'Current Account Balance (US$)' },
] as const
