import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useRFStore } from '@/stores/rf-store'
import { getFrequencyBand } from '@/lib/rf-client'
import { MasterToggle, TypeToggle } from './shared'
import type { RFSpot } from '@/types'

type RFSource = 'psk' | 'rbn' | 'satnogs'

const SOURCE_LABELS: Record<RFSource, string> = { psk: 'PSK Reporter', rbn: 'Rev. Beacon', satnogs: 'SatNOGS' }
const SOURCE_DOT_COLORS: Record<RFSource, string> = { psk: '#a78bfa', rbn: '#c084fc', satnogs: '#e879f9' }
const SOURCES: RFSource[] = ['psk', 'rbn', 'satnogs']

function formatFreq(hz: number): string {
  if (hz >= 1_000_000_000) return `${(hz / 1_000_000_000).toFixed(1)} GHz`
  if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(1)} MHz`
  if (hz >= 1_000) return `${(hz / 1_000).toFixed(0)} kHz`
  return `${hz} Hz`
}

function timeAgo(ms: number): string {
  const sec = Math.round((Date.now() - ms) / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  return `${hr}h ago`
}

export function RFSection({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { spots, version, count, sourceToggles, toggleSource } = useRFStore()
  const [expandedSources, setExpandedSources] = useState<Set<RFSource>>(new Set())

  const toggleSourceExpand = (src: RFSource) => {
    setExpandedSources(prev => {
      const next = new Set(prev)
      if (next.has(src)) next.delete(src); else next.add(src)
      return next
    })
  }

  const spotsBySource = useMemo(() => {
    void version
    const groups = new Map<RFSource, RFSpot[]>()
    for (const s of SOURCES) groups.set(s, [])
    for (const spot of spots.values()) {
      const arr = groups.get(spot.source)
      if (arr) arr.push(spot)
    }
    return groups
  }, [spots, version])

  const allOn = useMemo(() => SOURCES.every(s => sourceToggles.get(s) !== false), [sourceToggles])
  const noneOn = useMemo(() => SOURCES.every(s => sourceToggles.get(s) === false), [sourceToggles])
  const hasData = count > 0

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors"
      >
        <span className="text-[11px] text-zinc-600">{expanded ? '▾' : '▸'}</span>
        <span className="font-display text-[12px] font-semibold tracking-[2px] text-violet-400 uppercase flex-1 text-left">RF Spectrum</span>
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1', hasData ? 'bg-violet-400' : 'bg-zinc-600')} />
        <span className="font-mono text-[11px] text-zinc-500">{count}</span>
        <MasterToggle
          allOn={allOn}
          noneOn={noneOn}
          onToggle={() => SOURCES.forEach(s => toggleSource(s))}
        />
      </button>

      {expanded && (
        <div className="border-b border-zinc-800">
          {SOURCES.map(src => {
            const srcSpots = spotsBySource.get(src) ?? []
            const isOn = sourceToggles.get(src) !== false
            const isExpanded = expandedSources.has(src)
            const dotColor = SOURCE_DOT_COLORS[src]
            const sorted = srcSpots.sort((a, b) => b.time - a.time)

            return (
              <div key={src}>
                <div className="flex items-center border-b border-zinc-800/40">
                  <button
                    onClick={() => isOn && srcSpots.length > 0 && toggleSourceExpand(src)}
                    className={cn(
                      'flex-1 flex items-center gap-2 pl-4 pr-1 py-1.5 text-left transition-colors',
                      isOn ? 'hover:bg-zinc-800/30' : '',
                    )}
                  >
                    <span className="inline-block w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ backgroundColor: isOn ? dotColor : '#3f3f46' }} />
                    <span className={cn('font-display text-[12px] font-medium tracking-wide flex-1', isOn ? 'text-zinc-300' : 'text-zinc-600')}>
                      {SOURCE_LABELS[src]}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-600">{srcSpots.length}</span>
                    {isOn && srcSpots.length > 0 && <span className="text-[11px] text-zinc-600">{isExpanded ? '▾' : '▸'}</span>}
                  </button>
                  <TypeToggle on={isOn} color={dotColor} onClick={() => toggleSource(src)} />
                </div>

                {isExpanded && isOn && sorted.length > 0 && (
                  <div className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                    {sorted.slice(0, 200).map(spot => (
                      <div
                        key={spot.id}
                        className="w-full flex items-center gap-2 pl-7 pr-3 py-1 text-left border-b border-zinc-800/20"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-[11px] text-zinc-400 truncate">
                            {spot.txCall} → {spot.rxCall}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] text-zinc-600">{formatFreq(spot.frequency)}</span>
                            <span className="font-mono text-[10px] text-violet-400/60">{getFrequencyBand(spot.frequency)}</span>
                            <span className="font-mono text-[10px] text-zinc-600">{spot.mode}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="font-mono text-[11px] text-zinc-600">{timeAgo(spot.time)}</span>
                          {spot.snr > 0 && <span className="font-mono text-[10px] text-zinc-600">{spot.snr}dB</span>}
                        </div>
                      </div>
                    ))}
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
