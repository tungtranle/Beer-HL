'use client'

import { DollarSign } from 'lucide-react'

/**
 * CreditAgingChip — §20 UX Spec v5
 * Đơn on_credit quá T+7 → hiện chip đỏ.
 */

const AGING_TIERS = [
  { min: 30, label: '> 30 ngày', color: 'bg-red-600 text-white' },
  { min: 14, label: '> 14 ngày', color: 'bg-red-100 text-red-700' },
  { min: 7,  label: '> 7 ngày',  color: 'bg-amber-100 text-amber-700' },
]

export function CreditAgingChip({ deliveredAt }: { deliveredAt?: string }) {
  if (!deliveredAt) return null
  const days = Math.floor((Date.now() - new Date(deliveredAt).getTime()) / (86400 * 1000))
  if (days < 7) return null
  const tier = AGING_TIERS.find(t => days >= t.min)
  if (!tier) return null
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${tier.color}`}>
      <DollarSign className="h-3 w-3" aria-hidden="true" />
      Nợ {tier.label}
    </span>
  )
}
