'use client'

/**
 * PageHeader — replaces 50+ duplicated `<h1 className="text-2xl font-bold...">` blocks.
 *
 * Variants:
 *  - default: title + optional subtitle, optional actions slot on the right
 *  - withIcon: prepend a colored icon tile
 *
 * Reference: UX_AUDIT_REPORT.md §3.1 (anti-pattern: title duplication)
 */

import type { ReactNode, ReactElement } from 'react'
import type { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  iconTone?: 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'neutral'
  /** Right-aligned actions (buttons, refresh, filters) */
  actions?: ReactNode
  /** Left of title (e.g. back button) */
  leading?: ReactNode
  /** Sticky top-0 on scroll */
  sticky?: boolean
  className?: string
}

const TONE_BG: Record<NonNullable<PageHeaderProps['iconTone']>, string> = {
  brand: 'bg-brand-50 text-brand-600 ring-brand-100',
  info: 'bg-sky-50 text-sky-600 ring-sky-100',
  success: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-600 ring-amber-100',
  danger: 'bg-rose-50 text-rose-600 ring-rose-100',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconTone = 'brand',
  actions,
  leading,
  sticky = false,
  className = '',
}: PageHeaderProps): ReactElement {
  return (
    <header
      className={[
        'mb-6 flex items-start gap-4',
        sticky ? 'sticky top-0 z-10 -mx-4 px-4 py-3 bg-white/80 backdrop-blur-md border-b border-slate-200/70' : '',
        className,
      ].join(' ')}
    >
      {leading}
      {Icon && (
        <div className={`shrink-0 mt-0.5 grid h-11 w-11 place-items-center rounded-xl ring-1 ${TONE_BG[iconTone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 truncate">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  )
}
