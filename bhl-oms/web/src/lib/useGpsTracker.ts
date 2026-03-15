'use client'

import { useEffect, useRef } from 'react'
import { apiFetch, getUser, getToken } from '@/lib/api'

const GPS_INTERVAL_MS = 15_000 // Send GPS every 15 seconds
const GPS_BATCH_SIZE = 5       // Buffer up to 5 points before sending

interface GpsPoint {
  lat: number
  lng: number
  speed: number
  heading: number
  accuracy_m: number
  recorded_at: string
}

export function useGpsTracker() {
  const bufferRef = useRef<GpsPoint[]>([])
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    const user = getUser()
    if (!user || user.role !== 'driver') return
    if (!getToken()) return
    if (!navigator.geolocation) return

    // Watch position changes
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        bufferRef.current.push({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed ?? 0,
          heading: pos.coords.heading ?? 0,
          accuracy_m: pos.coords.accuracy ?? 0,
          recorded_at: new Date(pos.timestamp).toISOString(),
        })
      },
      () => { /* ignore errors silently */ },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 10_000 }
    )

    // Periodic flush
    const interval = setInterval(async () => {
      if (bufferRef.current.length === 0) return
      const points = bufferRef.current.splice(0, GPS_BATCH_SIZE)
      try {
        await apiFetch('/driver/gps/batch', {
          method: 'POST',
          body: JSON.stringify({ points }),
        })
      } catch {
        // Re-add failed points to buffer (max 50 to prevent memory leak)
        bufferRef.current.unshift(...points)
        if (bufferRef.current.length > 50) {
          bufferRef.current = bufferRef.current.slice(-50)
        }
      }
    }, GPS_INTERVAL_MS)

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      clearInterval(interval)
    }
  }, [])
}
