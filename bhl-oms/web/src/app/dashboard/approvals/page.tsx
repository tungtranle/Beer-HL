'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface OrderItem {
  product_code: string
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

interface PendingOrder {
  id: string; order_number: string; customer_name: string; customer_code: string
  total_amount: number; credit_limit: number; current_balance: number; available_limit: number
  exceed_amount: number; status: string; created_at: string; notes: string
  items?: OrderItem[]
}

export default function ApprovalsPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<string>('')
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/orders/pending-approvals')
      setOrders(res.data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])

  const approveOrder = async (orderId: string) => {
    setProcessing(orderId)
    try {
      await apiFetch(`/orders/${orderId}/approve`, {
        method: 'POST',
        body: { approved: true },
      })
      await loadData()
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    } finally {
      setProcessing(null)
    }
  }

  const rejectOrder = async (orderId: string) => {
    if (!rejectReason.trim()) {
      alert('Vui lòng nhập lý do từ chối')
      return
    }
    setProcessing(orderId)
    try {
      await apiFetch(`/orders/${orderId}/approve`, {
        method: 'POST',
        body: { approved: false, reason: rejectReason },
      })
      setShowRejectModal(null)
      setRejectReason('')
      await loadData()
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    } finally {
      setProcessing(null)
    }
  }

  const formatMoney = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)
  const exceedPercent = (order: PendingOrder) => order.credit_limit > 0 ? ((order.exceed_amount / order.credit_limit) * 100).toFixed(1) : '0'

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>

  return (
    <div className="max-w-[1200px] mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">📝 Duyệt đơn hàng</h1>
      <p className="text-sm text-gray-500 mb-6">Đơn hàng vượt hạn mức nợ cần phê duyệt</p>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-gray-500">Không có đơn hàng nào cần phê duyệt</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
            ⚠️ Có <strong>{orders.length}</strong> đơn hàng vượt hạn mức nợ đang chờ duyệt
          </div>

          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-xl shadow-sm border-l-4 border-orange-400 overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold text-gray-800 text-lg">{order.order_number}</div>
                    <div className="text-sm text-gray-500 mt-1">🏪 {order.customer_code} — {order.customer_name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                      Vượt {exceedPercent(order)}%
                    </span>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">Chờ duyệt</span>
                  </div>
                </div>

                {/* Credit info cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Giá trị đơn hàng</div>
                    <div className="font-bold text-gray-800">{formatMoney(order.total_amount)}</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Hạn mức tín dụng</div>
                    <div className="font-bold text-blue-700">{formatMoney(order.credit_limit)}</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Công nợ hiện tại</div>
                    <div className="font-bold text-orange-600">{formatMoney(order.current_balance)}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Hạn mức còn lại</div>
                    <div className="font-bold text-green-600">{formatMoney(order.available_limit)}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Giá trị vượt hạn mức</div>
                    <div className="font-bold text-red-600">{formatMoney(order.exceed_amount)}</div>
                  </div>
                </div>

                {/* Credit bar visualization */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Sử dụng hạn mức</span>
                    <span>{order.credit_limit > 0 ? (((order.current_balance + order.total_amount) / order.credit_limit) * 100).toFixed(0) : 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full bg-gradient-to-r from-orange-400 to-red-500"
                      style={{ width: `${Math.min(((order.current_balance + order.total_amount) / (order.credit_limit || 1)) * 100, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Nợ cũ: {formatMoney(order.current_balance)}</span>
                    <span>+ Đơn mới: {formatMoney(order.total_amount)}</span>
                    <span>Hạn mức: {formatMoney(order.credit_limit)}</span>
                  </div>
                </div>

                {/* Expandable order items */}
                <button
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  className="text-sm text-blue-600 hover:text-blue-800 mb-3 flex items-center gap-1"
                >
                  {expandedOrder === order.id ? '▼' : '▶'} Chi tiết sản phẩm ({order.items?.length || 0} mặt hàng)
                </button>

                {expandedOrder === order.id && order.items && order.items.length > 0 && (
                  <div className="mb-4 border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Mã SP</th>
                          <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Tên sản phẩm</th>
                          <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">SL</th>
                          <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Đơn giá</th>
                          <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2 text-gray-600 font-mono text-xs">{item.product_code}</td>
                            <td className="px-3 py-2 text-gray-800">{item.product_name}</td>
                            <td className="px-3 py-2 text-right text-gray-800">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{formatMoney(item.unit_price)}</td>
                            <td className="px-3 py-2 text-right font-medium text-gray-800">{formatMoney(item.line_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 font-bold">
                        <tr className="border-t">
                          <td colSpan={4} className="px-3 py-2 text-right text-gray-600">Tổng cộng:</td>
                          <td className="px-3 py-2 text-right text-gray-800">{formatMoney(order.total_amount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {order.notes && (
                  <div className="text-sm text-gray-500 mb-3 bg-yellow-50 p-2 rounded">📝 {order.notes}</div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => approveOrder(order.id)}
                    disabled={processing === order.id}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm disabled:opacity-50 font-medium"
                  >
                    {processing === order.id ? 'Đang xử lý...' : '✅ Phê duyệt'}
                  </button>
                  <button
                    onClick={() => { setShowRejectModal(order.id); setRejectReason('') }}
                    disabled={processing === order.id}
                    className="px-6 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm disabled:opacity-50 font-medium"
                  >
                    ❌ Từ chối
                  </button>
                </div>

                <div className="text-xs text-gray-400 mt-2">Tạo lúc: {new Date(order.created_at).toLocaleString('vi-VN')}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject reason modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Lý do từ chối đơn hàng</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              className="w-full border rounded-lg p-3 text-sm mb-4 h-24 resize-none focus:ring-2 focus:ring-red-300 focus:border-red-400 outline-none"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowRejectModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Hủy
              </button>
              <button
                onClick={() => rejectOrder(showRejectModal)}
                disabled={processing === showRejectModal}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
              >
                {processing === showRejectModal ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
