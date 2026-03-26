'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'
import { useDataRefresh } from '@/lib/notifications'

// ── Types ──────────────────────────────────────────

interface VehicleOrderItem {
  product_id: string; product_name: string; product_sku: string
  lot_id: string; batch_number: string; expiry_date: string
  location_id: string; qty: number; picked_qty: number
}

interface VehiclePickingItem {
  product_id: string; product_name: string; product_sku: string
  total_qty: number; picked_qty: number
  fefo_lot: string; expiry_date: string
}

interface VehiclePickingOrder {
  order_number: string; customer_name: string
  stop_order: number; amount: number; pick_status: string
  picking_order_id: string; items: VehicleOrderItem[]
}

interface VehiclePickingProgress {
  total_items: number; picked_items: number; percentage: number
}

interface VehicleWorkbench {
  trip_id: string; trip_number: string
  vehicle_plate: string; driver_name: string
  departure_time: string; planned_date: string; total_stops: number; status: string
  handover_status: string // '', 'pending', 'partially_signed', 'completed'
  picking_items: VehiclePickingItem[]
  orders: VehiclePickingOrder[]
  progress: VehiclePickingProgress
}

// ── Helpers ──────────────────────────────────────────

function daysUntilExpiry(expiryDate: string): number {
  if (!expiryDate) return 999
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫'
}

