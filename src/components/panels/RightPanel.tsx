import { useState, useRef, useEffect, useMemo } from 'react'
import { CONSTELLATIONS } from '@/data/constellations'
import { cn } from '@/lib/utils'
import { VESSEL_TYPE_COLORS, FLIGHT_TYPE_COLORS, WEATHER_TYPE_COLORS, NEWS_CATEGORY_COLORS, CONFLICT_TYPE_COLORS, CYBER_TYPE_COLORS, OSINT_PLATFORM_COLORS, RF_SOURCE_COLORS } from '@/lib/colors'
import { useSatelliteStore } from '@/stores/satellite-store'
import { useVesselStore } from '@/stores/vessel-store'
import { useFlightStore } from '@/stores/flight-store'
import { useWeatherStore } from '@/stores/weather-store'
import { useNewsStore } from '@/stores/news-store'
import { useConflictStore } from '@/stores/conflict-store'
import { useCyberStore } from '@/stores/cyber-store'
import { useRFStore } from '@/stores/rf-store'
import { useAlertStore } from '@/stores/alert-store'
import { AlertRuleEditor, AlertRuleList } from '@/components/ui/AlertRuleEditor'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/Tooltip'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { useIncidents } from '@/hooks/useIncidents'
import { useOsintStore } from '@/stores/osint-store'
import { OsintModal } from '@/components/ui/OsintModal'
import type { OsintPost } from '@/lib/osint-client'
import { useSelectionStore } from '@/stores/selection-store'
import { useWatchlistStore } from '@/stores/watchlist-store'
import { useFlightInfo } from '@/hooks/useFlightInfo'
import { findNearbyEntities, type CorrelatedEntity } from '@/lib/correlation'
import type { HexdbFlightInfo } from '@/lib/hexdb'
import type { SatelliteRecord, SatellitePosition, VesselRecord, FlightRecord, ConstellationMeta, WeatherEvent, NewsEvent, ConflictEvent, CyberEvent, RFSpot } from '@/types'
import type { SanctionMatch } from '@/lib/sanctions-client'

const NAV_STATUS_LABELS: Record<number, string> = {
  0: 'Under way using engine',
  1: 'At anchor',
  2: 'Not under command',
  3: 'Restricted manoeuvrability',
  4: 'Constrained by draught',
  5: 'Moored',
  6: 'Aground',
  7: 'Engaged in fishing',
  8: 'Under way sailing',
  15: 'Undefined',
}

const DOMAIN_COLORS_MAP: Record<string, string> = {
  vessel: 'text-cyan-400',
  flight: 'text-yellow-400',
  weather: 'text-green-400',
  news: 'text-rose-400',
  conflict: 'text-red-400',
  cyber: 'text-purple-400',
  satellite: 'text-orange-400',
}

