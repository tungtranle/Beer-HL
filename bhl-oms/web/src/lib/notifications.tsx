'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { getToken, apiFetch } from '@/lib/api'

interface Notification {
  id: string
  title: string
  body: string
  category: string
  priority: string
  link?: string
  entity_type?: string
  entity_id?: string
  is_read: boolean
  created_at: string
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  toast: Notification | null
  dismissToast: () => void
  markRead: (id: string) => void
  markAllRead: () => void
  refresh: () => void
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  toast: null,
  dismissToast: () => {},
  markRead: () => {},
  markAllRead: () => {},
  refresh: () => {},
})

export function useNotifications() {
  return useContext(NotificationContext)
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [toast, setToast] = useState<Notification | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null)

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

  const dismissToast = useCallback(() => {
    setToast(null)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  // Show toast for new notification
  const showToast = useCallback((n: Notification) => {
    setToast(n)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 6000)
  }, [])

  // WebSocket connection
  useEffect(() => {
    const token = getToken()
    if (!token) return

    refresh()

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.hostname}:8080/ws/notifications?token=${token}`
    
    let ws: WebSocket
    let reconnectTimer: NodeJS.Timeout
    let retries = 0
    const MAX_RETRIES = 5

    const connect = () => {
      if (retries >= MAX_RETRIES) return
      ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        retries = 0 // reset on successful connection
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'notification' && msg.data) {
            const n = msg.data as Notification
            setNotifications(prev => [n, ...prev.slice(0, 9)])
            setUnreadCount(prev => prev + 1)
            // Show toast for urgent/high priority
            if (n.priority === 'urgent' || n.priority === 'high' || n.priority === 'normal') {
              showToast(n)
            }
          }
        } catch { /* ignore parse errors */ }
      }

      ws.onclose = () => {
        retries++
        // Exponential backoff: 5s, 10s, 20s, 40s, 80s
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
  }, [refresh, showToast])

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, toast, dismissToast, markRead, markAllRead, refresh }}>
      {children}
    </NotificationContext.Provider>
  )
}
