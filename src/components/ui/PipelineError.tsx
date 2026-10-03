import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/Tooltip'

export function PipelineError({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative flex-shrink-0 cursor-help">
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              className="text-amber-400"
              fill="none"
            >
              <path
                d="M5.134 1.5a1 1 0 0 1 1.732 0l4.134 7.164A1 1 0 0 1 10.134 10H1.866a1 1 0 0 1-.866-1.5L5.134 1.5z"
                fill="currentColor"
                opacity="0.2"
                stroke="currentColor"
                strokeWidth="0.8"
              />
              <text x="6" y="8.5" textAnchor="middle" fill="currentColor" fontSize="7" fontWeight="bold">!</text>
            </svg>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="font-mono text-[10px] text-amber-400 font-semibold uppercase tracking-wide mb-1">
            Pipeline Issue{errors.length > 1 ? 's' : ''}
          </div>
          {errors.map((err, i) => (
            <div key={i} className="font-mono text-[11px] text-zinc-300 leading-relaxed">{err}</div>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
