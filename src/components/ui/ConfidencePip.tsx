import { cn } from '@/lib/utils'
import { type ConfidenceLevel, CONFIDENCE_COLORS, CONFIDENCE_LABELS } from '@/lib/confidence'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/Tooltip'

interface ConfidencePipProps {
  level: ConfidenceLevel
  className?: string
}

export function ConfidencePip({ level, className }: ConfidencePipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(
            'relative inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 cursor-help',
            CONFIDENCE_COLORS[level],
            className,
          )}>
            <span className={cn(
              'absolute inset-0 rounded-full animate-ping opacity-50',
              CONFIDENCE_COLORS[level],
            )} />
          </span>
        </TooltipTrigger>
        <TooltipContent>{CONFIDENCE_LABELS[level]}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
