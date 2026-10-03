import { useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useClock } from '@/hooks/useClock'
import { useAppStore } from '@/stores/app-store'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/Tooltip'

const SIX_HOURS = 6 * 60 * 60 * 1000
const SPEED_OPTIONS = [1, 2, 5, 10]

export function BottomBar() {
  const sessionStart = useAppStore(s => s.sessionStart)
  const timelineStart = useAppStore(s => s.timelineStart)
  const timelineCursor = useAppStore(s => s.timelineCursor)
  const timelineLive = useAppStore(s => s.timelineLive)
  const timelinePlaying = useAppStore(s => s.timelinePlaying)
  const timelineSpeed = useAppStore(s => s.timelineSpeed)
  const setTimelineCursor = useAppStore(s => s.setTimelineCursor)
  const setTimelineLive = useAppStore(s => s.setTimelineLive)
  const setTimelinePlaying = useAppStore(s => s.setTimelinePlaying)
  const setTimelineSpeed = useAppStore(s => s.setTimelineSpeed)
  const { elapsed, nextUpdate } = useClock(sessionStart)
  const trackRef = useRef<HTMLDivElement>(null)

  // Keep cursor at "now" when live
  useEffect(() => {
    if (!timelineLive) return
    const id = setInterval(() => {
      useAppStore.setState({ timelineCursor: Date.now(), timelineStart: Date.now() - SIX_HOURS })
    }, 1000)
    return () => clearInterval(id)
  }, [timelineLive])

  // Replay playback — advance cursor forward when playing
  useEffect(() => {
    if (!timelinePlaying || timelineLive) return
    const intervalMs = 100
    const id = setInterval(() => {
      const state = useAppStore.getState()
      const advance = (intervalMs * state.timelineSpeed * 60) // speed multiplier scales minutes
      const newCursor = state.timelineCursor + advance
      if (newCursor >= Date.now()) {
        setTimelineLive(true)
      } else {
        useAppStore.setState({ timelineCursor: newCursor })
      }
    }, 100)
    return () => clearInterval(id)
  }, [timelinePlaying, timelineLive, setTimelineLive])

  const now = Date.now()
  const range = now - timelineStart
  const progress = Math.min(1, Math.max(0, (timelineCursor - timelineStart) / range))

  const handleScrub = useCallback((clientX: number) => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const now = Date.now()
    const start = now - SIX_HOURS
    const cursor = start + pct * SIX_HOURS
    if (now - cursor < 10_000) {
      setTimelineLive(true)
    } else {
      setTimelineCursor(cursor)
    }
  }, [setTimelineCursor, setTimelineLive])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    handleScrub(e.clientX)
    const onMove = (me: MouseEvent) => handleScrub(me.clientX)
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [handleScrub])

  const cursorOffset = now - timelineCursor
  const cursorLabel = timelineLive
    ? 'LIVE'
    : cursorOffset < 60_000
      ? `T-${Math.floor(cursorOffset / 1000)}s`
      : cursorOffset < 3_600_000
        ? `T-${Math.floor(cursorOffset / 60_000)}m`
        : `T-${(cursorOffset / 3_600_000).toFixed(1)}h`

  const togglePlayPause = useCallback(() => {
    if (timelineLive) {
      // Start replay from 6 hours ago
      const start = Date.now() - SIX_HOURS
      setTimelineCursor(start)
      setTimelinePlaying(true)
    } else {
      setTimelinePlaying(!timelinePlaying)
    }
  }, [timelineLive, timelinePlaying, setTimelineCursor, setTimelinePlaying])

  const cycleSpeed = useCallback(() => {
    const idx = SPEED_OPTIONS.indexOf(timelineSpeed)
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]
    setTimelineSpeed(next)
  }, [timelineSpeed, setTimelineSpeed])

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-[34px] bg-zinc-900 border-t border-zinc-800 flex items-center pl-3.5 z-50">

      <div className="flex items-center gap-1.5 pr-3.5 border-r border-zinc-800 font-mono text-[12px] text-zinc-600 whitespace-nowrap h-full">
        MODE <span className="text-zinc-400">{timelineLive ? 'REALTIME' : timelinePlaying ? 'REPLAY' : 'PAUSED'}</span>
      </div>

      {/* Play/Pause + Speed */}
      <div className="flex items-center h-full border-r border-zinc-800">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={togglePlayPause}
                className="px-2.5 h-full font-mono text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {timelinePlaying && !timelineLive ? '⏸' : '▶'}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{timelinePlaying ? 'Pause' : 'Play'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={cycleSpeed}
                className={cn(
                  'px-2 h-full font-mono text-[11px] transition-colors',
                  timelineSpeed > 1 ? 'text-orange-400' : 'text-zinc-600 hover:text-zinc-400',
                )}
              >
                {timelineSpeed}x
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Playback speed</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-1.5 px-3.5 border-r border-zinc-800 font-mono text-[12px] text-zinc-600 whitespace-nowrap h-full">
        T+ <span className="text-zinc-400">{elapsed}</span>
      </div>

      {/* Timeline scrubber */}
      <div className="flex-1 flex items-center gap-2.5 px-4 h-full">
        <span className="font-mono text-[13px] text-zinc-600 whitespace-nowrap">T-6H</span>
        <div
          ref={trackRef}
          className="flex-1 h-[3px] bg-zinc-800 rounded-sm relative cursor-pointer"
          onMouseDown={handleMouseDown}
        >
          <div
            className="h-full bg-gradient-to-r from-orange-800 to-orange-500 rounded-sm relative transition-[width] duration-100"
            style={{ width: `${(progress * 100).toFixed(1)}%` }}
          >
            <div className="absolute right-[-1px] top-[-3px] w-[2px] h-[9px] bg-orange-400 rounded-sm shadow-[0_0_6px_rgba(249,115,22,0.6)]" />
          </div>
        </div>
        <span className="font-mono text-[13px] text-zinc-600 whitespace-nowrap">NOW</span>
      </div>

      <div className="flex items-center gap-1.5 px-3.5 border-l border-zinc-800 font-mono text-[12px] text-zinc-600 whitespace-nowrap h-full">
        {timelineLive ? (
          <>UPDATE <span className="text-zinc-400">T-{nextUpdate}s</span></>
        ) : (
          <button
            onClick={() => setTimelineLive(true)}
            className="text-orange-400 hover:text-orange-300 uppercase tracking-wider"
          >
            {cursorLabel} → LIVE
          </button>
        )}
      </div>
      <div className="px-4 border-l border-zinc-800 font-display text-[13px] font-semibold tracking-[2px] text-zinc-50 h-full flex items-center">
        OP NIGHTFALL
      </div>
      <div className="px-3.5 border-l border-zinc-800 font-display text-[13px] font-bold tracking-[3px] text-red-400 h-full flex items-center">
        UNCLASSIFIED
      </div>
    </footer>
  )
}
