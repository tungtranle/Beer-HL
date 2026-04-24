'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiFetch, getUser } from '@/lib/api'
import { orderStatusLabels, orderStatusColors, formatVND } from '@/lib/status-config'
import { StatusChip } from '@/components/ui/StatusChip'
import { Pagination } from '@/components/ui/Pagination'
import { toast } from '@/lib/useToast'
import { handleError } from '@/lib/handleError'
import { useDataRefresh } from '@/lib/notifications'

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
  is_urgent?: boolean
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

type ViewTab = 'all' | 'exceptions' | 'redelivery'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<ControlDeskStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const searchParams = useSearchParams()
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [deliveryDate, setDeliveryDate] = useState(searchParams.get('delivery_date') || '')
  const [cutoffGroup, setCutoffGroup] = useState(searchParams.get('cutoff_group') || '')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [totalRows, setTotalRows] = useState(0)
  const [viewTab, setViewTab] = useState<ViewTab>('all')
  const [sidebarCustomer, setSidebarCustomer] = useState<any>(null)
  const [sidebarOrders, setSidebarOrders] = useState<Order[]>([])
  const [sidebarLoading, setSidebarLoading] = useState(false)
  const [sidebarHealth, setSidebarHealth] = useState<any>(null)
  const [sidebarForecast, setSidebarForecast] = useState<any[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const currentUser = getUser()

  const handleExport = async () => {
    try {
      const res = await fetch('/api/orders/export', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('bhl_token')}` },
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `don-hang-${new Date().toISOString().slice(0,10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Đã tải xuống file Excel')
    } catch (err: any) {
      toast.error('Lỗi xuất Excel: ' + err.message)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/orders/import/template', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('bhl_token')}` },
      })
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mau-import-don-hang.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast.error('Lỗi tải mẫu: ' + err.message)
    }
  }

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const res = await fetch('/api/orders/import', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('bhl_token')}` },
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Import failed')
      setImportResult(json.data)
      if (json.data.error_count === 0) {
        toast.success(`Đã import thành công ${json.data.success_count} đơn hàng`)
      } else {
        toast.error(`Import: ${json.data.success_count} thành công, ${json.data.error_count} lỗi`)
      }
      loadOrders()
      loadStats()
    } catch (err: any) {
      toast.error('Lỗi import: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  const loadStats = async () => {
    try {
      const res: any = await apiFetch('/orders/control-desk/stats')
      setStats(res.data)
    } catch (err) {
      handleError(err, { userMessage: 'Không tải được thống kê đơn hàng' })
    }
  }

  // Auto-refresh when order status changes via WebSocket
  useDataRefresh('order', () => { loadOrders(); loadStats() })

  const loadOrders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (deliveryDate) params.set('delivery_date', deliveryDate)
      if (cutoffGroup) params.set('cutoff_group', cutoffGroup)
      params.set('page', String(page))
      params.set('limit', String(limit))
      const res: any = await apiFetch(`/orders?${params}`)
      setOrders(res.data || [])
      setTotalRows(res.meta?.total ?? (res.data?.length || 0))
    } catch (err) {
      handleError(err, { userMessage: 'Không tải được danh sách đơn' })
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
      handleError(err, { userMessage: 'Tìm kiếm đơn hàng thất bại' })
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
  }, [statusFilter, deliveryDate, cutoffGroup, page, limit])

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1)
  }, [statusFilter, deliveryDate, cutoffGroup])

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
    setSidebarHealth(null)
    setSidebarForecast([])
    try {
      const [custRes, ordersRes]: any[] = await Promise.all([
        apiFetch(`/customers/${customerId}`),
        apiFetch(`/orders?customer_id=${customerId}&limit=20`),
      ])
      setSidebarCustomer(custRes.data)
      setSidebarOrders(ordersRes.data || [])
      // F2: NPP Health Score (graceful fail — available after ML service launch)
      apiFetch<any>(`/customers/${customerId}/health`)
        .then((r: any) => setSidebarHealth(r.data))
        .catch(() => {})
      // F1: Demand Intelligence forecast (graceful fail — available after Demand ML)
      apiFetch<any>(`/customers/${customerId}/forecast`)
        .then((r: any) => setSidebarForecast(r.data || []))
        .catch(() => {})
    } catch (err) { handleError(err, { userMessage: 'Không tải được chi tiết NPP' }) }
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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Quản lý đơn hàng</h1>
          <button onClick={() => { loadOrders(); loadStats() }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition" title="Làm mới">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
            title="Xuất Excel"
          >
            📥 Xuất Excel
          </button>
          <button
            onClick={() => { setShowImportModal(true); setImportFile(null); setImportResult(null) }}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
            title="Import đơn từ Excel"
          >
            📤 Import Excel
          </button>
          <Link
            href="/dashboard/orders/new"
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition text-sm font-medium"
          >
            ➕ Tạo đơn hàng mới
          </Link>
        </div>
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

        {/* Advanced Filters: delivery date + cutoff group */}
        {!isSearching && (
          <div className="flex gap-2 flex-wrap items-center text-xs">
            <label className="flex items-center gap-1 text-gray-600">
              Ngày giao
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="border border-gray-200 rounded px-2 py-1 text-xs"
              />
            </label>
            <label className="flex items-center gap-1 text-gray-600">
              Cut-off
              <select
                value={cutoffGroup}
                onChange={(e) => setCutoffGroup(e.target.value)}
                className="border border-gray-200 rounded px-2 py-1 text-xs bg-white"
              >
                <option value="">Tất cả</option>
                <option value="before_16h">Trước 16h (giao trong ngày)</option>
                <option value="after_16h">Sau 16h (giao T+1)</option>
              </select>
            </label>
            {(deliveryDate || cutoffGroup) && (
              <button
                onClick={() => { setDeliveryDate(''); setCutoffGroup('') }}
                className="text-brand-600 hover:underline"
              >
                Xóa lọc
              </button>
            )}
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
              <th className="text-left py-3 px-3">Xe / Tài xế</th>
              <th className="text-center py-3 px-3">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  Đang tải...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center">
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
                    <div className="flex items-center gap-1">
                      {order.is_urgent && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700" title="Giao gấp">⚡ Gấp</span>
                      )}
                      <Link href={`/dashboard/orders/${order.id}`} className="font-mono text-xs text-blue-600 hover:underline">
                        {order.order_number}
                      </Link>
                    </div>
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
                    <StatusChip status={order.status} role={currentUser?.role} />
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

        {/* Footer: pagination */}
        {!loading && totalRows > 0 && !isSearching && (
          <Pagination
            page={page}
            limit={limit}
            total={totalRows}
            onPageChange={setPage}
            onLimitChange={(n) => { setLimit(n); setPage(1) }}
            className="border-t bg-gray-50"
          />
        )}
        {/* When searching, just show simple count */}
        {!loading && filteredOrders.length > 0 && isSearching && (
          <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-t">
            Hiển thị {filteredOrders.length} kết quả tìm kiếm
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
                {/* Customer info + Health Score hero */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xl font-bold">{sidebarCustomer.name}</div>
                      <div className="text-sm text-gray-500">{sidebarCustomer.code}</div>
                    </div>
                    {/* F2: NPP Health Score badge */}
                    {sidebarHealth ? (
                      <div className={`flex flex-col items-center px-3 py-1.5 rounded-xl border ${
                        sidebarHealth.score >= 70 ? 'bg-emerald-50 border-emerald-200' :
                        sidebarHealth.score >= 40 ? 'bg-amber-50 border-amber-200' :
                        'bg-red-50 border-red-200'
                      }`}>
                        <span className={`text-xl font-bold leading-none ${
                          sidebarHealth.score >= 70 ? 'text-emerald-700' :
                          sidebarHealth.score >= 40 ? 'text-amber-700' : 'text-red-700'
                        }`}>{sidebarHealth.score}</span>
                        <span className="text-[9px] font-semibold uppercase tracking-wide mt-0.5 text-gray-500">Health</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center px-3 py-1.5 rounded-xl border border-dashed border-gray-200 bg-gray-50">
                        <span className="text-xl leading-none text-gray-300">—</span>
                        <span className="text-[9px] font-semibold uppercase tracking-wide mt-0.5 text-gray-400">Score</span>
                      </div>
                    )}
                  </div>
                  {sidebarCustomer.phone && <div className="text-sm">📞 {sidebarCustomer.phone}</div>}
                  {sidebarCustomer.address && <div className="text-sm text-gray-600">📍 {sidebarCustomer.address}</div>}
                </div>

                {/* F2: Churn risk detail */}
                {sidebarHealth && sidebarHealth.score < 40 && (
                  <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <span className="text-base">🚨</span>
                    <div>
                      <p className="font-semibold">Nguy cơ rời bỏ cao</p>
                      <p className="text-red-500">{sidebarHealth.recency_days ? `Im lặng ${sidebarHealth.recency_days} ngày — ` : ''}Điểm giảm {sidebarHealth.score_drop_7d || 0} trong 7 ngày</p>
                    </div>
                  </div>
                )}
                {sidebarHealth && sidebarHealth.score >= 40 && sidebarHealth.score < 70 && (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <span className="text-base">⚠️</span>
                    <p>NPP cần theo dõi — hoạt động giảm so với trung bình</p>
                  </div>
                )}
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

                {/* F1: Demand Intelligence */}
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                      <span>🔮</span> Dự báo nhu cầu tuần tới
                    </div>
                    {sidebarForecast.length === 0 && (
                      <span className="text-[10px] text-blue-400 bg-blue-100 px-1.5 py-0.5 rounded-full">Sắp ra mắt</span>
                    )}
                  </div>
                  {sidebarForecast.length > 0 ? (
                    <div className="divide-y divide-gray-50">
                      {sidebarForecast.map((item: any) => (
                        <div key={item.sku_id} className="flex items-center justify-between px-3 py-2">
                          <span className="text-xs text-gray-700 truncate flex-1 pr-2">{item.sku_name}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs font-bold text-brand-600">~{item.predicted_qty} {item.unit}</span>
                            {item.delta_pct !== undefined && (
                              <span className={`text-[10px] font-semibold px-1 rounded ${
                                item.delta_pct > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'
                              }`}>
                                {item.delta_pct > 0 ? '↑' : '↓'}{Math.abs(item.delta_pct)}%
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-4 text-center text-xs text-gray-400 space-y-1">
                      <p>Demand AI đang học từ lịch sử đơn hàng</p>
                      <p className="text-[10px] text-gray-300">Sẽ hiển thị sau khi module AI Demand khởi động</p>
                    </div>
                  )}
                </div>

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

      {/* Import Excel Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowImportModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">📤 Import đơn hàng từ Excel</h2>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="space-y-4">
              {/* Template download */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700 mb-2">Tải file mẫu để biết đúng định dạng import:</p>
                <button
                  onClick={handleDownloadTemplate}
                  className="text-sm text-blue-600 hover:underline font-medium"
                >
                  📄 Tải file mẫu (.xlsx)
                </button>
              </div>

              {/* File upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chọn file Excel</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-500 file:text-white hover:file:bg-brand-600"
                />
              </div>

              {/* Import result */}
              {importResult && (
                <div className={`rounded-lg p-3 text-sm ${importResult.error_count > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  <p className="font-medium mb-1">
                    Kết quả: {importResult.success_count}/{importResult.total_rows} dòng thành công
                  </p>
                  {importResult.errors?.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                      {importResult.errors.map((err: any, i: number) => (
                        <p key={i} className="text-xs text-red-600">
                          Dòng {err.row}, cột &quot;{err.column}&quot;: {err.message}
                          {err.value && <span className="text-gray-500"> (giá trị: {err.value})</span>}
                        </p>
                      ))}
                    </div>
                  )}
                  {importResult.orders?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-green-700 font-medium">Đơn đã tạo:</p>
                      {importResult.orders.map((o: any, i: number) => (
                        <p key={i} className="text-xs text-green-600">{o.order_number} — {o.customer_code}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Đóng
                </button>
                <button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                  className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? 'Đang import...' : '📤 Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
