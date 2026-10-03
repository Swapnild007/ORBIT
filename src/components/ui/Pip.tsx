import { cn } from '@/lib/utils'

type PipColor = 'ok' | 'warn' | 'danger' | 'info'

interface PipProps { color: PipColor; className?: string }

export function Pip({ color, className }: PipProps) {
  return (
    <span className={cn(
      'inline-block w-[5px] h-[5px] rounded-full flex-shrink-0 animate-pulse',
      color === 'ok'     && 'bg-green-400 shadow-[0_0_5px_theme(colors.green.400)]',
      color === 'warn'   && 'bg-yellow-400 shadow-[0_0_5px_theme(colors.yellow.400)]',
      color === 'danger' && 'bg-red-400 shadow-[0_0_5px_theme(colors.red.400)]',
      color === 'info'   && 'bg-blue-400 shadow-[0_0_5px_theme(colors.blue.400)]',
      className
    )} />
  )
}