export function RightPanel() {
  const { selectedSatId, selectedMmsi, selectedIcao, selectedEventId, selectedNewsId, selectedConflictId, selectedCyberId, selectedRFId } = useSelectionStore()
  const { getSatellites, getPositions, toggles, version: satVersion } = useSatelliteStore()
  const { vessels, version: vesselVersion } = useVesselStore()
  const { flights, version: flightVersion } = useFlightStore()
  const { events, version: weatherVersion } = useWeatherStore()
  const { events: newsEvents, version: newsVersion } = useNewsStore()
  const { events: conflictEvents, version: conflictVersion } = useConflictStore()
  const { events: cyberEvents, version: cyberVersion } = useCyberStore()
  const { spots: rfSpots, version: rfVersion } = useRFStore()

  // Derive selected records
  void vesselVersion
  void flightVersion
  void weatherVersion
  void newsVersion
  void conflictVersion
  void cyberVersion
  void rfVersion
  const selectedVessel = selectedMmsi ? vessels.get(selectedMmsi) ?? null : null
  const selectedFlight = selectedIcao ? flights.get(selectedIcao) ?? null : null
  const selectedEvent = selectedEventId ? events.get(selectedEventId) ?? null : null
  const selectedNews = selectedNewsId ? newsEvents.get(selectedNewsId) ?? null : null
  const selectedConflict = selectedConflictId ? conflictEvents.get(selectedConflictId) ?? null : null
  const selectedCyber = selectedCyberId ? cyberEvents.get(selectedCyberId) ?? null : null
  const selectedRF = selectedRFId ? rfSpots.get(selectedRFId) ?? null : null

  const { satellite: selectedSatellite, position: selectedPosition } = useMemo(() => {
    if (!selectedSatId) return { satellite: null, position: null }
    const allSats = [...toggles.keys()].flatMap(id => getSatellites(id))
    const satellite = allSats.find(s => s.noradId === selectedSatId) ?? null
    let position = null
    for (const id of toggles.keys()) {
      const pos = getPositions(id).find(p => p.noradId === selectedSatId)
      if (pos) { position = pos; break }
    }
    return { satellite, position }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSatId, satVersion, toggles])

  const { info: flightInfo, loading: flightInfoLoading } = useFlightInfo(
    selectedIcao,
    selectedFlight?.callsign ?? null,
  )

  const constellation = selectedSatellite
    ? CONSTELLATIONS.find(c => c.id === selectedSatellite.constellationId) ?? null
    : null
  const colorHex = constellation ? `#${constellation.color.toString(16).padStart(6, '0')}` : '#3f3f46'

  const epochAgeRef = useRef<number | null>(null)
  useEffect(() => {
    if (!selectedSatellite) { epochAgeRef.current = null; return }
    epochAgeRef.current = Math.round((Date.now() - selectedSatellite.epoch.getTime()) / (1000 * 60 * 60))
  }, [selectedSatellite])
  const epochAge = epochAgeRef.current

  // Determine entity ID + lat/lon for watchlist and nearby
  const selectedEntityId = selectedRF ? `rf-${selectedRF.id}`
    : selectedCyber ? `cyber-${selectedCyber.id}`
    : selectedConflict ? `conflict-${selectedConflict.id}`
    : selectedNews ? `news-${selectedNews.id}`
    : selectedEvent ? `weather-${selectedEvent.id}`
    : selectedFlight ? `flight-${selectedFlight.icao24}`
    : selectedVessel ? `vessel-${selectedVessel.mmsi}`
    : selectedSatellite ? `sat-${selectedSatellite.noradId}`
    : null

  const selectedLat = selectedRF?.rxLat ?? selectedCyber?.lat ?? selectedConflict?.lat ?? selectedNews?.lat ?? selectedEvent?.lat ?? selectedFlight?.lat ?? selectedVessel?.lat ?? selectedPosition?.lat ?? null
  const selectedLon = selectedRF?.rxLon ?? selectedCyber?.lon ?? selectedConflict?.lon ?? selectedNews?.lon ?? selectedEvent?.lon ?? selectedFlight?.lon ?? selectedVessel?.lon ?? selectedPosition?.lon ?? null

  // Watchlist
  const isWatched = useWatchlistStore(s => selectedEntityId ? s.watchlist.has(selectedEntityId) : false)
  const toggleWatch = useWatchlistStore(s => s.toggle)

  // Nearby entities (50km radius)
  const nearby = useMemo(() => {
    if (selectedLat == null || selectedLon == null || !selectedEntityId) return []
    const sources = [
      { domain: 'vessel', entities: [...vessels.values()].map(v => ({ id: `vessel-${v.mmsi}`, name: v.name || String(v.mmsi), lat: v.lat, lon: v.lon })) },
      { domain: 'flight', entities: [...flights.values()].map(f => ({ id: `flight-${f.icao24}`, name: f.callsign, lat: f.lat, lon: f.lon })) },
      { domain: 'weather', entities: [...events.values()].map(e => ({ id: `weather-${e.id}`, name: e.title, lat: e.lat, lon: e.lon })) },
      { domain: 'news', entities: [...newsEvents.values()].map(e => ({ id: `news-${e.id}`, name: e.title, lat: e.lat, lon: e.lon })) },
      { domain: 'conflict', entities: [...conflictEvents.values()].map(e => ({ id: `conflict-${e.id}`, name: e.title, lat: e.lat, lon: e.lon })) },
      { domain: 'cyber', entities: [...cyberEvents.values()].map(e => ({ id: `cyber-${e.id}`, name: e.title, lat: e.lat, lon: e.lon })) },
    ]
    return findNearbyEntities(selectedLat, selectedLon, 50, selectedEntityId, sources).slice(0, 10)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntityId, selectedLat, selectedLon, vesselVersion, flightVersion, weatherVersion, newsVersion, conflictVersion, cyberVersion])

  // Determine panel title
  let panelTitle = 'Entity Detail'
  if (selectedRF) panelTitle = 'RF Signal'
  else if (selectedCyber) panelTitle = 'Cyber Threat'
  else if (selectedConflict) panelTitle = 'Conflict Event'
  else if (selectedNews) panelTitle = 'News Event'
  else if (selectedEvent) panelTitle = 'Weather Event'
  else if (selectedFlight) panelTitle = 'Flight Detail'
  else if (selectedVessel) panelTitle = 'Vessel Detail'
  else if (selectedSatellite) panelTitle = 'Satellite Detail'

  const hasSelection = selectedSatellite || selectedVessel || selectedFlight || selectedEvent || selectedNews || selectedConflict || selectedCyber || selectedRF

  // Entity selected by ID but data not yet resolved (e.g. alert clicked during data refresh)
  const hasSelectionId = selectedSatId !== null || selectedMmsi !== null || selectedIcao !== null || selectedEventId !== null || selectedNewsId !== null || selectedConflictId !== null || selectedCyberId !== null || selectedRFId !== null
  const selectionPending = hasSelectionId && !hasSelection

  return (
    <aside className="fixed top-[46px] right-0 bottom-[34px] w-[272px] bg-zinc-900 border-l border-zinc-800 z-40 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-3.5 h-9 border-b border-zinc-800 flex-shrink-0">
        <span className="font-display text-[12px] font-semibold tracking-[2px] uppercase text-zinc-400">
          {hasSelection ? panelTitle : selectionPending ? 'Loading Entity...' : 'Intelligence Feed'}
        </span>
        {selectedEntityId && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => toggleWatch(selectedEntityId)}
                  className={cn('text-sm transition-colors', isWatched ? 'text-orange-400' : 'text-zinc-600 hover:text-zinc-400')}
                >
                  {isWatched ? '★' : '☆'}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">{isWatched ? 'Remove from watchlist' : 'Add to watchlist'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {selectedRF ? (
        <RFDetail spot={selectedRF} nearby={nearby} />
      ) : selectedCyber ? (
        <CyberDetail event={selectedCyber} nearby={nearby} />
      ) : selectedConflict ? (
        <ConflictDetail event={selectedConflict} nearby={nearby} />
      ) : selectedNews ? (
        <NewsDetail event={selectedNews} nearby={nearby} />
      ) : selectedEvent ? (
        <WeatherEventDetail event={selectedEvent} nearby={nearby} />
      ) : selectedFlight ? (
        <FlightDetail flight={selectedFlight} flightInfo={flightInfo} flightInfoLoading={flightInfoLoading} nearby={nearby} />
      ) : selectedVessel ? (
        <VesselDetail vessel={selectedVessel} nearby={nearby} />
      ) : selectedSatellite ? (
        <SatelliteDetail satellite={selectedSatellite} position={selectedPosition} constellation={constellation} colorHex={colorHex} epochAge={epochAge} nearby={nearby} />
      ) : selectionPending ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block w-5 h-5 border-2 border-zinc-700 border-t-orange-400 rounded-full animate-spin mb-3" />
            <p className="font-mono text-[11px] text-zinc-500">Loading entity data...</p>
          </div>
        </div>
      ) : (
        <IntelligenceFeed />
      )}
    </aside>
  )
}

