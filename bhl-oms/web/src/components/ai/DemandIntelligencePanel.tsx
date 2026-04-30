'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, TrendingUp } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useAIFeature } from '@/hooks/useAIFeature'

interface ForecastPoint {
  week_start: string
  qty_pred: number
  qty_lower: number
  qty_upper: number
}

interface DemandForecast {
  customer_name: string
  product_name: string
  sku: string
  warehouse_code: string
  history_points: number
  model_method: string
  confidence: number
  forecast: ForecastPoint[]
  explanation: string
  provider: string
}

export function DemandIntelligencePanel({
  customerId,
  productId,
  warehouseId,
}: {
  customerId?: string
  productId?: string
  warehouseId?: string
}) {
  const [forecast, setForecast] = useState<DemandForecast | null>(null)
  const [loading, setLoading] = useState(false)
  const { enabled } = useAIFeature('ai.forecast')

  useEffect(() => {
    if (!enabled) { setForecast(null); setLoading(false); return }
    if (!customerId || !productId || !warehouseId) { setForecast(null); return }
    const params = new URLSearchParams({ customer_id: customerId, product_id: productId, warehouse_id: warehouseId, horizon_weeks: '4' })
    let cancelled = false
    setLoading(true)
    apiFetch<any>(`/ai/demand-forecast?${params}`)
      .then((res) => { if (!cancelled) setForecast(res.data || null) })
      .catch(() => { if (!cancelled) setForecast(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [enabled, customerId, productId, warehouseId])

  const maxQty = useMemo(() => Math.max(1, ...(forecast?.forecast || []).map((p) => p.qty_upper || p.qty_pred || 0)), [forecast])

  if (!enabled) return null

  if (!customerId || !productId || !warehouseId) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-slate-700">
          <BarChart3 className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-semibold">Demand Intelligence</h3>
        </div>
        <p className="mt-3 text-sm text-slate-500">Chọn NPP, kho và SKU để xem dự báo 4 tuần.</p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-semibold text-slate-900">Demand Intelligence</h3>
        </div>
        {forecast && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{Math.round((forecast.confidence || 0) * 100)}%</span>}
      </div>

      {loading && <div className="mt-4 h-28 animate-pulse rounded-md bg-slate-100" />}

      {!loading && !forecast && (
        <div className="mt-4 rounded-md bg-slate-50 px-3 py-4 text-sm text-slate-500">Chưa có dự báo khả dụng.</div>
      )}

      {!loading && forecast && (
        <div className="mt-4 space-y-4">
          <div>
            <p className="truncate text-sm font-semibold text-slate-900">{forecast.product_name}</p>
            <p className="mt-0.5 text-xs text-slate-500">{forecast.sku} · Kho {forecast.warehouse_code} · {forecast.history_points} điểm lịch sử</p>
          </div>
          <div className="space-y-2">
            {forecast.forecast.map((point) => (
              <div key={point.week_start} className="grid grid-cols-[72px_1fr_48px] items-center gap-2 text-xs">
                <span className="text-slate-500">{point.week_start.slice(5)}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(6, Math.min(100, (point.qty_pred / maxQty) * 100))}%` }} />
                </div>
                <span className="text-right font-semibold text-slate-800">{Math.round(point.qty_pred)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-100">
            <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{forecast.explanation}</span>
          </div>
        </div>
      )}
    </section>
  )
}