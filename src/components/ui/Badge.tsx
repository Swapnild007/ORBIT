import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'ok' | 'warn' | 'danger' | 'info' | 'accent' | 'live'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center font-mono text-[12px] px-1.5 py-0.5 rounded-sm border',
      variant === 'default' && 'bg-zinc-800 text-zinc-400 border-zinc-700',
      variant === 'ok'      && 'bg-green-950/60 text-green-400 border-green-800/40',
      variant === 'warn'    && 'bg-yellow-950/60 text-yellow-400 border-yellow-800/40',
      variant === 'danger'  && 'bg-red-950/60 text-red-400 border-red-800/40',
      variant === 'info'    && 'bg-blue-950/60 text-blue-400 border-blue-800/40',
      variant === 'accent'  && 'bg-orange-950/60 text-orange-400 border-orange-800/40',
      variant === 'live'    && 'bg-green-950/60 text-green-400 border-green-800/40',
      className
    )}>
      {children}
    </span>
  )
}
