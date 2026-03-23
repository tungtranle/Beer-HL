'use client'

import { useState, useEffect, useCallback } from 'react'

export interface AppToast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  traceRef?: string
}

type Listener = (toast: AppToast) => void
const listeners: Set<Listener> = new Set()

function emit(toast: AppToast) {
  listeners.forEach(fn => fn(toast))
}

let counter = 0
function makeId() { return `toast-${++counter}-${Date.now()}` }

/** Global toast trigger — can be called from anywhere */
export const toast = {
  success: (message: string) => emit({ id: makeId(), type: 'success', message }),
  error: (message: string, traceRef?: string) => emit({ id: makeId(), type: 'error', message, traceRef }),
  warning: (message: string) => emit({ id: makeId(), type: 'warning', message }),
  info: (message: string) => emit({ id: makeId(), type: 'info', message }),
}

/** Hook to listen for toasts — used by ToastContainer only */
export function useToastListener() {
  const [toasts, setToasts] = useState<AppToast[]>([])

  useEffect(() => {
    const handler: Listener = (t) => {
      setToasts(prev => [...prev, t])
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id))
      }, 5000)
    }
    listeners.add(handler)
    return () => { listeners.delete(handler) }
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(x => x.id !== id))
  }, [])

  return { toasts, dismiss }
}
