import { useState, useRef, useEffect } from 'react'
import { Pip } from '@/components/ui/Pip'
import { useClock } from '@/hooks/useClock'
import { useAppStore } from '@/stores/app-store'
import { useSatelliteStore } from '@/stores/satellite-store'
import { useVesselStore } from '@/stores/vessel-store'
import { useFlightStore } from '@/stores/flight-store'
import { useWeatherStore } from '@/stores/weather-store'
import { useNewsStore } from '@/stores/news-store'
import { useConflictStore } from '@/stores/conflict-store'
import { useCyberStore } from '@/stores/cyber-store'
// import { useOsintStore } from '@/stores/osint-store'
import { usePortStore } from '@/stores/port-store'
import { useRFStore } from '@/stores/rf-store'
// import { useEconomicStore } from '@/stores/economic-store'
import { useCameraStore } from '@/stores/camera-store'
import { useAlertStore } from '@/stores/alert-store'
import { useWatchlistStore } from '@/stores/watchlist-store'
import type { NavView } from '@/types'

const NAV_VIEWS: NavView[] = ['Globe', 'Objects', 'Graph', 'Signals', 'Reports']

interface RegionPreset {
  label: string
  center: [number, number]
  zoom: number
}

const REGION_PRESETS: RegionPreset[] = [
  { label: 'Ukraine / Black Sea',      center: [34.0, 47.0],    zoom: 5 },
  { label: 'Middle East',              center: [44.0, 31.0],    zoom: 4 },
  { label: 'Strait of Hormuz',         center: [56.3, 26.5],    zoom: 7 },
  { label: 'Suez Canal',               center: [32.3, 30.5],    zoom: 8 },
  { label: 'South China Sea',          center: [114.0, 12.0],   zoom: 5 },
  { label: 'Taiwan Strait',            center: [119.5, 24.0],   zoom: 6 },
  { label: 'Horn of Africa / Red Sea', center: [45.0, 12.5],    zoom: 5 },
  { label: 'Baltic Sea / NATO Flank',  center: [20.5, 58.0],    zoom: 5 },
  { label: 'Korean Peninsula',         center: [127.5, 37.5],   zoom: 6 },
  { label: 'Arctic',                   center: [0, 80],         zoom: 3 },
  { label: 'Mediterranean',            center: [18.0, 36.0],    zoom: 4 },
  { label: 'Gulf of Guinea',           center: [3.0, 3.0],      zoom: 5 },
]

