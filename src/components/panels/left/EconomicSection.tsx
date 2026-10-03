import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useEconomicStore } from '@/stores/economic-store'
import { ECONOMIC_INDICATORS } from '@/lib/economic-client'
import type { EconomicIndicator } from '@/lib/economic-client'
import { PipelineError } from '@/components/ui/PipelineError'

const INDICATOR_DOT_COLORS: Record<string, string> = {
  'NY.GDP.MKTP.CD': '#34d399',
  'NY.GDP.MKTP.KD.ZG': '#4ade80',
  'FP.CPI.TOTL.ZG': '#fbbf24',
  'SL.UEM.TOTL.ZS': '#f87171',
  'BN.CAB.XOKA.CD': '#60a5fa',
}

function formatValue(value: number | null, indicatorId: string): string {
  if (value == null) return '—'
  if (indicatorId === 'NY.GDP.MKTP.CD' || indicatorId === 'BN.CAB.XOKA.CD') {
    const abs = Math.abs(value)
    const sign = value < 0 ? '-' : ''
    if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(1)}T`
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`
    return `${sign}$${abs.toFixed(0)}`
  }
  return `${value.toFixed(1)}%`
}

export function EconomicSection({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { indicators, version, count, errors, selectedIndicator, setSelectedIndicator } = useEconomicStore()

  const byIndicator = useMemo(() => {
    void version
    const groups = new Map<string, EconomicIndicator[]>()
    for (const ind of ECONOMIC_INDICATORS) groups.set(ind.id, [])
    for (const entry of indicators.values()) {
      const arr = groups.get(entry.indicatorId)
      if (arr) arr.push(entry)
    }
    return groups
  }, [indicators, version])

  const hasData = count > 0

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors"
      >
        <span className="text-[11px] text-zinc-600">{expanded ? '▾' : '▸'}</span>
        <span className="font-display text-[12px] font-semibold tracking-[2px] text-emerald-400 uppercase flex-1 text-left">Economic</span>
        <PipelineError errors={errors} />
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1', hasData ? 'bg-emerald-400' : 'bg-zinc-600')} />
        <span className="font-mono text-[11px] text-zinc-500">{count}</span>
      </button>

      {expanded && (
        <div className="border-b border-zinc-800">
          {/* Indicator selector */}
          <div className="px-3 py-2 border-b border-zinc-800/40">
            <select
              value={selectedIndicator}
              onChange={(e) => setSelectedIndicator(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 font-mono text-[11px] text-zinc-300"
            >
              {ECONOMIC_INDICATORS.map(ind => (
                <option key={ind.id} value={ind.id}>{ind.name}</option>
              ))}
            </select>
          </div>

          {/* Country list for selected indicator */}
          <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
            {(() => {
              const entries = byIndicator.get(selectedIndicator) ?? []
              const sorted = [...entries].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
              const dotColor = INDICATOR_DOT_COLORS[selectedIndicator] ?? '#34d399'

              return sorted.slice(0, 200).map(entry => (
                <div
                  key={entry.id}
                  className="w-full flex items-center gap-2 pl-4 pr-3 py-1.5 text-left border-b border-zinc-800/20"
                >
                  <span className="inline-block w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[11px] text-zinc-400 truncate">{entry.country}</div>
                    <div className="font-mono text-[10px] text-zinc-600">{entry.countryCode} · {entry.year}</div>
                  </div>
                  <span className="font-mono text-[11px] text-zinc-300 flex-shrink-0">
                    {formatValue(entry.value, entry.indicatorId)}
                  </span>
                </div>
              ))
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
