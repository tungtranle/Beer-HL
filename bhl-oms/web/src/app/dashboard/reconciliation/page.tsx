'use client'

import { useEffect, useState } from 'react'
import { apiFetch, getUser, getToken } from '@/lib/api'
import { formatVND } from '@/lib/status-config'
import { toast } from '@/lib/useToast'
import { Pagination } from '@/components/ui/Pagination'
import { handleError } from '@/lib/handleError'

// â”€â”€ Interfaces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Reconciliation {
  id: string
  trip_id: string
  trip_number: string
  recon_type: string
  status: string
  expected_value: number
  actual_value: number
  variance: number
  reconciled_at: string | null
  created_at: string
}

interface Discrepancy {
  id: string
  recon_id: string
  trip_id: string
  trip_number: string
  disc_type: string
  status: string
  description: string
  expected_value: number
  actual_value: number
  variance: number
  resolution: string | null
  deadline: string | null
  created_at: string
}

interface DailyClose {
  id: string
  warehouse_id: string
  close_date: string
  total_trips: number
  total_orders: number
  total_revenue: number
  total_collected: number
  revenue_variance: number
  total_discrepancies: number
  status: string
  created_at: string
}

interface HistoryEvent {
  id: string
  event_type: string
  actor_name: string
  title: string
  detail: Record<string, string>
  created_at: string
}

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const reconStatusColors: Record<string, string> = {
  matched: 'bg-green-100 text-green-700',
  discrepancy: 'bg-red-100 text-red-700',
  resolved: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-gray-100 text-gray-600',
}

const reconStatusLabels: Record<string, string> = {
  matched: 'Khớp',
  discrepancy: 'Sai lệch',
  resolved: 'Đã xử lý',
  pending: 'Chờ xử lý',
  closed: 'Đã đóng',
}

const discStatusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  investigating: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
  escalated: 'bg-purple-100 text-purple-700',
  closed: 'bg-gray-100 text-gray-600',
}

const discStatusLabels: Record<string, string> = {
  open: 'Mở',
  investigating: 'Đang điều tra',
  resolved: 'Đã xử lý',
  escalated: 'Đã leo thang',
  closed: 'Đã đóng',
}

const typeLabels: Record<string, string> = {
  goods: '📦 Hàng hóa',
  payment: '💰 Thanh toán',
  asset: '🏷️ Vỏ/Két',
}

const tabs = [
  { key: 'recon', label: '📊 Đối soát' },
  { key: 'disc', label: '⚠️ Sai lệch' },
  { key: 'close', label: '📅 Chốt ngày' },
]

