import { useAppStore } from '@/stores/app-store'
import { useSatelliteInit } from '@/hooks/useSatelliteInit'
import { useVesselInit } from '@/hooks/useVesselInit'
import { useFlightInit } from '@/hooks/useFlightInit'
import { useWeatherInit } from '@/hooks/useWeatherInit'
import { useNewsInit } from '@/hooks/useNewsInit'
import { useConflictInit } from '@/hooks/useConflictInit'
import { useCyberInit } from '@/hooks/useCyberInit'
import { useOsintInit } from '@/hooks/useOsintInit'
import { usePortInit } from '@/hooks/usePortInit'
import { useRFInit } from '@/hooks/useRFInit'
import { useEconomicInit } from '@/hooks/useEconomicInit'
import { useCameraInit } from '@/hooks/useCameraInit'
import { useAlertEngine } from '@/hooks/useAlertEngine'
import { useDarkVesselDetection } from '@/hooks/useDarkVesselDetection'
import { usePersistence } from '@/hooks/usePersistence'
import { AlertToastContainer } from '@/components/ui/AlertToast'
import { TopBar } from '@/components/panels/TopBar'
import { BottomBar } from '@/components/panels/BottomBar'
import { LeftPanel } from '@/components/panels/left/LeftPanel'
import { RightPanel } from '@/components/panels/RightPanel'
import { MapboxGlobeView } from '@/components/globe/MapboxGlobeView'
import { ObjectsView } from '@/components/views/ObjectsView'
import { GraphView } from '@/components/views/GraphView'
import { SignalsView } from '@/components/views/SignalsView'
import { ReportsView } from '@/components/views/ReportsView'

export default function App() {
  useSatelliteInit()
  useVesselInit()
  useFlightInit()
  useWeatherInit()
  useNewsInit()
  useConflictInit()
  useCyberInit()
  useOsintInit()
  usePortInit()
  useRFInit()
  useEconomicInit()
  useCameraInit()
  useAlertEngine()
  useDarkVesselDetection()
  usePersistence()

  const activeView = useAppStore(s => s.activeView)

  return (
    <div className="h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-50">
      <TopBar />
      <LeftPanel />
      {activeView === 'Globe' && <MapboxGlobeView />}
      {activeView === 'Objects' && <ObjectsView />}
      {activeView === 'Graph' && <GraphView />}
      {activeView === 'Signals' && <SignalsView />}
      {activeView === 'Reports' && <ReportsView />}
      <RightPanel />
      <AlertToastContainer />
      <BottomBar />
    </div>
  )
}
