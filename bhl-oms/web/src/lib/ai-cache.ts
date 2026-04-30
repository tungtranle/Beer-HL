import { apiFetch } from '@/lib/api'

type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

export async function aiCacheFetch<T>(path: string, ttlMs = 5 * 60 * 1000): Promise<T> {
  const now = Date.now()
  const hit = cache.get(path)
  if (hit && hit.expiresAt > now) return hit.value as T

  const response = await apiFetch<{ data?: T }>(path)
  const value = (response?.data ?? null) as T
  cache.set(path, { value, expiresAt: now + ttlMs })
  return value
}

export function clearAICache(path?: string) {
  if (path) cache.delete(path)
  else cache.clear()
}