'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api'

interface Order {
  id: string
  order_number: string
  customer_name: string
  status: string
  delivery_date: string
  total_amount: number
  atp_status: string
  credit_status: string
  created_at: string
}

const statusColors: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  draft: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
  approved: 'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
}

const statusLabels: Record<string, string> = {
  confirmed: 'Đã xác nhận',
  pending_approval: 'Chờ duyệt',
  draft: 'Nháp',
  cancelled: 'Đã hủy',
  approved: 'Đã duyệt',
  processing: 'Đang xử lý',
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')

  const loadOrders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('limit', '50')
      const res: any = await apiFetch(`/orders?${params}`)
      setOrders(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [statusFilter])

  const handleApprove = async (orderId: string) => {
    try {
      await apiFetch(`/orders/${orderId}/approve`, { method: 'POST' })
      loadOrders()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleCancel = async (orderId: string) => {
    if (!confirm('Bạn có chắc muốn hủy đơn hàng này?')) return
    try {
      await apiFetch(`/orders/${orderId}/cancel`, { method: 'POST' })
      loadOrders()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Đơn hàng</h1>
        <Link
          href="/dashboard/orders/new"
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm"
        >
          ➕ Tạo đơn hàng mới
        </Link>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex gap-2">
          {['', 'confirmed', 'pending_approval', 'cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${
                statusFilter === s
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === '' ? 'Tất cả' : statusLabels[s] || s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left py-3 px-4">Số đơn</th>
              <th className="text-left py-3 px-4">Khách hàng</th>
              <th className="text-left py-3 px-4">Ngày giao</th>
              <th className="text-right py-3 px-4">Tổng tiền</th>
              <th className="text-center py-3 px-4">Trạng thái</th>
              <th className="text-center py-3 px-4">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">
                  Đang tải...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">
                  Chưa có đơn hàng nào
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-xs">{order.order_number}</td>
                  <td className="py-3 px-4">{order.customer_name}</td>
                  <td className="py-3 px-4">{order.delivery_date}</td>
                  <td className="py-3 px-4 text-right">{formatMoney(order.total_amount)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${statusColors[order.status] || 'bg-gray-100'}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center space-x-2">
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Chi tiết
                    </Link>
                    {['draft', 'confirmed', 'pending_approval'].includes(order.status) && (
                      <Link
                        href={`/dashboard/orders/${order.id}/edit`}
                        className="text-amber-600 hover:underline text-xs"
                      >
                        Sửa
                      </Link>
                    )}
                    {order.status === 'pending_approval' && (
                      <button
                        onClick={() => handleApprove(order.id)}
                        className="text-green-600 hover:underline text-xs"
                      >
                        Duyệt
                      </button>
                    )}
                    {['draft', 'confirmed', 'pending_approval'].includes(order.status) && (
                      <button
                        onClick={() => handleCancel(order.id)}
                        className="text-red-600 hover:underline text-xs"
                      >
                        Hủy
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
