import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
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
import { haversineDistance } from '@/lib/utils'
import { DOMAIN_HEX_COLORS, DOMAIN_LABELS, CHART_TOOLTIP_STYLE, CHART_AXIS_STYLE, CHART_GRID_STYLE, activeBarGrow } from '@/lib/chart-theme'
import { BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'

interface GraphNode {
  id: string
  domain: string
  name: string
  lat: number
  lon: number
  x: number
  y: number
  vx: number
  vy: number
}

interface GraphEdge {
  source: string
  target: string
  distance: number
}

const PROXIMITY_KM = 100
const MAX_NODES = 200

export function GraphView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const nodesRef = useRef<GraphNode[]>([])
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  const { vessels, version: vv } = useVesselStore()
  const { flights, version: fv } = useFlightStore()
  const { events: weatherEvents, version: wv } = useWeatherStore()
  const { events: newsEvents, version: nv } = useNewsStore()
  const { events: conflictEvents, version: cv } = useConflictStore()
  const { events: cyberEvents, version: cyv } = useCyberStore()
  const { posts: osintPosts, version: ov } = useOsintStore()
  const { ports, version: pv } = usePortStore()
  const { spots: rfSpots, version: rv } = useRFStore()
  const { indicators: econIndicators, version: ev } = useEconomicStore()

  const { nodes, edges } = useMemo(() => {
    void vv; void fv; void wv; void nv; void cv; void cyv; void ov; void pv; void rv; void ev
    const allNodes: GraphNode[] = []
    const perDomain = Math.floor(MAX_NODES / 10)

    for (const [, v] of [...vessels].slice(0, perDomain)) {
      allNodes.push({ id: `v-${v.mmsi}`, domain: 'vessel', name: v.name || String(v.mmsi), lat: v.lat, lon: v.lon, x: 0, y: 0, vx: 0, vy: 0 })
    }
    for (const [, f] of [...flights].slice(0, perDomain)) {
      allNodes.push({ id: `f-${f.icao24}`, domain: 'flight', name: f.callsign, lat: f.lat, lon: f.lon, x: 0, y: 0, vx: 0, vy: 0 })
    }
    for (const [, e] of [...weatherEvents].slice(0, perDomain)) {
      allNodes.push({ id: `w-${e.id}`, domain: 'weather', name: e.title, lat: e.lat, lon: e.lon, x: 0, y: 0, vx: 0, vy: 0 })
    }
    for (const [, e] of [...newsEvents].slice(0, perDomain)) {
      allNodes.push({ id: `n-${e.id}`, domain: 'news', name: e.title, lat: e.lat, lon: e.lon, x: 0, y: 0, vx: 0, vy: 0 })
    }
    for (const [, e] of [...conflictEvents].slice(0, perDomain)) {
      allNodes.push({ id: `c-${e.id}`, domain: 'conflict', name: e.title, lat: e.lat, lon: e.lon, x: 0, y: 0, vx: 0, vy: 0 })
    }
    for (const [, e] of [...cyberEvents].slice(0, perDomain)) {
      allNodes.push({ id: `cy-${e.id}`, domain: 'cyber', name: e.title, lat: e.lat, lon: e.lon, x: 0, y: 0, vx: 0, vy: 0 })
    }
    for (const [, p] of [...osintPosts].slice(0, perDomain)) {
      allNodes.push({ id: `o-${p.id}`, domain: 'osint', name: p.text.slice(0, 40), lat: p.lat, lon: p.lon, x: 0, y: 0, vx: 0, vy: 0 })
    }
    for (const [, p] of [...ports].slice(0, perDomain)) {
      allNodes.push({ id: `p-${p.id}`, domain: 'port', name: p.name, lat: p.lat, lon: p.lon, x: 0, y: 0, vx: 0, vy: 0 })
    }
    for (const [, s] of [...rfSpots].slice(0, perDomain)) {
      allNodes.push({ id: `r-${s.id}`, domain: 'rf', name: `${s.txCall}→${s.rxCall}`, lat: s.rxLat, lon: s.rxLon, x: 0, y: 0, vx: 0, vy: 0 })
    }
    for (const [, ind] of [...econIndicators].slice(0, perDomain)) {
      allNodes.push({ id: `e-${ind.id}`, domain: 'economic', name: ind.country, lat: ind.lat, lon: ind.lon, x: 0, y: 0, vx: 0, vy: 0 })
    }

    // Initialize positions in a circle
    for (let i = 0; i < allNodes.length; i++) {
      const angle = (i / allNodes.length) * Math.PI * 2
      const r = 200 + Math.random() * 100
      allNodes[i].x = 400 + Math.cos(angle) * r
      allNodes[i].y = 300 + Math.sin(angle) * r
    }

    // Find edges (cross-domain proximity)
    const allEdges: GraphEdge[] = []
    for (let i = 0; i < allNodes.length; i++) {
      for (let j = i + 1; j < allNodes.length; j++) {
        if (allNodes[i].domain === allNodes[j].domain) continue
        const dist = haversineDistance(allNodes[i].lat, allNodes[i].lon, allNodes[j].lat, allNodes[j].lon)
        if (dist <= PROXIMITY_KM) {
          allEdges.push({ source: allNodes[i].id, target: allNodes[j].id, distance: dist })
        }
      }
    }

    return { nodes: allNodes, edges: allEdges }
  }, [vv, fv, wv, nv, cv, cyv, ov, pv, rv, ev, vessels, flights, weatherEvents, newsEvents, conflictEvents, cyberEvents, osintPosts, ports, rfSpots, econIndicators])

  // Stats computations
  const domainNodeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const n of nodes) counts[n.domain] = (counts[n.domain] || 0) + 1
    return Object.entries(counts).map(([domain, count]) => ({
      domain: DOMAIN_LABELS[domain] || domain,
      count,
      fill: DOMAIN_HEX_COLORS[domain] || '#a1a1aa',
    }))
  }, [nodes])

  const radarData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const n of nodes) counts[n.domain] = (counts[n.domain] || 0) + 1
    const max = Math.max(...Object.values(counts), 1)
    return Object.keys(DOMAIN_HEX_COLORS).map(domain => ({
      domain: DOMAIN_LABELS[domain] || domain,
      value: Math.round(((counts[domain] || 0) / max) * 100),
    }))
  }, [nodes])

  const topConnections = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const pairCounts: Record<string, number> = {}
    for (const edge of edges) {
      const s = nodeMap.get(edge.source)
      const t = nodeMap.get(edge.target)
      if (!s || !t) continue
      const pair = [s.domain, t.domain].sort().join('–')
      pairCounts[pair] = (pairCounts[pair] || 0) + 1
    }
    return Object.entries(pairCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([pair, count]) => ({ pair, count }))
  }, [nodes, edges])

  const distanceHistogram = useMemo(() => {
    const buckets = [
      { range: '0-25', count: 0 },
      { range: '25-50', count: 0 },
      { range: '50-75', count: 0 },
      { range: '75-100', count: 0 },
    ]
    for (const edge of edges) {
      const idx = Math.min(3, Math.floor(edge.distance / 25))
      buckets[idx].count++
    }
    return buckets
  }, [edges])

  const connectedNodes = useMemo(() => {
    if (!selectedNode) return []
    const connected: GraphNode[] = []
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    for (const edge of edges) {
      if (edge.source === selectedNode.id) {
        const t = nodeMap.get(edge.target)
        if (t) connected.push(t)
      } else if (edge.target === selectedNode.id) {
        const s = nodeMap.get(edge.source)
        if (s) connected.push(s)
      }
    }
    return connected
  }, [selectedNode, nodes, edges])

  const selectedEdgeIds = useMemo(() => {
    if (!selectedNode) return new Set<string>()
    const ids = new Set<string>()
    for (const edge of edges) {
      if (edge.source === selectedNode.id || edge.target === selectedNode.id) {
        ids.add(`${edge.source}-${edge.target}`)
      }
    }
    return ids
  }, [selectedNode, edges])

  // Canvas mouse interaction
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width)
    const my = (e.clientY - rect.top) * (canvas.height / rect.height)

    let closest: GraphNode | null = null
    let closestDist = 20
    for (const node of nodesRef.current) {
      const dx = node.x - mx
      const dy = node.y - my
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < closestDist) {
        closestDist = d
        closest = node
      }
    }
    setHoveredNode(closest)
    canvas.style.cursor = closest ? 'pointer' : 'default'
  }, [])

  const handleCanvasClick = useCallback(() => {
    setSelectedNode(hoveredNode)
  }, [hoveredNode])

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    nodesRef.current = nodes

    // Size canvas
    const container = canvas.parentElement!
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height

    // Update center gravity target
    const cx = rect.width / 2
    const cy = rect.height / 2

    // Re-initialize positions based on actual canvas size
    for (let i = 0; i < nodes.length; i++) {
      const angle = (i / nodes.length) * Math.PI * 2
      const r = Math.min(cx, cy) * 0.6 + Math.random() * Math.min(cx, cy) * 0.2
      nodes[i].x = cx + Math.cos(angle) * r
      nodes[i].y = cy + Math.sin(angle) * r
    }

    function tick() {
      // Spring forces on edges
      for (const edge of edges) {
        const s = nodeMap.get(edge.source)
        const t = nodeMap.get(edge.target)
        if (!s || !t) continue
        const dx = t.x - s.x
        const dy = t.y - s.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = (dist - 80) * 0.001
        s.vx += (dx / dist) * force
        s.vy += (dy / dist) * force
        t.vx -= (dx / dist) * force
        t.vy -= (dy / dist) * force
      }

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x
          const dy = nodes[j].y - nodes[i].y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          if (dist < 60) {
            const force = 0.5 / dist
            nodes[i].vx -= (dx / dist) * force
            nodes[i].vy -= (dy / dist) * force
            nodes[j].vx += (dx / dist) * force
            nodes[j].vy += (dy / dist) * force
          }
        }
      }

      // Center gravity + damping
      for (const node of nodes) {
        node.vx += (cx - node.x) * 0.0005
        node.vy += (cy - node.y) * 0.0005
        node.vx *= 0.95
        node.vy *= 0.95
        node.x += node.vx
        node.y += node.vy
      }

      // Draw
      const w = canvas!.width
      const h = canvas!.height
      ctx!.clearRect(0, 0, w, h)

      // Edges
      for (const edge of edges) {
        const s = nodeMap.get(edge.source)
        const t = nodeMap.get(edge.target)
        if (!s || !t) continue
        const edgeKey = `${edge.source}-${edge.target}`
        const isSelected = selectedEdgeIds.has(edgeKey)
        const color = DOMAIN_HEX_COLORS[s.domain] || '#3f3f46'
        ctx!.strokeStyle = color
        ctx!.globalAlpha = isSelected ? 0.6 : 0.12
        ctx!.lineWidth = isSelected ? 1.5 : 0.5
        ctx!.beginPath()
        ctx!.moveTo(s.x, s.y)
        ctx!.lineTo(t.x, t.y)
        ctx!.stroke()
      }
      ctx!.globalAlpha = 1

      // Nodes
      for (const node of nodes) {
        const color = DOMAIN_HEX_COLORS[node.domain] ?? '#a1a1aa'
        const isHovered = hoveredNode?.id === node.id
        const isSelected = selectedNode?.id === node.id
        const isConnected = selectedNode && connectedNodes.some(n => n.id === node.id)

        // Glow for selected/connected
        if (isSelected || isConnected) {
          ctx!.shadowColor = color
          ctx!.shadowBlur = 8
        }

        ctx!.fillStyle = color
        ctx!.globalAlpha = (isSelected || isConnected || isHovered) ? 1 : 0.7
        ctx!.beginPath()
        ctx!.arc(node.x, node.y, isSelected ? 7 : isHovered ? 6 : 4, 0, Math.PI * 2)
        ctx!.fill()

        ctx!.shadowColor = 'transparent'
        ctx!.shadowBlur = 0
        ctx!.globalAlpha = 1

        // Highlight ring
        if (isHovered || isSelected) {
          ctx!.strokeStyle = color
          ctx!.lineWidth = 1.5
          ctx!.beginPath()
          ctx!.arc(node.x, node.y, (isSelected ? 7 : 6) + 3, 0, Math.PI * 2)
          ctx!.stroke()

          // Label
          ctx!.font = '10px "DM Mono", monospace'
          ctx!.fillStyle = '#d4d4d8'
          ctx!.textAlign = 'center'
          ctx!.fillText(node.name.slice(0, 30), node.x, node.y - 14)
        }
      }

      animRef.current = requestAnimationFrame(tick)
    }

    tick()

    return () => cancelAnimationFrame(animRef.current)
  }, [nodes, edges, hoveredNode, selectedNode, selectedEdgeIds, connectedNodes])

  return (
    <div className="fixed top-[46px] left-64 right-[272px] bottom-[34px] bg-zinc-950 flex">
      {/* Canvas area */}
      <div className="flex-1 relative">
        <div className="absolute top-3 left-3 font-display text-[12px] font-semibold tracking-[3px] text-zinc-600 uppercase z-10">
          Entity Graph — {nodes.length} nodes, {edges.length} edges
        </div>
        {/* Legend */}
        <div className="absolute top-3 right-3 flex flex-wrap gap-x-3 gap-y-1 z-10 max-w-[400px]">
          {Object.entries(DOMAIN_HEX_COLORS).map(([domain, color]) => (
            <div key={domain} className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-mono text-[10px] text-zinc-500 uppercase">{DOMAIN_LABELS[domain] || domain}</span>
            </div>
          ))}
        </div>
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onMouseMove={handleCanvasMouseMove}
          onClick={handleCanvasClick}
        />
      </div>

      {/* Stats sidebar */}
      <div className="w-72 bg-zinc-900/50 border-l border-zinc-800 p-3 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 flex flex-col gap-4">
        {/* Domain Radar */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="font-display text-[11px] font-semibold tracking-[2px] text-zinc-500 uppercase mb-2">Node Distribution</div>
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#27272a" />
              <PolarAngleAxis dataKey="domain" tick={{ fill: '#71717a', fontSize: 9, fontFamily: '"DM Mono", monospace' }} />
              <Radar dataKey="value" stroke="#f97316" fill="#f97316" fillOpacity={0.2} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Connections */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="font-display text-[11px] font-semibold tracking-[2px] text-zinc-500 uppercase mb-2">Top Connections</div>
          {topConnections.length > 0 ? (
            <ResponsiveContainer width="100%" height={topConnections.length * 24 + 20}>
              <BarChart data={topConnections} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid {...CHART_GRID_STYLE} horizontal={false} />
                <XAxis type="number" {...CHART_AXIS_STYLE} />
                <YAxis type="category" dataKey="pair" width={70} tick={{ fill: '#71717a', fontSize: 9, fontFamily: '"DM Mono", monospace' }} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#f97316" radius={[0, 2, 2, 0]} activeBar={activeBarGrow} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="font-mono text-[11px] text-zinc-600 text-center py-4">No cross-domain connections</div>
          )}
        </div>

        {/* Proximity Histogram */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="font-display text-[11px] font-semibold tracking-[2px] text-zinc-500 uppercase mb-2">Edge Distance (km)</div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={distanceHistogram} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
              <XAxis dataKey="range" {...CHART_AXIS_STYLE} />
              <YAxis hide />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" fill="#a78bfa" radius={[2, 2, 0, 0]} activeBar={activeBarGrow} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Selected Node Detail */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="font-display text-[11px] font-semibold tracking-[2px] text-zinc-500 uppercase mb-2">Selected Entity</div>
          {selectedNode ? (
            <div className="space-y-2">
              <div>
                <div className="font-mono text-[12px] text-zinc-200 truncate">{selectedNode.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: DOMAIN_HEX_COLORS[selectedNode.domain] }} />
                  <span className="font-mono text-[10px] text-zinc-500 uppercase">{selectedNode.domain}</span>
                </div>
                <div className="font-mono text-[10px] text-zinc-600 mt-1">
                  {selectedNode.lat.toFixed(3)}, {selectedNode.lon.toFixed(3)}
                </div>
              </div>
              {connectedNodes.length > 0 && (
                <div>
                  <div className="font-mono text-[10px] text-zinc-500 uppercase mb-1">Connected ({connectedNodes.length})</div>
                  <div className="space-y-0.5 max-h-[160px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                    {connectedNodes.map(n => (
                      <div key={n.id} className="flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: DOMAIN_HEX_COLORS[n.domain] }} />
                        <span className="font-mono text-[10px] text-zinc-400 truncate">{n.name.slice(0, 30)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="font-mono text-[11px] text-zinc-600 text-center py-4">Click a node to inspect</div>
          )}
        </div>
      </div>
    </div>
  )
}
