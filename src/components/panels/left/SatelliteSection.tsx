import { useState, useMemo } from 'react'
import { CONSTELLATIONS, CATEGORY_LABELS } from '@/data/constellations'
import { cn } from '@/lib/utils'
import { useSatelliteStore } from '@/stores/satellite-store'
import { useSelectionStore } from '@/stores/selection-store'
import { MasterToggle, TypeToggle } from './shared'
import { PipelineError } from '@/components/ui/PipelineError'
import type { SatCategory, ConstellationId } from '@/types'

const CATEGORY_ORDER: SatCategory[] = [
  'station', 'comms', 'nav', 'weather', 'earth-obs', 'scientific', 'military', 'amateur',
]

export function SatelliteSection({ expanded, onToggle: onToggleSection }: { expanded: boolean; onToggle: () => void }) {
  const { toggles, toggle, enableAll, disableAll, version, loading, getPositions, getSatellites } = useSatelliteStore()
  const { selectedSatId, selectSatellite } = useSelectionStore()

  const [expandedCategories, setExpandedCategories] = useState<Set<SatCategory>>(new Set())
  const [expandedConstellations, setExpandedConstellations] = useState<Set<ConstellationId>>(new Set())

  const toggleCategoryExpand = (cat: SatCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  const toggleConstellationExpand = (id: ConstellationId) => {
    setExpandedConstellations(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const satStats = useMemo(() => {
    let tracked = 0, visible = 0, constellations = 0
    for (const c of CONSTELLATIONS) {
      const sats = getSatellites(c.id)
      tracked += sats.length
      if (toggles.get(c.id)) { visible += sats.length; constellations++ }
    }
    return { tracked, visible, constellations }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, toggles, getSatellites])

  const allOn = useMemo(() => [...toggles.values()].every(v => v), [toggles])
  const noneOn = useMemo(() => [...toggles.values()].every(v => !v), [toggles])

  const groupedConstellations = useMemo(() => {
    const map = new Map<SatCategory, typeof CONSTELLATIONS>()
    for (const cat of CATEGORY_ORDER) {
      const consts = CONSTELLATIONS.filter(c => c.category === cat)
      if (consts.length > 0) map.set(cat, consts)
    }
    return map
  }, [])

  return (
    <div>
      <button
        onClick={onToggleSection}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors"
      >
        <span className="text-[11px] text-zinc-600">{expanded ? '▾' : '▸'}</span>
        <span className="font-display text-[12px] font-semibold tracking-[2px] text-orange-400 uppercase flex-1 text-left">Satellite</span>
        <PipelineError errors={satStats.tracked === 0 && !loading.size ? ['TLE data not yet loaded'] : []} />
        <span className="font-mono text-[11px] text-zinc-500">{satStats.visible}/{satStats.tracked}</span>
        <MasterToggle
          allOn={allOn}
          noneOn={noneOn}
          onToggle={() => allOn ? disableAll() : enableAll()}
        />
      </button>

      {expanded && (
        <div className="border-b border-zinc-800">
          {Array.from(groupedConstellations.entries()).map(([cat, consts]) => {
            const isExpanded = expandedCategories.has(cat)
            return (
              <div key={cat}>
                <button
                  onClick={() => toggleCategoryExpand(cat)}
                  className="w-full flex items-center gap-2 px-3.5 py-1.5 border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors"
                >
                  <span className="text-[11px] text-zinc-600">{isExpanded ? '▾' : '▸'}</span>
                  <span className="font-display text-[11px] font-semibold tracking-[1.5px] text-zinc-500 uppercase flex-1 text-left">
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-600">{consts.length}</span>
                </button>

                {isExpanded && consts.map(c => {
                  const isOn = toggles.get(c.id) ?? false
                  const isLoading = loading.has(c.id)
                  const sats = getSatellites(c.id)
                  const isConstExpanded = expandedConstellations.has(c.id)
                  const colorHex = `#${c.color.toString(16).padStart(6, '0')}`

                  return (
                    <div key={c.id}>
                      <div className="flex items-center border-b border-zinc-800/30">
                        <button
                          onClick={() => isOn && sats.length > 0 && toggleConstellationExpand(c.id)}
                          className={cn(
                            'flex-1 flex items-center gap-2 pl-6 pr-1 py-1 text-left transition-colors',
                            isOn ? 'hover:bg-zinc-800/30' : '',
                          )}
                        >
                          <span className="inline-block w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ backgroundColor: isOn ? colorHex : '#3f3f46' }} />
                          <span className={cn('font-display text-[12px] font-medium tracking-wide flex-1 truncate', isOn ? 'text-zinc-300' : 'text-zinc-600')}>
                            {c.name}
                          </span>
                          {isLoading && <span className="text-[11px] text-zinc-600 animate-pulse">loading</span>}
                          {!isLoading && sats.length > 0 && <span className="font-mono text-[11px] text-zinc-600">{sats.length}</span>}
                          {isOn && sats.length > 0 && <span className="text-[11px] text-zinc-600">{isConstExpanded ? '▾' : '▸'}</span>}
                        </button>
                        <TypeToggle on={isOn} color={colorHex} onClick={() => toggle(c.id)} />
                      </div>

                      {isConstExpanded && isOn && sats.length > 0 && (
                        <div className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                          {sats.slice(0, 100).map(sat => {
                            const pos = getPositions(c.id).find(p => p.noradId === sat.noradId)
                            const isSelected = sat.noradId === selectedSatId
                            return (
                              <button
                                key={sat.noradId}
                                onClick={() => selectSatellite(isSelected ? null : sat.noradId)}
                                className={cn(
                                  'w-full flex items-center gap-2 pl-8 pr-3 py-1 text-left border-b border-zinc-800/20 transition-colors',
                                  isSelected ? 'bg-orange-950/20 border-l-2 border-l-orange-500' : 'hover:bg-zinc-800/30',
                                )}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-mono text-[11px] text-zinc-400 truncate">{sat.name}</div>
                                  <div className="font-mono text-[11px] text-zinc-600">{sat.noradId}</div>
                                </div>
                                {pos && (
                                  <div className="flex flex-col items-end flex-shrink-0">
                                    <span className="font-mono text-[11px] text-zinc-600">{pos.alt.toFixed(0)} km</span>
                                    <span className="font-mono text-[11px] text-zinc-600">{pos.velocity.toFixed(1)} km/s</span>
                                  </div>
                                )}
                              </button>
                            )
                          })}
                          {sats.length > 100 && (
                            <div className="px-8 py-1 font-mono text-[11px] text-zinc-600">+{sats.length - 100} more...</div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
