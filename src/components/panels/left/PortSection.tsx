import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { usePortStore } from '@/stores/port-store'
import type { Port } from '@/lib/ports-client'

const SIZE_LABELS: Record<string, string> = { large: 'Large', medium: 'Medium', small: 'Small' }
const SIZE_DOT_COLORS: Record<string, string> = { large: '#60a5fa', medium: '#38bdf8', small: '#94a3b8' }

export function PortSection({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { ports, version, count, visible, setVisible } = usePortStore()
  const [expandedSizes, setExpandedSizes] = useState<Set<string>>(new Set())

  const toggleSizeExpand = (size: string) => {
    setExpandedSizes(prev => {
      const next = new Set(prev)
      if (next.has(size)) next.delete(size); else next.add(size)
      return next
    })
  }

  const portsBySize = useMemo(() => {
    void version
    const groups = new Map<string, Port[]>()
    for (const size of ['large', 'medium', 'small']) groups.set(size, [])
    for (const p of ports.values()) {
      const arr = groups.get(p.size)
      if (arr) arr.push(p)
    }
    return groups
  }, [ports, version])

  const hasData = count > 0

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors cursor-pointer"
      >
        <span className="text-[11px] text-zinc-600">{expanded ? '▾' : '▸'}</span>
        <span className="font-display text-[12px] font-semibold tracking-[2px] text-blue-400 uppercase flex-1 text-left">Ports</span>
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1', hasData ? 'bg-blue-400' : 'bg-zinc-600')} />
        <span className="font-mono text-[11px] text-zinc-500">{count}</span>
        <button
          onClick={(e) => { e.stopPropagation(); setVisible(!visible) }}
          className={cn('w-4 h-4 rounded border flex items-center justify-center text-[10px]',
            visible ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-zinc-600 text-zinc-600'
          )}
        >
          {visible ? '✓' : ''}
        </button>
      </div>

      {expanded && (
        <div className="border-b border-zinc-800">
          {['large', 'medium', 'small'].map(size => {
            const sizePorts = portsBySize.get(size) ?? []
            const isExpanded = expandedSizes.has(size)
            const dotColor = SIZE_DOT_COLORS[size] ?? '#94a3b8'

            return (
              <div key={size}>
                <div className="flex items-center border-b border-zinc-800/40">
                  <button
                    onClick={() => sizePorts.length > 0 && toggleSizeExpand(size)}
                    className="flex-1 flex items-center gap-2 pl-4 pr-1 py-1.5 text-left hover:bg-zinc-800/30 transition-colors"
                  >
                    <span className="inline-block w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                    <span className="font-display text-[12px] font-medium tracking-wide flex-1 text-zinc-300">
                      {SIZE_LABELS[size]}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-600">{sizePorts.length}</span>
                    {sizePorts.length > 0 && <span className="text-[11px] text-zinc-600">{isExpanded ? '▾' : '▸'}</span>}
                  </button>
                </div>

                {isExpanded && sizePorts.length > 0 && (
                  <div className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                    {sizePorts.slice(0, 200).map(port => (
                      <div
                        key={port.id}
                        className="w-full flex items-center gap-2 pl-7 pr-3 py-1 text-left border-b border-zinc-800/20"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-[11px] text-zinc-400 truncate">{port.name}</div>
                          <div className="font-mono text-[10px] text-zinc-600">{port.country} · {port.harborType}</div>
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
