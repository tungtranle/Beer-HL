'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'
import { useDataRefresh } from '@/lib/notifications'

interface EnrichedItem {
  product_id: string; product_name: string; product_sku: string
  lot_id: string; batch_number: string; expiry_date: string
  location_id: string; qty: number; picked_qty: number
}

interface PickingOrder {
  id: string; pick_number: string; shipment_id: string
  status: string; total_items: number; enriched_items: EnrichedItem[]
  created_at: string; warehouse_id: string
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
}
const statusLabels: Record<string, string> = {
  pending: 'Chờ soạn',
  in_progress: 'Đang soạn',
  completed: 'Đã soạn',
  cancelled: 'Đã hủy',
}

function daysUntilExpiry(expiryDate: string): number {
  if (!expiryDate) return 999
  const diff = new Date(expiryDate).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function PickingOrdersPage() {
  const [orders, setOrders] = useState<PickingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/warehouse/picking-orders')
      setOrders(res.data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])

  // Auto-refresh when orders change via WebSocket
  useDataRefresh('order', loadData)

  const confirmPick = async (order: PickingOrder) => {
    setConfirming(order.id)
    try {
      // Build items with picked_qty = qty (full pick confirmation)
      const items = (order.enriched_items || []).map(item => ({
        product_id: item.product_id,
        lot_id: item.lot_id,
        location_id: item.location_id,
        picked_qty: item.qty,
      }))
      await apiFetch('/warehouse/confirm-pick', {
        method: 'POST',
        body: { picking_order_id: order.id, items },
      })
      await loadData()
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setConfirming(null)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full" /></div>

  const pending = orders.filter(o => o.status === 'pending' || o.status === 'in_progress')
  const completed = orders.filter(o => o.status === 'completed')

  return (
    <div className="max-w-[1200px] mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">📋 Lệnh đóng hàng</h1>
      <p className="text-base text-gray-500 mb-6">Soạn hàng theo FEFO — hết hạn sớm lấy trước</p>

      {/* Pending orders — sorted queue */}
      <div className="mb-6">
        <h2 className="font-semibold text-gray-700 mb-3 text-base">
          ⏳ Hàng đợi soạn hàng ({pending.length})
          {pending.length > 0 && <span className="text-xs text-gray-400 ml-2">Sắp xếp theo thời gian tạo</span>}
        </h2>
        {pending.length === 0 ? (
          <p className="text-gray-400 text-base bg-white rounded-xl shadow-sm p-8 text-center">
            Không có lệnh đóng hàng nào đang chờ — tốt lắm! 🎉
          </p>
        ) : (
          <div className="space-y-4">
            {pending.map((order, idx) => {
              const isExpanded = expandedOrder === order.id
              const items = order.enriched_items || []
              const sortedItems = [...items].sort((a, b) => daysUntilExpiry(a.expiry_date) - daysUntilExpiry(b.expiry_date))

              return (
                <div key={order.id} className={`bg-white rounded-xl shadow-sm border-l-4 ${idx === 0 ? 'border-brand-500 ring-1 ring-brand-100' : 'border-amber-500'}`}>
                  {/* Header — always visible */}
                  <button
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    className="w-full text-left p-5"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {idx === 0 && (
                          <span className="bg-brand text-white text-xs px-2.5 py-0.5 rounded-full font-medium">
                            Soạn trước
                          </span>
                        )}
                        <span className="font-bold text-gray-800 text-base">{order.pick_number || order.id.slice(0, 8)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[order.status] || 'bg-gray-100'}`}>
                          {statusLabels[order.status] || order.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">{items.length} mặt hàng</span>
                        <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      Tạo lúc: {new Date(order.created_at).toLocaleString('vi-VN')}
                    </div>
                  </button>

                  {/* Expanded — item detail with FEFO badges */}
                  {isExpanded && (
                    <div className="border-t px-5 pb-5">
                      <div className="mt-4 space-y-3">
                        {sortedItems.map((item, itemIdx) => {
                          const days = daysUntilExpiry(item.expiry_date)
                          const isFirst = itemIdx === 0
                          const isUrgent = days <= 7

                          return (
                            <div key={`${item.product_id}-${item.lot_id}`} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span className="font-medium text-base text-gray-800">{item.product_name || item.product_sku}</span>
                                  <span className="ml-2 text-xs text-gray-400 font-mono">{item.product_sku}</span>
                                </div>
                                {isFirst && (
                                  <span className="text-xs bg-brand text-white px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                                    Pick trước (FEFO)
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                <div>
                                  <span className="text-gray-500">Lô:</span>{' '}
                                  <span className="font-medium">{item.batch_number || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">HSD:</span>{' '}
                                  <span className={`font-medium ${isUrgent ? 'text-amber-600' : 'text-gray-700'}`}>
                                    {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('vi-VN') : '—'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Cần lấy:</span>{' '}
                                  <span className="font-bold text-gray-800">{item.qty}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Đã lấy:</span>{' '}
                                  <span className={`font-bold ${item.picked_qty >= item.qty ? 'text-green-600' : 'text-gray-400'}`}>
                                    {item.picked_qty}
                                  </span>
                                </div>
                              </div>
                              {isUrgent && (
                                <p className="text-xs text-amber-600 font-medium mt-2">
                                  ⚠ Gần hết hạn ({days} ngày) — ưu tiên lấy trước
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* Confirm button — h-14 per UXUI_SPEC */}
                      <button
                        onClick={(e) => { e.stopPropagation(); confirmPick(order) }}
                        disabled={confirming === order.id}
                        className="mt-4 bg-brand text-white w-full h-14 rounded-xl font-medium text-base hover:bg-brand-500 transition disabled:opacity-50"
                      >
                        {confirming === order.id ? 'Đang xử lý...' : '✅ Xác nhận đã soạn xong'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-3 text-base">✅ Đã soạn ({completed.length})</h2>
          <div className="space-y-2">
            {completed.map(order => (
              <div key={order.id} className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-base">{order.pick_number || order.id.slice(0, 8)}</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Đã soạn</span>
                </div>
                <span className="text-sm text-gray-500">{(order.enriched_items || []).length} mặt hàng</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
