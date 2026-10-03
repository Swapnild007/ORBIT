import { cn } from '@/lib/utils'
import { SOURCE_COLORS, SOURCE_LABELS } from '@/lib/colors'

interface SourceBadgeProps {
  source: string
  className?: string
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const key = source.toLowerCase()
  const colors = SOURCE_COLORS[key] ?? 'text-zinc-500 border-zinc-700/60 bg-zinc-800/40'
  const label = SOURCE_LABELS[key] ?? source.toUpperCase()

  return (
    <span className={cn(
      'font-mono text-[8px] uppercase tracking-wider px-1 py-px rounded-sm border leading-tight',
      colors,
      className,
    )}>
      {label}
    </span>
  )
}
