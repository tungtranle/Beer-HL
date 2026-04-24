'use client'

/**
 * KpiCard — standardized KPI/metric tile.
 *
 * Use for top-of-page dashboard metrics.
 * Replaces ad-hoc metric divs across dashboard, warehouse, accountant pages.
 *
 * Reference: UX_AUDIT_REPORT.md §2 (per-role redesign)
 */

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight, TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react'

type Tone = 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'neutral'

interface KpiCardProps {
  label: string
  value: ReactNode
  icon?: LucideIcon
  tone?: Tone
  /** Sub-text under the value (e.g. "Đã đặt: 1,200") */
  hint?: ReactNode
  /** Delta vs previous period: positive/negative/zero */
  delta?: { value: number; suffix?: string; goodWhen?: 'up' | 'down' }
  /** Wrap the card in a Link if href provided */
  href?: string
  /** Pulse the icon (urgent KPIs) */
  pulse?: boolean
  className?: string
}

const TONE_ICON: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600',
  info: 'bg-sky-50 text-sky-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-rose-50 text-rose-600',
  neutral: 'bg-slate-100 text-slate-600',
}

const TONE_VALUE: Record<Tone, string> = {
  brand: 'text-brand-700',
  info: 'text-sky-700',
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-rose-700',
  neutral: 'text-slate-900',
}

export function KpiCard({
  label, value, icon: Icon, tone = 'neutral', hint, delta, href, pulse, className = '',
}: KpiCardProps) {
  const isGood = delta
    ? (delta.goodWhen === 'down' ? delta.value <= 0 : delta.value >= 0)
    : true

  const content = (
    <div className={[
      'group relative rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70',
      href ? 'hover:shadow-md hover:ring-brand-200 transition cursor-pointer' : '',
      className,
    ].join(' ')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className={`mt-2 text-3xl font-bold tabular-nums ${TONE_VALUE[tone]}`}>{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
          {delta && (
            <div className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${isGood ? 'text-emerald-600' : 'text-rose-600'}`}>
              {delta.value > 0 ? <TrendingUp size={12} /> : delta.value < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
              {Math.abs(delta.value).toFixed(1)}{delta.suffix ?? '%'}
              <span className="text-slate-400 font-normal">vs hôm qua</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${TONE_ICON[tone]} ${pulse ? 'animate-pulse' : ''}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
      </div>
      {href && (
        <ArrowUpRight className="absolute bottom-3 right-3 h-4 w-4 text-slate-300 group-hover:text-brand-500 transition" />
      )}
    </div>
  )
  return href ? <Link href={href} className="block">{content}</Link> : content
}
