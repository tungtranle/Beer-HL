'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { OrderTimeline } from '@/components/OrderTimeline'
import { DeliveryAttempts } from '@/components/DeliveryAttempts'
import { OrderStatusStepper } from '@/components/OrderStatusStepper'
import { orderStatusLabels, orderStatusColors, formatVND } from '@/lib/status-config'
import { handleError } from '@/lib/handleError'
import { StatusChip } from '@/components/ui/StatusChip'
import { toast } from '@/lib/useToast'
import { WaitingForBanner } from '@/components/WaitingForBanner'
import { PinnedNotesBar } from '@/components/PinnedNotesBar'
import { CreditAgingChip } from '@/components/CreditAgingChip'
import { TimelineKPIBar } from '@/components/TimelineKPIBar'
import { useDataRefresh } from '@/lib/notifications'

interface OrderItem {
  id: string; product_id: string; product_name: string; product_sku: string
  quantity: number; unit_price: number; deposit_amount: number; amount: number
}

interface Order {
  id: string; order_number: string; customer_id: string; customer_name: string; customer_code: string
  warehouse_id: string; warehouse_name: string; delivery_date: string; notes: string
  status: string; total_amount: number; deposit_amount: number; grand_total: number
  re_delivery_count?: number
  customer_phone?: string
  epod_photos?: string[]
  created_at: string; items: OrderItem[]
}

