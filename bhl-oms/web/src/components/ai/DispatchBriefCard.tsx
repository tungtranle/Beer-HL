'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { BrainCircuit, RefreshCcw } from 'lucide-react'
import { apiFetch, getUser } from '@/lib/api'
import { useAIFeature } from '@/hooks/useAIFeature'

interface DispatchBrief {
  date: string
  summary: string
  total_orders: number
  at_risk_npps: number
  active_trips: number
  exceptions: number
  provider: string
}

export function DispatchBriefCard() {
  const [brief, setBrief] = useState<DispatchBrief | null>(null)
  const [loading, setLoading] = useState(false)
  const user = getUser()
  const { enabled } = useAIFeature('ai.briefing')

  const allowed = ['admin', 'dispatcher', 'management'].includes(user?.role || '')

  const load = useCallback((refresh = false) => {
    if (!allowed || !enabled) return
    setLoading(true)
    apiFetch<{data: DispatchBrief | null}>(`/ai/dispatch-brief${refresh ? '?refresh=1' : ''}`)
      .then((res) => setBrief(res.data || null))
      .catch(() => setBrief(null))
      .finally(() => setLoading(false))
  }, [allowed, enabled])

  useEffect(() => { load() }, [load])

  if (!allowed || !enabled || (!brief && !loading)) return null

  return (
    <section className="rounded-lg border border-sky-100 bg-sky-50/50 p-4 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-white text-sky-700 ring-1 ring-sky-100">
            <BrainCircuit className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-slate-900">Brief điều phối hôm nay</h2>
              {brief?.provider && <span className="text-[10px] font-medium text-sky-700 bg-white px-1.5 py-0.5 rounded ring-1 ring-sky-100">{brief.provider}</span>}
            </div>
            <p className="text-sm text-slate-700 mt-1 leading-6">
              {loading ? 'Đang tổng hợp tình hình vận hành...' : brief?.summary}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="grid h-8 w-8 place-items-center rounded-md bg-white text-sky-700 ring-1 ring-sky-100 hover:bg-sky-50 disabled:opacity-50"
          title="Làm mới brief"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      </div>
      {brief && (
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <Mini label="Đơn hôm nay" value={brief.total_orders} href="/dashboard/orders?date=today" />
          <Mini label="Chuyến active" value={brief.active_trips} href="/dashboard/control-tower?status=active" />
          <Mini label="NPP rủi ro" value={brief.at_risk_npps} href="/dashboard/customers?risk=red" />
          <Mini label="Cảnh báo GPS" value={brief.exceptions} href="/dashboard/anomalies?status=open" />
        </div>
      )}
    </section>
  )
}

function Mini({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-md bg-white px-2.5 py-2 ring-1 ring-sky-100 transition hover:bg-sky-50 hover:ring-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
      <div className="text-[10px] uppercase font-semibold text-slate-400">{label}</div>
      <div className="text-sm font-bold text-slate-900 tabular-nums">{value}</div>
    </Link>
  )
}