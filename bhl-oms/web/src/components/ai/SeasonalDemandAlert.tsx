'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useAIFeature } from '@/hooks/useAIFeature'

interface SeasonalAlert {
  alert_level: 'none' | 'low' | 'high'
  message: string
  expected_qty: number
  drop_pct: number
}

export function SeasonalDemandAlert({
  sku,
  warehouseCode,
  quantity,
  historicalAvgQty,
}: {
  sku?: string
  warehouseCode?: string
  quantity: number
  historicalAvgQty: number
}) {
  const [alert, setAlert] = useState<SeasonalAlert | null>(null)
  const { enabled } = useAIFeature('ai.forecast')

  useEffect(() => {
    if (!enabled) { setAlert(null); return }
    if (!sku || !warehouseCode || quantity <= 0 || historicalAvgQty <= 0) { setAlert(null); return }
    const params = new URLSearchParams({
      sku,
      warehouse: warehouseCode,
      qty: String(quantity),
      avg_qty: String(historicalAvgQty),
    })
    apiFetch<any>(`/ai/seasonal-alert?${params}`)
      .then((res) => setAlert(res.data || null))
      .catch(() => setAlert(null))
  }, [enabled, sku, warehouseCode, quantity, historicalAvgQty])

  if (!enabled || !alert || alert.alert_level === 'none' || !alert.message) return null

  const tone = alert.alert_level === 'high'
    ? 'bg-rose-50 text-rose-700 ring-rose-200'
    : 'bg-amber-50 text-amber-700 ring-amber-200'

  return (
    <div className={`mt-2 inline-flex items-start gap-2 rounded-md px-2.5 py-2 text-xs ring-1 ${tone}`}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{alert.message}</span>
    </div>
  )
}