function IntelligenceFeed() {
  const alerts = useAlertStore(s => s.alerts)
  const unackCount = useAlertStore(s => s.unacknowledgedCount)
  const acknowledge = useAlertStore(s => s.acknowledge)
  const acknowledgeAll = useAlertStore(s => s.acknowledgeAll)
  const { posts, platformToggles, version, count } = useOsintStore()
  const { selectEvent, selectConflict, selectCyber, selectVessel, selectFlight } = useSelectionStore()
  const [osintModalPost, setOsintModalPost] = useState<OsintPost | null>(null)
  const [showRuleEditor, setShowRuleEditor] = useState(false)
  const incidents = useIncidents()

  const severityColor = (sev: string) => {
    if (sev === 'critical') return 'text-red-400 border-l-red-500'
    if (sev === 'warning') return 'text-yellow-400 border-l-yellow-500'
    return 'text-blue-400 border-l-blue-500'
  }

  const sortedPosts = useMemo(() => {
    void version
    return [...posts.values()]
      .filter(p => platformToggles.get(p.platform) !== false)
      .sort((a, b) => b.time - a.time)
      .slice(0, 50)
  }, [version, posts, platformToggles])

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
      {/* Alerts section */}
      <div className="border-b border-zinc-800">
        <div className="px-3.5 py-2 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display text-[11px] font-semibold tracking-[2px] text-zinc-500 uppercase">Alerts</span>
            {unackCount > 0 && (
              <span className="bg-red-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {unackCount > 99 ? '99' : unackCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {alerts.length > 0 && (
              <button onClick={acknowledgeAll} className="font-mono text-[10px] text-zinc-600 hover:text-zinc-400 uppercase tracking-wider">Ack All</button>
            )}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowRuleEditor(prev => !prev)}
                    className="text-zinc-600 hover:text-orange-400 text-sm font-mono leading-none transition-colors"
                  >
                    +
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Add Alert Rule</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        {showRuleEditor && (
          <div className="px-3 py-2 border-b border-zinc-800">
            <AlertRuleEditor onClose={() => setShowRuleEditor(false)} />
          </div>
        )}
        {alerts.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-[11px] text-zinc-600 font-mono">No alerts</p>
          </div>
        ) : (
          alerts.map(a => (
            <button
              key={a.id}
              onClick={() => {
                if (!a.acknowledged) acknowledge(a.id)
                if (a.entityId) {
                  switch (a.domain) {
                    case 'weather': selectEvent(a.entityId); break
                    case 'conflict': selectConflict(a.entityId); break
                    case 'cyber': selectCyber(a.entityId); break
                    case 'vessel': selectVessel(Number(a.entityId)); break
                    case 'flight': selectFlight(a.entityId); break
                  }
                }
              }}
              className={cn(
                'w-full text-left px-3.5 py-2 border-b border-zinc-800/50 border-l-2 transition-colors',
                severityColor(a.severity),
                a.acknowledged ? 'opacity-40' : 'hover:bg-zinc-800/30',
              )}
            >
              <div className="font-mono text-[11px] font-medium">{a.title}</div>
              <div className="font-mono text-[10px] text-zinc-500 mt-0.5 truncate">{a.description}</div>
              <div className="font-mono text-[9px] text-zinc-600 mt-0.5 uppercase">
                {a.domain} — {new Date(a.time).toISOString().slice(11, 19)}Z
              </div>
            </button>
          ))
        )}
        <AlertRuleList />
      </div>

      {/* Correlated incidents section */}
      {incidents.length > 0 && (
        <div className="border-b border-zinc-800">
          <div className="px-3.5 py-2 border-b border-zinc-800 flex items-center gap-2">
            <span className="font-display text-[11px] font-semibold tracking-[2px] text-amber-400 uppercase">Incidents</span>
            <span className="font-mono text-[10px] text-zinc-600">{incidents.length}</span>
          </div>
          {incidents.slice(0, 10).map(inc => (
            <div
              key={inc.id}
              className="px-3.5 py-2 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] font-medium text-zinc-300">
                  {inc.events.length} events correlated
                </span>
                <span className="font-mono text-[9px] text-zinc-600">
                  {inc.sourceCount} sources
                </span>
              </div>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {inc.domains.map(d => (
                  <span
                    key={d}
                    className={cn(
                      'font-mono text-[8px] uppercase tracking-wider px-1 py-px rounded-sm border',
                      d === 'conflict' ? 'text-red-400 border-red-800/60 bg-red-950/40'
                        : d === 'weather' ? 'text-amber-400 border-amber-800/60 bg-amber-950/40'
                        : d === 'cyber' ? 'text-purple-400 border-purple-800/60 bg-purple-950/40'
                        : d === 'news' ? 'text-rose-400 border-rose-800/60 bg-rose-950/40'
                        : 'text-zinc-400 border-zinc-700/60 bg-zinc-800/40',
                    )}
                  >
                    {d}
                  </span>
                ))}
              </div>
              <div className="mt-1 space-y-0.5">
                {inc.events.slice(0, 3).map(e => (
                  <div key={`${e.domain}-${e.id}`} className="font-mono text-[10px] text-zinc-500 truncate">
                    {e.title}
                  </div>
                ))}
                {inc.events.length > 3 && (
                  <div className="font-mono text-[10px] text-zinc-600">+{inc.events.length - 3} more</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* OSINT feed section */}
      <div>
        <div className="px-3.5 py-2 border-b border-zinc-800 flex items-center gap-2">
          <span className="font-display text-[11px] font-semibold tracking-[2px] text-teal-400 uppercase">OSINT</span>
          <span className="font-mono text-[10px] text-zinc-600">{count}</span>
        </div>
        {sortedPosts.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-[11px] text-zinc-600 font-mono">{count === 0 ? 'Loading OSINT...' : 'No geolocated posts'}</p>
          </div>
        ) : (
          sortedPosts.map(post => (
            <button
              key={post.id}
              onClick={() => setOsintModalPost(post)}
              className="block w-full text-left px-3.5 py-2 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={cn(
                  'font-mono text-[9px] uppercase tracking-wider px-1 rounded',
                  OSINT_PLATFORM_COLORS[post.platform],
                )}>
                  {post.platform.slice(0, 3)}
                </span>
                <span className="font-mono text-[10px] text-zinc-600">{post.author}</span>
                <span className="font-mono text-[9px] text-zinc-700 ml-auto">{post.locationName}</span>
              </div>
              <div className="font-mono text-[11px] text-zinc-400 truncate">{post.text}</div>
              <div className="font-mono text-[9px] text-zinc-600 mt-0.5">
                {new Date(post.time).toISOString().slice(11, 19)}Z
              </div>
            </button>
          ))
        )}
      </div>
      <OsintModal post={osintModalPost} onClose={() => setOsintModalPost(null)} />
    </div>
  )
}

function NearbyEntities({ nearby }: { nearby: CorrelatedEntity[] }) {
  if (nearby.length === 0) return null
  return (
    <div className="px-3.5 py-3 border-b border-zinc-800">
      <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Nearby Entities</div>
      <div className="space-y-1.5">
        {nearby.map(e => (
          <div key={e.id} className="flex items-center gap-2">
            <span className={cn('font-mono text-[10px] uppercase w-7', DOMAIN_COLORS_MAP[e.domain] ?? 'text-zinc-400')}>
              {e.domain.slice(0, 3)}
            </span>
            <span className="font-mono text-[11px] text-zinc-400 truncate flex-1">{e.name}</span>
            <span className="font-mono text-[10px] text-zinc-600">{e.distance.toFixed(0)}km</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function NewsDetail({ event, nearby }: { event: NewsEvent; nearby: CorrelatedEntity[] }) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-sm font-bold tracking-wide text-zinc-50">{event.title}</div>
        <div className="flex items-center gap-2 mt-1.5">
          <SourceBadge source={event.source} />
          <span className={cn(
            'font-display text-[13px] font-semibold tracking-[1px] uppercase px-1.5 py-0.5 rounded-sm border',
            NEWS_CATEGORY_COLORS[event.category] || NEWS_CATEGORY_COLORS.other,
          )}>{event.category}</span>
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Position</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Latitude" value={`${Math.abs(event.lat).toFixed(4)}°${event.lat >= 0 ? 'N' : 'S'}`} />
          <DetailRow label="Longitude" value={`${Math.abs(event.lon).toFixed(4)}°${event.lon >= 0 ? 'E' : 'W'}`} />
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Analysis</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Tone" value={event.tone.toFixed(1)} warn={event.tone < -5} />
          <DetailRow label="Articles" value={String(event.articleCount)} />
          <DetailRow label="Time" value={new Date(event.time).toISOString().slice(0, 16).replace('T', ' ') + 'Z'} />
        </div>
      </div>

      {event.url && (
        <div className="px-3.5 py-3 border-b border-zinc-800">
          <a href={event.url} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-orange-400 hover:underline break-all">
            View source article
          </a>
        </div>
      )}

      <NearbyEntities nearby={nearby} />
    </div>
  )
}

function ConflictDetail({ event, nearby }: { event: ConflictEvent; nearby: CorrelatedEntity[] }) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-sm font-bold tracking-wide text-zinc-50">{event.title}</div>
        <div className="flex items-center gap-2 mt-1.5">
          <SourceBadge source={event.source} />
          <span className={cn(
            'font-display text-[13px] font-semibold tracking-[1px] uppercase px-1.5 py-0.5 rounded-sm border',
            CONFLICT_TYPE_COLORS[event.type] || CONFLICT_TYPE_COLORS.violence,
          )}>{event.type}</span>
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Position</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Latitude" value={`${Math.abs(event.lat).toFixed(4)}°${event.lat >= 0 ? 'N' : 'S'}`} />
          <DetailRow label="Longitude" value={`${Math.abs(event.lon).toFixed(4)}°${event.lon >= 0 ? 'E' : 'W'}`} />
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Details</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Fatalities" value={String(event.fatalities)} warn={event.fatalities > 0} />
          <DetailRow label="Event Time" value={new Date(event.time).toISOString().slice(0, 16).replace('T', ' ') + 'Z'} />
        </div>
      </div>

      {event.actors.length > 0 && (
        <div className="px-3.5 py-3 border-b border-zinc-800">
          <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Actors</div>
          {event.actors.map((actor, i) => (
            <div key={i} className="font-mono text-[12px] text-zinc-400 mt-1">{actor}</div>
          ))}
        </div>
      )}

      {event.description && (
        <div className="px-3.5 py-3 border-b border-zinc-800">
          <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Description</div>
          <p className="font-mono text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap">{event.description.slice(0, 500)}</p>
        </div>
      )}

      <NearbyEntities nearby={nearby} />
    </div>
  )
}

function CyberDetail({ event, nearby }: { event: CyberEvent; nearby: CorrelatedEntity[] }) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-sm font-bold tracking-wide text-zinc-50">{event.title}</div>
        <div className="flex items-center gap-2 mt-1.5">
          <SourceBadge source={event.source} />
          <span className={cn(
            'font-display text-[13px] font-semibold tracking-[1px] uppercase px-1.5 py-0.5 rounded-sm border',
            CYBER_TYPE_COLORS[event.type] || CYBER_TYPE_COLORS.vulnerability,
          )}>{event.type}</span>
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Position</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Latitude" value={`${Math.abs(event.lat).toFixed(4)}°${event.lat >= 0 ? 'N' : 'S'}`} />
          <DetailRow label="Longitude" value={`${Math.abs(event.lon).toFixed(4)}°${event.lon >= 0 ? 'E' : 'W'}`} />
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Threat Details</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Severity" value={`${event.severity}/10`} warn={event.severity >= 7} />
          {event.ip && <DetailRow label="IP Address" value={event.ip} />}
          <DetailRow label="Event Time" value={new Date(event.time).toISOString().slice(0, 16).replace('T', ' ') + 'Z'} />
        </div>
      </div>

      {event.description && (
        <div className="px-3.5 py-3 border-b border-zinc-800">
          <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Description</div>
          <p className="font-mono text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap">{event.description.slice(0, 500)}</p>
        </div>
      )}

      <NearbyEntities nearby={nearby} />
    </div>
  )
}

