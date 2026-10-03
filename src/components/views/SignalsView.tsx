import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts'
import { useSatelliteStore } from '@/stores/satellite-store'
import { useVesselStore } from '@/stores/vessel-store'
import { useFlightStore } from '@/stores/flight-store'
import { useWeatherStore } from '@/stores/weather-store'
import { useNewsStore } from '@/stores/news-store'
import { useConflictStore } from '@/stores/conflict-store'
import { useCyberStore } from '@/stores/cyber-store'
import { useOsintStore } from '@/stores/osint-store'
import { usePortStore } from '@/stores/port-store'
import { useRFStore } from '@/stores/rf-store'
import { useEconomicStore } from '@/stores/economic-store'
import { useAlertStore } from '@/stores/alert-store'
import { useCameraStore } from '@/stores/camera-store'
import {
  DOMAIN_HEX_COLORS,
  DOMAIN_LABELS,
  CHART_TOOLTIP_STYLE,
  CHART_AXIS_STYLE,
  CHART_GRID_STYLE,
  activeBarGrow,
} from '@/lib/chart-theme'

const SEVERITY_COLORS: Record<string, string> = {
  info: '#60a5fa',
  warning: '#eab308',
  critical: '#ef4444',
}

export function SignalsView() {
  // --- Store subscriptions ---
  const satStats = useSatelliteStore(s => s.getStats)()
  const satLastFetch = useSatelliteStore(s => s.getStats)().lastFetchTime

  const vesselCount = useVesselStore(s => s.count)
  const vesselConnected = useVesselStore(s => s.connected)

  const flightCount = useFlightStore(s => s.count)
  const flightConnected = useFlightStore(s => s.connected)

  const weatherCount = useWeatherStore(s => s.count)
  const weatherLastFetch = useWeatherStore(s => s.lastFetch)

  const newsCount = useNewsStore(s => s.count)
  const newsLastFetch = useNewsStore(s => s.lastFetch)

  const conflictCount = useConflictStore(s => s.count)
  const conflictLastFetch = useConflictStore(s => s.lastFetch)
  const conflictEvents = useConflictStore(s => s.events)

  const cyberCount = useCyberStore(s => s.count)
  const cyberLastFetch = useCyberStore(s => s.lastFetch)
  const cyberEvents = useCyberStore(s => s.events)

  const osintCount = useOsintStore(s => s.count)
  const osintLastFetch = useOsintStore(s => s.lastFetch)

  const portCount = usePortStore(s => s.count)
  const portLastFetch = usePortStore(s => s.lastFetch)

  const rfCount = useRFStore(s => s.count)
  const rfLastFetch = useRFStore(s => s.lastFetch)

  const econCount = useEconomicStore(s => s.count)
  const econLastFetch = useEconomicStore(s => s.lastFetch)

  const alerts = useAlertStore(s => s.alerts)
  const unackCount = useAlertStore(s => s.unacknowledgedCount)
  const acknowledgeAll = useAlertStore(s => s.acknowledgeAll)

  const cameraCount = useCameraStore(s => s.count)
  const cameraLastFetch = useCameraStore(s => s.lastFetch)

  // --- Computed values ---

  const domainCounts: Record<string, number> = useMemo(() => ({
    satellite: satStats.enabledCount,
    vessel: vesselCount,
    flight: flightCount,
    weather: weatherCount,
    news: newsCount,
    conflict: conflictCount,
    cyber: cyberCount,
    osint: osintCount,
    port: portCount,
    rf: rfCount,
    economic: econCount,
  }), [satStats.enabledCount, vesselCount, flightCount, weatherCount, newsCount, conflictCount, cyberCount, osintCount, portCount, rfCount, econCount])

  const totalEntities = useMemo(() => Object.values(domainCounts).reduce((a, b) => a + b, 0), [domainCounts])

  const activeSources = useMemo(() => Object.values(domainCounts).filter(c => c > 0).length, [domainCounts])

  // Row 2: Domain bar chart data
  const domainBarData = useMemo(() =>
    Object.entries(domainCounts).map(([key, value]) => ({
      domain: key,
      label: DOMAIN_LABELS[key],
      count: value,
      fill: DOMAIN_HEX_COLORS[key],
    })),
    [domainCounts],
  )

  // Row 3 Left: Alert timeline buckets (last hour, 5-min buckets = 12 buckets)
  const alertTimelineData = useMemo(() => {
    const now = Date.now()
    const hourAgo = now - 60 * 60 * 1000
    const bucketSize = 5 * 60 * 1000
    const buckets: Array<{ time: string; info: number; warning: number; critical: number }> = []

    for (let i = 0; i < 12; i++) {
      const bucketStart = hourAgo + i * bucketSize
      const bucketEnd = bucketStart + bucketSize
      const label = new Date(bucketEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

      const bucket = { time: label, info: 0, warning: 0, critical: 0 }
      for (const a of alerts) {
        if (a.time >= bucketStart && a.time < bucketEnd) {
          bucket[a.severity]++
        }
      }
      buckets.push(bucket)
    }
    return buckets
  }, [alerts])

  // Row 3 Right: Alert severity pie data
  const alertSeverityData = useMemo(() => {
    const counts = { info: 0, warning: 0, critical: 0 }
    for (const a of alerts) counts[a.severity]++
    return [
      { name: 'Info', value: counts.info, fill: SEVERITY_COLORS.info },
      { name: 'Warning', value: counts.warning, fill: SEVERITY_COLORS.warning },
      { name: 'Critical', value: counts.critical, fill: SEVERITY_COLORS.critical },
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.length])

  // Row 4 Left: Cyber events by type
  const cyberByType = useMemo(() => {
    const counts: Record<string, number> = { ddos: 0, scan: 0, malware: 0, outage: 0, vulnerability: 0 }
    for (const [, ev] of cyberEvents) counts[ev.type] = (counts[ev.type] || 0) + 1
    return Object.entries(counts).map(([type, count]) => ({
      type: type.toUpperCase(),
      count,
    }))
  }, [cyberEvents])

  // Row 4 Right: Conflict events by type
  const conflictByType = useMemo(() => {
    const counts: Record<string, { count: number; fatalities: number }> = {}
    for (const t of ['battle', 'protest', 'riot', 'explosion', 'violence', 'strategic']) {
      counts[t] = { count: 0, fatalities: 0 }
    }
    for (const [, ev] of conflictEvents) {
      if (!counts[ev.type]) counts[ev.type] = { count: 0, fatalities: 0 }
      counts[ev.type].count++
      counts[ev.type].fatalities += ev.fatalities || 0
    }
    return Object.entries(counts).map(([type, data]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      count: data.count,
      fatalities: data.fatalities,
    }))
  }, [conflictEvents])

  // Row 5: Feed health sources
  const feedHealthSources = useMemo(() => {
    const now = Date.now()
    const staleThreshold = 10 * 60 * 1000

    function getStatus(count: number, lastFetch: number | null, connected?: boolean): 'green' | 'amber' | 'red' {
      if (connected !== undefined) {
        if (connected && count > 0) return 'green'
        if (connected || count > 0) return 'amber'
        return 'red'
      }
      if (count > 0 && lastFetch && (now - lastFetch) < staleThreshold) return 'green'
      if (count > 0 || (lastFetch && (now - lastFetch) < staleThreshold)) return 'amber'
      return 'red'
    }

    return [
      { key: 'satellite', label: 'SAT', count: satStats.enabledCount, status: getStatus(satStats.enabledCount, satLastFetch) },
      { key: 'vessel', label: 'AIS', count: vesselCount, status: getStatus(vesselCount, null, vesselConnected) },
      { key: 'flight', label: 'ADSB', count: flightCount, status: getStatus(flightCount, null, flightConnected) },
      { key: 'weather', label: 'WX', count: weatherCount, status: getStatus(weatherCount, weatherLastFetch) },
      { key: 'news', label: 'NEWS', count: newsCount, status: getStatus(newsCount, newsLastFetch) },
      { key: 'conflict', label: 'CON', count: conflictCount, status: getStatus(conflictCount, conflictLastFetch) },
      { key: 'cyber', label: 'CYB', count: cyberCount, status: getStatus(cyberCount, cyberLastFetch) },
      { key: 'osint', label: 'OSINT', count: osintCount, status: getStatus(osintCount, osintLastFetch) },
      { key: 'port', label: 'PORT', count: portCount, status: getStatus(portCount, portLastFetch) },
      { key: 'rf', label: 'RF', count: rfCount, status: getStatus(rfCount, rfLastFetch) },
      { key: 'economic', label: 'ECON', count: econCount, status: getStatus(econCount, econLastFetch) },
      { key: 'camera', label: 'CAM', count: cameraCount, status: getStatus(cameraCount, cameraLastFetch) },
    ]
  }, [
    satStats.enabledCount, satLastFetch,
    vesselCount, vesselConnected,
    flightCount, flightConnected,
    weatherCount, weatherLastFetch,
    newsCount, newsLastFetch,
    conflictCount, conflictLastFetch,
    cyberCount, cyberLastFetch,
    osintCount, osintLastFetch,
    portCount, portLastFetch,
    rfCount, rfLastFetch,
    econCount, econLastFetch,
    cameraCount, cameraLastFetch,
  ])

  const statusDotColor = { green: 'bg-green-400', amber: 'bg-amber-400', red: 'bg-red-500' }

  return (
    <div className="fixed top-[46px] left-64 right-[272px] bottom-[34px] bg-zinc-950 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 p-4">
      <div className="font-display text-[12px] font-semibold tracking-[3px] text-zinc-600 uppercase mb-4">
        Signals Dashboard
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="font-mono text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Total Entities</div>
          <div className="font-mono text-2xl font-bold text-orange-400">{totalEntities.toLocaleString()}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="font-mono text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Active Sources</div>
          <div className="font-mono text-2xl font-bold text-green-400">{activeSources}/11</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="font-mono text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Alerts</div>
          <div className="font-mono text-2xl font-bold text-yellow-400">{alerts.length}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="font-mono text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Unacknowledged</div>
          <div className="flex items-center gap-3">
            <div className={`font-mono text-2xl font-bold ${unackCount > 0 ? 'text-red-400' : 'text-zinc-400'}`}>
              {unackCount}
            </div>
            {unackCount > 0 && (
              <button
                onClick={acknowledgeAll}
                className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
              >
                ACK ALL
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Domain Activity Bar Chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
        <div className="font-display text-[12px] font-semibold tracking-[2px] text-zinc-500 uppercase mb-3">
          Entities by Domain
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={domainBarData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid {...CHART_GRID_STYLE} />
            <XAxis dataKey="label" {...CHART_AXIS_STYLE} />
            <YAxis {...CHART_AXIS_STYLE} />
            <Tooltip {...CHART_TOOLTIP_STYLE} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} activeBar={activeBarGrow}>
              {domainBarData.map((entry) => (
                <Cell key={entry.domain} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Row 3: Alert Analysis */}
      <div className="font-display text-[12px] font-semibold tracking-[3px] text-zinc-600 uppercase mb-4">
        Alert Analysis
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Alert Timeline */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="font-display text-[12px] font-semibold tracking-[2px] text-zinc-500 uppercase mb-3">
            Alert Timeline (Last Hour)
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={alertTimelineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid {...CHART_GRID_STYLE} />
              <XAxis dataKey="time" {...CHART_AXIS_STYLE} />
              <YAxis {...CHART_AXIS_STYLE} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="critical" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} />
              <Area type="monotone" dataKey="warning" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.4} />
              <Area type="monotone" dataKey="info" stackId="1" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.4} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Alert Severity Breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="font-display text-[12px] font-semibold tracking-[2px] text-zinc-500 uppercase mb-3">
            Alert Severity Breakdown
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={alertSeverityData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                dataKey="value"
                isAnimationActive={false}
              >
                {alertSeverityData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip {...CHART_TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {alertSeverityData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                <span className="font-mono text-[11px] text-zinc-400">{d.name}</span>
                <span className="font-mono text-[11px] text-zinc-200 font-bold">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Threat Breakdown */}
      <div className="font-display text-[12px] font-semibold tracking-[3px] text-zinc-600 uppercase mb-4">
        Threat Breakdown
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Cyber Threats by Type */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="font-display text-[12px] font-semibold tracking-[2px] text-zinc-500 uppercase mb-3">
            Cyber Threats by Type
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={cyberByType} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid {...CHART_GRID_STYLE} />
              <XAxis dataKey="type" {...CHART_AXIS_STYLE} />
              <YAxis {...CHART_AXIS_STYLE} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" fill="#c084fc" radius={[3, 3, 0, 0]} activeBar={activeBarGrow} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Conflict Events by Type */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="font-display text-[12px] font-semibold tracking-[2px] text-zinc-500 uppercase mb-3">
            Conflict Events by Type
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={conflictByType} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid {...CHART_GRID_STYLE} />
              <XAxis dataKey="type" {...CHART_AXIS_STYLE} />
              <YAxis {...CHART_AXIS_STYLE} allowDecimals={false} />
              <Tooltip
                {...CHART_TOOLTIP_STYLE}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any, name: any) => {
                  if (name === 'count') return [value, 'Events']
                  if (name === 'fatalities') return [value, 'Fatalities']
                  return [value, name]
                }) as any}
              />
              <Bar dataKey="count" fill="#f87171" radius={[3, 3, 0, 0]} activeBar={activeBarGrow} />
              <Bar dataKey="fatalities" fill="#991b1b" radius={[3, 3, 0, 0]} activeBar={activeBarGrow} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 5: Feed Health */}
      <div className="font-display text-[12px] font-semibold tracking-[3px] text-zinc-600 uppercase mb-4">
        Feed Health
      </div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {feedHealthSources.map((source) => (
          <div key={source.key} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${statusDotColor[source.status]} shrink-0`} />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[11px] text-zinc-500 uppercase tracking-wider">{source.label}</div>
              <div className="font-mono text-lg font-bold text-zinc-200">{source.count.toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