export function TopBar() {
  const { activeView, setActiveView, sessionStart, flyTo } = useAppStore()
  const [regionsOpen, setRegionsOpen] = useState(false)
  const regionsRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!regionsOpen) return
    const handleClick = (e: MouseEvent) => {
      if (regionsRef.current && !regionsRef.current.contains(e.target as Node)) {
        setRegionsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [regionsOpen])
  const { time, date } = useClock(sessionStart)
  const getStats = useSatelliteStore(s => s.getStats)
  const vesselCount = useVesselStore(s => s.count)
  const vesselConnected = useVesselStore(s => s.connected)
  const flightCount = useFlightStore(s => s.count)
  const flightConnected = useFlightStore(s => s.connected)
  const weatherCount = useWeatherStore(s => s.count)
  const weatherLastFetch = useWeatherStore(s => s.lastFetch)
  const newsCount = useNewsStore(s => s.count)
  const newsLastFetch = useNewsStore(s => s.lastFetch)
  const conflictCount = useConflictStore(s => s.count)
  const conflictLastFetch = useConflictStore(s => s.lastFetch)
  const cyberCount = useCyberStore(s => s.count)
  const cyberLastFetch = useCyberStore(s => s.lastFetch)
  // const osintCount = useOsintStore(s => s.count)
  // const osintLastFetch = useOsintStore(s => s.lastFetch)
  const portCount = usePortStore(s => s.count)
  const portLastFetch = usePortStore(s => s.lastFetch)
  const rfCount = useRFStore(s => s.count)
  const rfLastFetch = useRFStore(s => s.lastFetch)
  // const econCount = useEconomicStore(s => s.count)
  // const econLastFetch = useEconomicStore(s => s.lastFetch)
  const camCount = useCameraStore(s => s.count)
  const camLastFetch = useCameraStore(s => s.lastFetch)
  const unackAlerts = useAlertStore(s => s.unacknowledgedCount)
  const watchlistSize = useWatchlistStore(s => s.watchlist.size)

  const stats = getStats()

  const dataAge = stats.lastFetchTime
    ? Math.round((Date.now() - stats.lastFetchTime) / 60_000)
    : null

  return (
    <header className="fixed top-0 left-0 right-0 h-[46px] bg-zinc-900 border-b border-zinc-800 flex items-center pl-4 z-50">

      {/* Logo */}
      <div className="flex items-center gap-2.5 pr-5 border-r border-zinc-800 h-full flex-shrink-0">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <polygon points="11,1 21,6 21,16 11,21 1,16 1,6" stroke="#e8640a" strokeWidth="1.5" fill="none" />
          <polygon points="11,5 17,8.5 17,13.5 11,17 5,13.5 5,8.5" fill="rgba(232,100,10,0.12)" stroke="#e8640a" strokeWidth="0.75" />
          <circle cx="11" cy="11" r="2" fill="#e8640a" />
        </svg>
        <div>
          <div className="font-display text-base font-bold tracking-[3px] text-zinc-50 uppercase">Eagle Eye</div>
          <div className="text-[13px] text-zinc-600 tracking-[2px] uppercase mt-px">Geospatial Intel</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex h-full ml-1">
        {NAV_VIEWS.map(view => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={[
              'font-display text-xs font-medium tracking-[2px] uppercase px-4 h-full',
              'border-r border-zinc-800 border-b-2 transition-colors',
              activeView === view
                ? 'text-zinc-50 border-b-orange-500'
                : 'text-zinc-600 border-b-transparent hover:text-zinc-400',
            ].join(' ')}
          >
            {view}
          </button>
        ))}
      </nav>

      {/* Regions dropdown */}
      <div ref={regionsRef} className="relative h-full">
        <button
          onClick={() => setRegionsOpen(!regionsOpen)}
          className={[
            'font-display text-xs font-medium tracking-[2px] uppercase px-4 h-full',
            'border-r border-zinc-800 border-b-2 transition-colors',
            regionsOpen
              ? 'text-zinc-50 border-b-teal-500'
              : 'text-zinc-600 border-b-transparent hover:text-zinc-400',
          ].join(' ')}
        >
          Regions
        </button>
        {regionsOpen && (
          <div className="absolute top-full left-0 mt-0 w-56 bg-zinc-900 border border-zinc-700 rounded-b-md shadow-xl z-50 py-1 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
            {REGION_PRESETS.map(region => (
              <button
                key={region.label}
                onClick={() => {
                  flyTo(region.center, region.zoom)
                  setRegionsOpen(false)
                }}
                className="w-full text-left px-3 py-1.5 font-mono text-[11px] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                {region.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center ml-auto h-full">
        <div className="flex items-center gap-2 px-3 h-full border-l border-zinc-800 font-mono text-[11px] text-zinc-600">
          <Pip color="ok" /> TLE
        </div>
        <div className="flex items-center gap-1.5 px-3 h-full border-l border-zinc-800 font-mono text-[11px] text-zinc-600">
          <span className="text-zinc-400">{stats.enabledCount}</span> SAT
        </div>
        <div className="flex items-center gap-1.5 px-3 h-full border-l border-zinc-800 font-mono text-[11px] text-zinc-600">
          <span className="text-cyan-400">{vesselCount}</span> AIS
          <Pip color={vesselConnected ? 'ok' : 'danger'} />
        </div>
        <div className="flex items-center gap-1.5 px-3 h-full border-l border-zinc-800 font-mono text-[11px] text-zinc-600">
          <span className="text-yellow-400">{flightCount}</span> ADSB
          <Pip color={flightConnected ? 'ok' : 'danger'} />
        </div>
        <div className="flex items-center gap-1.5 px-3 h-full border-l border-zinc-800 font-mono text-[11px] text-zinc-600">
          <span className="text-green-400">{weatherCount}</span> WX
          <Pip color={weatherLastFetch ? 'ok' : 'danger'} />
        </div>
        <div className="flex items-center gap-1.5 px-3 h-full border-l border-zinc-800 font-mono text-[11px] text-zinc-600">
          <span className="text-rose-400">{newsCount}</span> NEWS
          <Pip color={newsLastFetch ? 'ok' : 'danger'} />
        </div>
        <div className="flex items-center gap-1.5 px-3 h-full border-l border-zinc-800 font-mono text-[11px] text-zinc-600">
          <span className="text-red-400">{conflictCount}</span> CON
          <Pip color={conflictLastFetch ? 'ok' : 'danger'} />
        </div>
        <div className="flex items-center gap-1.5 px-3 h-full border-l border-zinc-800 font-mono text-[11px] text-zinc-600">
          <span className="text-purple-400">{cyberCount}</span> CYB
          <Pip color={cyberLastFetch ? 'ok' : 'danger'} />
        </div>
        {/* <div className="flex items-center gap-1.5 px-3 h-full border-l border-zinc-800 font-mono text-[11px] text-zinc-600">
          <span className="text-teal-400">{osintCount}</span> OSINT
          <Pip color={osintLastFetch ? 'ok' : 'danger'} />
        </div> */}
        <div className="flex items-center gap-1.5 px-3 h-full border-l border-zinc-800 font-mono text-[11px] text-zinc-600">
          <span className="text-blue-400">{portCount}</span> PORT
          <Pip color={portLastFetch ? 'ok' : 'danger'} />
        </div>
        <div className="flex items-center gap-1.5 px-3 h-full border-l border-zinc-800 font-mono text-[11px] text-zinc-600">
          <span className="text-violet-400">{rfCount}</span> RF
          <Pip color={rfLastFetch ? 'ok' : 'danger'} />
        </div>
        {/* <div className="flex items-center gap-1.5 px-3 h-full border-l border-zinc-800 font-mono text-[11px] text-zinc-600">
          <span className="text-emerald-400">{econCount}</span> ECON
          <Pip color={econLastFetch ? 'ok' : 'danger'} />
        </div> */}
        <div className="flex items-center gap-1.5 px-3 h-full border-l border-zinc-800 font-mono text-[11px] text-zinc-600">
          <span className="text-sky-400">{camCount}</span> CAM
          <Pip color={camLastFetch ? 'ok' : 'danger'} />
        </div>
        {unackAlerts > 0 && (
          <div className="flex items-center gap-1.5 px-3 h-full border-l border-zinc-800 font-mono text-[11px] animate-pulse">
            <span className="text-red-400 font-bold">{unackAlerts}</span>
            <span className="text-red-400/70">ALT</span>
          </div>
        )}
        {watchlistSize > 0 && (
          <div className="flex items-center gap-1.5 px-3 h-full border-l border-zinc-800 font-mono text-[11px] text-zinc-600">
            <span className="text-orange-400">{watchlistSize}</span> WL
          </div>
        )}
        <div className="flex items-center gap-1.5 px-3 h-full border-l border-zinc-800 font-mono text-[11px] text-zinc-600">
          {dataAge !== null ? (
            <><Pip color={dataAge < 30 ? 'ok' : 'warn'} /> {dataAge < 1 ? '<1m' : `${dataAge}m`}</>
          ) : (
            <><Pip color="danger" /> —</>
          )}
        </div>
        <div className="flex flex-col justify-center items-end px-4 h-full border-l border-zinc-800 min-w-[104px]">
          <span className="font-mono text-sm font-medium text-zinc-50 tracking-wide">{time}</span>
          <span className="font-mono text-[13px] text-zinc-600 tracking-wide mt-px">{date}</span>
        </div>
      </div>
    </header>
  )
}
