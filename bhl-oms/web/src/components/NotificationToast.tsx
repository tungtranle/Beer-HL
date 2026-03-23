'use client'

import { useNotifications } from '@/lib/notifications'

export function NotificationToast() {
  const { toast, dismissToast } = useNotifications()

  if (!toast) return null

  const categoryColors: Record<string, string> = {
    success: 'border-green-500 bg-green-50',
    warning: 'border-amber-500 bg-amber-50',
    error: 'border-red-500 bg-red-50',
    info: 'border-blue-500 bg-blue-50',
  }

  const categoryIcons: Record<string, string> = {
    success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️',
  }

  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-in">
      <div className={`w-80 rounded-lg border-l-4 shadow-lg p-4 ${categoryColors[toast.category] || 'border-gray-500 bg-white'}`}>
        <div className="flex items-start gap-3">
          <span className="text-lg">{categoryIcons[toast.category] || '🔔'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{toast.body}</p>
          </div>
          <button
            onClick={dismissToast}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
