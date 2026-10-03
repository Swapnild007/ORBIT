import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { WEATHER_EVENT_TYPES, WEATHER_EVENT_LABELS } from '@/types'
import type { WeatherEvent, WeatherEventType } from '@/types'
import { WEATHER_TYPE_COLORS, WEATHER_TYPE_DOT_COLORS } from '@/lib/colors'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { ConfidencePip } from '@/components/ui/ConfidencePip'
import { computeConfidence } from '@/lib/confidence'
import { useWeatherStore } from '@/stores/weather-store'
import { useSelectionStore } from '@/stores/selection-store'
import { MasterToggle, TypeToggle } from './shared'
import { PipelineError } from '@/components/ui/PipelineError'

function timeAgo(ms: number): string {
  const sec = Math.round((Date.now() - ms) / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.round(hr / 24)}d ago`
}

export function WeatherSection({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { events, version, count, errors, typeToggles, toggleType, enableAllTypes, disableAllTypes } = useWeatherStore()
  const { selectedEventId, selectEvent } = useSelectionStore()

  const [expandedTypes, setExpandedTypes] = useState<Set<WeatherEventType>>(new Set())

  const toggleTypeExpand = (type: WeatherEventType) => {
    setExpandedTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type); else next.add(type)
      return next
    })
  }

  const eventsByType = useMemo(() => {
    void version
    const counts = new Map<WeatherEventType, WeatherEvent[]>()
    for (const t of WEATHER_EVENT_TYPES) counts.set(t, [])
    for (const e of events.values()) {
      const arr = counts.get(e.type)
      if (arr) arr.push(e)
    }
    return counts
  }, [events, version])

  const allOn = useMemo(() => [...typeToggles.values()].every(v => v), [typeToggles])
  const noneOn = useMemo(() => [...typeToggles.values()].every(v => !v), [typeToggles])

  const hasData = count > 0

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors"
      >
        <span className="text-[11px] text-zinc-600">{expanded ? '▾' : '▸'}</span>
        <span className="font-display text-[12px] font-semibold tracking-[2px] text-green-400 uppercase flex-1 text-left">Weather & Events</span>
        <PipelineError errors={errors} />
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1', hasData ? 'bg-green-400' : 'bg-zinc-600')} />
        <span className="font-mono text-[11px] text-zinc-500">{count}</span>
        <MasterToggle
          allOn={allOn}
          noneOn={noneOn}
          onToggle={() => allOn ? disableAllTypes() : enableAllTypes()}
        />
      </button>

      {expanded && (
        <div className="border-b border-zinc-800">
          {WEATHER_EVENT_TYPES.map(type => {
            const typeEvents = eventsByType.get(type) ?? []
            const isOn = typeToggles.get(type) ?? true
            const isExpanded = expandedTypes.has(type)
            const dotColor = WEATHER_TYPE_DOT_COLORS[type] ?? '#a1a1aa'

            const sorted = typeEvents.sort((a, b) => b.time - a.time)

            return (
              <div key={type}>
                <div className="flex items-center border-b border-zinc-800/40">
                  <button
                    onClick={() => isOn && typeEvents.length > 0 && toggleTypeExpand(type)}
                    className={cn(
                      'flex-1 flex items-center gap-2 pl-4 pr-1 py-1.5 text-left transition-colors',
                      isOn ? 'hover:bg-zinc-800/30' : '',
                    )}
                  >
                    <span className="inline-block w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ backgroundColor: isOn ? dotColor : '#3f3f46' }} />
                    <span className={cn('font-display text-[12px] font-medium tracking-wide flex-1', isOn ? 'text-zinc-300' : 'text-zinc-600')}>
                      {WEATHER_EVENT_LABELS[type]}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-600">{typeEvents.length}</span>
                    {isOn && typeEvents.length > 0 && <span className="text-[11px] text-zinc-600">{isExpanded ? '▾' : '▸'}</span>}
                  </button>
                  <TypeToggle on={isOn} color={dotColor} onClick={() => toggleType(type)} />
                </div>

                {isExpanded && isOn && sorted.length > 0 && (
                  <div className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                    {sorted.slice(0, 200).map(event => {
                      const isSelected = event.id === selectedEventId
                      return (
                        <button
                          key={event.id}
                          onClick={() => selectEvent(isSelected ? null : event.id)}
                          className={cn(
                            'w-full flex items-center gap-2 pl-7 pr-3 py-1 text-left border-b border-zinc-800/20 transition-colors',
                            isSelected ? 'bg-green-950/20 border-l-2 border-l-green-500' : 'hover:bg-zinc-800/30',
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-[11px] text-zinc-400 truncate">{event.title}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {event.magnitude !== null && (
                                <span className={cn(
                                  'font-display text-[9px] font-semibold tracking-[0.5px] uppercase px-1 py-px rounded-sm border',
                                  WEATHER_TYPE_COLORS[event.type] || WEATHER_TYPE_COLORS.alert,
                                )}>
                                  M{event.magnitude.toFixed(1)}
                                </span>
                              )}
                              <SourceBadge source={event.source} />
                              <ConfidencePip level={computeConfidence({ source: event.source, time: event.time, severity: event.magnitude ?? undefined })} />
                            </div>
                          </div>
                          <div className="flex flex-col items-end flex-shrink-0">
                            <span className="font-mono text-[11px] text-zinc-600">{timeAgo(event.time)}</span>
                          </div>
                        </button>
                      )
                    })}
                    {sorted.length > 200 && (
                      <div className="px-7 py-1 font-mono text-[11px] text-zinc-600">+{sorted.length - 200} more...</div>
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
