import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { FLIGHT_TYPES, FLIGHT_TYPE_LABELS } from '@/types'
import type { FlightRecord } from '@/types'
import { FLIGHT_TYPE_COLORS, FLIGHT_TYPE_DOT_COLORS } from '@/lib/colors'
import { useFlightStore } from '@/stores/flight-store'
import { useSelectionStore } from '@/stores/selection-store'
import { MasterToggle, TypeToggle } from './shared'
import { PipelineError } from '@/components/ui/PipelineError'
import type { FlightType } from '@/types'

export function AircraftSection({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { flights, version, connected, count, typeToggles, toggleType, enableAllTypes, disableAllTypes } = useFlightStore()
  const { selectedIcao, selectFlight } = useSelectionStore()

  const [expandedTypes, setExpandedTypes] = useState<Set<FlightType>>(new Set())

  const toggleTypeExpand = (type: FlightType) => {
    setExpandedTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type); else next.add(type)
      return next
    })
  }

  const flightsByType = useMemo(() => {
    void version
    const counts = new Map<FlightType, FlightRecord[]>()
    for (const t of FLIGHT_TYPES) counts.set(t, [])
    for (const f of flights.values()) {
      const arr = counts.get(f.type)
      if (arr) arr.push(f)
    }
    return counts
  }, [flights, version])

  const allOn = useMemo(() => [...typeToggles.values()].every(v => v), [typeToggles])
  const noneOn = useMemo(() => [...typeToggles.values()].every(v => !v), [typeToggles])

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors"
      >
        <span className="text-[11px] text-zinc-600">{expanded ? '▾' : '▸'}</span>
        <span className="font-display text-[12px] font-semibold tracking-[2px] text-yellow-400 uppercase flex-1 text-left">Aircraft</span>
        <PipelineError errors={!connected ? ['ADS-B feed disconnected'] : []} />
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1', connected ? 'bg-green-400' : 'bg-red-400')} />
        <span className="font-mono text-[11px] text-zinc-500">{count}</span>
        <MasterToggle
          allOn={allOn}
          noneOn={noneOn}
          onToggle={() => allOn ? disableAllTypes() : enableAllTypes()}
        />
      </button>

      {expanded && (
        <div className="border-b border-zinc-800">
          {FLIGHT_TYPES.map(type => {
            const typeFlights = flightsByType.get(type) ?? []
            const isOn = typeToggles.get(type) ?? true
            const isExpanded = expandedTypes.has(type)
            const dotColor = FLIGHT_TYPE_DOT_COLORS[type] ?? '#a1a1aa'

            const filtered = typeFlights.sort((a, b) => a.callsign.localeCompare(b.callsign))

            return (
              <div key={type}>
                <div className="flex items-center border-b border-zinc-800/40">
                  <button
                    onClick={() => isOn && typeFlights.length > 0 && toggleTypeExpand(type)}
                    className={cn(
                      'flex-1 flex items-center gap-2 pl-4 pr-1 py-1.5 text-left transition-colors',
                      isOn ? 'hover:bg-zinc-800/30' : '',
                    )}
                  >
                    <span className="inline-block w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ backgroundColor: isOn ? dotColor : '#3f3f46' }} />
                    <span className={cn('font-display text-[12px] font-medium tracking-wide flex-1', isOn ? 'text-zinc-300' : 'text-zinc-600')}>
                      {FLIGHT_TYPE_LABELS[type]}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-600">{typeFlights.length}</span>
                    {isOn && typeFlights.length > 0 && <span className="text-[11px] text-zinc-600">{isExpanded ? '▾' : '▸'}</span>}
                  </button>
                  <TypeToggle on={isOn} color={dotColor} onClick={() => toggleType(type)} />
                </div>

                {isExpanded && isOn && filtered.length > 0 && (
                  <div className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                    {filtered.slice(0, 200).map(flight => {
                      const isSelected = flight.icao24 === selectedIcao
                      return (
                        <button
                          key={flight.icao24}
                          onClick={() => selectFlight(isSelected ? null : flight.icao24)}
                          className={cn(
                            'w-full flex items-center gap-2 pl-7 pr-3 py-1 text-left border-b border-zinc-800/20 transition-colors',
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
                            <span className="font-mono text-[11px] text-zinc-600">{flight.heading.toFixed(0)}°</span>
                          </div>
                        </button>
                      )
                    })}
                    {filtered.length > 200 && (
                      <div className="px-7 py-1 font-mono text-[11px] text-zinc-600">+{filtered.length - 200} more...</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
