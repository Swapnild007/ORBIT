import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAlertRuleStore, type AlertRule, type RuleTrigger } from '@/stores/alert-rule-store'
import { useGeofenceStore } from '@/stores/geofence-store'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/Tooltip'

const TRIGGER_LABELS: Record<RuleTrigger, string> = {
  domain: 'Domain Filter',
  severity: 'Severity Threshold',
  keyword: 'Keyword Match',
  geofence: 'Geofence + Domain',
  proximity: 'Proximity Alert',
}

const DOMAINS = ['vessel', 'flight', 'weather', 'conflict', 'cyber', 'satellite']
const SEVERITIES: AlertRule['alertSeverity'][] = ['info', 'warning', 'critical']

export function AlertRuleEditor({ onClose }: { onClose: () => void }) {
  const { addRule } = useAlertRuleStore()
  const geofences = useGeofenceStore(s => s.geofences)

  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState<RuleTrigger>('domain')
  const [alertSeverity, setAlertSeverity] = useState<AlertRule['alertSeverity']>('warning')

  // Domain trigger
  const [selectedDomains, setSelectedDomains] = useState<string[]>([])

  // Severity trigger
  const [severityThreshold, setSeverityThreshold] = useState(5)

  // Keyword trigger
  const [keywordInput, setKeywordInput] = useState('')

  // Geofence trigger
  const [geofenceId, setGeofenceId] = useState('')
  const [geofenceDomain, setGeofenceDomain] = useState('')

  // Proximity trigger
  const [proxLat, setProxLat] = useState('')
  const [proxLon, setProxLon] = useState('')
  const [proxRadius, setProxRadius] = useState('50')
  const [proxDomain, setProxDomain] = useState('')

  const toggleDomain = (d: string) => {
    setSelectedDomains(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    )
  }

  const handleSave = () => {
    if (!name.trim()) return

    const rule: Omit<AlertRule, 'id'> = {
      name: name.trim(),
      enabled: true,
      trigger,
      alertSeverity,
    }

    switch (trigger) {
      case 'domain':
        rule.domains = selectedDomains
        break
      case 'severity':
        rule.severityThreshold = severityThreshold
        break
      case 'keyword':
        rule.keywords = keywordInput.split(',').map(k => k.trim()).filter(Boolean)
        break
      case 'geofence':
        rule.geofenceId = geofenceId
        rule.geofenceDomain = geofenceDomain || undefined
        break
      case 'proximity':
        rule.proximityLat = parseFloat(proxLat)
        rule.proximityLon = parseFloat(proxLon)
        rule.proximityRadiusKm = parseFloat(proxRadius)
        rule.proximityDomain = proxDomain || undefined
        break
    }

    addRule(rule)
    onClose()
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-md p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-zinc-300 uppercase tracking-wider">New Alert Rule</span>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xs">X</button>
      </div>

      {/* Rule name */}
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Rule name..."
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono focus:border-orange-800 focus:outline-none"
      />

      {/* Trigger type */}
      <div>
        <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Trigger</label>
        <div className="flex flex-wrap gap-1 mt-1">
          {(Object.keys(TRIGGER_LABELS) as RuleTrigger[]).map(t => (
            <button
              key={t}
              onClick={() => setTrigger(t)}
              className={cn(
                'px-2 py-1 text-[10px] font-mono rounded transition-colors',
                trigger === t
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-300',
              )}
            >
              {TRIGGER_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Trigger-specific config */}
      <div className="space-y-2">
        {trigger === 'domain' && (
          <div>
            <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Match domains</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {DOMAINS.map(d => (
                <button
                  key={d}
                  onClick={() => toggleDomain(d)}
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-mono rounded transition-colors',
                    selectedDomains.includes(d)
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      : 'bg-zinc-800 text-zinc-500 border border-zinc-700',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {trigger === 'severity' && (
          <div>
            <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
              Min severity: {severityThreshold}
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={severityThreshold}
              onChange={e => setSeverityThreshold(parseInt(e.target.value))}
              className="w-full mt-1 accent-orange-500"
            />
          </div>
        )}

        {trigger === 'keyword' && (
          <div>
            <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Keywords (comma-separated)</label>
            <input
              type="text"
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              placeholder="nuclear, missile, explosion"
              className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono focus:border-orange-800 focus:outline-none"
            />
          </div>
        )}

        {trigger === 'geofence' && (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Geofence</label>
              <select
                value={geofenceId}
                onChange={e => setGeofenceId(e.target.value)}
                className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono focus:border-orange-800 focus:outline-none"
              >
                <option value="">Select zone...</option>
                {geofences.map(gf => (
                  <option key={gf.id} value={gf.id}>{gf.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Domain filter (optional)</label>
              <select
                value={geofenceDomain}
                onChange={e => setGeofenceDomain(e.target.value)}
                className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono focus:border-orange-800 focus:outline-none"
              >
                <option value="">All domains</option>
                {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        )}

        {trigger === 'proximity' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Lat</label>
                <input
                  type="number"
                  step="0.01"
                  value={proxLat}
                  onChange={e => setProxLat(e.target.value)}
                  placeholder="33.5"
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono focus:border-orange-800 focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Lon</label>
                <input
                  type="number"
                  step="0.01"
                  value={proxLon}
                  onChange={e => setProxLon(e.target.value)}
                  placeholder="44.0"
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono focus:border-orange-800 focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Radius (km)</label>
                <input
                  type="number"
                  value={proxRadius}
                  onChange={e => setProxRadius(e.target.value)}
                  placeholder="50"
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono focus:border-orange-800 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Domain filter (optional)</label>
              <select
                value={proxDomain}
                onChange={e => setProxDomain(e.target.value)}
                className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono focus:border-orange-800 focus:outline-none"
              >
                <option value="">All domains</option>
                {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Alert severity */}
      <div>
        <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Alert severity</label>
        <div className="flex gap-1 mt-1">
          {SEVERITIES.map(s => (
            <button
              key={s}
              onClick={() => setAlertSeverity(s)}
              className={cn(
                'px-2 py-0.5 text-[10px] font-mono rounded transition-colors',
                alertSeverity === s
                  ? s === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : s === 'warning' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className={cn(
            'flex-1 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded transition-colors',
            name.trim()
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 hover:bg-orange-500/30'
              : 'bg-zinc-800 text-zinc-600 border border-zinc-700 cursor-not-allowed',
          )}
        >
          Save Rule
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-300"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

/** Compact list of existing rules with toggle/delete controls */
export function AlertRuleList() {
  const { rules, toggleRule, removeRule } = useAlertRuleStore()

  if (rules.length === 0) return null

  return (
    <div className="px-3 py-2 space-y-1">
      {rules.map(rule => (
        <div
          key={rule.id}
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded border transition-colors',
            rule.enabled
              ? 'bg-zinc-800/50 border-zinc-700'
              : 'bg-zinc-900/50 border-zinc-800 opacity-50',
          )}
        >
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => toggleRule(rule.id)}
                  className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0 transition-colors',
                    rule.enabled ? 'bg-green-400' : 'bg-zinc-600',
                  )}
                />
              </TooltipTrigger>
              <TooltipContent side="right">{rule.enabled ? 'Disable' : 'Enable'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-mono text-zinc-300 truncate">{rule.name}</div>
            <div className="text-[9px] font-mono text-zinc-600 uppercase">{rule.trigger} — {rule.alertSeverity}</div>
          </div>
          <button
            onClick={() => removeRule(rule.id)}
            className="text-zinc-600 hover:text-red-400 text-[10px] font-mono flex-shrink-0 transition-colors"
          >
            X
          </button>
        </div>
      ))}
    </div>
  )
}
