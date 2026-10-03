import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { CONSTELLATIONS } from '@/data/constellations'
import { VESSEL_TYPE_COLORS, FLIGHT_TYPE_COLORS, WEATHER_TYPE_COLORS, WEATHER_TYPE_DOT_COLORS, NEWS_CATEGORY_COLORS, NEWS_CATEGORY_DOT_COLORS, CONFLICT_TYPE_COLORS, CONFLICT_TYPE_DOT_COLORS, CYBER_TYPE_COLORS } from '@/lib/colors'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { useSatelliteStore } from '@/stores/satellite-store'
import { useVesselStore } from '@/stores/vessel-store'
import { useFlightStore } from '@/stores/flight-store'
import { useWeatherStore } from '@/stores/weather-store'
import { useNewsStore } from '@/stores/news-store'
import { useConflictStore } from '@/stores/conflict-store'
import { useCyberStore } from '@/stores/cyber-store'
import { useSelectionStore } from '@/stores/selection-store'

export function SearchResults({ query }: { query: string }) {
  const { toggles, version: satVersion, getPositions, getSatellites } = useSatelliteStore()
  const { vessels, version: vesselVersion } = useVesselStore()
  const { flights, version: flightVersion } = useFlightStore()
  const { events: weatherEvents, version: weatherVersion } = useWeatherStore()
  const { events: newsEvents, version: newsVersion } = useNewsStore()
  const { events: conflictEvents, version: conflictVersion } = useConflictStore()
  const { events: cyberEvents, version: cyberVersion } = useCyberStore()
  const { selectedSatId, selectSatellite, selectedMmsi, selectVessel, selectedIcao, selectFlight, selectedEventId, selectEvent, selectedNewsId, selectNews, selectedConflictId, selectConflict, selectedCyberId, selectCyber } = useSelectionStore()

  const searchResults = useMemo(() => {
    const q = query.toLowerCase()

    const matchedSats: { sat: ReturnType<typeof getSatellites>[number]; constellation: typeof CONSTELLATIONS[number]; pos: ReturnType<typeof getPositions>[number] | undefined }[] = []
    for (const c of CONSTELLATIONS) {
      if (!toggles.get(c.id)) continue
      const sats = getSatellites(c.id)
      const positions = getPositions(c.id)
      for (const sat of sats) {
        if (sat.name.toLowerCase().includes(q) || String(sat.noradId).includes(q)) {
          matchedSats.push({ sat, constellation: c, pos: positions.find(p => p.noradId === sat.noradId) })
        }
      }
    }

    const matchedVessels = [...vessels.values()]
      .filter(v => v.name.toLowerCase().includes(q) || String(v.mmsi).includes(q) || v.type.toLowerCase().includes(q))
      .sort((a, b) => b.lastUpdate - a.lastUpdate)

    const matchedFlights = [...flights.values()]
      .filter(f => f.callsign.toLowerCase().includes(q) || f.icao24.toLowerCase().includes(q) || f.originCountry.toLowerCase().includes(q) || f.type.toLowerCase().includes(q))
      .sort((a, b) => a.callsign.localeCompare(b.callsign))

    const matchedEvents = [...weatherEvents.values()]
      .filter(e => e.title.toLowerCase().includes(q) || e.type.toLowerCase().includes(q) || e.source.toLowerCase().includes(q))
      .sort((a, b) => b.time - a.time)

    const matchedNews = [...newsEvents.values()]
      .filter(e => e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || e.source.toLowerCase().includes(q))
      .sort((a, b) => b.time - a.time)

    const matchedConflicts = [...conflictEvents.values()]
      .filter(e => e.title.toLowerCase().includes(q) || e.type.toLowerCase().includes(q) || e.actors.some(a => a.toLowerCase().includes(q)))
      .sort((a, b) => b.time - a.time)

    const matchedCyber = [...cyberEvents.values()]
      .filter(e => e.title.toLowerCase().includes(q) || e.type.toLowerCase().includes(q) || (e.ip && e.ip.includes(q)))
      .sort((a, b) => b.time - a.time)

    return { sats: matchedSats, vessels: matchedVessels, flights: matchedFlights, events: matchedEvents, news: matchedNews, conflicts: matchedConflicts, cyber: matchedCyber }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, satVersion, toggles, getSatellites, getPositions, vessels, vesselVersion, flights, flightVersion, weatherEvents, weatherVersion, newsEvents, newsVersion, conflictEvents, conflictVersion, cyberEvents, cyberVersion])

  const totalResults = searchResults.sats.length + searchResults.vessels.length + searchResults.flights.length + searchResults.events.length + searchResults.news.length + searchResults.conflicts.length + searchResults.cyber.length

  return (
    <div>
      <div className="px-3.5 py-1.5 border-b border-zinc-800 flex-shrink-0">
        <span className="font-mono text-[11px] text-zinc-500">{totalResults} result{totalResults !== 1 ? 's' : ''}</span>
      </div>

      {/* Satellite results */}
      {searchResults.sats.length > 0 && (
        <div>
          <div className="px-3.5 py-1.5 border-b border-zinc-800/60">
            <span className="font-display text-[11px] font-semibold tracking-[1.5px] text-orange-400/70 uppercase">Satellites</span>
            <span className="font-mono text-[11px] text-zinc-600 ml-2">{searchResults.sats.length}</span>
          </div>
          {searchResults.sats.slice(0, 100).map(({ sat, constellation, pos }) => {
            const isSelected = sat.noradId === selectedSatId
            const colorHex = `#${constellation.color.toString(16).padStart(6, '0')}`
            return (
              <button
                key={sat.noradId}
                onClick={() => selectSatellite(isSelected ? null : sat.noradId)}
                className={cn(
                  'w-full flex items-center gap-2 pl-3.5 pr-3 py-1 text-left border-b border-zinc-800/20 transition-colors',
                  isSelected ? 'bg-orange-950/20 border-l-2 border-l-orange-500' : 'hover:bg-zinc-800/30',
                )}
              >
                <span className="inline-block w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ backgroundColor: colorHex }} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] text-zinc-400 truncate">{sat.name}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-zinc-600">{sat.noradId}</span>
                    <span className="font-mono text-[10px] text-zinc-700">{constellation.name}</span>
                  </div>
                </div>
                {pos && (
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="font-mono text-[11px] text-zinc-600">{pos.alt.toFixed(0)} km</span>
                  </div>
                )}
              </button>
            )
          })}
          {searchResults.sats.length > 100 && (
            <div className="px-3.5 py-1 font-mono text-[11px] text-zinc-600">+{searchResults.sats.length - 100} more...</div>
          )}
        </div>
      )}

      {/* Vessel results */}
      {searchResults.vessels.length > 0 && (
        <div>
          <div className="px-3.5 py-1.5 border-b border-zinc-800/60">
            <span className="font-display text-[11px] font-semibold tracking-[1.5px] text-cyan-400/70 uppercase">Maritime</span>
            <span className="font-mono text-[11px] text-zinc-600 ml-2">{searchResults.vessels.length}</span>
          </div>
          {searchResults.vessels.slice(0, 200).map(vessel => {
            const isSelected = vessel.mmsi === selectedMmsi
            return (
              <button
                key={vessel.mmsi}
                onClick={() => selectVessel(isSelected ? null : vessel.mmsi)}
                className={cn(
                  'w-full flex items-center gap-2 pl-3.5 pr-3 py-1 text-left border-b border-zinc-800/20 transition-colors',
                  isSelected ? 'bg-cyan-950/20 border-l-2 border-l-cyan-500' : 'hover:bg-zinc-800/30',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] text-zinc-400 truncate">{vessel.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-[10px] text-zinc-600">{vessel.mmsi}</span>
                    <span className={cn(
                      'font-display text-[9px] font-semibold tracking-[0.5px] uppercase px-1 py-px rounded-sm border',
                      VESSEL_TYPE_COLORS[vessel.type] || VESSEL_TYPE_COLORS.other,
                    )}>
                      {vessel.type}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="font-mono text-[11px] text-zinc-600">{vessel.speed.toFixed(1)} kn</span>
                </div>
              </button>
            )
          })}
          {searchResults.vessels.length > 200 && (
            <div className="px-3.5 py-1 font-mono text-[11px] text-zinc-600">+{searchResults.vessels.length - 200} more...</div>
          )}
        </div>
      )}

      {/* Flight results */}
      {searchResults.flights.length > 0 && (
        <div>
          <div className="px-3.5 py-1.5 border-b border-zinc-800/60">
            <span className="font-display text-[11px] font-semibold tracking-[1.5px] text-yellow-400/70 uppercase">Aircraft</span>
            <span className="font-mono text-[11px] text-zinc-600 ml-2">{searchResults.flights.length}</span>
          </div>
          {searchResults.flights.slice(0, 200).map(flight => {
            const isSelected = flight.icao24 === selectedIcao
            return (
              <button
                key={flight.icao24}
                onClick={() => selectFlight(isSelected ? null : flight.icao24)}
                className={cn(
                  'w-full flex items-center gap-2 pl-3.5 pr-3 py-1 text-left border-b border-zinc-800/20 transition-colors',
                  isSelected ? 'bg-yellow-950/20 border-l-2 border-l-yellow-500' : 'hover:bg-zinc-800/30',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] text-zinc-400 truncate">{flight.callsign}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-[10px] text-zinc-600">{flight.icao24.toUpperCase()}</span>
                    <span className={cn(
                      'font-display text-[9px] font-semibold tracking-[0.5px] uppercase px-1 py-px rounded-sm border',
                      FLIGHT_TYPE_COLORS[flight.type] || FLIGHT_TYPE_COLORS.other,
                    )}>
                      {flight.type}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="font-mono text-[11px] text-zinc-600">FL{Math.round(flight.altitude * 3.28084 / 100)}</span>
                </div>
              </button>
            )
          })}
          {searchResults.flights.length > 200 && (
            <div className="px-3.5 py-1 font-mono text-[11px] text-zinc-600">+{searchResults.flights.length - 200} more...</div>
          )}
        </div>
      )}

      {/* Weather event results */}
      {searchResults.events.length > 0 && (
        <div>
          <div className="px-3.5 py-1.5 border-b border-zinc-800/60">
            <span className="font-display text-[11px] font-semibold tracking-[1.5px] text-green-400/70 uppercase">Weather & Events</span>
            <span className="font-mono text-[11px] text-zinc-600 ml-2">{searchResults.events.length}</span>
          </div>
          {searchResults.events.slice(0, 200).map(event => {
            const isSelected = event.id === selectedEventId
            const dotColor = WEATHER_TYPE_DOT_COLORS[event.type] ?? '#a1a1aa'
            return (
              <button
                key={event.id}
                onClick={() => selectEvent(isSelected ? null : event.id)}
                className={cn(
                  'w-full flex items-center gap-2 pl-3.5 pr-3 py-1 text-left border-b border-zinc-800/20 transition-colors',
                  isSelected ? 'bg-green-950/20 border-l-2 border-l-green-500' : 'hover:bg-zinc-800/30',
                )}
              >
                <span className="inline-block w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] text-zinc-400 truncate">{event.title}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <SourceBadge source={event.source} />
                    <span className={cn(
                      'font-display text-[9px] font-semibold tracking-[0.5px] uppercase px-1 py-px rounded-sm border',
                      WEATHER_TYPE_COLORS[event.type] || WEATHER_TYPE_COLORS.alert,
                    )}>
                      {event.type}
                    </span>
                  </div>
                </div>
                {event.magnitude !== null && (
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="font-mono text-[11px] text-zinc-600">M{event.magnitude.toFixed(1)}</span>
                  </div>
                )}
              </button>
            )
          })}
          {searchResults.events.length > 200 && (
            <div className="px-3.5 py-1 font-mono text-[11px] text-zinc-600">+{searchResults.events.length - 200} more...</div>
          )}
        </div>
      )}

      {/* News results */}
      {searchResults.news.length > 0 && (
        <div>
          <div className="px-3.5 py-1.5 border-b border-zinc-800/60">
            <span className="font-display text-[11px] font-semibold tracking-[1.5px] text-rose-400/70 uppercase">News</span>
            <span className="font-mono text-[11px] text-zinc-600 ml-2">{searchResults.news.length}</span>
          </div>
          {searchResults.news.slice(0, 200).map(event => {
            const isSelected = event.id === selectedNewsId
            const dotColor = NEWS_CATEGORY_DOT_COLORS[event.category] ?? '#a1a1aa'
            return (
              <button
                key={event.id}
                onClick={() => selectNews(isSelected ? null : event.id)}
                className={cn(
                  'w-full flex items-center gap-2 pl-3.5 pr-3 py-1 text-left border-b border-zinc-800/20 transition-colors',
                  isSelected ? 'bg-rose-950/20 border-l-2 border-l-rose-500' : 'hover:bg-zinc-800/30',
                )}
              >
                <span className="inline-block w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] text-zinc-400 truncate">{event.title}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn(
                      'font-display text-[9px] font-semibold tracking-[0.5px] uppercase px-1 py-px rounded-sm border',
                      NEWS_CATEGORY_COLORS[event.category] || NEWS_CATEGORY_COLORS.other,
                    )}>
                      {event.category}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Conflict results */}
      {searchResults.conflicts.length > 0 && (
        <div>
          <div className="px-3.5 py-1.5 border-b border-zinc-800/60">
            <span className="font-display text-[11px] font-semibold tracking-[1.5px] text-red-400/70 uppercase">Conflicts</span>
            <span className="font-mono text-[11px] text-zinc-600 ml-2">{searchResults.conflicts.length}</span>
          </div>
          {searchResults.conflicts.slice(0, 200).map(event => {
            const isSelected = event.id === selectedConflictId
            const dotColor = CONFLICT_TYPE_DOT_COLORS[event.type] ?? '#f87171'
            return (
              <button
                key={event.id}
                onClick={() => selectConflict(isSelected ? null : event.id)}
                className={cn(
                  'w-full flex items-center gap-2 pl-3.5 pr-3 py-1 text-left border-b border-zinc-800/20 transition-colors',
                  isSelected ? 'bg-red-950/20 border-l-2 border-l-red-500' : 'hover:bg-zinc-800/30',
                )}
              >
                <span className="inline-block w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] text-zinc-400 truncate">{event.title}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn(
                      'font-display text-[9px] font-semibold tracking-[0.5px] uppercase px-1 py-px rounded-sm border',
                      CONFLICT_TYPE_COLORS[event.type] || CONFLICT_TYPE_COLORS.violence,
                    )}>
                      {event.type}
                    </span>
                    {event.fatalities > 0 && <span className="font-mono text-[10px] text-red-400">{event.fatalities}</span>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Cyber results */}
      {searchResults.cyber.length > 0 && (
        <div>
          <div className="px-3.5 py-1.5 border-b border-zinc-800/60">
            <span className="font-display text-[11px] font-semibold tracking-[1.5px] text-purple-400/70 uppercase">Cyber Threats</span>
            <span className="font-mono text-[11px] text-zinc-600 ml-2">{searchResults.cyber.length}</span>
          </div>
          {searchResults.cyber.slice(0, 200).map(event => {
            const isSelected = event.id === selectedCyberId
            return (
              <button
                key={event.id}
                onClick={() => selectCyber(isSelected ? null : event.id)}
                className={cn(
                  'w-full flex items-center gap-2 pl-3.5 pr-3 py-1 text-left border-b border-zinc-800/20 transition-colors',
                  isSelected ? 'bg-purple-950/20 border-l-2 border-l-purple-500' : 'hover:bg-zinc-800/30',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] text-zinc-400 truncate">{event.title}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn(
                      'font-display text-[9px] font-semibold tracking-[0.5px] uppercase px-1 py-px rounded-sm border',
                      CYBER_TYPE_COLORS[event.type] || CYBER_TYPE_COLORS.vulnerability,
                    )}>
                      {event.type}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {totalResults === 0 && (
        <div className="flex items-center justify-center py-8">
          <span className="text-[12px] text-zinc-600">No results for &quot;{query}&quot;</span>
        </div>
      )}
    </div>
  )
}
