'use client'

import { CheckCircle2, XCircle, AlertTriangle, Info, Bell, X } from 'lucide-react'
import { useNotifications } from '@/lib/notifications'

const categoryIcons: Record<string, typeof Bell> = {
  success: CheckCircle2, warning: AlertTriangle, error: XCircle, info: Info,
}
const categoryIconCls: Record<string, string> = {
  success: 'text-green-600', warning: 'text-amber-600', error: 'text-red-600', info: 'text-blue-600',
}

export function NotificationToast() {
  const { toast, dismissToast } = useNotifications()

  if (!toast) return null

  const categoryColors: Record<string, string> = {
    success: 'border-green-500 bg-green-50',
    warning: 'border-amber-500 bg-amber-50',
    error: 'border-red-500 bg-red-50',
    info: 'border-blue-500 bg-blue-50',
  }

  const IconComp = categoryIcons[toast.category] ?? Bell
  const iconCls = categoryIconCls[toast.category] ?? 'text-gray-500'

  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-in">
      <div className={`w-80 rounded-lg border-l-4 shadow-lg p-4 ${categoryColors[toast.category] || 'border-gray-500 bg-white'}`}>
        <div className="flex items-start gap-3">
          <IconComp className={`h-5 w-5 mt-0.5 shrink-0 ${iconCls}`} aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{toast.body}</p>
          </div>
          <button
            onClick={dismissToast}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
