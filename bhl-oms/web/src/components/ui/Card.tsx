'use client'

/**
 * Card — replaces 100+ ad-hoc `bg-white rounded-xl shadow-sm p-5` blocks.
 *
 * Variants:
 *  - default: white surface with subtle ring
 *  - elevated: stronger shadow, for hero/featured cards
 *  - inset: gray surface for nested groups
 *
 * Reference: UX_AUDIT_REPORT.md §3.1 (anti-pattern: ad-hoc card styling)
 */

import type { HTMLAttributes, ReactNode } from 'react'

type CardVariant = 'default' | 'elevated' | 'inset' | 'interactive'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: 'none' | 'sm' | 'md' | 'lg'
  children?: ReactNode
}

const VARIANT: Record<CardVariant, string> = {
  default: 'rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70',
  elevated: 'rounded-2xl bg-white shadow-md ring-1 ring-slate-200/50',
  inset: 'rounded-xl bg-slate-50 ring-1 ring-slate-200/60',
  interactive: 'rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 hover:shadow-md hover:ring-brand-200 transition cursor-pointer',
}

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
}

export function Card({
  variant = 'default',
  padding = 'md',
  className = '',
  children,
  ...rest
}: CardProps) {
  return (
    <div {...rest} className={[VARIANT[variant], PADDING[padding], className].join(' ')}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
