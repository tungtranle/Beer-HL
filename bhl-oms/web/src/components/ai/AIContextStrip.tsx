'use client'

import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfidenceMeter } from './ConfidenceMeter'
import { ExplainabilityPopover, type ExplainabilityFactor } from './ExplainabilityPopover'

type StripTone = 'info' | 'warning' | 'danger' | 'success'

interface AIContextStripProps {
  title?: string
  message: string
  tone?: StripTone
  confidence?: number
  source?: string
  dataFreshness?: string
  sampleSize?: number | string
  factors?: ExplainabilityFactor[]
  reasons?: string[]
  dismissKey?: string
  actionLabel?: string
  onAction?: () => void
}

const toneMap: Record<StripTone, { box: string; icon: LucideIcon; iconClass: string }> = {
  info: { box: 'border-sky-200 bg-sky-50/70 text-sky-900', icon: Info, iconClass: 'text-sky-600' },
  warning: { box: 'border-amber-200 bg-amber-50/70 text-amber-900', icon: AlertTriangle, iconClass: 'text-amber-600' },
  danger: { box: 'border-rose-200 bg-rose-50/70 text-rose-900', icon: AlertTriangle, iconClass: 'text-rose-600' },
  success: { box: 'border-emerald-200 bg-emerald-50/70 text-emerald-900', icon: CheckCircle2, iconClass: 'text-emerald-600' },
}

export function AIContextStrip({
  title = 'Decision Intelligence',
  message,
  tone = 'info',
  confidence,
  source = 'rules',
  dataFreshness,
  sampleSize,
  factors = [],
  reasons = [],
  dismissKey,
  actionLabel,
  onAction,
}: AIContextStripProps) {
  const [dismissed, setDismissed] = useState(false)
  const cfg = toneMap[tone]
  const Icon = cfg.icon

  useEffect(() => {
    if (!dismissKey || typeof window === 'undefined') return
    setDismissed(localStorage.getItem(`ai-strip:${dismissKey}`) === 'dismissed')
  }, [dismissKey])

  if (dismissed) return null

  const handleDismiss = () => {
    if (dismissKey && typeof window !== 'undefined') localStorage.setItem(`ai-strip:${dismissKey}`, 'dismissed')
    setDismissed(true)
  }

  return (
    <div className={`rounded-lg border px-3 py-3 shadow-sm ${cfg.box}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="relative mt-0.5 shrink-0">
            <span className="ai-dot absolute -right-0.5 -top-0.5" />
            <Icon className={`h-5 w-5 ${cfg.iconClass}`} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">{title}</div>
            <p className="mt-0.5 text-sm leading-5 text-slate-700">{message}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ExplainabilityPopover
                reasons={reasons}
                factors={factors}
                source={source}
                confidence={confidence}
                dataFreshness={dataFreshness}
                sampleSize={sampleSize}
              />
              {actionLabel && onAction && <Button type="button" size="sm" variant="secondary" onClick={onAction}>{actionLabel}</Button>}
            </div>
          </div>
        </div>
        <div className="flex items-start justify-between gap-2 sm:justify-end">
          <ConfidenceMeter value={confidence} source={source} dataFreshness={dataFreshness} sampleSize={sampleSize} compact />
          {dismissKey && (
            <button type="button" onClick={handleDismiss} className="rounded-md p-1 text-slate-400 hover:bg-white/70 hover:text-slate-700" aria-label="Ẩn gợi ý">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}