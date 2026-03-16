'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

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
    } catch (err) { console.error(err) }
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
      alert('Lỗi: ' + err.message)
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
        <p className="text-gray-400 text-sm bg-white rounded-xl shadow-sm p-8 text-center">Không có hàng trả về đang chờ xử lý</p>
      ) : (
        <div className="space-y-4">
          {pending.map(item => (
            <div key={item.trip_id} className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-bold text-gray-800">{item.trip_number}</span>
                  <span className="ml-2 text-sm text-gray-500">· Tài xế: {item.driver_name}</span>
                </div>
                <button
                  onClick={() => processInbound(item.trip_id)}
                  disabled={processing === item.trip_id}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {processing === item.trip_id ? 'Đang xử lý...' : '📥 Xác nhận nhập kho'}
                </button>
              </div>
              <div className="text-sm text-gray-500">Tổng: {item.total_items} mặt hàng</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