function RFDetail({ spot, nearby }: { spot: RFSpot; nearby: CorrelatedEntity[] }) {
  const freqMHz = (spot.frequency / 1_000_000).toFixed(3)
  const band = spot.frequency < 30_000_000 ? 'HF' : spot.frequency < 300_000_000 ? 'VHF' : 'UHF+'

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-sm font-bold tracking-wide text-zinc-50">{spot.txCall} → {spot.rxCall}</div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="font-mono text-[12px] text-zinc-500">{spot.mode}</span>
          <SourceBadge source={spot.source} />
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Signal</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Frequency" value={`${freqMHz} MHz`} />
          <DetailRow label="Band" value={band} />
          <DetailRow label="SNR" value={`${spot.snr} dB`} warn={spot.snr < 5} />
          <DetailRow label="Time" value={new Date(spot.time).toISOString().slice(11, 19) + 'Z'} />
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Transmitter</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Callsign" value={spot.txCall} />
          <DetailRow label="Latitude" value={spot.txLat !== 0 ? `${Math.abs(spot.txLat).toFixed(4)}°${spot.txLat >= 0 ? 'N' : 'S'}` : 'N/A'} />
          <DetailRow label="Longitude" value={spot.txLon !== 0 ? `${Math.abs(spot.txLon).toFixed(4)}°${spot.txLon >= 0 ? 'E' : 'W'}` : 'N/A'} />
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Receiver</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Callsign" value={spot.rxCall} />
          <DetailRow label="Latitude" value={spot.rxLat !== 0 ? `${Math.abs(spot.rxLat).toFixed(4)}°${spot.rxLat >= 0 ? 'N' : 'S'}` : 'N/A'} />
          <DetailRow label="Longitude" value={spot.rxLon !== 0 ? `${Math.abs(spot.rxLon).toFixed(4)}°${spot.rxLon >= 0 ? 'E' : 'W'}` : 'N/A'} />
        </div>
      </div>

      <NearbyEntities nearby={nearby} />
    </div>
  )
}

