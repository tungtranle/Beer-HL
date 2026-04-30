'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { apiFetch } from '@/lib/api'

interface NotificationAction {
  label: string
  method: string
  endpoint: string
  body_template?: Record<string, unknown>
}

interface ToastNotification {
  id: string
  title: string
  body: string
  category: string
  priority: string
  actions?: NotificationAction[]
  entity_type?: string
  entity_id?: string
}

interface PersistentToastProps {
  notifications: ToastNotification[]
  onDismiss: (id: string) => void
  onAcknowledge?: (id: string) => void
}

function ToastItem({ notification, onDismiss, onAcknowledge, index }: {
  notification: ToastNotification
  onDismiss: (id: string) => void
  onAcknowledge?: (id: string) => void
  index: number
}) {
  const [loading, setLoading] = useState<string | null>(null)

  const handleAction = useCallback(async (action: NotificationAction) => {
    setLoading(action.label)
    try {
      await apiFetch(action.endpoint, {
        method: action.method,
        body: action.body_template,
      })
      onDismiss(notification.id)
    } catch {
      // Error handled by apiFetch
    } finally {
      setLoading(null)
    }
  }, [notification.id, onDismiss])

  const categoryColors: Record<string, string> = {
    oms: 'border-l-[#F68634]',
    tms: 'border-l-blue-500',
    wms: 'border-l-green-500',
    rec: 'border-l-purple-500',
    system: 'border-l-gray-500',
  }

  return (
    <div
      className={`w-96 bg-white rounded-lg shadow-2xl border border-gray-200 border-l-4 ${categoryColors[notification.category] || 'border-l-gray-500'} overflow-hidden transition-all duration-300`}
      style={{ transform: `translateY(${index * 8}px)`, zIndex: 100 - index }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-3 pb-2">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
          <span className="text-red-600 text-sm font-bold">!</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-red-100 text-red-700">
              Khẩn cấp
            </span>
            <span className="text-[10px] text-gray-400 uppercase">{notification.category}</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 mt-1 leading-snug">{notification.title}</p>
          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{notification.body}</p>
        </div>
        <button
          onClick={() => onDismiss(notification.id)}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition"
          title="Đóng"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Actions */}
      {notification.actions && notification.actions.length > 0 && (
        <div className="flex gap-2 px-4 pb-3">
          {notification.actions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleAction(action)}
              disabled={loading !== null}
              className="flex-1 text-xs font-medium py-1.5 px-3 rounded-md bg-[#F68634] text-white hover:bg-[#e5762a] disabled:opacity-50 transition"
            >
              {loading === action.label ? 'Đang xử lý...' : action.label}
            </button>
          ))}
        </div>
      )}

      {/* ACK button — always show for urgent toasts without actions */}
      {onAcknowledge && !notification.actions?.length && (
        <div className="px-4 pb-3">
          <button
            onClick={() => onAcknowledge(notification.id)}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Đã xử lý — dừng thông báo
          </button>
        </div>
      )}

      {/* ACK button alongside actions */}
      {onAcknowledge && notification.actions && notification.actions.length > 0 && (
        <div className="px-4 pb-3 pt-0">
          <button
            onClick={() => onAcknowledge(notification.id)}
            className="w-full text-xs font-medium py-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition"
          >
            ✓ Đã xử lý — dừng thông báo
          </button>
        </div>
      )}
    </div>
  )
}

export function PersistentToast({ notifications, onDismiss, onAcknowledge }: PersistentToastProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  // Stack max 3 toasts, oldest pushed down
  const visibleToasts = notifications.slice(0, 3)

  return createPortal(
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-3">
      {visibleToasts.map((n, i) => (
        <ToastItem key={n.id} notification={n} onDismiss={onDismiss} onAcknowledge={onAcknowledge} index={i} />
      ))}
    </div>,
    document.body
  )
}
