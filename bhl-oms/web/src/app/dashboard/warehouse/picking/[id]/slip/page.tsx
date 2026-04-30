'use client'

// WMS — Phiếu soạn hàng (Picking Slip) tối ưu thủ kho:
//  • Liệt kê chi tiết từng dòng theo BIN walk path (zone → bin → expiry FEFO)
//  • Mỗi dòng hiện rõ: Bin code (font lớn), Lot, HSD, SL, checkbox tick
//  • Header: pick_number, shipment, kho, ngày in
//  • Footer: chữ ký người soạn / trưởng kho
//  • In trực tiếp khổ A4 — 1 phiếu = 1 lệnh soạn

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

interface EnrichedItem {
  product_id: string; product_name: string; product_sku: string
  lot_id: string; batch_number: string; expiry_date: string
  location_id: string; bin_code?: string; zone?: string
  qty: number; picked_qty: number
}

interface PickingOrder {
  id: string; pick_number: string; shipment_id: string
  status: string; total_items: number; enriched_items: EnrichedItem[]
  created_at: string; warehouse_id: string
}

function daysUntilExpiry(expiryDate: string): number {
  if (!expiryDate) return 999
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000)
}

export default function PickingSlipPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<PickingOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params?.id) return
    // Fetch the picking order — backend's GET endpoint returns single, but enrichment needs list
    // Easier path: call all-orders and find by id (cheap; few orders typically active)
    apiFetch<any>(`/warehouse/picking-orders`).then(r => {
      const found = (r.data || []).find((o: PickingOrder) => o.id === params.id)
      setOrder(found || null)
    }).finally(() => setLoading(false))
  }, [params?.id])

  if (loading) return <div className="p-8">Đang tải…</div>
  if (!order) return <div className="p-8">Không tìm thấy phiếu</div>

  const items = order.enriched_items || []
  // Items đã được backend sort theo zone/bin/expiry — chỉ cần render
  const totalQty = items.reduce((s, i) => s + (i.qty || 0), 0)
  const totalSKU = new Set(items.map(i => i.product_id)).size

  return (
    <div className="bg-slate-100 min-h-screen p-4 print:bg-white print:p-0">
      {/* Action bar (hidden on print) */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <button
          onClick={() => router.back()}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Quay lại
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
          >
            🖨 In phiếu A4
          </button>
        </div>
      </div>

      {/* Slip — A4 layout */}
      <div className="max-w-3xl mx-auto bg-white shadow-lg p-8 print:shadow-none print:max-w-none print:p-6">
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-3 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight">PHIẾU SOẠN HÀNG (PICKING)</h1>
              <div className="text-sm text-slate-600 mt-1">
                Bia Hạ Long — In lúc {new Date().toLocaleString('vi-VN')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Mã phiếu</div>
              <div className="font-mono text-xl font-black">{order.pick_number}</div>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-3 gap-2 text-sm mb-4">
          <div>
            <div className="text-xs text-slate-500 uppercase">Lệnh giao</div>
            <div className="font-mono font-semibold">{order.shipment_id.slice(0, 8)}…</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase">Tổng</div>
            <div className="font-semibold">{totalSKU} SKU · {totalQty} chai/lon</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase">Tạo lúc</div>
            <div className="font-semibold">{new Date(order.created_at).toLocaleString('vi-VN')}</div>
          </div>
        </div>

        {/* Walk-path hint */}
        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2 mb-3 print:bg-white print:border-slate-300">
          💡 Các dòng được sắp xếp theo <b>đường đi tối ưu</b> (zone → bin → HSD gần nhất). Đi lần lượt từ trên xuống.
        </div>

        {/* Lines */}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 print:bg-slate-200">
              <th className="border border-slate-300 px-2 py-2 text-left w-8">#</th>
              <th className="border border-slate-300 px-2 py-2 text-left">CẤT TỪ BIN</th>
              <th className="border border-slate-300 px-2 py-2 text-left">Sản phẩm</th>
              <th className="border border-slate-300 px-2 py-2 text-left">Lô / HSD</th>
              <th className="border border-slate-300 px-2 py-2 text-right w-16">SL</th>
              <th className="border border-slate-300 px-2 py-2 text-center w-12">✓</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const days = daysUntilExpiry(it.expiry_date)
              const expiryWarn = days <= 7
              return (
                <tr key={`${it.product_id}-${it.lot_id}`} className="break-inside-avoid">
                  <td className="border border-slate-300 px-2 py-2 text-slate-500 tabular-nums align-top">{idx + 1}</td>
                  <td className="border border-slate-300 px-2 py-2 align-top">
                    <div className="font-mono text-xl font-black tracking-wider text-emerald-700">
                      {it.bin_code || '— chưa gán'}
                    </div>
                    {it.zone && <div className="text-[10px] text-slate-500 uppercase">Zone {it.zone}</div>}
                  </td>
                  <td className="border border-slate-300 px-2 py-2 align-top">
                    <div className="font-semibold">{it.product_name || '—'}</div>
                    <div className="text-xs text-slate-500 font-mono">{it.product_sku}</div>
                  </td>
                  <td className="border border-slate-300 px-2 py-2 align-top text-xs">
                    <div className="font-mono">{it.batch_number || '—'}</div>
                    <div className={expiryWarn ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                      HSD {it.expiry_date ? new Date(it.expiry_date).toLocaleDateString('vi-VN') : '—'}
                      {expiryWarn && ` (còn ${days}d ⚠)`}
                    </div>
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-right tabular-nums font-bold align-top">
                    {it.qty}
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-center align-top">
                    <div className="w-5 h-5 border-2 border-slate-400 inline-block" />
                  </td>
                </tr>
              )
            })}
            {items.length === 0 && (
              <tr><td colSpan={6} className="border border-slate-300 p-4 text-center text-slate-400">Phiếu trống</td></tr>
            )}
          </tbody>
        </table>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-12 mt-12 text-sm">
          <div className="text-center">
            <div className="font-semibold">Người soạn</div>
            <div className="text-xs text-slate-500 mb-12">Ký, ghi rõ họ tên</div>
            <div className="border-t border-slate-400 pt-1 text-xs text-slate-400">_________________________</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">Trưởng kho xác nhận</div>
            <div className="text-xs text-slate-500 mb-12">Ký, ghi rõ họ tên</div>
            <div className="border-t border-slate-400 pt-1 text-xs text-slate-400">_________________________</div>
          </div>
        </div>
      </div>
    </div>
  )
}
