'use client'

// WMS Phase 9 task 9.13 — Realtime alerts dashboard.

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface Alerts {
  low_safety_stock?: any[]
  near_expiry_high_qty?: any[]
  bins_over_90?: any[]
  orphan_pallets?: any[]
}

export default function RealtimeDashboardPage() {
  const [data, setData] = useState<Alerts>({})
  const [warehouseID] = useState('a0000000-0000-0000-0000-000000000001')

  const [loading, setLoading] = useState(true)
  const urgentCount = (data.low_safety_stock?.length || 0) + (data.near_expiry_high_qty?.length || 0) +
    (data.bins_over_90?.length || 0) + (data.orphan_pallets?.length || 0)

  const load = async () => {
    setLoading(true)
    try {
      const r: any = await apiFetch(`/warehouse/dashboard/alerts?warehouse_id=${warehouseID}`)
      setData(r.data || {})
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 10_000) // poll every 10s
    return () => clearInterval(t)
  }, [])

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Cảnh báo kho realtime</h1>
          {urgentCount > 0 && (
            <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-full animate-pulse">
              {urgentCount} cảnh báo
            </span>
          )}
        </div>
        <button onClick={load} disabled={loading}
          className="px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          {loading ? '⟳ Đang tải...' : '↺ Làm mới'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="🟠 Tồn dưới mức an toàn" items={data.low_safety_stock} render={(it: any) =>
          <div className="text-sm"><span className="font-mono">{it.sku}</span> · {it.name} · <strong>{it.qty}</strong> tồn</div>
        } />
        <Card title=" Sắp hết hạn (HSD<30d, SL≥50)" items={data.near_expiry_high_qty} render={(it: any) =>
          <div className="text-sm"><span className="font-mono">{it.lpn}</span> · Lô {it.batch} · HSD {it.expiry} · {it.qty} đơn vị</div>
        } />
        <Card title=" Bin chiếm > 90%" items={data.bins_over_90} render={(it: any) =>
          <div className="text-sm"><span className="font-mono">{it.bin_code}</span> · {it.occupied}/{it.capacity}</div>
        } />
        <Card title="🟣 Pallet mồ côi (>7 ngày staging)" items={data.orphan_pallets} render={(it: any) =>
          <div className="text-sm"><span className="font-mono">{it.lpn}</span> · {it.bin_code || 'no-bin'} · {new Date(it.received_at).toLocaleDateString()}</div>
        } />
      </div>

      <div className="text-xs text-gray-500 mt-4">Tự động cập nhật mỗi 10 giây.</div>
    </div>
  )
}

function Card({ title, items, render }: { title: string; items?: any[]; render: (it: any) => any }) {
  const arr = items || []
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="px-2 py-0.5 bg-gray-200 rounded text-xs">{arr.length}</span>
      </div>
      {arr.length === 0 ? (
        <div className="text-sm text-gray-400">— không có cảnh báo —</div>
      ) : (
        <div className="space-y-1 max-h-72 overflow-auto">
          {arr.map((it, i) => <div key={i} className="border-b pb-1">{render(it)}</div>)}
        </div>
      )}
    </div>
  )
}
