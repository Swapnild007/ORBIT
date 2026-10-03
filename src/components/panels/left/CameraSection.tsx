import { useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useCameraStore } from '@/stores/camera-store'
import { useSelectionStore } from '@/stores/selection-store'
import { useAppStore } from '@/stores/app-store'

export function CameraSection({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { cameras, version, count, visible, setVisible } = useCameraStore()
  const selectedCameraId = useSelectionStore(s => s.selectedCameraId)

  const cameraList = useMemo(() => {
    void version
    return [...cameras.values()].sort((a, b) => a.title.localeCompare(b.title))
  }, [cameras, version])

  const handleSelect = useCallback((id: string) => {
    useSelectionStore.getState().selectCamera(id)
    useAppStore.getState().setActiveView('Globe')
  }, [])

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
        <span className="font-display text-[12px] font-semibold tracking-[2px] text-sky-400 uppercase flex-1 text-left">Cameras</span>
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1', hasData ? 'bg-sky-400' : 'bg-zinc-600')} />
        <span className="font-mono text-[11px] text-zinc-500">{count}</span>
        <button
          onClick={(e) => { e.stopPropagation(); setVisible(!visible) }}
          className={cn('w-4 h-4 rounded border flex items-center justify-center text-[10px]',
            visible ? 'border-sky-500 bg-sky-500/20 text-sky-400' : 'border-zinc-600 text-zinc-600'
          )}
        >
          {visible ? '✓' : ''}
        </button>
      </div>

      {expanded && (
        <div className="border-b border-zinc-800 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
          {cameraList.slice(0, 200).map(cam => (
            <button
              key={cam.id}
              onClick={() => handleSelect(cam.id)}
              className={cn(
                'w-full flex items-center gap-2 pl-4 pr-3 py-1.5 text-left border-b border-zinc-800/20 hover:bg-zinc-800/30 transition-colors cursor-pointer',
                selectedCameraId === cam.id && 'bg-sky-500/10 border-l-2 border-l-sky-400',
              )}
            >
              {cam.thumbnail && (
                <img src={cam.thumbnail} alt="" className="w-8 h-6 rounded object-cover flex-shrink-0 bg-zinc-800" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[11px] text-zinc-400 truncate">{cam.title}</div>
                <div className="font-mono text-[10px] text-zinc-600">{cam.city}{cam.country ? `, ${cam.country}` : ''}</div>
              </div>
            </button>
          ))}
          {count === 0 && (
            <div className="px-4 py-3 font-mono text-[11px] text-zinc-600">No cameras loaded</div>
          )}
        </div>
      )}
    </div>
  )
}