const discSubTabs = [
  { key: 'all', label: 'Tất cả' },
  { key: 'payment', label: '💰 Tiền' },
  { key: 'goods', label: '📦 Hàng' },
  { key: 'asset', label: '🏷️ Vỏ' },
]

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getT1Countdown(deadline: string | null): { text: string; color: string; urgent: boolean } {
  if (!deadline) return { text: '—', color: 'text-gray-400', urgent: false }
  const now = new Date()
  const dl = new Date(deadline)
  const diffMs = dl.getTime() - now.getTime()
  const diffH = Math.floor(diffMs / (1000 * 60 * 60))
  const diffM = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  if (diffMs <= 0) return { text: 'Quá hạn!', color: 'text-red-600 font-bold', urgent: true }
  if (diffH < 2) return { text: `${diffH}h ${diffM}m`, color: 'text-red-600 font-bold', urgent: true }
  if (diffH < 8) return { text: `${diffH}h ${diffM}m`, color: 'text-amber-600 font-medium', urgent: false }
  return { text: `${diffH}h ${diffM}m`, color: 'text-gray-600', urgent: false }
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ReconciliationPage() {
  const [activeTab, setActiveTab] = useState('recon')
  const [recons, setRecons] = useState<Reconciliation[]>([])
  const [discs, setDiscs] = useState<Discrepancy[]>([])
  const [closes, setCloses] = useState<DailyClose[]>([])
  const [loading, setLoading] = useState(true)
  const [reconFilter, setReconFilter] = useState('')
  const [discFilter, setDiscFilter] = useState('')
  const [discTypeFilter, setDiscTypeFilter] = useState('all')
  const [resolveId, setResolveId] = useState<string | null>(null)
  const [resolution, setResolution] = useState('')
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEvent[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [, setTick] = useState(0)

  // Pagination state per tab
  const [reconPage, setReconPage] = useState(1)
  const [reconLimit, setReconLimit] = useState(20)
  const [reconTotal, setReconTotal] = useState(0)
  const [discPage, setDiscPage] = useState(1)
  const [discLimit, setDiscLimit] = useState(20)
  const [discTotal, setDiscTotal] = useState(0)
  const [closePage, setClosePage] = useState(1)
  const [closeLimit, setCloseLimit] = useState(20)
  const [closeTotal, setCloseTotal] = useState(0)

  // T+1 countdown auto-refresh every 60s
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(iv)
  }, [])

  // Reset page when filter changes
  useEffect(() => { setReconPage(1) }, [reconFilter])
  useEffect(() => { setDiscPage(1) }, [discFilter, discTypeFilter])

  // Load data based on active tab
  useEffect(() => {
    setLoading(true)
    if (activeTab === 'recon') {
      const params = new URLSearchParams()
      if (reconFilter) params.set('status', reconFilter)
      params.set('page', String(reconPage))
      params.set('limit', String(reconLimit))
      apiFetch<any>(`/reconciliation?${params}`)
        .then((r) => { setRecons(r.data || []); setReconTotal(r.meta?.total ?? 0) })
        .catch(err => handleError(err))
        .finally(() => setLoading(false))
    } else if (activeTab === 'disc') {
      const params = new URLSearchParams()
      if (discFilter) params.set('status', discFilter)
      params.set('page', String(discPage))
      params.set('limit', String(discLimit))
      apiFetch<any>(`/reconciliation/discrepancies?${params}`)
        .then((r) => { setDiscs(r.data || []); setDiscTotal(r.meta?.total ?? 0) })
        .catch(err => handleError(err))
        .finally(() => setLoading(false))
    } else {
      const params = new URLSearchParams()
      params.set('page', String(closePage))
      params.set('limit', String(closeLimit))
      apiFetch<any>(`/reconciliation/daily-close?${params}`)
        .then((r) => { setCloses(r.data || []); setCloseTotal(r.meta?.total ?? (r.data?.length || 0)) })
        .catch(err => handleError(err))
        .finally(() => setLoading(false))
    }
  }, [activeTab, reconFilter, discFilter, reconPage, reconLimit, discPage, discLimit, closePage, closeLimit])

  // formatVND imported from status-config (single source of truth)

  const handleResolveDiscrepancy = async (id: string) => {
    if (!resolution.trim()) return toast.warning('Vui lòng nhập nội dung xử lý')
    try {
      await apiFetch(`/reconciliation/discrepancies/${id}/resolve`, {
        method: 'POST',
        body: { resolution },
      })
      setResolveId(null)
      setResolution('')
      const params = new URLSearchParams()
      if (discFilter) params.set('status', discFilter)
      params.set('limit', '50')
      const r: any = await apiFetch(`/reconciliation/discrepancies?${params}`)
      setDiscs(r.data || [])
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const loadHistory = async (discId: string) => {
    setHistoryId(discId)
    setHistoryLoading(true)
    try {
      const r: any = await apiFetch(`/reconciliation/discrepancies/${discId}/history`)
      setHistory(r.data || [])
    } catch { setHistory([]) }
    finally { setHistoryLoading(false) }
  }

  const handleGenerateDailyClose = async () => {
    const date = new Date().toISOString().split('T')[0]
    const warehouseId = 'a0000000-0000-0000-0000-000000000001'
    try {
      await apiFetch('/reconciliation/daily-close', {
        method: 'POST',
        body: { warehouse_id: warehouseId, date },
      })
      const r: any = await apiFetch('/reconciliation/daily-close?limit=30')
      setCloses(r.data || [])
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Filter discrepancies by sub-tab type
  const filteredDiscs = discTypeFilter === 'all'
    ? discs
    : discs.filter(d => d.disc_type === discTypeFilter)

  // Count by type for badges
  const discTypeCounts = {
    all: discs.length,
    payment: discs.filter(d => d.disc_type === 'payment').length,
    goods: discs.filter(d => d.disc_type === 'goods').length,
    asset: discs.filter(d => d.disc_type === 'asset').length,
  }

  const openCount = discs.filter(d => ['open', 'investigating'].includes(d.status)).length
  const urgentCount = discs.filter(d => {
    if (!d.deadline || !['open', 'investigating'].includes(d.status)) return false
    return getT1Countdown(d.deadline).urgent
  }).length

  return (
    <div>
      {/* Aging + risk summary bar */}
      {discs.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-red-600 uppercase mb-1">Sai lệch cần xử lý</div>
            <div className="text-3xl font-bold text-red-700">{openCount}</div>
            <div className="text-xs text-red-500 mt-1">
              {urgentCount > 0 ? `⚠️ ${urgentCount} sắp quá hạn T+1` : 'Không có gấp'}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-amber-600 uppercase mb-1">Sai lệch thanh toán</div>
            <div className="text-3xl font-bold text-amber-700">{discs.filter(d => d.disc_type === 'payment').length}</div>
            <div className="text-xs text-amber-500 mt-1">
              {formatVND(discs.filter(d => d.disc_type === 'payment' && ['open', 'investigating'].includes(d.status)).reduce((s, d) => s + Math.abs(d.variance), 0))} chưa xử lý
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-blue-600 uppercase mb-1">Sai lệch hàng hóa</div>
            <div className="text-3xl font-bold text-blue-700">{discs.filter(d => d.disc_type === 'goods').length}</div>
            <div className="text-xs text-blue-500 mt-1">vỏ/két: {discs.filter(d => d.disc_type === 'asset').length} mục</div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Đối soát & Chốt sổ</h1>
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/reconciliation/export', {
                  headers: { Authorization: `Bearer ${getToken()}` },
                })
                if (!res.ok) throw new Error('Export failed')
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `doi-soat-${new Date().toISOString().slice(0, 10)}.xlsx`
                a.click()
                URL.revokeObjectURL(url)
                toast.success('Đã tải xuống file Excel')
              } catch (err: any) {
                toast.error('Lỗi xuất Excel: ' + err.message)
              }
            }}
            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
            title="Xuất Excel"
          >📥 Xuất Excel</button>
        </div>
        {/* T+1 summary badges */}
        {openCount > 0 ? (
          <div className="flex gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
              {openCount} sai lệch chưa xử lý
            </span>
            {urgentCount > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-600 text-white animate-pulse">
                ⏰ {urgentCount} sắp quá hạn T+1
              </span>
            )}
          </div>
        ) : recons.length === 0 && discs.length === 0 ? (
          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">Chưa có chuyến nào hoàn thành</span>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === t.key
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* â”€â”€ TAB: Reconciliations â”€â”€ */}
      {activeTab === 'recon' && (
        <div>
          <div className="flex gap-2 mb-4">
            {['', 'matched', 'discrepancy', 'resolved'].map((s) => (
              <button
                key={s}
                onClick={() => setReconFilter(s)}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  reconFilter === s
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === '' ? 'Tất cả' : reconStatusLabels[s] || s}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 text-gray-600 sticky top-0">
                <tr>
                  <th className="text-left py-3 px-4 sticky left-0 bg-gray-50 z-10 shadow-[1px_0_0_#e5e7eb]">Chuyến xe</th>
                  <th className="text-left py-3 px-4">Loại</th>
                  <th className="text-right py-3 px-4">Kỳ vọng</th>
                  <th className="text-right py-3 px-4">Thực tế</th>
                  <th className="text-right py-3 px-4">Chênh lệch</th>
                  <th className="text-center py-3 px-4">Trạng thái</th>
                  <th className="text-center py-3 px-4">Ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-400">Đang tải...</td></tr>
                ) : recons.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center">
                    <div className="text-4xl mb-3">📊</div>
                    <p className="text-gray-500 font-medium mb-2">Chưa có dữ liệu đối soát</p>
                    <div className="text-xs text-gray-400 max-w-md mx-auto space-y-1">
                      <p>Đối soát tự động tạo khi tài xế hoàn thành chuyến xe.</p>
                      <p className="font-medium text-gray-500">Luồng: Tài xế giao hàng → ePOD → Thu tiền → Hoàn thành chuyến → Đối soát tự động</p>
                    </div>
                  </td></tr>
                ) : (
                  recons.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-xs sticky left-0 bg-white hover:bg-gray-50 shadow-[1px_0_0_#e5e7eb]">{r.trip_number}</td>
                      <td className="py-3 px-4">{typeLabels[r.recon_type] || r.recon_type}</td>
                      <td className="py-3 px-4 text-right">{r.recon_type === 'payment' ? formatVND(r.expected_value) : r.expected_value.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">{r.recon_type === 'payment' ? formatVND(r.actual_value) : r.actual_value.toLocaleString()}</td>
                      <td className={`py-3 px-4 text-right font-medium ${r.variance !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {r.recon_type === 'payment' ? formatVND(r.variance) : r.variance.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${reconStatusColors[r.status] || 'bg-gray-100'}`}>
                          {reconStatusLabels[r.status] || r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-500 text-xs">
                        {new Date(r.created_at).toLocaleDateString('vi-VN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {reconTotal > 0 && (
              <Pagination page={reconPage} limit={reconLimit} total={reconTotal}
                onPageChange={setReconPage}
                onLimitChange={(n) => { setReconLimit(n); setReconPage(1) }}
                className="border-t bg-gray-50" />
            )}
          </div>
        </div>
      )}

      {/* â”€â”€ TAB: Discrepancies (Task 6.1 T+1 countdown + Task 6.2 split view) â”€â”€ */}
      {activeTab === 'disc' && (
        <div>
          {/* Status filter */}
          <div className="flex gap-2 mb-3">
            {['', 'open', 'investigating', 'resolved'].map((s) => (
              <button
                key={s}
                onClick={() => setDiscFilter(s)}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  discFilter === s
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === '' ? 'Tất cả' : discStatusLabels[s] || s}
              </button>
            ))}
          </div>

          {/* Task 6.2: Split view sub-tabs (Tiền / Hàng / Vỏ) */}
          <div className="flex gap-1 mb-4 bg-gray-50 rounded-lg p-1 w-fit">
            {discSubTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setDiscTypeFilter(t.key)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition ${
                  discTypeFilter === t.key
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
                <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-gray-100 rounded-full">
                  {discTypeCounts[t.key as keyof typeof discTypeCounts]}
                </span>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left py-3 px-4">Mô tả</th>
                  <th className="text-left py-3 px-4">Loại</th>
                  <th className="text-right py-3 px-4">Chênh lệch</th>
                  <th className="text-center py-3 px-4">Trạng thái</th>
                  <th className="text-center py-3 px-4">â° T+1</th>
                  <th className="text-center py-3 px-4">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">Đang tải...</td></tr>
                ) : filteredDiscs.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">
                    {discTypeFilter !== 'all'
                      ? `Không có sai lệch ${typeLabels[discTypeFilter] || discTypeFilter}`
                      : 'Không có sai lệch nào'}
                  </td></tr>
                ) : (
                  filteredDiscs.map((d) => {
                    const countdown = getT1Countdown(d.deadline)
                    return (
                      <tr key={d.id} className={`hover:bg-gray-50 ${countdown.urgent && ['open','investigating'].includes(d.status) ? 'bg-red-50/50' : ''}`}>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="truncate" title={d.description}>{d.description}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{d.trip_number}</div>
                        </td>
                        <td className="py-3 px-4">{typeLabels[d.disc_type] || d.disc_type}</td>
                        <td className="py-3 px-4 text-right font-medium text-red-600">
                          {d.disc_type === 'payment' ? formatVND(d.variance) : d.variance.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs ${discStatusColors[d.status] || 'bg-gray-100'}`}>
                            {discStatusLabels[d.status] || d.status}
                          </span>
                        </td>
                        {/* Task 6.1: T+1 countdown badge */}
                        <td className="py-3 px-4 text-center">
                          {['open', 'investigating'].includes(d.status) ? (
                            <span className={`text-xs ${countdown.color}`}>
                              {countdown.urgent && '🔴 '}{countdown.text}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center gap-1 justify-center">
                            {['open', 'investigating'].includes(d.status) && (
                              resolveId === d.id ? (
                                <div className="flex gap-1 items-center">
                                  <input
                                    type="text"
                                    value={resolution}
                                    onChange={(e) => setResolution(e.target.value)}
                                    placeholder="Nội dung xử lý..."
                                    className="border rounded px-2 py-1 text-xs w-32"
                                  />
                                  <button
                                    onClick={() => handleResolveDiscrepancy(d.id)}
                                    className="text-green-600 text-xs font-medium hover:underline"
                                  >Lưu</button>
                                  <button
                                    onClick={() => { setResolveId(null); setResolution('') }}
                                    className="text-gray-400 text-xs hover:underline"
                                  >Hủy</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setResolveId(d.id)}
                                  className="text-brand-500 text-xs font-medium hover:underline"
                                >Xử lý</button>
                              )
                            )}
                            {d.status === 'resolved' && (
                              <span className="text-xs text-gray-400" title={d.resolution || ''}>✅</span>
                            )}
                            {/* Task 6.3: Action history button */}
                            <button
                              onClick={() => loadHistory(d.id)}
                              className="text-blue-500 text-xs hover:underline ml-1"
                              title="Xem lịch sử"
                            >📜</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            {discTotal > 0 && (
              <Pagination page={discPage} limit={discLimit} total={discTotal}
                onPageChange={setDiscPage}
                onLimitChange={(n) => { setDiscLimit(n); setDiscPage(1) }}
                className="border-t bg-gray-50" />
            )}
          </div>
        </div>
      )}

      {/* â”€â”€ TAB: Daily Close â”€â”€ */}
      {activeTab === 'close' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={handleGenerateDailyClose}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition text-sm"
            >
              📅 Chốt sổ hôm nay
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left py-3 px-4">Ngày</th>
                  <th className="text-right py-3 px-4">Chuyến xe</th>
                  <th className="text-right py-3 px-4">Đơn hàng</th>
                  <th className="text-right py-3 px-4">Doanh thu KV</th>
                  <th className="text-right py-3 px-4">Thu thực tế</th>
                  <th className="text-right py-3 px-4">Chênh lệch</th>
                  <th className="text-center py-3 px-4">Sai lệch</th>
                  <th className="text-center py-3 px-4">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-400">Đang tải...</td></tr>
                ) : closes.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center">
                    <div className="text-4xl mb-3">📅</div>
                    <p className="text-gray-500 font-medium mb-2">Chưa có phiên chốt sổ nào</p>
                    <p className="text-xs text-gray-400">Nhấn &quot;Chốt sổ hôm nay&quot; để tạo báo cáo tổng hợp cuối ngày.</p>
                  </td></tr>
                ) : (
                  closes.map((cl) => (
                    <tr key={cl.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{cl.close_date}</td>
                      <td className="py-3 px-4 text-right">{cl.total_trips}</td>
                      <td className="py-3 px-4 text-right">{cl.total_orders}</td>
                      <td className="py-3 px-4 text-right">{formatVND(cl.total_revenue)}</td>
                      <td className="py-3 px-4 text-right">{formatVND(cl.total_collected)}</td>
                      <td className={`py-3 px-4 text-right font-medium ${cl.revenue_variance !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatVND(cl.revenue_variance)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {cl.total_discrepancies > 0 ? (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">{cl.total_discrepancies}</span>
                        ) : (
                          <span className="text-green-600 text-xs">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          cl.status === 'closed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {cl.status === 'closed' ? 'Đã đóng' : 'Đang mở'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {closeTotal > 0 && (
              <Pagination page={closePage} limit={closeLimit} total={closeTotal}
                onPageChange={setClosePage}
                onLimitChange={(n) => { setCloseLimit(n); setClosePage(1) }}
                className="border-t bg-gray-50" />
            )}
          </div>
        </div>
      )}

      {/* â”€â”€ Task 6.3: Discrepancy History Modal â”€â”€ */}
      {historyId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setHistoryId(null)}>
          <div className="bg-white rounded-xl shadow-xl w-[480px] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold text-gray-800">📜 Lịch sử xử lý</h3>
              <button onClick={() => setHistoryId(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {historyLoading ? (
                <div className="text-center py-8 text-gray-400">Đang tải...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-gray-400">Chưa có lịch sử xử lý</div>
              ) : (
                <div className="space-y-4">
                  {history.map((evt) => (
                    <div key={evt.id} className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-800">{evt.title}</div>
                        {evt.actor_name && <div className="text-xs text-gray-500">bởi {evt.actor_name}</div>}
                        {evt.detail?.resolution && (
                          <div className="text-xs text-gray-600 mt-1 bg-gray-50 rounded px-2 py-1">
                            {evt.detail.resolution}
                          </div>
                        )}
                        <div className="text-[10px] text-gray-400 mt-1">
                          {new Date(evt.created_at).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
