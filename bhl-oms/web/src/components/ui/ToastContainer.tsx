'use client'

import { useToastListener } from '@/lib/useToast'

const STYLES = {
  success: { border: 'border-green-500', bg: 'bg-green-50', icon: '✅' },
  error:   { border: 'border-red-500',   bg: 'bg-red-50',   icon: '❌' },
  warning: { border: 'border-amber-500', bg: 'bg-amber-50', icon: '⚠️' },
  info:    { border: 'border-blue-500',  bg: 'bg-blue-50',  icon: 'ℹ️' },
}

export function ToastContainer() {
  const { toasts, dismiss } = useToastListener()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[200] space-y-2 pointer-events-none">
      {toasts.map((t) => {
        const s = STYLES[t.type]
        return (
          <div key={t.id}
            className={`w-80 rounded-lg border-l-4 shadow-lg p-4 pointer-events-auto animate-slide-in ${s.border} ${s.bg}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{t.message}</p>
                {t.traceRef && (
                  <p className="text-[10px] text-gray-400 mt-1 font-mono">Ref: {t.traceRef}</p>
                )}
              </div>
              <button onClick={() => dismiss(t.id)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none">
                ×
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