function WeatherEventDetail({ event, nearby }: { event: WeatherEvent; nearby: CorrelatedEntity[] }) {
  const [conditions, setConditions] = useState<{
    current?: {
      temperature_2m?: number
      relative_humidity_2m?: number
      wind_speed_10m?: number
      wind_direction_10m?: number
      precipitation?: number
      surface_pressure?: number
    }
    current_units?: Record<string, string>
  } | null>(null)
  const [conditionsLoading, setConditionsLoading] = useState(false)

  useEffect(() => {
    setConditions(null)
    setConditionsLoading(true)
    fetch(`/api/weather/conditions?lat=${event.lat}&lon=${event.lon}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setConditions(data))
      .catch(() => setConditions(null))
      .finally(() => setConditionsLoading(false))
  }, [event.id, event.lat, event.lon])

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-sm font-bold tracking-wide text-zinc-50">{event.title}</div>
        <div className="flex items-center gap-2 mt-1.5">
          <SourceBadge source={event.source} />
          <span className={cn(
            'font-display text-[13px] font-semibold tracking-[1px] uppercase px-1.5 py-0.5 rounded-sm border',
            WEATHER_TYPE_COLORS[event.type] || WEATHER_TYPE_COLORS.alert,
          )}>{event.type}</span>
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Position</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Latitude" value={`${Math.abs(event.lat).toFixed(4)}°${event.lat >= 0 ? 'N' : 'S'}`} />
          <DetailRow label="Longitude" value={`${Math.abs(event.lon).toFixed(4)}°${event.lon >= 0 ? 'E' : 'W'}`} />
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Event Details</div>
        <div className="grid grid-cols-2 gap-2">
          {event.magnitude !== null && (
            <DetailRow label="Magnitude" value={`M${event.magnitude.toFixed(1)}`} warn={event.magnitude >= 5.0} />
          )}
          <DetailRow label="Source" value={event.source.toUpperCase()} />
          <DetailRow label="Event Time" value={new Date(event.time).toISOString().slice(0, 16).replace('T', ' ') + 'Z'} />
          {event.expires && (
            <DetailRow
              label="Expires"
              value={new Date(event.expires).toISOString().slice(0, 16).replace('T', ' ') + 'Z'}
              warn={event.expires < Date.now() + 3600_000}
            />
          )}
          <DetailRow label="Last Update" value={new Date(event.lastUpdate).toISOString().slice(11, 19) + 'Z'} />
        </div>
      </div>

      {event.description && (
        <div className="px-3.5 py-3 border-b border-zinc-800">
          <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Description</div>
          <p className="font-mono text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap">{event.description.slice(0, 500)}</p>
        </div>
      )}

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Local Conditions</div>
        {conditionsLoading ? (
          <div className="font-mono text-[12px] text-zinc-600 animate-pulse">Loading conditions...</div>
        ) : conditions?.current ? (
          <div className="grid grid-cols-2 gap-2">
            {conditions.current.temperature_2m != null && (
              <DetailRow label="Temperature" value={`${conditions.current.temperature_2m}${conditions.current_units?.temperature_2m ?? '°C'}`} />
            )}
            {conditions.current.relative_humidity_2m != null && (
              <DetailRow label="Humidity" value={`${conditions.current.relative_humidity_2m}%`} />
            )}
            {conditions.current.wind_speed_10m != null && (
              <DetailRow label="Wind Speed" value={`${conditions.current.wind_speed_10m} ${conditions.current_units?.wind_speed_10m ?? 'km/h'}`} />
            )}
            {conditions.current.wind_direction_10m != null && (
              <DetailRow label="Wind Dir" value={`${conditions.current.wind_direction_10m}°`} />
            )}
            {conditions.current.precipitation != null && (
              <DetailRow label="Precipitation" value={`${conditions.current.precipitation} ${conditions.current_units?.precipitation ?? 'mm'}`} />
            )}
            {conditions.current.surface_pressure != null && (
              <DetailRow label="Pressure" value={`${conditions.current.surface_pressure} ${conditions.current_units?.surface_pressure ?? 'hPa'}`} />
            )}
          </div>
        ) : (
          <div className="font-mono text-[12px] text-zinc-600">No conditions available</div>
        )}
      </div>

      <NearbyEntities nearby={nearby} />
    </div>
  )
}

function FlightDetail({ flight, flightInfo, flightInfoLoading, nearby }: {
  flight: FlightRecord
  flightInfo: HexdbFlightInfo
  flightInfoLoading: boolean
  nearby: CorrelatedEntity[]
}) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
      {flightInfo.imageUrl && <AircraftImage url={flightInfo.imageUrl} alt={flight.callsign} />}

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-sm font-bold tracking-wide text-zinc-50">{flight.callsign}</div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="font-mono text-[12px] text-zinc-500">ICAO {flight.icao24.toUpperCase()}</span>
          <span className={cn(
            'font-display text-[13px] font-semibold tracking-[1px] uppercase px-1.5 py-0.5 rounded-sm border',
            FLIGHT_TYPE_COLORS[flight.type] || FLIGHT_TYPE_COLORS.other,
          )}>{flight.type}</span>
        </div>
        {flight.originCountry && <div className="font-mono text-[12px] text-zinc-500 mt-1">{flight.originCountry}</div>}
      </div>

      {flightInfo.aircraft && (
        <div className="px-3.5 py-3 border-b border-zinc-800">
          <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Aircraft</div>
          <div className="grid grid-cols-2 gap-2">
            <DetailRow label="Registration" value={flightInfo.aircraft.Registration} />
            <DetailRow label="Type" value={flightInfo.aircraft.Type || flightInfo.aircraft.ICAOTypeCode} />
            <DetailRow label="Manufacturer" value={flightInfo.aircraft.Manufacturer} />
            <DetailRow label="Owner" value={flightInfo.aircraft.RegisteredOwners} />
          </div>
        </div>
      )}

      {flightInfo.route && (
        <div className="px-3.5 py-3 border-b border-zinc-800">
          <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Route</div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[13px] text-yellow-400 font-bold">{flightInfo.route.route}</span>
          </div>
          {flightInfo.origin && (
            <div className="mb-1.5">
              <div className="font-mono text-[11px] text-zinc-600 uppercase">Origin</div>
              <div className="font-mono text-[12px] text-zinc-300">{flightInfo.origin.airport}</div>
              <div className="font-mono text-[11px] text-zinc-500">
                {flightInfo.origin.iata}/{flightInfo.origin.icao} — {flightInfo.origin.region_name}, {flightInfo.origin.country_code}
              </div>
            </div>
          )}
          {flightInfo.destination && (
            <div>
              <div className="font-mono text-[11px] text-zinc-600 uppercase">Destination</div>
              <div className="font-mono text-[12px] text-zinc-300">{flightInfo.destination.airport}</div>
              <div className="font-mono text-[11px] text-zinc-500">
                {flightInfo.destination.iata}/{flightInfo.destination.icao} — {flightInfo.destination.region_name}, {flightInfo.destination.country_code}
              </div>
            </div>
          )}
        </div>
      )}

      {flightInfoLoading && !flightInfo.aircraft && (
        <div className="px-3.5 py-3 border-b border-zinc-800">
          <div className="font-mono text-[12px] text-zinc-600 animate-pulse">Loading aircraft data...</div>
        </div>
      )}

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Position</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Latitude" value={`${Math.abs(flight.lat).toFixed(4)}°${flight.lat >= 0 ? 'N' : 'S'}`} />
          <DetailRow label="Longitude" value={`${Math.abs(flight.lon).toFixed(4)}°${flight.lon >= 0 ? 'E' : 'W'}`} />
          <DetailRow label="Altitude" value={`${Math.round(flight.altitude)} m (FL${Math.round(flight.altitude * 3.28084 / 100)})`} />
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Movement</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Speed" value={`${(flight.speed * 1.94384).toFixed(0)} kn`} />
          <DetailRow label="Heading" value={`${flight.heading.toFixed(0)}°`} />
          <DetailRow label="Vert Rate" value={`${(flight.verticalRate * 196.85).toFixed(0)} fpm`} warn={Math.abs(flight.verticalRate) > 10} />
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">ADS-B Data</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Last Update" value={new Date(flight.lastUpdate).toISOString().slice(11, 19) + 'Z'} />
          <DetailRow label="Age" value={`${Math.round((Date.now() - flight.lastUpdate) / 1000)}s`} />
        </div>
      </div>

      <NearbyEntities nearby={nearby} />
    </div>
  )
}

function VesselDetail({ vessel, nearby }: { vessel: VesselRecord; nearby: CorrelatedEntity[] }) {
  const [sanctions, setSanctions] = useState<SanctionMatch[]>([])
  const [sanctionsLoading, setSanctionsLoading] = useState(false)

  useEffect(() => {
    setSanctions([])
    const name = vessel.name?.trim()
    if (!name || name === String(vessel.mmsi)) return
    setSanctionsLoading(true)
    fetch(`/api/sanctions/check?q=${encodeURIComponent(name)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.matches) setSanctions(data.matches) })
      .catch(() => {})
      .finally(() => setSanctionsLoading(false))
  }, [vessel.mmsi, vessel.name])
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-sm font-bold tracking-wide text-zinc-50">{vessel.name}</div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="font-mono text-[12px] text-zinc-500">MMSI {vessel.mmsi}</span>
          <span className={cn(
            'font-display text-[13px] font-semibold tracking-[1px] uppercase px-1.5 py-0.5 rounded-sm border',
            VESSEL_TYPE_COLORS[vessel.type] || VESSEL_TYPE_COLORS.other,
          )}>{vessel.type}</span>
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Current Position</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Latitude" value={`${Math.abs(vessel.lat).toFixed(4)}°${vessel.lat >= 0 ? 'N' : 'S'}`} />
          <DetailRow label="Longitude" value={`${Math.abs(vessel.lon).toFixed(4)}°${vessel.lon >= 0 ? 'E' : 'W'}`} />
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Movement</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Speed (SOG)" value={`${vessel.speed.toFixed(1)} kn`} />
          <DetailRow label="Course (COG)" value={`${vessel.course.toFixed(1)}°`} />
          <DetailRow label="Heading" value={vessel.heading === 511 ? 'N/A' : `${vessel.heading}°`} />
          <DetailRow label="Nav Status" value={NAV_STATUS_LABELS[vessel.navStatus] ?? `Code ${vessel.navStatus}`} />
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">AIS Data</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Last Update" value={new Date(vessel.lastUpdate).toISOString().slice(11, 19) + 'Z'} />
          <DetailRow label="Age" value={`${Math.round((Date.now() - vessel.lastUpdate) / 1000)}s`} />
        </div>
      </div>

      {/* Sanctions check */}
      {sanctionsLoading && (
        <div className="px-3.5 py-3 border-b border-zinc-800">
          <div className="font-mono text-[12px] text-zinc-600 animate-pulse">Checking sanctions...</div>
        </div>
      )}
      {sanctions.length > 0 && (
        <div className="px-3.5 py-3 border-b border-zinc-800 bg-red-950/20">
          <div className="font-display text-[13px] font-bold tracking-[2px] text-red-400 uppercase mb-2">Sanctioned</div>
          {sanctions.map(s => (
            <div key={s.id} className="mb-2">
              <div className="font-mono text-[12px] text-red-300">{s.name}</div>
              <div className="font-mono text-[10px] text-zinc-500">{s.datasets.slice(0, 3).join(', ')}</div>
              <div className="font-mono text-[10px] text-zinc-600">Match: {(s.score * 100).toFixed(0)}%</div>
            </div>
          ))}
        </div>
      )}

      <NearbyEntities nearby={nearby} />
    </div>
  )
}

