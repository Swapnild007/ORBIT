import { create } from 'zustand'

export type RuleTrigger = 'domain' | 'severity' | 'keyword' | 'geofence' | 'proximity'

export interface AlertRule {
  id: string
  name: string
  enabled: boolean
  trigger: RuleTrigger
  /** For domain trigger: which domain(s) to match */
  domains?: string[]
  /** For severity trigger: minimum severity threshold (1-10 scale) */
  severityThreshold?: number
  /** For keyword trigger: match these words in title/description */
  keywords?: string[]
  /** For geofence trigger: which geofence ID + optional domain filter */
  geofenceId?: string
  geofenceDomain?: string
  /** For proximity trigger: lat, lon, radius in km */
  proximityLat?: number
  proximityLon?: number
  proximityRadiusKm?: number
  proximityDomain?: string
  /** Output severity for generated alerts */
  alertSeverity: 'info' | 'warning' | 'critical'
  /** Timestamp of last trigger (for cooldown) */
  lastTriggered?: number
}

const STORAGE_KEY = 'eagle-eye-alert-rules'

function loadRules(): AlertRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AlertRule[]
  } catch { /* ignore */ }
  return []
}

function saveRules(rules: AlertRule[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

interface AlertRuleState {
  rules: AlertRule[]
  addRule: (rule: Omit<AlertRule, 'id'>) => void
  updateRule: (id: string, updates: Partial<AlertRule>) => void
  removeRule: (id: string) => void
  toggleRule: (id: string) => void
}

export const useAlertRuleStore = create<AlertRuleState>()((set, get) => ({
  rules: loadRules(),

  addRule: (rule) => {
    const newRule: AlertRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }
    const next = [...get().rules, newRule]
    set({ rules: next })
    saveRules(next)
  },

  updateRule: (id, updates) => {
    const next = get().rules.map(r => r.id === id ? { ...r, ...updates } : r)
    set({ rules: next })
    saveRules(next)
  },

  removeRule: (id) => {
    const next = get().rules.filter(r => r.id !== id)
    set({ rules: next })
    saveRules(next)
  },

  toggleRule: (id) => {
    const next = get().rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
    set({ rules: next })
    saveRules(next)
  },
}))
