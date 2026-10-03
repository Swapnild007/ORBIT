/**
 * Browser notification and audio alert utilities.
 */

let notificationPermission: NotificationPermission = 'default'

/** Request browser notification permission */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') {
    notificationPermission = 'granted'
    return true
  }
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  notificationPermission = result
  return result === 'granted'
}

/** Send a browser notification */
export function sendBrowserNotification(title: string, body: string, icon?: string) {
  if (notificationPermission !== 'granted') {
    // Try requesting permission on first use
    requestNotificationPermission().then(granted => {
      if (granted) new Notification(title, { body, icon })
    })
    return
  }
  new Notification(title, { body, icon })
}

// Audio context for generating alert tones
let audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

/** Play a short alert tone */
export function playAlertTone(severity: 'info' | 'warning' | 'critical') {
  try {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    // Frequency and pattern based on severity
    switch (severity) {
      case 'critical':
        osc.frequency.value = 880
        gain.gain.value = 0.15
        break
      case 'warning':
        osc.frequency.value = 660
        gain.gain.value = 0.1
        break
      case 'info':
        osc.frequency.value = 440
        gain.gain.value = 0.06
        break
    }

    osc.type = 'sine'

    const now = ctx.currentTime
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

    osc.start(now)
    osc.stop(now + 0.3)
  } catch {
    // Audio not available
  }
}
