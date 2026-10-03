/**
 * Extracts geographic locations from text using a dictionary of major
 * cities/countries and returns lat/lon coordinates.
 */

const LOCATION_DB: Record<string, [number, number]> = {
  // Countries
  'ukraine': [48.38, 31.17], 'russia': [61.52, 105.32], 'china': [35.86, 104.20],
  'taiwan': [23.70, 120.96], 'iran': [32.43, 53.69], 'iraq': [33.22, 43.68],
  'syria': [34.80, 38.99], 'israel': [31.05, 34.85], 'palestine': [31.95, 35.23],
  'gaza': [31.35, 34.31], 'lebanon': [33.85, 35.86], 'yemen': [15.55, 48.52],
  'afghanistan': [33.94, 67.71], 'pakistan': [30.38, 69.35], 'india': [20.59, 78.96],
  'north korea': [40.34, 127.51], 'south korea': [35.91, 127.77], 'japan': [36.20, 138.25],
  'turkey': [38.96, 35.24], 'egypt': [26.82, 30.80], 'libya': [26.34, 17.23],
  'sudan': [12.86, 30.22], 'somalia': [5.15, 46.20], 'ethiopia': [9.15, 40.49],
  'nigeria': [9.08, 8.68], 'south africa': [-30.56, 22.94], 'brazil': [-14.24, -51.93],
  'mexico': [23.63, -102.55], 'venezuela': [6.42, -66.59], 'colombia': [4.57, -74.30],
  'argentina': [-38.42, -63.62], 'myanmar': [21.91, 95.96], 'thailand': [15.87, 100.99],
  'philippines': [12.88, 121.77], 'indonesia': [-0.79, 113.92], 'australia': [-25.27, 133.78],
  'germany': [51.17, 10.45], 'france': [46.23, 2.21], 'united kingdom': [55.38, -3.44],
  'uk': [55.38, -3.44], 'us': [37.09, -95.71], 'usa': [37.09, -95.71],
  'united states': [37.09, -95.71], 'canada': [56.13, -106.35], 'poland': [51.92, 19.15],

  // Major cities
  'kyiv': [50.45, 30.52], 'moscow': [55.76, 37.62], 'beijing': [39.90, 116.40],
  'taipei': [25.03, 121.57], 'tehran': [35.69, 51.39], 'baghdad': [33.31, 44.37],
  'damascus': [33.51, 36.29], 'jerusalem': [31.77, 35.23], 'tel aviv': [32.09, 34.77],
  'beirut': [33.89, 35.50], 'kabul': [34.53, 69.17], 'islamabad': [33.69, 73.04],
  'new delhi': [28.61, 77.21], 'pyongyang': [39.04, 125.76], 'seoul': [37.57, 126.98],
  'tokyo': [35.68, 139.69], 'istanbul': [41.01, 28.98], 'cairo': [30.04, 31.24],
  'tripoli': [32.89, 13.18], 'khartoum': [15.50, 32.56], 'mogadishu': [2.05, 45.32],
  'lagos': [6.52, 3.38], 'johannesburg': [-26.20, 28.05], 'london': [51.51, -0.13],
  'paris': [48.86, 2.35], 'berlin': [52.52, 13.41], 'washington': [38.91, -77.04],
  'new york': [40.71, -74.01], 'los angeles': [34.05, -118.24],
  'hong kong': [22.40, 114.11], 'singapore': [1.35, 103.82], 'dubai': [25.20, 55.27],
  'riyadh': [24.71, 46.68], 'mumbai': [19.08, 72.88], 'shanghai': [31.23, 121.47],
  'bangkok': [13.76, 100.50], 'jakarta': [-6.21, 106.85], 'manila': [14.60, 120.98],
  'nairobi': [-1.29, 36.82], 'ankara': [39.93, 32.86], 'warsaw': [52.23, 21.01],
  'kharkiv': [49.99, 36.23], 'odesa': [46.48, 30.74], 'crimea': [44.95, 34.10],
  'donbas': [48.00, 37.80], 'mariupol': [47.10, 37.55],
}

export function extractLocations(text: string): Array<{ name: string; lat: number; lon: number }> {
  const lower = text.toLowerCase()
  const found: Array<{ name: string; lat: number; lon: number }> = []
  const seen = new Set<string>()

  for (const [name, [lat, lon]] of Object.entries(LOCATION_DB)) {
    if (seen.has(name)) continue
    // Match whole word (with possible punctuation after)
    const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (regex.test(lower)) {
      found.push({ name, lat, lon })
      seen.add(name)
    }
  }

  return found
}
