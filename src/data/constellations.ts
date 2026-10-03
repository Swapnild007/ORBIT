import type { ConstellationMeta, SatCategory } from '@/types'

export const CATEGORY_COLORS: Record<SatCategory, number> = {
  station:      0xef4444,
  comms:        0x3b82f6,
  nav:          0x22c55e,
  weather:      0x06b6d4,
  'earth-obs':  0xa855f7,
  scientific:   0xf59e0b,
  military:     0xf97316,
  amateur:      0xec4899,
}

export const CATEGORY_LABELS: Record<SatCategory, string> = {
  station:      'Space Stations',
  comms:        'Communications',
  nav:          'Navigation',
  weather:      'Weather',
  'earth-obs':  'Earth Observation',
  scientific:   'Scientific',
  military:     'Military',
  amateur:      'Amateur',
}

export const CONSTELLATIONS: ConstellationMeta[] = [
  // Space Stations
  { id: 'iss',           name: 'ISS',            category: 'station',    celestrakGroup: 'stations',      color: 0xef4444, defaultOn: true },

  // Communications
  { id: 'starlink',      name: 'Starlink',       category: 'comms',      celestrakGroup: 'starlink',      color: 0x3b82f6, defaultOn: false },
  { id: 'oneweb',        name: 'OneWeb',          category: 'comms',      celestrakGroup: 'oneweb',        color: 0x60a5fa, defaultOn: false },
  { id: 'iridium',       name: 'Iridium',         category: 'comms',      celestrakGroup: 'iridium',       color: 0x2563eb, defaultOn: false },
  { id: 'iridium-next',  name: 'Iridium NEXT',    category: 'comms',      celestrakGroup: 'iridium-NEXT',  color: 0x1d4ed8, defaultOn: false },
  { id: 'globalstar',    name: 'Globalstar',      category: 'comms',      celestrakGroup: 'globalstar',    color: 0x93c5fd, defaultOn: false },
  { id: 'orbcomm',       name: 'ORBCOMM',         category: 'comms',      celestrakGroup: 'orbcomm',       color: 0x7dd3fc, defaultOn: false },
  { id: 'ses',           name: 'SES',             category: 'comms',      celestrakGroup: 'ses',           color: 0x38bdf8, defaultOn: false },
  { id: 'intelsat',      name: 'Intelsat',        category: 'comms',      celestrakGroup: 'intelsat',      color: 0x0ea5e9, defaultOn: false },
  { id: 'telesat',       name: 'Telesat',         category: 'comms',      celestrakGroup: 'telesat',       color: 0x0284c7, defaultOn: false },

  // Navigation
  { id: 'gps',           name: 'GPS',             category: 'nav',        celestrakGroup: 'gps-ops',       color: 0x22c55e, defaultOn: true },
  { id: 'glonass',       name: 'GLONASS',         category: 'nav',        celestrakGroup: 'glo-ops',       color: 0x4ade80, defaultOn: false },
  { id: 'galileo',       name: 'Galileo',         category: 'nav',        celestrakGroup: 'galileo',       color: 0x86efac, defaultOn: false },
  { id: 'beidou',        name: 'BeiDou',          category: 'nav',        celestrakGroup: 'beidou',        color: 0x16a34a, defaultOn: false },

  // Weather
  { id: 'noaa',          name: 'NOAA',            category: 'weather',    celestrakGroup: 'noaa',          color: 0x06b6d4, defaultOn: false },
  { id: 'goes',          name: 'GOES',            category: 'weather',    celestrakGroup: 'goes',          color: 0x22d3ee, defaultOn: false },
  { id: 'meteosat',      name: 'Meteosat',        category: 'weather',    celestrakGroup: 'resource',      color: 0x67e8f9, defaultOn: false },

  // Earth Observation
  { id: 'landsat',       name: 'Landsat',         category: 'earth-obs',  celestrakGroup: 'resource',      color: 0xa855f7, defaultOn: false },
  { id: 'sentinel',      name: 'Sentinel',        category: 'earth-obs',  celestrakGroup: 'resource',      color: 0xc084fc, defaultOn: false },
  { id: 'planet',        name: 'Planet Labs',     category: 'earth-obs',  celestrakGroup: 'planet',        color: 0xd8b4fe, defaultOn: false },

  // Scientific
  { id: 'science',       name: 'Science',         category: 'scientific', celestrakGroup: 'science',       color: 0xf59e0b, defaultOn: false },

  // Military
  { id: 'military-sat',  name: 'Military',        category: 'military',   celestrakGroup: 'military',      color: 0xf97316, defaultOn: false },

  // Amateur
  { id: 'amateur',       name: 'Amateur Radio',   category: 'amateur',    celestrakGroup: 'amateur',       color: 0xec4899, defaultOn: false },
]
