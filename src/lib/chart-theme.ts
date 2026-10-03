export const DOMAIN_HEX_COLORS: Record<string, string> = {
  satellite: '#f97316',
  vessel: '#22d3ee',
  flight: '#eab308',
  weather: '#4ade80',
  news: '#fb7185',
  conflict: '#f87171',
  cyber: '#c084fc',
  osint: '#2dd4bf',
  port: '#60a5fa',
  rf: '#a78bfa',
  economic: '#34d399',
}

export const DOMAIN_LABELS: Record<string, string> = {
  satellite: 'SAT',
  vessel: 'AIS',
  flight: 'ADSB',
  weather: 'WX',
  news: 'NEWS',
  conflict: 'CON',
  cyber: 'CYB',
  osint: 'OSINT',
  port: 'PORT',
  rf: 'RF',
  economic: 'ECON',
}

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: '#18181b',
    border: '1px solid #3f3f46',
    borderRadius: 6,
    fontFamily: '"DM Mono", monospace',
    fontSize: 11,
    color: '#f4f4f5',
  },
  labelStyle: {
    color: '#f4f4f5',
    fontWeight: 600,
  },
  itemStyle: {
    color: '#e4e4e7',
  },
  cursor: false as const,
}

export const CHART_AXIS_STYLE = {
  tick: { fill: '#71717a', fontFamily: '"DM Mono", monospace', fontSize: 10 },
  axisLine: { stroke: '#3f3f46' },
  tickLine: { stroke: '#3f3f46' },
}

export const CHART_GRID_STYLE = {
  stroke: '#27272a',
  strokeDasharray: '3 3',
}

import { createElement } from 'react'

/** Render a slightly enlarged bar on hover (used as <Bar activeBar={activeBarGrow} />) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function activeBarGrow(props: any) {
  const { x, y, width, height, fill, radius } = props as {
    x: number; y: number; width: number; height: number; fill: string; radius?: number | number[]
  }
  const grow = 3
  let rx = 0
  if (Array.isArray(radius)) rx = radius[0] ?? 0
  else if (typeof radius === 'number') rx = radius
  return createElement('rect', {
    x: x - grow / 2,
    y: y - grow,
    width: width + grow,
    height: height + grow,
    fill,
    rx,
    fillOpacity: 1,
  })
}
