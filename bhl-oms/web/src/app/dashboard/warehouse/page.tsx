'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

// ─── types ────────────────────────────────────────────────────────────────────

const WH_ID = 'a0000000-0000-0000-0000-000000000001'

interface StockItem {
  product_id: string; product_name: string; product_sku: string
  batch_number: string; expiry_date: string
  quantity: number; reserved_qty: number; available: number
  warehouse_id: string
}

interface PickingOrder {
  id: string; pick_number: string
  status: string; total_items: number; created_at: string
}

interface ExpiryAlert {
  product_id: string; product_name: string; product_sku: string
  batch_number: string; expiry_date: string; quantity: number
  available: number
}

interface WarehouseKPI {
  warehouse_id: string
  total_bins: number
  bins_over_90_pct: number
  bins_occupied: number
  active_pick_orders: number
  pending_pick_orders: number
  completed_pick_today: number
  near_expiry_count: number
  total_skus: number
  total_units: number
  open_exceptions: number
  critical_exceptions: number
}

interface WMSException {
  id: string
  type: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  reference_type: string
  status: string
  created_at: string
}

interface PickerStat {
  user_id: string
  full_name: string
  username: string
  picks_today: number
  picks_week: number
  in_progress: number
  avg_minutes_per_order: number
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function daysUntilExpiry(expiryDate: string): number {
  if (!expiryDate) return 999
  const diff = new Date(expiryDate).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  return `${Math.floor(h / 24)} ngày trước`
}

const SEV_STYLES: Record<string, { badge: string; row: string; dot: string }> = {
  critical: { badge: 'bg-red-100 text-red-700 border-red-300', row: 'border-l-4 border-red-500 bg-red-50', dot: 'bg-red-500' },
  warning:  { badge: 'bg-amber-100 text-amber-700 border-amber-300', row: 'border-l-4 border-amber-400 bg-amber-50', dot: 'bg-amber-400' },
  info:     { badge: 'bg-blue-100 text-blue-700 border-blue-300', row: 'border-l-4 border-blue-400 bg-blue-50', dot: 'bg-blue-400' },
}

const SEV_LABEL: Record<string, string> = { critical: 'Khẩn cấp', warning: 'Cảnh báo', info: 'Thông tin' }

const EXC_TYPE_LABEL: Record<string, string> = {
  missing_stock: 'Thiếu hàng', wrong_lot: 'Sai lô', damaged: 'Hàng hỏng',
  over_pick: 'Soạn dư', bin_overflow: 'Bin đầy', orphan_pallet: 'Pallet bỏ', other: 'Khác',
}

// ─── component ────────────────────────────────────────────────────────────────

export default function WarehouseDashboardPage() {
  const [stock, setStock] = useState<StockItem[]>([])
  const [pickingOrders, setPickingOrders] = useState<PickingOrder[]>([])
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([])
  const [kpi, setKpi] = useState<WarehouseKPI | null>(null)
  const [exceptions, setExceptions] = useState<WMSException[]>([])
  const [pickerStats, setPickerStats] = useState<PickerStat[]>([])
  const [loadingOps, setLoadingOps] = useState(true)
  const [loading, setLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolveNote, setResolveNote] = useState('')
  const [resolveTarget, setResolveTarget] = useState<string | null>(null)

  const loadOps = useCallback(() => {
    setLoadingOps(true)
    Promise.all([
      apiFetch<any>(`/warehouse/dashboard/kpis?warehouse_id=${WH_ID}`).then(r => setKpi(r.data)).catch(() => {}),
      apiFetch<any>(`/warehouse/exceptions?warehouse_id=${WH_ID}&status=open`).then(r => setExceptions(r.data || [])).catch(() => {}),
      apiFetch<any>(`/warehouse/picker-stats?warehouse_id=${WH_ID}`).then(r => setPickerStats(r.data || [])).catch(() => {}),
    ]).finally(() => setLoadingOps(false))
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      apiFetch<any>('/warehouse/stock').then(r => setStock(r.data || [])).catch(() => {}),
      apiFetch<any>('/warehouse/picking-orders').then(r => setPickingOrders(r.data || [])).catch(() => {}),
      apiFetch<any>('/warehouse/expiry-alerts').then(r => setExpiryAlerts(r.data || [])).catch(() => {}),
    ]).finally(() => setLoading(false))
    loadOps()
  }, [loadOps])

  async function handleResolve(id: string) {
    setResolvingId(id)
    try {
      await apiFetch(`/warehouse/exceptions/${id}/resolve`, { method: 'POST', body: { note: resolveNote } })
      setResolveTarget(null); setResolveNote('')
      loadOps()
    } catch { /* ignore */ } finally { setResolvingId(null) }
  }

  async function handleDismiss(id: string) {
    setResolvingId(id)
    try {
      await apiFetch(`/warehouse/exceptions/${id}/dismiss`, { method: 'POST', body: {} })
      loadOps()
    } catch { /* ignore */ } finally { setResolvingId(null) }
  }

  const pendingPick = pickingOrders.filter(p => p.status === 'pending' || p.status === 'in_progress')
  const totalStock = stock.reduce((s, i) => s + i.quantity, 0)
  const totalReserved = stock.reduce((s, i) => s + (i.reserved_qty || 0), 0)
  const urgentExpiry = expiryAlerts.filter(a => daysUntilExpiry(a.expiry_date) <= 7)
  const binOccupancyPct = kpi && kpi.total_bins > 0
    ? Math.round((kpi.bins_occupied / kpi.total_bins) * 100) : 0

  if (loading && loadingOps) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">

      {/* ── PAGE HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🏭 Trung tâm điều hành kho</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kho Hạ Long · cập nhật mỗi lần tải trang</p>
        </div>
        <button onClick={loadOps}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition shadow-sm">
          <span className={loadingOps ? 'animate-spin' : ''}>↻</span> Làm mới
        </button>
      </div>

      {/* ── KPI STRIP ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-blue-500">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Đang soạn</div>
          <div className="text-3xl font-bold text-blue-700">{kpi?.active_pick_orders ?? '—'}</div>
          <div className="text-xs text-gray-400 mt-1">Chờ: {kpi?.pending_pick_orders ?? 0} · Xong hôm nay: {kpi?.completed_pick_today ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-emerald-500">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Đầy bin</div>
          <div className="text-3xl font-bold text-emerald-700">{binOccupancyPct}%</div>
          <div className="text-xs text-gray-400 mt-1">
            {kpi?.bins_occupied ?? 0}/{kpi?.total_bins ?? 0} bin · &gt;90%: {kpi?.bins_over_90_pct ?? 0}
          </div>
        </div>
        <div className={`bg-white rounded-xl shadow-sm p-4 border-t-4 ${(kpi?.critical_exceptions ?? 0) > 0 ? 'border-red-500' : (kpi?.open_exceptions ?? 0) > 0 ? 'border-amber-400' : 'border-gray-200'}`}>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Sự cố mở</div>
          <div className={`text-3xl font-bold ${(kpi?.critical_exceptions ?? 0) > 0 ? 'text-red-700' : 'text-amber-700'}`}>{kpi?.open_exceptions ?? '—'}</div>
          <div className="text-xs text-gray-400 mt-1">Khẩn: {kpi?.critical_exceptions ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-violet-500">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Tổng đơn vị</div>
          <div className="text-3xl font-bold text-violet-700">{kpi ? (kpi.total_units / 1000).toFixed(1) + 'K' : '—'}</div>
          <div className="text-xs text-gray-400 mt-1">{kpi?.total_skus ?? 0} SKU · kho HLong</div>
        </div>
        <div className={`bg-white rounded-xl shadow-sm p-4 border-t-4 ${(kpi?.near_expiry_count ?? 0) > 0 ? 'border-orange-500' : 'border-gray-200'}`}>
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Cận date 30d</div>
          <div className={`text-3xl font-bold ${(kpi?.near_expiry_count ?? 0) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{kpi?.near_expiry_count ?? '—'}</div>
          <div className="text-xs text-gray-400 mt-1">{urgentExpiry.length > 0 ? `${urgentExpiry.length} lô ≤7 ngày` : 'Ổn định'}</div>
        </div>
      </div>

      {/* ── TWO-COLUMN: EXCEPTIONS + PICKERS ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Exception queue */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800">🚨 Hàng đợi sự cố</h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
              {exceptions.length} sự cố đang mở
            </span>
          </div>

          {loadingOps ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : exceptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <div className="text-4xl mb-2">✅</div>
              <div className="text-sm font-medium">Không có sự cố nào đang mở</div>
            </div>
          ) : (
            <div className="space-y-2">
              {exceptions.map(ex => {
                const s = SEV_STYLES[ex.severity] || SEV_STYLES.info
                const isResolving = resolveTarget === ex.id
                return (
                  <div key={ex.id} className={`rounded-lg p-3 ${s.row}`}>
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${s.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${s.badge}`}>
                            {SEV_LABEL[ex.severity]}
                          </span>
                          <span className="text-[10px] text-gray-500 bg-white/70 px-1.5 py-0.5 rounded border border-gray-200">
                            {EXC_TYPE_LABEL[ex.type] || ex.type}
                          </span>
                          <span className="text-[10px] text-gray-400">{timeAgo(ex.created_at)}</span>
                        </div>
                        <div className="text-sm font-semibold text-gray-900 truncate">{ex.title}</div>
                        {ex.description && (
                          <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{ex.description}</div>
                        )}

                        {isResolving && (
                          <div className="mt-2 flex gap-2">
                            <input
                              type="text"
                              placeholder="Ghi chú giải quyết..."
                              value={resolveNote}
                              onChange={e => setResolveNote(e.target.value)}
                              className="flex-1 text-xs px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                            />
                            <button
                              onClick={() => handleResolve(ex.id)}
                              disabled={resolvingId === ex.id}
                              className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                              {resolvingId === ex.id ? '…' : 'Xác nhận'}
                            </button>
                            <button onClick={() => setResolveTarget(null)}
                              className="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-700">✕</button>
                          </div>
                        )}
                      </div>

                      {!isResolving && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => { setResolveTarget(ex.id); setResolveNote('') }}
                            className="text-[11px] px-2.5 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">
                            Giải quyết
                          </button>
                          <button
                            onClick={() => handleDismiss(ex.id)}
                            disabled={resolvingId === ex.id}
                            className="text-[11px] px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition disabled:opacity-40">
                            {resolvingId === ex.id ? '…' : 'Bỏ qua'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Picker stats panel */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="text-base font-bold text-gray-800 mb-4">👷 Năng suất thủ kho</h2>
          {loadingOps ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />)}
            </div>
          ) : pickerStats.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu hôm nay</p>
          ) : (
            <div className="space-y-3">
              {pickerStats.map((p, i) => (
                <div key={p.user_id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">{p.full_name}</div>
                    <div className="text-xs text-gray-400">{p.username}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-base font-bold text-emerald-700">{p.picks_today}</div>
                    <div className="text-[10px] text-gray-400">hôm nay</div>
                  </div>
                </div>
              ))}
              {pickerStats.map(p => (
                p.in_progress > 0 ? (
                  <div key={p.user_id + '_prog'} className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 border border-amber-100">
                    ⚡ {p.full_name.split(' ').pop()} đang soạn {p.in_progress} lệnh
                  </div>
                ) : null
              ))}
              <div className="pt-2 border-t border-gray-100">
                <div className="text-xs text-gray-400 text-center">
                  Tuần: {pickerStats.reduce((s, p) => s + p.picks_week, 0)} lệnh
                  · TB: {Math.round(pickerStats.reduce((s, p) => s + p.avg_minutes_per_order, 0) / Math.max(pickerStats.length, 1))} phút/lệnh
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── QUICK ACTIONS ───────────────────────────────────────────────────── */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quy trình chính</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Link href="/dashboard/warehouse/picking-by-vehicle" className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition text-center flex flex-col items-center justify-center min-h-[72px] border-2 border-[#F68634]">
            <div className="text-2xl mb-1">🚛</div>
            <div className="text-sm font-semibold text-[#F68634]">Soạn theo xe</div>
          </Link>
          <Link href="/dashboard/warehouse/picking" className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition text-center flex flex-col items-center justify-center min-h-[72px]">
            <div className="text-2xl mb-1">📋</div>
            <div className="text-sm font-medium">Lệnh đóng hàng</div>
          </Link>
          <Link href="/dashboard/gate-check" className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition text-center flex flex-col items-center justify-center min-h-[72px]">
            <div className="text-2xl mb-1">🚧</div>
            <div className="text-sm font-medium">Kiểm tra cổng</div>
          </Link>
          <Link href="/dashboard/warehouse/returns" className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition text-center flex flex-col items-center justify-center min-h-[72px]">
            <div className="text-2xl mb-1">📥</div>
            <div className="text-sm font-medium">Nhập vỏ</div>
          </Link>
          <Link href="/dashboard/pda-scanner" className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition text-center flex flex-col items-center justify-center min-h-[72px]">
            <div className="text-2xl mb-1">📱</div>
            <div className="text-sm font-medium">Quét barcode</div>
          </Link>
        </div>

        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quy trình WMS</div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <Link href="/dashboard/warehouse/scan" className="bg-blue-50 rounded-lg shadow-sm p-3 hover:shadow-md text-center min-h-[64px] flex flex-col items-center justify-center">
            <div className="text-xl">📷</div><div className="text-sm font-medium">Scan QR</div>
          </Link>
          <Link href="/dashboard/warehouse/inbound" className="bg-blue-50 rounded-lg shadow-sm p-3 hover:shadow-md text-center min-h-[64px] flex flex-col items-center justify-center">
            <div className="text-xl">📦</div><div className="text-sm font-medium">Nhập kho</div>
          </Link>
          <Link href="/dashboard/warehouse/putaway" className="bg-blue-50 rounded-lg shadow-sm p-3 hover:shadow-md text-center min-h-[64px] flex flex-col items-center justify-center">
            <div className="text-xl">🏷</div><div className="text-sm font-medium">Putaway</div>
          </Link>
          <Link href="/dashboard/warehouse/loading" className="bg-blue-50 rounded-lg shadow-sm p-3 hover:shadow-md text-center min-h-[64px] flex flex-col items-center justify-center">
            <div className="text-xl">🚚</div><div className="text-sm font-medium">Load lên xe</div>
          </Link>
          <Link href="/dashboard/warehouse/cycle-count" className="bg-blue-50 rounded-lg shadow-sm p-3 hover:shadow-md text-center min-h-[64px] flex flex-col items-center justify-center">
            <div className="text-xl">🔢</div><div className="text-sm font-medium">Kiểm kê</div>
          </Link>
          <Link href="/dashboard/warehouse/dashboard" className="bg-blue-50 rounded-lg shadow-sm p-3 hover:shadow-md text-center min-h-[64px] flex flex-col items-center justify-center">
            <div className="text-xl">📊</div><div className="text-sm font-medium">Cảnh báo</div>
          </Link>
          <Link href="/dashboard/warehouse/bin-map" className="bg-blue-50 rounded-lg shadow-sm p-3 hover:shadow-md text-center min-h-[64px] flex flex-col items-center justify-center md:col-span-2">
            <div className="text-xl">🗺</div><div className="text-sm font-medium">Bản đồ kho</div>
          </Link>
        </div>
      </div>

      {/* ── STOCK TABLE ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700 text-base">Tồn kho hiện tại</h2>
          <div className="text-xs text-gray-400">
            Tổng: <span className="font-semibold text-gray-700">{totalStock.toLocaleString()}</span> ·
            Đặt: <span className="font-semibold text-brand">{totalReserved.toLocaleString()}</span>
          </div>
        </div>
        {stock.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Chưa có dữ liệu tồn kho</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-3">SKU</th>
                  <th className="text-left py-3 px-3">Sản phẩm</th>
                  <th className="text-left py-3 px-3">Lô</th>
                  <th className="text-left py-3 px-3">HSD</th>
                  <th className="text-right py-3 px-3">Tồn</th>
                  <th className="text-right py-3 px-3">Đặt</th>
                  <th className="text-right py-3 px-3">Khả dụng</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((s, i) => {
                  const days = daysUntilExpiry(s.expiry_date)
                  const isFEFOFirst = days <= 30 && days > 0
                  return (
                    <tr key={i} className={`border-t hover:bg-gray-50 ${days <= 7 ? 'bg-red-50' : ''}`}>
                      <td className="py-2.5 px-3 font-mono text-xs">{s.product_sku}</td>
                      <td className="py-2.5 px-3">
                        {s.product_name}
                        {isFEFOFirst && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">
                            Pick trước
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-xs">{s.batch_number || '—'}</td>
                      <td className={`py-2.5 px-3 text-xs ${days <= 7 ? 'text-red-600 font-medium' : days <= 30 ? 'text-amber-600' : ''}`}>
                        {s.expiry_date ? new Date(s.expiry_date).toLocaleDateString('vi-VN') : '—'}
                        {days <= 7 && days > 0 && <span className="ml-1">({days}d)</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right">{s.quantity.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-orange-600">{(s.reserved_qty || 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-green-600">{s.available.toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── EXPIRY ALERTS ───────────────────────────────────────────────────── */}
      {expiryAlerts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 mb-3 text-base">⚠️ Cảnh báo hết hạn</h2>
          <div className="space-y-2">
            {expiryAlerts.map((a, i) => {
              const days = daysUntilExpiry(a.expiry_date)
              return (
                <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${days <= 7 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <div>
                    <div className="font-medium text-sm">
                      {a.product_name}
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">
                        Pick trước
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">Lô: {a.batch_number} · SL: {a.quantity}</div>
                  </div>
                  <div className={`text-sm font-bold ${days <= 7 ? 'text-red-600' : 'text-yellow-600'}`}>
                    {days <= 0 ? '❌ Đã hết hạn' : `⏰ Còn ${days} ngày`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
