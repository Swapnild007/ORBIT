import { useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/Tooltip'

interface MapScreenshotProps {
  map: mapboxgl.Map | null
}

export function MapScreenshot({ map }: MapScreenshotProps) {
  const handleScreenshot = useCallback(() => {
    if (!map) return
    try {
      const canvas = map.getCanvas()
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `eagle-eye-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.warn('Screenshot failed:', err)
    }
  }, [map])

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleScreenshot}
            className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md border bg-zinc-900/90 text-zinc-400 border-zinc-700 hover:text-zinc-200 backdrop-blur-sm transition-colors"
          >
            Screenshot
          </button>
        </TooltipTrigger>
        <TooltipContent>Save map screenshot</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