// Status labels and colors imported from @/lib/status-config
const _statusLabels = orderStatusLabels
const _statusColors = orderStatusColors

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'items' | 'timeline' | 'attempts' | 'epod'>('items')
  const [showRedeliveryModal, setShowRedeliveryModal] = useState(false)
  const [redeliveryReason, setRedeliveryReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submitRef = useRef(false)

  const load = () => {
    apiFetch<any>(`/orders/${params.id}`)
      .then((r) => setOrder(r.data))
      .catch(err => handleError(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [params.id])

  // Auto-refresh when this order changes via WebSocket
  useDataRefresh('order', load, params.id as string)

  const handleAction = async (action: 'approve' | 'cancel') => {
    if (!confirm(action === 'approve' ? 'Duyệt đơn hàng này?' : 'Hủy đơn hàng này?')) return
    try {
      await apiFetch(`/orders/${params.id}/${action}`, { method: 'POST' })
      toast.success(action === 'approve' ? 'Đã duyệt đơn hàng' : 'Đã hủy đơn hàng')
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleRedelivery = async () => {
    if (!redeliveryReason.trim()) return
    if (submitRef.current) return
    submitRef.current = true
    setSubmitting(true)
    try {
      await apiFetch(`/orders/${params.id}/redelivery`, {
        method: 'POST',
        body: { reason: redeliveryReason.trim() },
      })
      toast.success('Tạo giao bổ sung thành công')
      setShowRedeliveryModal(false)
      setRedeliveryReason('')
      load()
    } catch (err: any) {
      submitRef.current = false
      toast.error(err.message)
    } finally {
      setSubmitting(false)
      submitRef.current = false
    }
  }

  const canRedelivery = order && ['partially_delivered', 'failed'].includes(order.status)

  // formatVND imported from status-config (single source of truth)

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div></div>
  if (!order) return <div className="text-center py-20 text-gray-500">Không tìm thấy đơn hàng</div>

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-1">
            ← Quay lại
          </button>
          <h1 className="text-2xl font-bold text-gray-800">{order.order_number}</h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip status={order.status} />
          {order.status === 'on_credit' && <CreditAgingChip deliveredAt={order.created_at} />}
        </div>
      </div>

      {/* Thanh tiến trình đơn hàng */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <OrderStatusStepper status={order.status} />
      </div>

      {/* Waiting banner */}
      <WaitingForBanner status={order.status} />

      {/* Pinned notes */}
      <PinnedNotesBar orderId={order.id} />

      {/* Order info */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold mb-4">Thông tin đơn hàng</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Khách hàng:</span> <strong>{order.customer_code} — {order.customer_name}</strong></div>
          <div><span className="text-gray-500">Kho xuất:</span> <strong>{order.warehouse_name || '-'}</strong></div>
          <div><span className="text-gray-500">Ngày giao:</span> <strong>{new Date(order.delivery_date).toLocaleDateString('vi-VN')}</strong></div>
          <div><span className="text-gray-500">Ngày tạo:</span> <strong>{new Date(order.created_at).toLocaleString('vi-VN')}</strong></div>
          {order.customer_phone && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500">SĐT:</span> <strong>{order.customer_phone}</strong>
              <a href={`https://zalo.me/${order.customer_phone.replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 transition">
                💬 Zalo
              </a>
            </div>
          )}
          {order.notes && <div className="col-span-2"><span className="text-gray-500">Ghi chú:</span> {order.notes}</div>}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="flex border-b">
          {[
            { key: 'items' as const, label: '📦 Sản phẩm', count: order.items?.length },
            { key: 'timeline' as const, label: '📜 Lịch sử & Ghi chú' },
            ...(order.re_delivery_count && order.re_delivery_count > 0
              ? [{ key: 'attempts' as const, label: '🔄 Giao lại', count: order.re_delivery_count }]
              : []),
            ...(order.epod_photos && order.epod_photos.length > 0
              ? [{ key: 'epod' as const, label: '📸 Ảnh ePOD', count: order.epod_photos.length }]
              : []),
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium transition border-b-2 ${
                activeTab === tab.key
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 rounded text-xs">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Items tab */}
          {activeTab === 'items' && (
            <>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
              <th className="text-left py-2 px-3">#</th>
              <th className="text-left py-2 px-3">SKU</th>
              <th className="text-left py-2 px-3">Sản phẩm</th>
              <th className="text-right py-2 px-3">SL</th>
              <th className="text-right py-2 px-3">Đơn giá</th>
              <th className="text-right py-2 px-3">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item, idx) => (
              <tr key={item.id} className="border-t">
                <td className="py-2 px-3">{idx + 1}</td>
                <td className="py-2 px-3 font-mono">{item.product_sku}</td>
                <td className="py-2 px-3">{item.product_name}</td>
                <td className="py-2 px-3 text-right">{item.quantity}</td>
                <td className="py-2 px-3 text-right">{formatVND(item.unit_price)}</td>
                <td className="py-2 px-3 text-right font-medium">{formatVND(item.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t">
              <td colSpan={5} className="py-2 px-3 text-right text-gray-500">Tiền hàng:</td>
              <td className="py-2 px-3 text-right">{formatVND(order.total_amount)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="py-2 px-3 text-right text-gray-500">Phí vỏ/két:</td>
              <td className="py-2 px-3 text-right">{formatVND(order.deposit_amount)}</td>
            </tr>
            <tr className="font-semibold text-lg">
              <td colSpan={5} className="py-3 px-3 text-right">Tổng cộng:</td>
              <td className="py-3 px-3 text-right text-brand-600">{formatVND(order.grand_total)}</td>
            </tr>
          </tfoot>
        </table>
            </>
          )}

          {/* Timeline + Notes tab */}
          {activeTab === 'timeline' && (
            <div>
              <TimelineKPIBar createdAt={order.created_at} />
              <OrderTimeline orderId={order.id} />
            </div>
          )}

          {/* Delivery Attempts tab */}
          {activeTab === 'attempts' && (
            <DeliveryAttempts orderId={order.id} />
          )}

          {/* ePOD Photos tab */}
          {activeTab === 'epod' && order.epod_photos && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">📸 Ảnh ePOD ({order.epod_photos.length})</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {order.epod_photos.map((url, idx) => (
                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                    className="group relative aspect-square rounded-lg overflow-hidden border hover:ring-2 hover:ring-brand-300 transition">
                    <img src={url} alt={`ePOD photo ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1">
                      Ảnh #{idx + 1}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {['confirmed', 'pending_approval', 'draft'].includes(order.status) && (
          <Link
            href={`/dashboard/orders/${order.id}/edit`}
            className="px-5 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition"
          >
            ✏️ Sửa đơn hàng
          </Link>
        )}
        {order.status === 'pending_approval' && (
          <button
            onClick={() => handleAction('approve')}
            className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            ✅ Duyệt đơn hàng
          </button>
        )}
        {canRedelivery && (
          <button
            onClick={() => setShowRedeliveryModal(true)}
            className="px-5 py-2 bg-[#F68634] text-white rounded-lg hover:bg-[#e5752a] transition"
          >
            � Giao bổ sung
          </button>
        )}
        {['confirmed', 'pending_approval', 'draft'].includes(order.status) && (
          <button
            onClick={() => handleAction('cancel')}
            className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            ❌ Hủy đơn hàng
          </button>
        )}
      </div>

      {/* Re-delivery Modal */}
      {showRedeliveryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">� Giao bổ sung</h3>
            <p className="text-sm text-gray-600 mb-3">
              Đơn hàng <strong>{order.order_number}</strong> sẽ được tạo lần giao bổ sung mới.
              {order.status === 'partially_delivered' && ' Hàng đã giao thiếu sẽ được giao bổ sung.'}
              {order.status === 'failed' && ' Đơn hàng giao thất bại sẽ được giao lại.'}
            </p>
            <textarea
              value={redeliveryReason}
              onChange={(e) => setRedeliveryReason(e.target.value)}
              placeholder="Nhập lý do giao bổ sung (bắt buộc)..."
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#F68634] focus:border-[#F68634] resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setShowRedeliveryModal(false); setRedeliveryReason('') }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
              >
                Hủy
              </button>
              <button
                onClick={handleRedelivery}
                disabled={!redeliveryReason.trim() || submitting}
                className="px-5 py-2 bg-[#F68634] text-white text-sm rounded-lg hover:bg-[#e5752a] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {submitting ? 'Đang xử lý...' : 'Xác nhận giao bổ sung'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
