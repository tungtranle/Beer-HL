'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { getToken, apiFetch, ensureValidAccessToken } from '@/lib/api'

interface NotificationAction {
  label: string
  method: string
  endpoint: string
  body_template?: Record<string, unknown>
}

export interface Notification {
  id: string
  title: string
  body: string
  category: string
  priority: string
  link?: string
  entity_type?: string
  entity_id?: string
  actions?: NotificationAction[]
  group_key?: string
  is_read: boolean
  created_at: string
}

export interface OrderUpdate {
  order_id: string
  new_status: string
}

export interface EntityUpdate {
  entity_type: string
  entity_id: string
  new_status: string
}

export interface VRPProgress {
  job_id: string
  stage: string
  pct: number
  detail: string
}

type OrderUpdateListener = (update: OrderUpdate) => void
type EntityUpdateListener = (update: EntityUpdate) => void
type VRPProgressListener = (progress: VRPProgress) => void

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  // 4-layer toast state
  urgentToasts: Notification[]
  autoToast: Notification | null
  autoToastQueueCount: number
  dismissUrgentToast: (id: string) => void
  dismissAutoToast: () => void
  // Legacy compat
  toast: Notification | null
  dismissToast: () => void
  markRead: (id: string) => void
  markAllRead: () => void
  refresh: () => void
  // Order update subscriptions
  subscribeOrderUpdates: (listener: OrderUpdateListener) => () => void
  // Entity update subscriptions (general: order, trip, handover, etc.)
  subscribeEntityUpdates: (listener: EntityUpdateListener) => () => void
  // VRP progress subscriptions (real-time solving stages)
  subscribeVRPProgress: (listener: VRPProgressListener) => () => void
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  urgentToasts: [],
  autoToast: null,
  autoToastQueueCount: 0,
  dismissUrgentToast: () => {},
  dismissAutoToast: () => {},
  toast: null,
  dismissToast: () => {},
  markRead: () => {},
  markAllRead: () => {},
  refresh: () => {},
  subscribeOrderUpdates: () => () => {},
  subscribeEntityUpdates: () => () => {},
  subscribeVRPProgress: () => () => {},
})

