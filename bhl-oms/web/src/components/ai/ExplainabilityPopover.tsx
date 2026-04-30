'use client'

import { useState } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfidenceMeter } from './ConfidenceMeter'

export interface ExplainabilityFactor {
  label: string
  value?: string | number
  impact?: 'positive' | 'neutral' | 'negative' | 'warning'
  source?: string
  computedAt?: string
  dataFreshness?: string
  sampleSize?: string | number
}

interface ExplainabilityPopoverProps {
  title?: string
  confidence?: number
  reasons: string[]
  source?: string
  noExplain?: boolean
  factors?: ExplainabilityFactor[]
  dataFreshness?: string
  sampleSize?: string | number
}

const impactTone: Record<NonNullable<ExplainabilityFactor['impact']>, string> = {
  positive: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  neutral: 'bg-slate-50 text-slate-700 ring-slate-100',
  negative: 'bg-rose-50 text-rose-700 ring-rose-100',
  warning: 'bg-amber-50 text-amber-700 ring-amber-100',
}

export function ExplainabilityPopover({ title = 'Vì sao?', confidence, reasons, source = 'rules', noExplain, factors = [], dataFreshness, sampleSize }: ExplainabilityPopoverProps) {
  const [open, setOpen] = useState(false)
  if (noExplain) return null

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
      >
        <HelpCircle className="h-4 w-4" /> {title}
      </button>
      {open && (
        <div className="fixed inset-0 z-[120] bg-black/30 p-4 sm:grid sm:place-items-center" onClick={() => setOpen(false)}>
          <div className="mt-20 w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl sm:mt-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Giải thích đề xuất</h3>
                <p className="mt-1 text-xs text-slate-500">Nguồn: {source}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <ConfidenceMeter value={confidence} source={source} dataFreshness={dataFreshness} sampleSize={sampleSize} />
            </div>
            <div className="mt-4 space-y-2">
              {reasons.map((reason, index) => (
                <div key={`${reason}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{reason}</div>
              ))}
              {reasons.length === 0 && factors.length === 0 && <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">Chưa có lý do chi tiết.</div>}
            </div>
            {factors.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Yếu tố ảnh hưởng</div>
                {factors.map((factor, index) => (
                  <div key={`${factor.label}-${index}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800">{factor.label}</div>
                        {(factor.source || factor.dataFreshness || factor.sampleSize) && (
                          <div className="mt-0.5 truncate text-[11px] text-slate-500">
                            {[factor.source, factor.sampleSize ? `${factor.sampleSize} mẫu` : undefined, factor.dataFreshness].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      {factor.value !== undefined && (
                        <div className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${impactTone[factor.impact || 'neutral']}`}>
                          {factor.value}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 flex justify-end"><Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Đóng</Button></div>
          </div>
        </div>
      )}
    </span>
  )
}