const pickStatusConfig: Record<string, { label: string; color: string; icon: string }> = {
  completed: { label: 'Đã soạn', color: 'bg-green-100 text-green-800', icon: '✅' },
  in_progress: { label: 'Đang soạn', color: 'bg-blue-100 text-blue-800', icon: '🔄' },
  pending: { label: 'Chờ soạn', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
}

const progressColor = (pct: number) =>
  pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-yellow-500'

// ── Filter ──────────────────────────────────────────

type FilterType = 'all' | 'pending' | 'in_progress' | 'completed'

function matchFilter(wb: VehicleWorkbench, filter: FilterType): boolean {
  if (filter === 'all') return true
  if (filter === 'completed') return wb.progress.percentage >= 100
  if (filter === 'pending') return wb.progress.percentage === 0
  return wb.progress.percentage > 0 && wb.progress.percentage < 100
}

// ── Main Page ──────────────────────────────────────────

export default function PickingByVehiclePage() {
  const [vehicles, setVehicles] = useState<VehicleWorkbench[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [confirmingOrder, setConfirmingOrder] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [dateStr, setDateStr] = useState('')

  const loadData = async (date?: string) => {
    setLoading(true)
    try {
      const params = date ? `?date=${date}` : ''
      const res: any = await apiFetch(`/warehouse/picking-by-vehicle${params}`)
      setVehicles(res.data || [])
    } catch (err: any) {
      toast.error(`Lỗi tải dữ liệu: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // Auto-refresh when order/picking status changes via WebSocket
  useDataRefresh('order', () => loadData(dateStr || undefined))

  const confirmPick = async (order: VehiclePickingOrder) => {
    if (!order.picking_order_id) {
      toast.error('Không tìm thấy lệnh đóng hàng cho đơn này')
      return
    }
    setConfirmingOrder(order.picking_order_id)
    try {
      const items = (order.items || []).map(item => ({
        product_id: item.product_id,
        lot_id: item.lot_id,
        location_id: item.location_id,
        picked_qty: item.qty,
      }))
      await apiFetch('/warehouse/confirm-pick', {
        method: 'POST',
        body: { picking_order_id: order.picking_order_id, items },
      })
      toast.success(`Đã soạn xong đơn ${order.order_number}`)
      await loadData(dateStr || undefined)
    } catch (err: any) {
      toast.error('Lỗi xác nhận: ' + err.message)
    } finally {
      setConfirmingOrder(null)
    }
  }

  const filtered = vehicles.filter(v => matchFilter(v, filter))
  const totalVehicles = vehicles.length
  const readyForGate = vehicles.filter(v => v.progress.percentage >= 100).length
  const totalOrders = vehicles.reduce((s, v) => s + (v.orders?.length || 0), 0)
  const avgProgress = totalVehicles > 0
    ? Math.round(vehicles.reduce((s, v) => s + v.progress.percentage, 0) / totalVehicles)
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-[#F68634] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📦 Soạn hàng theo xe</h1>
          <p className="text-base text-gray-500">Chọn xe → xem từng đơn → soạn &amp; xác nhận ngay tại đây</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={dateStr}
            onChange={e => { setDateStr(e.target.value); loadData(e.target.value) }}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => loadData(dateStr || undefined)}
            className="bg-[#F68634] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition"
          >
            🔄 Làm mới
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tổng xe</div>
          <div className="text-2xl font-bold text-blue-700">{totalVehicles}</div>
          <div className="text-xs text-gray-400">chuyến đang hoạt động</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-amber-500">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tổng đơn</div>
          <div className="text-2xl font-bold text-amber-700">{totalOrders}</div>
          <div className="text-xs text-gray-400">đơn cần soạn</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Sẵn sàng giao</div>
          <div className="text-2xl font-bold text-green-700">{readyForGate}</div>
          <div className="text-xs text-gray-400">xe đã soạn xong</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-purple-500">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tiến độ chung</div>
          <div className="text-2xl font-bold text-purple-700">{avgProgress}%</div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div className={`h-2 rounded-full transition-all ${progressColor(avgProgress)}`} style={{ width: `${avgProgress}%` }} />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {([
          ['all', 'Tất cả', vehicles.length],
          ['pending', 'Chưa soạn', vehicles.filter(v => v.progress.percentage === 0).length],
          ['in_progress', 'Đang soạn', vehicles.filter(v => v.progress.percentage > 0 && v.progress.percentage < 100).length],
          ['completed', 'Đã xong', vehicles.filter(v => v.progress.percentage >= 100).length],
        ] as [FilterType, string, number][]).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === key
                ? 'bg-[#F68634] text-white shadow'
                : 'bg-white text-gray-600 hover:bg-gray-50 border'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Vehicle List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-400 text-lg">Không có xe nào cần soạn hàng</p>
          <p className="text-gray-300 text-sm mt-1">Chuyến xe sẽ xuất hiện sau khi điều phối duyệt kế hoạch giao hàng</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(wb => {
            const isExpanded = expandedTrip === wb.trip_id
            const pct = wb.progress.percentage
            const isReady = pct >= 100
            const hasHandover = !!wb.handover_status
            const handoverDone = wb.handover_status === 'completed'
            const pendingOrders = (wb.orders || []).filter(o => o.pick_status !== 'completed')
            const completedOrders = (wb.orders || []).filter(o => o.pick_status === 'completed')

            return (
              <div key={wb.trip_id} className={`bg-white rounded-xl shadow-sm border-2 transition ${hasHandover ? 'border-blue-400' : isReady ? 'border-green-400' : 'border-gray-200'}`}>
                {/* Vehicle Header */}
                <div
                  className="p-5 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => { setExpandedTrip(isExpanded ? null : wb.trip_id); setExpandedOrder(null) }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{hasHandover ? '📋' : isReady ? '✅' : '🚛'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-gray-800">{wb.vehicle_plate || 'Chưa gán xe'}</span>
                          <span className="text-gray-400">·</span>
                          <span className="text-sm text-gray-500">{wb.trip_number}</span>
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5">
                          {wb.driver_name || 'Chưa gán tài xế'} · {wb.total_stops} điểm giao · {(wb.orders || []).length} đơn
                          {wb.planned_date && <span className="text-blue-600 font-medium"> · Ngày: {wb.planned_date}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        {hasHandover ? (
                          <div className="text-sm font-bold text-blue-600">
                            📋 {handoverDone ? 'ĐÃ BÀN GIAO' : wb.handover_status === 'partially_signed' ? 'ĐANG KÝ BÀN GIAO' : 'CHỜ BÀN GIAO'}
                          </div>
                        ) : isReady ? (
                          <div className="text-sm font-bold text-green-600">✅ SẴN SÀNG BÀN GIAO</div>
                        ) : (
                          <div className="text-sm font-semibold text-gray-600">
                            {completedOrders.length}/{(wb.orders || []).length} đơn · {pct}%
                          </div>
                        )}
                        <div className="w-36 bg-gray-200 rounded-full h-2.5 mt-1">
                          <div className={`h-2.5 rounded-full transition-all ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-gray-400 text-xl">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </div>

                {/* Expanded — Per-Order Picking */}
                {isExpanded && (
                  <div className="border-t">
                    {/* Aggregated Summary */}
                    {wb.picking_items && wb.picking_items.length > 0 && (
                      <div className="px-5 pt-4 pb-2">
                        <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                          Tổng hợp hàng cần soạn cho xe
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {wb.picking_items.map((item, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-1.5 text-sm">
                              <span className="font-medium text-gray-700">{item.product_name}</span>
                              <span className="text-gray-400">×</span>
                              <span className={`font-bold ${item.picked_qty >= item.total_qty ? 'text-green-600' : 'text-gray-800'}`}>
                                {item.picked_qty}/{item.total_qty}
                              </span>
                              {daysUntilExpiry(item.expiry_date) <= 7 && (
                                <span className="bg-[#F68634] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">FEFO</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Orders List — main picking area */}
                    <div className="px-5 pb-5">
                      <h3 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide mt-3">
                        Soạn từng đơn ({pendingOrders.length} chờ · {completedOrders.length} xong)
                      </h3>
                      <div className="space-y-3">
                        {/* Pending orders first */}
                        {pendingOrders.map((order, idx) => {
                          const isOrderExpanded = expandedOrder === `${wb.trip_id}-${order.stop_order}`
                          const orderKey = `${wb.trip_id}-${order.stop_order}`
                          const cfg = pickStatusConfig[order.pick_status] || pickStatusConfig.pending
                          const sortedItems = [...(order.items || [])].sort(
                            (a, b) => daysUntilExpiry(a.expiry_date) - daysUntilExpiry(b.expiry_date)
                          )
                          const isConfirming = confirmingOrder === order.picking_order_id

                          return (
                            <div key={orderKey} className={`rounded-xl border-2 transition ${
                              idx === 0 ? 'border-[#F68634] ring-1 ring-orange-100' : 'border-gray-200'
                            }`}>
                              {/* Order header */}
                              <button
                                onClick={() => setExpandedOrder(isOrderExpanded ? null : orderKey)}
                                className="w-full text-left p-4 hover:bg-gray-50 transition"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-full bg-[#F68634] text-white text-sm flex items-center justify-center font-bold shrink-0">
                                      {order.stop_order}
                                    </span>
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {idx === 0 && (
                                          <span className="bg-[#F68634] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                                            SOẠN TRƯỚC
                                          </span>
                                        )}
                                        <span className="font-bold text-gray-800">{order.order_number}</span>
                                      </div>
                                      <div className="text-sm text-gray-500">{order.customer_name}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm text-gray-500">{formatVND(order.amount)}</span>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                                      {cfg.icon} {cfg.label}
                                    </span>
                                    <span className="text-gray-400">{isOrderExpanded ? '▲' : '▼'}</span>
                                  </div>
                                </div>
                              </button>

                              {/* Order items — FEFO sorted */}
                              {isOrderExpanded && (
                                <div className="border-t px-4 pb-4">
                                  <div className="mt-3 space-y-2">
                                    {sortedItems.map((item, itemIdx) => {
                                      const days = daysUntilExpiry(item.expiry_date)
                                      const isUrgent = days <= 7
                                      const isNearExpiry = days <= 30
                                      const isDone = item.picked_qty >= item.qty

                                      return (
                                        <div key={`${item.product_id}-${item.lot_id}`} className={`rounded-lg p-3 border ${
                                          isDone ? 'bg-green-50 border-green-200' : isUrgent ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                                        }`}>
                                          <div className="flex justify-between items-start">
                                            <div>
                                              <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-800">{item.product_name}</span>
                                                <span className="text-xs text-gray-400 font-mono">{item.product_sku}</span>
                                              </div>
                                              <div className="flex items-center gap-3 mt-1 text-sm">
                                                <span className="text-gray-500">Lô: <span className="font-medium">{item.batch_number || '—'}</span></span>
                                                <span className={`${isUrgent ? 'text-red-600 font-bold' : isNearExpiry ? 'text-amber-600' : 'text-gray-500'}`}>
                                                  HSD: {item.expiry_date || '—'}
                                                  {isUrgent && ` (${days}d)`}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              {itemIdx === 0 && !isDone && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F68634] text-white mb-1">
                                                  🔥 Pick trước (FEFO)
                                                </span>
                                              )}
                                              <div className="flex items-center gap-1 justify-end">
                                                <span className="text-sm text-gray-500">Cần:</span>
                                                <span className="font-bold text-gray-800">{item.qty}</span>
                                                <span className="text-gray-300 mx-1">|</span>
                                                <span className="text-sm text-gray-500">Soạn:</span>
                                                <span className={`font-bold ${isDone ? 'text-green-600' : 'text-gray-400'}`}>
                                                  {isDone ? '✓' : item.picked_qty}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>

                                  {/* Confirm button — h-14 per UXUI_SPEC */}
                                  {order.pick_status !== 'completed' && (
                                    <button
                                      onClick={() => confirmPick(order)}
                                      disabled={isConfirming}
                                      className="mt-3 bg-[#F68634] text-white w-full h-14 rounded-xl font-medium text-base hover:bg-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                      {isConfirming ? (
                                        <><span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> Đang xử lý...</>
                                      ) : (
                                        <>✅ Xác nhận đã soạn xong đơn {order.order_number}</>
                                      )}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {/* Completed orders — collapsed */}
                        {completedOrders.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs font-semibold text-green-600 mb-1 uppercase tracking-wide">
                              ✅ Đã soạn xong ({completedOrders.length})
                            </div>
                            {completedOrders.map(order => (
                              <div key={`done-${order.stop_order}`} className="flex items-center justify-between py-2 px-3 bg-green-50 rounded-lg mb-1 opacity-75">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-full bg-green-200 text-green-700 text-xs flex items-center justify-center font-bold">
                                    {order.stop_order}
                                  </span>
                                  <span className="font-medium text-gray-600">{order.order_number}</span>
                                  <span className="text-gray-400">·</span>
                                  <span className="text-sm text-gray-500">{order.customer_name}</span>
                                </div>
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ Đã soạn</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Handover A button when all done and no handover yet */}
                      {isReady && !hasHandover && (
                        <button
                          onClick={() => {
                            // Store trip data + items for handover-a page
                            const handoverItems = wb.picking_items.map(item => ({
                              product_name: item.product_name,
                              product_sku: item.product_sku,
                              expected_qty: item.total_qty,
                              actual_qty: item.picked_qty,
                            }))
                            sessionStorage.setItem('handover_trip', JSON.stringify({
                              trip_id: wb.trip_id,
                              trip_number: wb.trip_number,
                              vehicle_plate: wb.vehicle_plate,
                              driver_name: wb.driver_name,
                              total_stops: wb.total_stops,
                              items: handoverItems,
                            }))
                            window.location.href = `/dashboard/handover-a?trip_id=${wb.trip_id}`
                          }}
                          className="mt-4 inline-flex items-center justify-center gap-2 w-full h-14 bg-green-600 text-white rounded-xl font-medium text-base hover:bg-green-700 transition"
                        >
                          📋 Tạo biên bản bàn giao xuất kho
                        </button>
                      )}

                      {/* View existing handover */}
                      {hasHandover && (
                        <button
                          onClick={() => window.location.href = `/dashboard/handover-a?trip_id=${wb.trip_id}`}
                          className="mt-4 inline-flex items-center justify-center gap-2 w-full h-14 bg-blue-600 text-white rounded-xl font-medium text-base hover:bg-blue-700 transition"
                        >
                          📋 Xem biên bản bàn giao ({handoverDone ? 'Hoàn tất' : wb.handover_status === 'partially_signed' ? 'Đang ký' : 'Chờ ký'})
                        </button>
                      )}
                    </div>
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
