'use client'

import { useEffect, useState } from 'react'
import { apiFetch, getToken } from '@/lib/api'

type FeatureFlags = Record<string, boolean>

let cachedFlags: FeatureFlags | null = null
let cacheAt = 0
let inFlight: Promise<FeatureFlags> | null = null
const CACHE_TTL_MS = 30_000

async function fetchFeatureFlags(): Promise<FeatureFlags> {
  if (typeof window === 'undefined' || !getToken()) return {}
  if (cachedFlags && Date.now() - cacheAt < CACHE_TTL_MS) return cachedFlags
  if (!inFlight) {
    inFlight = apiFetch<any>('/ai/features')
      .then((res) => res.data?.flags || {})
      .then((flags) => {
        cachedFlags = flags
        cacheAt = Date.now()
        return flags
      })
      .finally(() => { inFlight = null })
  }
  return inFlight
}

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlags>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadFlags() {
      setLoading(true)
      setError(null)
      try {
        const nextFlags = await fetchFeatureFlags()
        if (!cancelled) setFlags(nextFlags)
      } catch (err: any) {
        if (!cancelled) {
          setFlags({})
          setError(err.message || 'Không tải được trạng thái AI')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadFlags()
    return () => { cancelled = true }
  }, [])

  return { flags, loading, error }
}