function SatelliteDetail({ satellite, position, constellation, colorHex, epochAge, nearby }: {
  satellite: SatelliteRecord
  position: SatellitePosition | null
  constellation: ConstellationMeta | null
  colorHex: string
  epochAge: number | null
  nearby: CorrelatedEntity[]
}) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-sm font-bold tracking-wide text-zinc-50">{satellite.name}</div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="font-mono text-[12px] text-zinc-500">NORAD {satellite.noradId}</span>
          {constellation && (
            <span
              className="font-display text-[13px] font-semibold tracking-[1px] uppercase px-1.5 py-0.5 rounded-sm border"
              style={{ color: colorHex, borderColor: colorHex + '40', backgroundColor: colorHex + '15' }}
            >{constellation.name}</span>
          )}
        </div>
      </div>

      {position && (
        <div className="px-3.5 py-3 border-b border-zinc-800">
          <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Current Position</div>
          <div className="grid grid-cols-2 gap-2">
            <DetailRow label="Latitude" value={`${Math.abs(position.lat).toFixed(4)}°${position.lat >= 0 ? 'N' : 'S'}`} />
            <DetailRow label="Longitude" value={`${Math.abs(position.lon).toFixed(4)}°${position.lon >= 0 ? 'E' : 'W'}`} />
            <DetailRow label="Altitude" value={`${position.alt.toFixed(1)} km`} />
            <DetailRow label="Velocity" value={`${position.velocity.toFixed(2)} km/s`} />
          </div>
        </div>
      )}

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">Orbital Parameters</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Inclination" value={`${satellite.inclination.toFixed(2)}°`} />
          <DetailRow label="Period" value={`${satellite.period.toFixed(1)} min`} />
          <DetailRow label="Eccentricity" value={satellite.eccentricity.toFixed(6)} />
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-zinc-800">
        <div className="font-display text-[13px] font-semibold tracking-[2px] text-zinc-600 uppercase mb-2">TLE Data</div>
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Epoch" value={satellite.epoch.toISOString().slice(0, 16).replace('T', ' ') + 'Z'} />
          <DetailRow label="Age" value={epochAge !== null ? `${epochAge}h` : '—'} warn={epochAge !== null && epochAge > 48} />
        </div>
      </div>

      <NearbyEntities nearby={nearby} />
    </div>
  )
}

function AircraftImage({ url, alt }: { url: string; alt: string }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoaded(false)
    setError(false)
  }, [url])

  if (error) return null

  return (
    <div className="relative w-full border-b border-zinc-800 bg-zinc-950">
      {!loaded && (
        <div className="h-32 flex items-center justify-center">
          <div className="font-mono text-[11px] text-zinc-600 animate-pulse">Loading image...</div>
        </div>
      )}
      <img
        src={url}
        alt={alt}
        className={cn('w-full object-cover', loaded ? 'block' : 'hidden')}
        style={{ maxHeight: 160 }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  )
}

function DetailRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[12px] text-zinc-600 tracking-wide uppercase">{label}</div>
      <div className={cn('font-mono text-[13px] mt-0.5', warn ? 'text-yellow-400' : 'text-zinc-300')}>{value}</div>
    </div>
  )
}
