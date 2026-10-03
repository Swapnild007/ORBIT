import { cn } from '@/lib/utils'

export function MasterToggle({ allOn, noneOn, onToggle }: { allOn: boolean; noneOn: boolean; onToggle: () => void }) {
  const indeterminate = !allOn && !noneOn
  return (
    <div role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onToggle() }} className="px-2 py-1.5 flex-shrink-0">
      <span className={cn(
        'inline-flex items-center justify-center w-3 h-3 rounded-sm border transition-all',
        allOn ? 'bg-orange-500 border-orange-500' : indeterminate ? 'bg-zinc-600 border-zinc-600' : 'border-zinc-600',
      )}>
        {allOn && (
          <svg viewBox="0 0 12 12" className="w-full h-full" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {indeterminate && (
          <svg viewBox="0 0 12 12" className="w-full h-full" fill="none">
            <line x1="3" y1="6" x2="9" y2="6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder, focusColor }: { value: string; onChange: (v: string) => void; placeholder: string; focusColor: string }) {
  return (
    <div className="px-2.5 pt-2 pb-1.5 flex-shrink-0">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn('w-full bg-zinc-800 border border-zinc-700 text-zinc-50 text-[12px] pl-7 pr-2.5 py-1 rounded-sm outline-none placeholder-zinc-700 transition-colors', focusColor)}
        />
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600" width="11" height="11" viewBox="0 0 11 11" fill="none">
          <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.3" />
          <line x1="7.5" y1="7.5" x2="10" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

export function TypeToggle({ on, color, onClick }: { on: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick() }} className="px-2 py-1.5 flex-shrink-0">
      <span className={cn(
        'inline-block w-3 h-3 rounded-sm border transition-all',
        on ? 'border-current' : 'border-zinc-600',
      )} style={on ? { backgroundColor: color, borderColor: color } : undefined}>
        {on && (
          <svg viewBox="0 0 12 12" className="w-full h-full" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  )
}
