'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { orderStatusLabels, orderStatusColors, zaloStatusLabels, zaloStatusColors, formatVND } from '@/lib/status-config'
import { StatusChip } from '@/components/ui/StatusChip'
import { toast } from '@/lib/useToast'

interface Order {
  id: string
  order_number: string
  customer_id: string
  customer_name: string
  customer_phone?: string
  status: string
  delivery_date: string
  total_amount: number
  atp_status: string
  credit_status: string
  created_at: string
  reject_reason?: string
  zalo_status?: string
  trip_id?: string
  vehicle_plate?: string
  driver_name?: string
}

interface ControlDeskStats {
  draft: number
  pending_customer_confirm: number
  pending_approval: number
  confirmed: number
  shipment_created: number
  in_transit: number
  delivering: number
  delivered: number
  partially_delivered: number
  failed: number
  cancelled: number
  rejected: number
  on_credit: number
  total: number
}

// Status labels and colors imported from @/lib/status-config
const statusColors = orderStatusColors
const statusLabels = orderStatusLabels
const zaloLabels = zaloStatusLabels
const zaloColors = zaloStatusColors

type ViewTab = 'all' | 'exceptions' | 'redelivery'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<ControlDeskStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const searchParams = useSearchParams()
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [viewTab, setViewTab] = useState<ViewTab>('all')
  const [sidebarCustomer, setSidebarCustomer] = useState<any>(null)
  const [sidebarOrders, setSidebarOrders] = useState<Order[]>([])
  const [sidebarLoading, setSidebarLoading] = useState(false)

  const loadStats = async () => {
    try {
      const res: any = await apiFetch('/orders/control-desk/stats')
      setStats(res.data)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }

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

  const searchOrders = useCallback(async (q: string) => {
    if (q.length < 2) return
    setIsSearching(true)
    setLoading(true)
    try {
      const res: any = await apiFetch(`/orders/search?q=${encodeURIComponent(q)}&limit=50`)
      setOrders(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [])

  useEffect(() => {
    if (!isSearching) {
      loadOrders()
    }
  }, [statusFilter])

  useEffect(() => {
    if (!searchQuery) {
      setIsSearching(false)
      loadOrders()
      return
    }
    const timer = setTimeout(() => searchOrders(searchQuery), 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const openCustomerSidebar = async (customerId: string) => {
    setSidebarLoading(true)
    setSidebarCustomer(null)
    try {
      const [custRes, ordersRes]: any[] = await Promise.all([
        apiFetch(`/customers/${customerId}`),
        apiFetch(`/orders?customer_id=${customerId}&limit=20`),
      ])
      setSidebarCustomer(custRes.data)
      setSidebarOrders(ordersRes.data || [])
    } catch (err) { console.error(err) }
    finally { setSidebarLoading(false) }
  }

  const handleApprove = async (orderId: string) => {
    try {
      await apiFetch(`/orders/${orderId}/approve`, { method: 'POST' })
      toast.success('Đã duyệt đơn hàng')
      loadOrders()
      loadStats()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleCancel = async (orderId: string) => {
    if (!confirm('Bạn có chắc muốn hủy đơn hàng này?')) return
    try {
      await apiFetch(`/orders/${orderId}/cancel`, { method: 'POST' })
      toast.success('Đã hủy đơn hàng')
      loadOrders()
      loadStats()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleCardClick = (statuses: string[]) => {
    setSearchQuery('')
    setIsSearching(false)
    setStatusFilter(statuses.length === 1 ? statuses[0] : '')
    setViewTab('all')
  }

  // Derived stats for 7 summary cards
  const inDelivery = stats ? stats.confirmed + stats.shipment_created + stats.in_transit + stats.delivering : 0
  const issues = stats ? stats.failed + stats.rejected + stats.partially_delivered : 0

  const summaryCards = stats ? [
    { label: 'Mới', count: stats.draft, color: 'border-gray-300 bg-gray-50', textColor: 'text-gray-700', icon: '📝', statuses: ['draft'] },
    { label: 'Chờ KH', count: stats.pending_customer_confirm, color: 'border-amber-300 bg-amber-50', textColor: 'text-amber-700', icon: '⏳', statuses: ['pending_customer_confirm'] },
    { label: 'Chờ duyệt', count: stats.pending_approval, color: 'border-yellow-300 bg-yellow-50', textColor: 'text-yellow-700', icon: '🔑', statuses: ['pending_approval'] },
    { label: 'Đang giao', count: inDelivery, color: 'border-blue-300 bg-blue-50', textColor: 'text-blue-700', icon: '🚛', statuses: ['confirmed', 'shipment_created', 'in_transit', 'delivering'] },
    { label: 'Đã giao', count: stats.delivered, color: 'border-green-300 bg-green-50', textColor: 'text-green-700', icon: '✅', statuses: ['delivered'] },
    { label: 'Có vấn đề', count: issues, color: 'border-red-300 bg-red-50', textColor: 'text-red-700', icon: '⚠️', statuses: ['failed', 'rejected', 'partially_delivered'] },
    { label: 'Hủy/Nợ', count: stats.cancelled + stats.on_credit, color: 'border-gray-300 bg-gray-50', textColor: 'text-gray-500', icon: '🚫', statuses: ['cancelled', 'on_credit'] },
  ] : []

  // Filter orders by view tab
  const filteredOrders = orders.filter(o => {
    if (viewTab === 'exceptions') return ['failed', 'rejected', 'partially_delivered'].includes(o.status)
    if (viewTab === 'redelivery') return o.status === 'confirmed' && o.order_number.includes('-')  // re-delivery orders
    return true
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý đơn hàng</h1>
        <Link
          href="/dashboard/orders/new"
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition text-sm font-medium"
        >
          ➕ Tạo đơn hàng mới
        </Link>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-7 gap-3 mb-4">
          {summaryCards.map((card) => (
            <button
              key={card.label}
              onClick={() => handleCardClick(card.statuses)}
              className={`border rounded-xl p-3 text-left transition hover:shadow-md ${card.color}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-lg">{card.icon}</span>
                <span className={`text-2xl font-bold ${card.textColor}`}>{card.count}</span>
              </div>
              <p className={`text-xs font-medium ${card.textColor}`}>{card.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Search + Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Tìm kiếm: tên KH, SĐT, mã đơn, biển số xe..."
            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-sm"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        {!isSearching && (
          <div className="flex gap-2 flex-wrap">
            {['', 'draft', 'pending_customer_confirm', 'confirmed', 'pending_approval', 'in_transit', 'delivered', 'cancelled'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs rounded-lg transition ${
                  statusFilter === s
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === '' ? 'Tất cả' : statusLabels[s] || s}
              </button>
            ))}
          </div>
        )}

        {/* View Tabs: All / Exceptions / Re-delivery */}
        <div className="flex gap-1 border-b border-gray-100">
          {([
            { key: 'all', label: 'Tất cả' },
            { key: 'exceptions', label: '⚠️ Ngoại lệ' },
            { key: 'redelivery', label: '🔄 Giao lại' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewTab(tab.key)}
              className={`px-4 py-2 text-xs font-medium transition border-b-2 -mb-px ${
                viewTab === tab.key
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table — Enriched */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left py-3 px-3">Số đơn</th>
              <th className="text-left py-3 px-3">Khách hàng</th>
              <th className="text-left py-3 px-3">Ngày giao</th>
              <th className="text-right py-3 px-3">Tổng tiền</th>
              <th className="text-center py-3 px-3">Trạng thái</th>
              <th className="text-center py-3 px-3">Zalo</th>
              <th className="text-left py-3 px-3">Xe / Tài xế</th>
              <th className="text-center py-3 px-3">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-400">
                  Đang tải...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center">
                  <p className="text-gray-400 mb-2">
                    {viewTab === 'exceptions' ? '✅ Không có đơn ngoại lệ nào — tất cả đơn đang xử lý bình thường' :
                     viewTab === 'redelivery' ? '✅ Không có đơn giao bổ sung nào' :
                     isSearching ? `Không tìm thấy kết quả cho "${searchQuery}"` :
                     'Chưa có đơn hàng nào — tạo đơn mới từ nút "+ Tạo đơn" phía trên'}
                  </p>
                  {viewTab !== 'all' && (
                    <button onClick={() => setViewTab('all')} className="text-brand-500 text-xs hover:underline">
                      Xem tất cả đơn hàng
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="py-3 px-3">
                    <Link href={`/dashboard/orders/${order.id}`} className="font-mono text-xs text-blue-600 hover:underline">
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="py-3 px-3">
                    <button onClick={() => openCustomerSidebar(order.customer_id)}
                      className="text-sm text-blue-600 hover:underline text-left">{order.customer_name}</button>
                    {order.customer_phone && (
                      <div className="text-xs text-gray-400">{order.customer_phone}</div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-xs">{order.delivery_date}</td>
                  <td className="py-3 px-3 text-right text-xs font-medium">{formatVND(order.total_amount)}</td>
                  <td className="py-3 px-3 text-center">
                    <StatusChip status={order.status} />
                  </td>
                  <td className="py-3 px-3 text-center">
                    {order.zalo_status ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${zaloColors[order.zalo_status] || 'bg-gray-100 text-gray-500'}`}>
                        {zaloLabels[order.zalo_status] || order.zalo_status}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {order.vehicle_plate || order.driver_name ? (
                      <div>
                        {order.vehicle_plate && <div className="text-xs font-mono">{order.vehicle_plate}</div>}
                        {order.driver_name && <div className="text-xs text-gray-500">{order.driver_name}</div>}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center space-x-1">
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Chi tiết
                    </Link>
                    {['draft', 'confirmed', 'pending_approval'].includes(order.status) && (
                      <Link
                        href={`/dashboard/orders/${order.id}/edit`}
                        className="text-brand-600 hover:underline text-xs"
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

        {/* Footer count */}
        {!loading && filteredOrders.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-t">
            Hiển thị {filteredOrders.length} đơn hàng
            {stats && <span className="ml-2">• Tổng: {stats.total}</span>}
          </div>
        )}
      </div>

      {/* Customer Context Sidebar (slide-in) */}
      {(sidebarCustomer || sidebarLoading) && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => { setSidebarCustomer(null); setSidebarLoading(false) }} />
          <div className="relative w-96 bg-white shadow-xl overflow-y-auto animate-slide-in-right">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10">
              <h3 className="font-bold text-lg">🏪 Thông tin khách hàng</h3>
              <button onClick={() => { setSidebarCustomer(null); setSidebarLoading(false) }} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            {sidebarLoading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
              </div>
            ) : sidebarCustomer && (
              <div className="p-4 space-y-4">
                {/* Customer info */}
                <div className="space-y-2">
                  <div className="text-xl font-bold">{sidebarCustomer.name}</div>
                  <div className="text-sm text-gray-500">{sidebarCustomer.code}</div>
                  {sidebarCustomer.phone && <div className="text-sm">📞 {sidebarCustomer.phone}</div>}
                  {sidebarCustomer.address && <div className="text-sm text-gray-600">📍 {sidebarCustomer.address}</div>}
                </div>

                {/* Credit info */}
                {sidebarCustomer.credit_limit != null && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <h4 className="text-sm font-medium">💰 Hạn mức tín dụng</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Hạn mức</span>
                      <span className="font-medium">{formatVND(sidebarCustomer.credit_limit)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Đã dùng</span>
                      <span className="font-medium text-red-600">{formatVND(sidebarCustomer.current_balance || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Còn lại</span>
                      <span className="font-medium text-green-600">
                        {formatVND((sidebarCustomer.credit_limit || 0) - (sidebarCustomer.current_balance || 0))}
                      </span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className={`h-full ${(sidebarCustomer.current_balance / sidebarCustomer.credit_limit) > 0.8 ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(100, (sidebarCustomer.current_balance || 0) / Math.max(sidebarCustomer.credit_limit, 1) * 100)}%` }} />
                    </div>
                  </div>
                )}

                {/* Order history */}
                <div>
                  <h4 className="text-sm font-medium mb-2">📋 Đơn hàng gần đây ({sidebarOrders.length})</h4>
                  {sidebarOrders.length === 0 ? (
                    <p className="text-sm text-gray-400">Chưa có đơn hàng nào</p>
                  ) : (
                    <div className="space-y-2">
                      {sidebarOrders.map(o => (
                        <Link key={o.id} href={`/dashboard/orders/${o.id}`}
                          className="block bg-gray-50 rounded-lg p-2 hover:bg-gray-100 transition">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-mono text-blue-600">{o.order_number}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs ${statusColors[o.status] || 'bg-gray-100'}`}>
                              {statusLabels[o.status] || o.status}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>{o.delivery_date}</span>
                            <span>{formatVND(o.total_amount)}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
