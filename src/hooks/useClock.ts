import { useState, useEffect } from 'react'
import { utcTimeString, utcDateString, elapsedString } from '@/lib/utils'

export function useClock(startTime: number = Date.now()) {
  const [time, setTime]    = useState(utcTimeString())
  const [date, setDate]    = useState(utcDateString())
  const [elapsed, setElapsed] = useState('00:00:00')
  const [nextUpdate, setNextUpdate] = useState(47)

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date()
      setTime(utcTimeString(now))
      setDate(utcDateString(now))
      const ms = Date.now() - startTime
      setElapsed(elapsedString(ms))
      setNextUpdate(47 - (Math.floor(ms / 1000) % 47))
    }, 1000)
    return () => clearInterval(id)
  }, [startTime])

  return { time, date, elapsed, nextUpdate }
}
