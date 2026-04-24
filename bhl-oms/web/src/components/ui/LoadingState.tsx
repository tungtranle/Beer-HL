'use client'

/**
 * LoadingState — replaces 90% of pages' ad-hoc spinner div.
 * For page-level loads. Inline list/card loads should use Skeleton primitives.
 */

import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  label?: string
  className?: string
  /** full = take min-h-screen; section = h-64 */
  size?: 'full' | 'section' | 'inline'
}

export function LoadingState({ label = 'Đang tải...', size = 'section', className = '' }: LoadingStateProps) {
  const heightCls = size === 'full' ? 'min-h-[60vh]' : size === 'section' ? 'h-64' : 'h-12'
  return (
    <div className={`flex flex-col items-center justify-center ${heightCls} text-slate-500 ${className}`}>
      <Loader2 className="h-7 w-7 animate-spin text-brand-500 mb-3" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
