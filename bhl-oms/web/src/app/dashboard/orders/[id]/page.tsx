'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface OrderItem {
  id: string; product_id: string; product_name: string; product_sku: string
  quantity: number; unit_price: number; deposit_amount: number; amount: number
}

interface Order {
  id: string; order_number: string; customer_id: string; customer_name: string; customer_code: string
  warehouse_id: string; warehouse_name: string; delivery_date: string; notes: string
  status: string; total_amount: number; deposit_amount: number; grand_total: number
  created_at: string; items: OrderItem[]
}

const statusLabels: Record<string, string> = {
  draft: 'Nháp', confirmed: 'Đã xác nhận', pending_approval: 'Chờ duyệt',
  approved: 'Đã duyệt', processing: 'Đang xử lý', shipped: 'Đang giao',
  delivered: 'Đã giao', completed: 'Hoàn thành', cancelled: 'Đã hủy',
}

const statusColors: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700', pending_approval: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700', processing: 'bg-indigo-100 text-indigo-700',
  shipped: 'bg-purple-100 text-purple-700', delivered: 'bg-teal-100 text-teal-700',
  completed: 'bg-gray-100 text-gray-700', cancelled: 'bg-red-100 text-red-700',
  draft: 'bg-gray-100 text-gray-500',
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    apiFetch<any>(`/orders/${params.id}`)
      .then((r) => setOrder(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [params.id])

  const handleAction = async (action: 'approve' | 'cancel') => {
    if (!confirm(action === 'approve' ? 'Duyệt đơn hàng này?' : 'Hủy đơn hàng này?')) return
    try {
      await apiFetch(`/orders/${params.id}/${action}`, { method: 'POST' })
      load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600"></div></div>
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
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.status] || 'bg-gray-100'}`}>
          {statusLabels[order.status] || order.status}
        </span>
      </div>

      {/* Order info */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold mb-4">Thông tin đơn hàng</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Khách hàng:</span> <strong>{order.customer_code} — {order.customer_name}</strong></div>
          <div><span className="text-gray-500">Kho xuất:</span> <strong>{order.warehouse_name || '-'}</strong></div>
          <div><span className="text-gray-500">Ngày giao:</span> <strong>{new Date(order.delivery_date).toLocaleDateString('vi-VN')}</strong></div>
          <div><span className="text-gray-500">Ngày tạo:</span> <strong>{new Date(order.created_at).toLocaleString('vi-VN')}</strong></div>
          {order.notes && <div className="col-span-2"><span className="text-gray-500">Ghi chú:</span> {order.notes}</div>}
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold mb-4">Chi tiết sản phẩm ({order.items?.length || 0} dòng)</h2>
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
                <td className="py-2 px-3 text-right">{formatMoney(item.unit_price)}</td>
                <td className="py-2 px-3 text-right font-medium">{formatMoney(item.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t">
              <td colSpan={5} className="py-2 px-3 text-right text-gray-500">Tiền hàng:</td>
              <td className="py-2 px-3 text-right">{formatMoney(order.total_amount)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="py-2 px-3 text-right text-gray-500">Phí vỏ/két:</td>
              <td className="py-2 px-3 text-right">{formatMoney(order.deposit_amount)}</td>
            </tr>
            <tr className="font-semibold text-lg">
              <td colSpan={5} className="py-3 px-3 text-right">Tổng cộng:</td>
              <td className="py-3 px-3 text-right text-amber-700">{formatMoney(order.grand_total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {['confirmed', 'pending_approval', 'draft'].includes(order.status) && (
          <Link
            href={`/dashboard/orders/${order.id}/edit`}
            className="px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
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
        {['confirmed', 'pending_approval', 'draft'].includes(order.status) && (
          <button
            onClick={() => handleAction('cancel')}
            className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            ❌ Hủy đơn hàng
          </button>
        )}
      </div>
    </div>
  )
}
