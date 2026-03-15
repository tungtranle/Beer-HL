'use client'

import { useEffect, useRef, useCallback } from 'react'
import { getToken } from '@/lib/api'

const DB_NAME = 'bhl_offline'
const DB_VERSION = 1
const STORE_NAME = 'sync_queue'
const SYNC_INTERVAL_MS = 30_000 // Retry every 30s

interface QueuedRequest {
  id?: number
  url: string
  method: string
  body: string | null
  createdAt: string
  retries: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function addToQueue(entry: Omit<QueuedRequest, 'id'>): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).add(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getAllQueued(): Promise<QueuedRequest[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function removeFromQueue(id: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function updateRetries(id: number, retries: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const entry = getReq.result
      if (entry) {
        entry.retries = retries
        store.put(entry)
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Queue an API request for offline replay */
export async function queueOfflineRequest(url: string, method: string, body: string | null) {
  await addToQueue({
    url,
    method,
    body,
    createdAt: new Date().toISOString(),
    retries: 0,
  })
}

/** Get count of pending items in offline queue */
export async function getQueueCount(): Promise<number> {
  const items = await getAllQueued()
  return items.length
}

/** Process the offline queue — replay requests in order */
async function processQueue(): Promise<{ synced: number; failed: number }> {
  const items = await getAllQueued()
  let synced = 0
  let failed = 0

  for (const item of items) {
    const token = getToken()
    if (!token) break

    try {
      const res = await fetch(`/api${item.url}`, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: item.body,
      })

      if (res.ok || res.status === 409) {
        // Success or duplicate — remove from queue
        if (item.id) await removeFromQueue(item.id)
        synced++
      } else if (res.status >= 500) {
        // Server error — retry later
        if (item.id) await updateRetries(item.id, (item.retries || 0) + 1)
        failed++
      } else {
        // Client error (400, 403, etc.) — discard
        if (item.id) await removeFromQueue(item.id)
        failed++
      }
    } catch {
      // Network error — stop processing
      failed++
      break
    }
  }

  return { synced, failed }
}

/** React hook: background sync worker */
export function useOfflineSync() {
  const isOnlineRef = useRef(navigator.onLine)

  const sync = useCallback(async () => {
    if (!navigator.onLine) return
    await processQueue()
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true
      sync()
    }
    const handleOffline = () => {
      isOnlineRef.current = false
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Periodic sync
    const interval = setInterval(sync, SYNC_INTERVAL_MS)

    // Initial sync on mount
    sync()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [sync])
}
