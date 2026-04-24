'use client'

/**
 * ExplainabilityModal — F15 World-Class Strategy.
 * Mọi recommendation từ ML/AI phải có nút "Tại sao?" dẫn tới modal này.
 *
 * Pattern:
 *  - 4 sections: Model / Data / Logic / Quality (MAPE)
 *  - Feedback loop: nút "Báo cáo gợi ý sai" → POST tới ML service
 *
 * Reference: docs/specs/UX_AUDIT_AND_REDESIGN.md §4 F15
 */

import { useEffect, useState } from 'react'
import { Info, X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from '@/lib/useToast'

export interface ExplainabilityData {
  /** Model name (Prophet, Croston, Apriori, ...) */
  model: string
  /** What data was used (text summary) */
  dataSource: string
  /** Step-by-step logic in plain Vietnamese */
  logic: string[]
  /** Optional quality metric — MAPE %, confidence %, lift, ... */
  quality?: {
    label: string          // e.g. "MAPE 30 ngày"
    value: string          // e.g. "12%"
    isGood: boolean        // green vs amber
  }
  /** Feature ID for feedback loop (F1, F3, F7, ...) */
  featureId: string
  /** Recommendation ID — for feedback DB tracking */
  recommendationId?: string
}

interface ExplainabilityButtonProps extends ExplainabilityData {
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Inline icon-button. Click → opens modal.
 * Drop-in usage:
 *   <ExplainabilityButton featureId="F1" model="Prophet" dataSource="..." logic={[...]} />
 */
export function ExplainabilityButton(props: ExplainabilityButtonProps) {
  const [open, setOpen] = useState(false)
  const sizeCls = props.size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand rounded ${props.className || ''}`}
        aria-label="Tại sao có gợi ý này?"
        title="Tại sao?"
      >
        <Info className={sizeCls} aria-hidden="true" />
        {props.size !== 'sm' && <span className="text-xs">Tại sao?</span>}
      </button>
      {open && <ExplainabilityModal {...props} onClose={() => setOpen(false)} />}
    </>
  )
}

interface ModalProps extends ExplainabilityData {
  onClose: () => void
}

function ExplainabilityModal({
  model, dataSource, logic, quality, featureId, recommendationId, onClose,
}: ModalProps) {
  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleFeedback = async () => {
    try {
      // Best-effort POST; backend endpoint will be wired in Sprint 2 ML service.
      await fetch('/api/v1/ml/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature_id: featureId, recommendation_id: recommendationId, reason: 'incorrect' }),
      }).catch(() => { /* ignore — feature flagged */ })
      toast.success('Cảm ơn — phản hồi đã ghi nhận')
      onClose()
    } catch {
      toast.warning('Không gửi được phản hồi, sẽ thử lại sau')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="explain-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-brand-50 p-2">
              <Info className="h-5 w-5 text-brand-600" aria-hidden="true" />
            </div>
            <div>
              <h3 id="explain-title" className="text-base font-medium text-gray-900">Vì sao có gợi ý này?</h3>
              <p className="text-xs text-gray-500">Feature {featureId}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-brand rounded p-1"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm">
          <Section label="Mô hình">{model}</Section>
          <Section label="Dữ liệu sử dụng">{dataSource}</Section>
          <Section label="Logic suy luận">
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              {logic.map((step, i) => <li key={i}>{step}</li>)}
            </ul>
          </Section>
          {quality && (
            <div className={`rounded-lg border p-3 flex items-center gap-2 ${
              quality.isGood ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
            }`}>
              {quality.isGood
                ? <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                : <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />}
              <span className="text-xs">
                <span className="font-medium">{quality.label}:</span>{' '}
                <span className={quality.isGood ? 'text-green-700' : 'text-amber-700'}>{quality.value}</span>
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={handleFeedback}
            className="text-xs text-gray-600 hover:text-red-600 underline focus-visible:ring-2 focus-visible:ring-brand rounded"
          >
            Báo cáo gợi ý sai
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-brand text-white text-sm px-4 h-9 rounded-lg hover:bg-brand-500 focus-visible:ring-2 focus-visible:ring-brand"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <div className="text-gray-800">{children}</div>
    </div>
  )
}