export function useNotifications() {
  return useContext(NotificationContext)
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  // 4-layer: urgent = PersistentToast (manual dismiss), high = AutoToast (8s)
  const [urgentToasts, setUrgentToasts] = useState<Notification[]>([])
  const [autoToast, setAutoToast] = useState<Notification | null>(null)
  const [autoToastQueueCount, setAutoToastQueueCount] = useState(0)
  const autoToastQueueRef = useRef<Notification[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const orderUpdateListenersRef = useRef<Set<OrderUpdateListener>>(new Set())
  const entityUpdateListenersRef = useRef<Set<EntityUpdateListener>>(new Set())
  const vrpProgressListenersRef = useRef<Set<VRPProgressListener>>(new Set())

  // Subscribe to order updates — returns unsubscribe function
  const subscribeOrderUpdates = useCallback((listener: OrderUpdateListener) => {
    orderUpdateListenersRef.current.add(listener)
    return () => { orderUpdateListenersRef.current.delete(listener) }
  }, [])

  // Subscribe to entity updates (general) — returns unsubscribe function
  const subscribeEntityUpdates = useCallback((listener: EntityUpdateListener) => {
    entityUpdateListenersRef.current.add(listener)
    return () => { entityUpdateListenersRef.current.delete(listener) }
  }, [])

  // Subscribe to VRP progress updates — returns unsubscribe function
  const subscribeVRPProgress = useCallback((listener: VRPProgressListener) => {
    vrpProgressListenersRef.current.add(listener)
    return () => { vrpProgressListenersRef.current.delete(listener) }
  }, [])

  // Fetch notifications from API
  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch<any>('/notifications?limit=10')
      if (res.data) setNotifications(res.data)
    } catch { /* ignore */ }
    try {
      const res = await apiFetch<any>('/notifications/unread-count')
      if (res.data) setUnreadCount(res.data.unread_count || 0)
    } catch { /* ignore */ }
  }, [])

  // Mark single notification as read
  const markRead = useCallback(async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'POST' })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch { /* ignore */ }
  }, [])

  // Mark all as read
  const markAllRead = useCallback(async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'POST' })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch { /* ignore */ }
  }, [])

  // Urgent toast — manual dismiss, max 3 stacked
  const dismissUrgentToast = useCallback((id: string) => {
    setUrgentToasts(prev => prev.filter(n => n.id !== id))
  }, [])

  // Auto toast — dismiss current, show next in queue
  const dismissAutoToast = useCallback(() => {
    setAutoToast(null)
    // Show next queued if any
    setTimeout(() => {
      if (autoToastQueueRef.current.length > 0) {
        const next = autoToastQueueRef.current.shift()!
        setAutoToastQueueCount(autoToastQueueRef.current.length)
        setAutoToast(next)
      } else {
        setAutoToastQueueCount(0)
      }
    }, 400)
  }, [])

  // Legacy compat
  const toast = autoToast
  const dismissToast = dismissAutoToast

  // Route notification to correct layer
  const routeNotification = useCallback((n: Notification) => {
    if (n.priority === 'urgent') {
      setUrgentToasts(prev => [n, ...prev].slice(0, 5)) // keep max 5, show max 3
    } else if (n.priority === 'high') {
      setAutoToast(current => {
        if (current) {
          autoToastQueueRef.current.push(n)
          setAutoToastQueueCount(autoToastQueueRef.current.length)
          return current
        }
        return n
      })
    }
    // normal/low → only bell + panel (no toast)
  }, [])

  // WebSocket connection
  useEffect(() => {
    let ws: WebSocket
    let reconnectTimer: NodeJS.Timeout
    let retries = 0
    const MAX_RETRIES = 5

    const connect = async () => {
      if (retries >= MAX_RETRIES) return
      const token = await ensureValidAccessToken()
      if (!token && !getToken()) return

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws/notifications?token=${token || getToken()}`
      ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        retries = 0
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'notification' && msg.data) {
            const n = msg.data as Notification
            setNotifications(prev => [n, ...prev.slice(0, 9)])
            setUnreadCount(prev => prev + 1)
            routeNotification(n)
          } else if (msg.type === 'entity_update' && msg.entity_type) {
            const eu: EntityUpdate = { entity_type: msg.entity_type, entity_id: msg.entity_id || '', new_status: msg.new_status || '' }
            entityUpdateListenersRef.current.forEach(listener => {
              try { listener(eu) } catch { /* ignore */ }
            })
            // Also dispatch to legacy order update listeners
            if (msg.entity_type === 'order') {
              const ou: OrderUpdate = { order_id: eu.entity_id, new_status: eu.new_status }
              orderUpdateListenersRef.current.forEach(listener => {
                try { listener(ou) } catch { /* ignore */ }
              })

              refresh()
            }
              void connect()
            const update: OrderUpdate = { order_id: msg.order_id, new_status: msg.new_status || '' }
            orderUpdateListenersRef.current.forEach(listener => {
              try { listener(update) } catch { /* ignore */ }
            })
          } else if (msg.type === 'vrp_progress' && msg.job_id) {
            const vp: VRPProgress = { job_id: msg.job_id, stage: msg.stage || '', pct: msg.pct || 0, detail: msg.detail || '' }
            vrpProgressListenersRef.current.forEach(listener => {
              try { listener(vp) } catch { /* ignore */ }
            })
          }
        } catch { /* ignore parse errors */ }
      }

      ws.onclose = () => {
        retries++
        const delay = Math.min(5000 * Math.pow(2, retries - 1), 80000)
        reconnectTimer = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      if (wsRef.current) wsRef.current.close()
    }
  }, [refresh, routeNotification])

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount,
      urgentToasts, autoToast, autoToastQueueCount, dismissUrgentToast, dismissAutoToast,
      toast, dismissToast,
      markRead, markAllRead, refresh,
      subscribeOrderUpdates,
      subscribeEntityUpdates, subscribeVRPProgress,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

/**
 * Hook for auto-refreshing page data when entities change via WebSocket.
 * Debounces rapid updates (300ms) to prevent excessive API calls.
 *
 * @param entityTypes - Entity type(s) to listen for ('order', 'trip', 'handover', etc.)
 * @param onRefresh - Callback to reload data
 * @param entityId - Optional: only trigger for a specific entity ID
 */
export function useDataRefresh(
  entityTypes: string | string[],
  onRefresh: () => void,
  entityId?: string | null
) {
  const { subscribeEntityUpdates } = useNotifications()
  const callbackRef = useRef(onRefresh)
  callbackRef.current = onRefresh
  const entityIdRef = useRef(entityId)
  entityIdRef.current = entityId
  const typesRef = useRef(entityTypes)
  typesRef.current = entityTypes
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const unsub = subscribeEntityUpdates((update) => {
      const types = Array.isArray(typesRef.current) ? typesRef.current : [typesRef.current]
      if (!types.includes(update.entity_type)) return
      if (entityIdRef.current && update.entity_id !== entityIdRef.current) return
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => callbackRef.current(), 300)
    })
    return () => {
      unsub()
      clearTimeout(debounceRef.current)
    }
  }, [subscribeEntityUpdates])
}
