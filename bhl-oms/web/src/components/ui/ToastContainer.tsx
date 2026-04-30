'use client'

import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastListener } from '@/lib/useToast'

type ToastType = 'success' | 'error' | 'warning' | 'info'

const STYLES: Record<ToastType, { border: string; bg: string; Icon: typeof CheckCircle2; iconCls: string }> = {
  success: { border: 'border-green-500', bg: 'bg-green-50', Icon: CheckCircle2, iconCls: 'text-green-600' },
  error:   { border: 'border-red-500',   bg: 'bg-red-50',   Icon: XCircle,       iconCls: 'text-red-600' },
  warning: { border: 'border-amber-500', bg: 'bg-amber-50', Icon: AlertTriangle,  iconCls: 'text-amber-600' },
  info:    { border: 'border-blue-500',  bg: 'bg-blue-50',  Icon: Info,           iconCls: 'text-blue-600' },
}

export function ToastContainer() {
  const { toasts, dismiss } = useToastListener()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[200] space-y-2 pointer-events-none">
      {toasts.map((t) => {
        const s = STYLES[t.type as ToastType] ?? STYLES.info
        return (
          <div key={t.id}
            className={`w-80 rounded-lg border-l-4 shadow-lg p-4 pointer-events-auto animate-slide-in ${s.border} ${s.bg}`}
          >
            <div className="flex items-start gap-3">
              <s.Icon className={`h-5 w-5 mt-0.5 shrink-0 ${s.iconCls}`} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{t.message}</p>
                {t.traceRef && (
                  <p className="text-[10px] text-gray-400 mt-1 font-mono">Ref: {t.traceRef}</p>
                )}
              </div>
              <button onClick={() => dismiss(t.id)}
                className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
