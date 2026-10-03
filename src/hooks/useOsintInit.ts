import { useEffect, useRef } from 'react'
import { useOsintStore } from '@/stores/osint-store'

const POLL_INTERVAL = 300_000 // 5 min

export function useOsintInit() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    async function fetchOsint() {
      try {
        const res = await fetch('/api/osint/posts')
        if (!res.ok) return
        const { posts } = await res.json()
        if (Array.isArray(posts)) {
          useOsintStore.getState().setPosts(posts)
        }
      } catch { /* ignore */ }
    }

    fetchOsint()

    function loop() {
      fetchOsint()
      timerRef.current = setTimeout(loop, POLL_INTERVAL)
    }
    timerRef.current = setTimeout(loop, POLL_INTERVAL)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])
}
