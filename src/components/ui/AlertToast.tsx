import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useAlertStore, type AlertItem } from '@/stores/alert-store'
import { sendBrowserNotification, playAlertTone } from '@/lib/notifications'

const TOAST_DURATION = 5000
const MAX_TOASTS = 3

interface Toast {
  alert: AlertItem
  exiting: boolean
}

export function AlertToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const lastAlertIdRef = useRef<string | null>(null)
  const alerts = useAlertStore(s => s.alerts)
  const audioEnabledRef = useRef(true)

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.alert.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.alert.id !== id))
    }, 300)
  }, [])

  // Watch for new alerts
  useEffect(() => {
    if (alerts.length === 0) return
    const latest = alerts[0]
    if (latest.id === lastAlertIdRef.current) return
    lastAlertIdRef.current = latest.id

    // Add toast
    setToasts(prev => [{ alert: latest, exiting: false }, ...prev].slice(0, MAX_TOASTS))

    // Auto-dismiss
    setTimeout(() => removeToast(latest.id), TOAST_DURATION)

    // Browser notification for critical/warning
    if (latest.severity === 'critical' || latest.severity === 'warning') {
      sendBrowserNotification(latest.title, latest.description)
    }

    // Audio tone
    if (audioEnabledRef.current) {
      playAlertTone(latest.severity)
    }
  }, [alerts, removeToast])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-14 right-72 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.alert.id}
          className={cn(
            'pointer-events-auto w-72 bg-zinc-900/95 backdrop-blur-sm border rounded-md shadow-xl px-3 py-2.5 transition-all duration-300',
            toast.exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0',
            toast.alert.severity === 'critical' ? 'border-red-500/50'
              : toast.alert.severity === 'warning' ? 'border-yellow-500/50'
              : 'border-blue-500/50',
          )}
        >
          <div className="flex items-start gap-2">
            <div className={cn(
              'w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0',
              toast.alert.severity === 'critical' ? 'bg-red-400'
                : toast.alert.severity === 'warning' ? 'bg-yellow-400'
                : 'bg-blue-400',
            )} />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[11px] font-medium text-zinc-200 truncate">
                {toast.alert.title}
              </div>
              <div className="font-mono text-[10px] text-zinc-500 mt-0.5 truncate">
                {toast.alert.description}
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.alert.id)}
              className="text-zinc-600 hover:text-zinc-300 text-[10px] font-mono flex-shrink-0"
            >
              X
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
