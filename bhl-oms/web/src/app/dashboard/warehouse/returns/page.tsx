'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { handleError } from '@/lib/handleError'
import { toast } from '@/lib/useToast'

interface PendingReturn {
  trip_id: string; trip_number: string; driver_name: string
  items: { product_name: string; expected: number; actual: number; damaged: number }[]
  total_items: number; status: string
}

export default function WarehouseReturnsPage() {
  const [pending, setPending] = useState<PendingReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/warehouse/returns/pending')
      setPending(res.data || [])
    } catch (err) { handleError(err, { userMessage: 'Không tải được danh sách vỏ chai/két trả về' }) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])

  const processInbound = async (tripId: string) => {
    setProcessing(tripId)
    try {
      await apiFetch('/warehouse/returns/inbound', {
        method: 'POST',
        body: { trip_id: tripId },
      })
      await loadData()
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setProcessing(null)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>

  return (
    <div className="max-w-[1200px] mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">📥 Nhập vỏ / Hàng trả về</h1>
      <p className="text-sm text-gray-500 mb-6">Tiếp nhận vỏ két và hàng trả về từ tài xế</p>

      {pending.length === 0 ? (
        <p className="text-gray-400 text-base bg-white rounded-xl shadow-sm p-8 text-center">Không có hàng trả về đang chờ xử lý — kiểm tra lại khi có xe về kho</p>
      ) : (
        <div className="space-y-4">
          {pending.map(item => {
            const hasShortage = item.items?.some(i => i.actual < i.expected)
            const hasDamaged = item.items?.some(i => i.damaged > 0)
            return (
            <div key={item.trip_id} className={`bg-white rounded-xl shadow-sm p-5 border-l-4 ${hasShortage || hasDamaged ? 'border-red-400' : 'border-blue-500'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-800 text-base">{item.trip_number}</span>
                    <span className="text-base text-gray-500">· {item.driver_name}</span>
                    {hasShortage && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">⚠️ Thiếu hàng</span>}
                    {hasDamaged && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">🔶 Có hư hỏng</span>}
                    {!hasShortage && !hasDamaged && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">✓ Đủ hàng</span>}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">Tổng: {item.total_items} mặt hàng</div>
                </div>
                <button
                  onClick={() => processInbound(item.trip_id)}
                  disabled={processing === item.trip_id}
                  className="px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-medium hover:bg-brand-600 transition disabled:opacity-50 whitespace-nowrap"
                >
                  {processing === item.trip_id ? 'Đang xử lý...' : '📥 Xác nhận'}
                </button>
              </div>
              {item.items && item.items.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {item.items.map((it, idx) => {
                    const shortage = it.actual < it.expected
                    return (
                      <div key={idx} className={`flex items-center justify-between text-sm px-3 py-1.5 rounded-lg ${shortage || it.damaged > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                        <span className="text-gray-700">{it.product_name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 text-xs">Dự kiến: <strong>{it.expected}</strong></span>
                          <span className={`text-xs font-semibold ${shortage ? 'text-red-600' : 'text-green-600'}`}>Thực tế: {it.actual}</span>
                          {it.damaged > 0 && <span className="text-xs text-amber-600 font-medium">Hỏng: {it.damaged}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
