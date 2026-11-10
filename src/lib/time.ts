import { useEffect, useState } from 'react'
import type { SceneTime } from '@shared/ipc'

export function isNightByClock(date = new Date()): boolean {
  const h = date.getHours()
  return h < 6 || h >= 19
}

export function resolveIsNight(sceneTime: SceneTime): boolean {
  return sceneTime === 'auto' ? isNightByClock() : sceneTime === 'night'
}

/** Re-renders on an interval so uptimes and the clock-driven scene stay current. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function formatUptime(startedAt: number | null, now: number): string {
  if (startedAt === null) return '—'
  const minutes = Math.max(0, Math.floor((now - startedAt) / 60_000))
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
