const MILITARY_PREFIXES = [
  'RCH', 'EVAC', 'DUKE', 'KING', 'JAKE', 'TOPCAT', 'NAVY', 'ARMY',
  'REACH', 'VALOR', 'HAWK', 'VIPER', 'BOLT', 'ROCK', 'FORCE',
]
const CARGO_AIRLINES = ['FDX', 'UPS', 'GTI', 'CLX', 'ABW', 'CKS', 'MPH', 'BOX', 'SQC']
const HELI_PREFIXES = ['LIFE', 'MEDEVAC', 'HELI', 'AIR1', 'MED']

export function classifyFlight(callsign: string): string {
  const cs = callsign.toUpperCase().trim()
  if (!cs) return 'other'
  if (MILITARY_PREFIXES.some(p => cs.startsWith(p))) return 'military'
  if (CARGO_AIRLINES.some(a => cs.startsWith(a))) return 'cargo'
  if (HELI_PREFIXES.some(p => cs.startsWith(p))) return 'helicopter'
  if (/^N\d/.test(cs)) return 'private'
  if (/^[A-Z]{3}\d/.test(cs)) return 'commercial'
  return 'other'
}
