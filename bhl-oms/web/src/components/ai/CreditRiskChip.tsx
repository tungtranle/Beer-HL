'use client'

import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { aiCacheFetch } from '@/lib/ai-cache'
import { useAIFeature } from '@/hooks/useAIFeature'

interface CreditRiskScore {
  score: number
  level: 'low' | 'medium' | 'high' | 'critical'
  narrative: string
}

const TONE: Record<CreditRiskScore['level'], string> = {
  low: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  high: 'bg-orange-50 text-orange-700 ring-orange-200',
  critical: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const LABEL: Record<CreditRiskScore['level'], string> = {
  low: 'RỦI RO THẤP',
  medium: 'RỦI RO TRUNG BÌNH',
  high: 'RỦI RO CAO',
  critical: 'RỦI RO RẤT CAO',
}

export function CreditRiskChip({ customerId }: { customerId?: string }) {
  const [score, setScore] = useState<CreditRiskScore | null>(null)
  const [loading, setLoading] = useState(false)
  const { enabled } = useAIFeature('ai.credit_score')

  useEffect(() => {
    if (!enabled || !customerId) { setScore(null); setLoading(false); return }
    setLoading(true)
    aiCacheFetch<CreditRiskScore | null>(`/ai/customers/${customerId}/risk-score`)
      .then((res) => setScore(res || null))
      .catch(() => setScore(null))
      .finally(() => setLoading(false))
  }, [enabled, customerId])

  if (!enabled || !customerId) return null
  if (loading) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">Đang tính rủi ro...</span>
  if (!score) return null

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${TONE[score.level]}`}
      title={score.narrative}
    >
      <ShieldAlert className="h-3 w-3" aria-hidden="true" />
      {LABEL[score.level]} · {score.score}/100
    </span>
  )
}