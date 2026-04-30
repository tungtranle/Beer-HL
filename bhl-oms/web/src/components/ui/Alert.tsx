'use client'

/**
 * Alert — inline warning/error/info/success banner trong form/page.
 * Replaces: `bg-yellow-50...` hardcode scattered trên 20+ pages.
 *
 * Reference: BHL_Component_System_Proposal.md §4.2 P0
 */

import type { ReactNode } from 'react'
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react'

type AlertTone = 'info' | 'success' | 'warning' | 'danger'

interface AlertProps {
  tone?: AlertTone
  title?: string
  children: ReactNode
  onDismiss?: () => void
  className?: string
}

const TONE_CONFIG: Record<
  AlertTone,
  { bg: string; border: string; text: string; icon: typeof Info }
> = {
  info: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-800',
    icon: Info,
  },
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    icon: CheckCircle2,
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    icon: AlertTriangle,
  },
  danger: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-800',
    icon: XCircle,
  },
}

export function Alert({ tone = 'info', title, children, onDismiss, className = '' }: AlertProps) {
  const cfg = TONE_CONFIG[tone]
  const Icon = cfg.icon

  return (
    <div
      role="alert"
      className={`flex gap-3 rounded-xl border px-4 py-3 ${cfg.bg} ${cfg.border} ${cfg.text} ${className}`}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1 text-sm leading-relaxed">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        {children}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Đóng thông báo"
          className={`shrink-0 p-0.5 rounded transition hover:bg-black/10 ${cfg.text}`}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
