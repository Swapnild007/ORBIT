import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { NEWS_CATEGORIES, NEWS_CATEGORY_LABELS } from '@/types'
import type { NewsEvent, NewsCategory } from '@/types'
import { NEWS_CATEGORY_COLORS, NEWS_CATEGORY_DOT_COLORS } from '@/lib/colors'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { ConfidencePip } from '@/components/ui/ConfidencePip'
import { computeConfidence } from '@/lib/confidence'
import { useNewsStore } from '@/stores/news-store'
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

export function NewsSection({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { events, version, count, errors, categoryToggles, toggleCategory, enableAllCategories, disableAllCategories } = useNewsStore()
  const { selectedNewsId, selectNews } = useSelectionStore()

  const [expandedCats, setExpandedCats] = useState<Set<NewsCategory>>(new Set())

  const toggleCatExpand = (cat: NewsCategory) => {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  const eventsByCat = useMemo(() => {
    void version
    const counts = new Map<NewsCategory, NewsEvent[]>()
    for (const t of NEWS_CATEGORIES) counts.set(t, [])
    for (const e of events.values()) {
      const arr = counts.get(e.category)
      if (arr) arr.push(e)
    }
    return counts
  }, [events, version])

  const allOn = useMemo(() => [...categoryToggles.values()].every(v => v), [categoryToggles])
  const noneOn = useMemo(() => [...categoryToggles.values()].every(v => !v), [categoryToggles])

  const hasData = count > 0

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors"
      >
        <span className="text-[11px] text-zinc-600">{expanded ? '▾' : '▸'}</span>
        <span className="font-display text-[12px] font-semibold tracking-[2px] text-rose-400 uppercase flex-1 text-left">News & Events</span>
        <PipelineError errors={errors} />
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1', hasData ? 'bg-rose-400' : 'bg-zinc-600')} />
        <span className="font-mono text-[11px] text-zinc-500">{count}</span>
        <MasterToggle
          allOn={allOn}
          noneOn={noneOn}
          onToggle={() => allOn ? disableAllCategories() : enableAllCategories()}
        />
      </button>

      {expanded && (
        <div className="border-b border-zinc-800">
          {NEWS_CATEGORIES.map(cat => {
            const catEvents = eventsByCat.get(cat) ?? []
            const isOn = categoryToggles.get(cat) ?? true
            const isExpanded = expandedCats.has(cat)
            const dotColor = NEWS_CATEGORY_DOT_COLORS[cat] ?? '#a1a1aa'

            const sorted = catEvents.sort((a, b) => b.time - a.time)

            return (
              <div key={cat}>
                <div className="flex items-center border-b border-zinc-800/40">
                  <button
                    onClick={() => isOn && catEvents.length > 0 && toggleCatExpand(cat)}
                    className={cn(
                      'flex-1 flex items-center gap-2 pl-4 pr-1 py-1.5 text-left transition-colors',
                      isOn ? 'hover:bg-zinc-800/30' : '',
                    )}
                  >
                    <span className="inline-block w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ backgroundColor: isOn ? dotColor : '#3f3f46' }} />
                    <span className={cn('font-display text-[12px] font-medium tracking-wide flex-1', isOn ? 'text-zinc-300' : 'text-zinc-600')}>
                      {NEWS_CATEGORY_LABELS[cat]}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-600">{catEvents.length}</span>
                    {isOn && catEvents.length > 0 && <span className="text-[11px] text-zinc-600">{isExpanded ? '▾' : '▸'}</span>}
                  </button>
                  <TypeToggle on={isOn} color={dotColor} onClick={() => toggleCategory(cat)} />
                </div>

                {isExpanded && isOn && sorted.length > 0 && (
                  <div className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                    {sorted.slice(0, 200).map(event => {
                      const isSelected = event.id === selectedNewsId
                      return (
                        <button
                          key={event.id}
                          onClick={() => selectNews(isSelected ? null : event.id)}
                          className={cn(
                            'w-full flex items-center gap-2 pl-7 pr-3 py-1 text-left border-b border-zinc-800/20 transition-colors',
                            isSelected ? 'bg-rose-950/20 border-l-2 border-l-rose-500' : 'hover:bg-zinc-800/30',
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-[11px] text-zinc-400 truncate">{event.title}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <SourceBadge source={event.source} />
                              <ConfidencePip level={computeConfidence({ source: event.source, time: event.time })} />
                              {event.tone < -3 && <span className="font-mono text-[9px] text-red-400">NEG</span>}
                              {event.tone > 3 && <span className="font-mono text-[9px] text-green-400">POS</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end flex-shrink-0">
                            <span className="font-mono text-[11px] text-zinc-600">{timeAgo(event.time)}</span>
                          </div>
                        </button>
                      )
                    })}
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
