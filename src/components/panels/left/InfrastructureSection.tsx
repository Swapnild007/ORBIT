import { cn } from '@/lib/utils'
import {
  useInfrastructureStore,
  INFRASTRUCTURE_LAYERS,
  INFRASTRUCTURE_LABELS,
  INFRASTRUCTURE_COLORS,
  type InfrastructureLayerType,
} from '@/stores/infrastructure-store'

const LAYER_ICONS: Record<InfrastructureLayerType, string> = {
  cables: '〰',
  pipelines: '═',
  nuclear: '☢',
  chokepoints: '◇',
}

export function InfrastructureSection({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { toggles, toggle } = useInfrastructureStore()
  const enabledCount = INFRASTRUCTURE_LAYERS.filter(l => toggles.get(l)).length

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
        <span className="font-display text-[12px] font-semibold tracking-[2px] text-emerald-400 uppercase flex-1 text-left">Infrastructure</span>
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1', enabledCount > 0 ? 'bg-emerald-400' : 'bg-zinc-600')} />
        <span className="font-mono text-[11px] text-zinc-500">{enabledCount}/{INFRASTRUCTURE_LAYERS.length}</span>
      </div>

      {expanded && (
        <div className="border-b border-zinc-800">
          {INFRASTRUCTURE_LAYERS.map(layer => {
            const enabled = toggles.get(layer) ?? false
            const color = INFRASTRUCTURE_COLORS[layer]

            return (
              <div
                key={layer}
                className="flex items-center gap-2 pl-5 pr-3 py-1.5 border-b border-zinc-800/20 hover:bg-zinc-800/20 transition-colors"
              >
                <span className="text-[12px] w-4 text-center" style={{ color }}>{LAYER_ICONS[layer]}</span>
                <span className="font-mono text-[11px] text-zinc-400 flex-1">{INFRASTRUCTURE_LABELS[layer]}</span>
                <button
                  onClick={() => toggle(layer)}
                  className={cn('w-4 h-4 rounded border flex items-center justify-center text-[10px]',
                    enabled ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-zinc-600 text-zinc-600'
                  )}
                >
                  {enabled ? '✓' : ''}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
