'use client'

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

interface AutoToastNotification {
  id: string
  title: string
  body: string
  category: string
  priority: string
  entity_type?: string
  entity_id?: string
  link?: string
}

interface AutoToastProps {
  notification: AutoToastNotification | null
  onDismiss: () => void
  duration?: number
  queueCount?: number
}

export function AutoToast({ notification, onDismiss, duration = 8000, queueCount = 0 }: AutoToastProps) {
  const [mounted, setMounted] = useState(false)
  const [progress, setProgress] = useState(100)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startRef = useRef<number>(0)
  const rafRef = useRef<number>(0)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!notification) {
      setVisible(false)
      return
    }

    setVisible(true)
    setProgress(100)
    startRef.current = Date.now()

    // Animate progress bar
    const animate = () => {
      const elapsed = Date.now() - startRef.current
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)

      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }
    rafRef.current = requestAnimationFrame(animate)

    // Auto dismiss
    timerRef.current = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300) // Wait for exit animation
    }, duration)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [notification, duration, onDismiss])

  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setVisible(false)
    setTimeout(onDismiss, 300)
  }

  const handleViewDetail = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    if (notification?.link) {
      router.push(`/dashboard${notification.link}`)
    } else if (notification?.entity_type && notification?.entity_id) {
      const paths: Record<string, string> = {
        order: '/orders',
        trip: '/trips',
        stock: '/warehouse',
        payment: '/reconciliation',
      }
      const basePath = paths[notification.entity_type] || ''
      if (basePath) {
        router.push(`/dashboard${basePath}/${notification.entity_id}`)
      }
    }
    onDismiss()
  }

  if (!mounted || !notification) return null

  const categoryColors: Record<string, string> = {
    oms: 'border-l-[#F68634]',
    tms: 'border-l-blue-500',
    wms: 'border-l-green-500',
    rec: 'border-l-purple-500',
    system: 'border-l-gray-500',
  }

  const categoryLabels: Record<string, string> = {
    oms: 'Đơn hàng',
    tms: 'Vận chuyển',
    wms: 'Kho',
    rec: 'Đối soát',
    system: 'Hệ thống',
  }

  return createPortal(
    <div
      className={`fixed top-4 right-4 z-[150] transition-all duration-300 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
      }`}
    >
      <div className={`w-80 bg-white rounded-lg shadow-xl border border-gray-200 border-l-4 ${categoryColors[notification.category] || 'border-l-gray-500'} overflow-hidden`}>
        {/* Content */}
        <div className="flex items-start gap-3 px-4 pt-3 pb-2">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-gray-400 uppercase font-medium">
              {categoryLabels[notification.category] || notification.category}
            </span>
            <p className="text-sm font-semibold text-gray-900 leading-snug">{notification.title}</p>
            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{notification.body}</p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action */}
        <div className="px-4 pb-2">
          <button
            onClick={handleViewDetail}
            className="text-xs font-medium text-[#F68634] hover:text-[#e5762a] transition"
          >
            Xem chi tiết →
          </button>
        </div>

        {/* Progress bar + queue count */}
        <div className="relative h-1 bg-gray-100">
          <div
            className="h-full bg-[#F68634] transition-none"
            style={{ width: `${progress}%` }}
          />
          {queueCount > 0 && (
            <span className="absolute -top-5 right-3 text-[10px] text-gray-400 whitespace-nowrap">
              +{queueCount} thông báo tiếp theo
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
