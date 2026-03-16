'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface PickingOrder {
  id: string; trip_id: string; trip_number: string
  status: string; total_items: number; items: any[]
  created_at: string; warehouse_id: string
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  picking: 'bg-blue-100 text-blue-800',
  picked: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
}
const statusLabels: Record<string, string> = {
  pending: 'Chờ soạn',
  picking: 'Đang soạn',
  picked: 'Đã soạn',
  cancelled: 'Đã hủy',
}

export default function PickingOrdersPage() {
  const [orders, setOrders] = useState<PickingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<PickingOrder | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/warehouse/picking-orders')
      setOrders(res.data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])

  const confirmPick = async (orderId: string) => {
    setConfirming(orderId)
    try {
      await apiFetch('/warehouse/confirm-pick', {
        method: 'POST',
        body: { picking_order_id: orderId },
      })
      await loadData()
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    } finally {
      setConfirming(null)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>

  const pending = orders.filter(o => o.status === 'pending' || o.status === 'picking')
  const completed = orders.filter(o => o.status === 'picked')

  return (
    <div className="max-w-[1200px] mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">📋 Lệnh đóng hàng</h1>
      <p className="text-sm text-gray-500 mb-6">Soạn hàng theo từng chuyến xe</p>

      {/* Pending orders */}
      <div className="mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">Đang chờ soạn ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-gray-400 text-sm bg-white rounded-xl shadow-sm p-8 text-center">Không có lệnh đóng hàng nào đang chờ</p>
        ) : (
          <div className="space-y-3">
            {pending.map(order => (
              <div key={order.id} className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-amber-500">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-bold text-gray-800">{order.trip_number || order.id.slice(0, 8)}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${statusColors[order.status] || 'bg-gray-100'}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">{order.total_items} mặt hàng</span>
                    <button
                      onClick={() => confirmPick(order.id)}
                      disabled={confirming === order.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition disabled:opacity-50"
                    >
                      {confirming === order.id ? 'Đang xử lý...' : '✅ Xác nhận đã soạn'}
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-400">Tạo lúc: {new Date(order.created_at).toLocaleString('vi-VN')}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-3">Đã soạn ({completed.length})</h2>
          <div className="space-y-2">
            {completed.map(order => (
              <div key={order.id} className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">{order.trip_number || order.id.slice(0, 8)}</span>
                  <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Đã soạn</span>
                </div>
                <span className="text-sm text-gray-500">{order.total_items} mặt hàng</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
