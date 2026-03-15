'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

// ── Interfaces ──────────────────────────────────────

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

// ── Constants ───────────────────────────────────────

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
  asset: '🏷️ Tài sản',
}

const tabs = [
  { key: 'recon', label: '📊 Đối soát' },
  { key: 'disc', label: '⚠️ Sai lệch' },
  { key: 'close', label: '📅 Chốt ngày' },
]

// ── Component ───────────────────────────────────────

export default function ReconciliationPage() {
  const [activeTab, setActiveTab] = useState('recon')
  const [recons, setRecons] = useState<Reconciliation[]>([])
  const [discs, setDiscs] = useState<Discrepancy[]>([])
  const [closes, setCloses] = useState<DailyClose[]>([])
  const [loading, setLoading] = useState(true)
  const [reconFilter, setReconFilter] = useState('')
  const [discFilter, setDiscFilter] = useState('')
  const [resolveId, setResolveId] = useState<string | null>(null)
  const [resolution, setResolution] = useState('')

  // Load data based on active tab
  useEffect(() => {
    setLoading(true)
    if (activeTab === 'recon') {
      const params = new URLSearchParams()
      if (reconFilter) params.set('status', reconFilter)
      params.set('limit', '50')
      apiFetch<any>(`/reconciliation?${params}`)
        .then((r) => setRecons(r.data || []))
        .catch(console.error)
        .finally(() => setLoading(false))
    } else if (activeTab === 'disc') {
      const params = new URLSearchParams()
      if (discFilter) params.set('status', discFilter)
      params.set('limit', '50')
      apiFetch<any>(`/reconciliation/discrepancies?${params}`)
        .then((r) => setDiscs(r.data || []))
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      apiFetch<any>('/reconciliation/daily-close?limit=30')
        .then((r) => setCloses(r.data || []))
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [activeTab, reconFilter, discFilter])

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)

  const handleResolveDiscrepancy = async (id: string) => {
    if (!resolution.trim()) return alert('Vui lòng nhập nội dung xử lý')
    try {
      await apiFetch(`/reconciliation/discrepancies/${id}/resolve`, {
        method: 'POST',
        body: { resolution },
      })
      setResolveId(null)
      setResolution('')
      // Reload discrepancies
      const params = new URLSearchParams()
      if (discFilter) params.set('status', discFilter)
      params.set('limit', '50')
      const r: any = await apiFetch(`/reconciliation/discrepancies?${params}`)
      setDiscs(r.data || [])
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleGenerateDailyClose = async () => {
    const date = new Date().toISOString().split('T')[0]
    const warehouseId = 'a0000000-0000-0000-0000-000000000001' // Default WH-HL
    try {
      await apiFetch('/reconciliation/daily-close', {
        method: 'POST',
        body: { warehouse_id: warehouseId, date },
      })
      const r: any = await apiFetch('/reconciliation/daily-close?limit=30')
      setCloses(r.data || [])
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Đối soát & Chốt sổ</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === t.key
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Reconciliations ── */}
      {activeTab === 'recon' && (
        <div>
          <div className="flex gap-2 mb-4">
            {['', 'matched', 'discrepancy', 'resolved'].map((s) => (
              <button
                key={s}
                onClick={() => setReconFilter(s)}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  reconFilter === s
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === '' ? 'Tất cả' : reconStatusLabels[s] || s}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left py-3 px-4">Chuyến xe</th>
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
                  <tr><td colSpan={7} className="py-8 text-center text-gray-400">Chưa có dữ liệu đối soát</td></tr>
                ) : (
                  recons.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-xs">{r.trip_number}</td>
                      <td className="py-3 px-4">{typeLabels[r.recon_type] || r.recon_type}</td>
                      <td className="py-3 px-4 text-right">{r.recon_type === 'payment' ? formatMoney(r.expected_value) : r.expected_value.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">{r.recon_type === 'payment' ? formatMoney(r.actual_value) : r.actual_value.toLocaleString()}</td>
                      <td className={`py-3 px-4 text-right font-medium ${r.variance !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {r.recon_type === 'payment' ? formatMoney(r.variance) : r.variance.toLocaleString()}
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
          </div>
        </div>
      )}

      {/* ── TAB: Discrepancies ── */}
      {activeTab === 'disc' && (
        <div>
          <div className="flex gap-2 mb-4">
            {['', 'open', 'investigating', 'resolved'].map((s) => (
              <button
                key={s}
                onClick={() => setDiscFilter(s)}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  discFilter === s
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === '' ? 'Tất cả' : discStatusLabels[s] || s}
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
                  <th className="text-center py-3 px-4">Hạn xử lý</th>
                  <th className="text-center py-3 px-4">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">Đang tải...</td></tr>
                ) : discs.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">Không có sai lệch nào</td></tr>
                ) : (
                  discs.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 max-w-xs truncate" title={d.description}>{d.description}</td>
                      <td className="py-3 px-4">{typeLabels[d.disc_type] || d.disc_type}</td>
                      <td className="py-3 px-4 text-right font-medium text-red-600">
                        {d.disc_type === 'payment' ? formatMoney(d.variance) : d.variance.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${discStatusColors[d.status] || 'bg-gray-100'}`}>
                          {discStatusLabels[d.status] || d.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-gray-500">
                        {d.deadline ? new Date(d.deadline).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {['open', 'investigating'].includes(d.status) && (
                          resolveId === d.id ? (
                            <div className="flex gap-1 items-center">
                              <input
                                type="text"
                                value={resolution}
                                onChange={(e) => setResolution(e.target.value)}
                                placeholder="Nội dung xử lý..."
                                className="border rounded px-2 py-1 text-xs w-40"
                              />
                              <button
                                onClick={() => handleResolveDiscrepancy(d.id)}
                                className="text-green-600 text-xs font-medium hover:underline"
                              >
                                Lưu
                              </button>
                              <button
                                onClick={() => { setResolveId(null); setResolution('') }}
                                className="text-gray-400 text-xs hover:underline"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setResolveId(d.id)}
                              className="text-amber-600 text-xs font-medium hover:underline"
                            >
                              Xử lý
                            </button>
                          )
                        )}
                        {d.status === 'resolved' && (
                          <span className="text-xs text-gray-400" title={d.resolution || ''}>✅ {d.resolution?.substring(0, 30) || ''}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: Daily Close ── */}
      {activeTab === 'close' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={handleGenerateDailyClose}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm"
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
                  <tr><td colSpan={8} className="py-8 text-center text-gray-400">Chưa có phiên chốt sổ nào</td></tr>
                ) : (
                  closes.map((cl) => (
                    <tr key={cl.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{cl.close_date}</td>
                      <td className="py-3 px-4 text-right">{cl.total_trips}</td>
                      <td className="py-3 px-4 text-right">{cl.total_orders}</td>
                      <td className="py-3 px-4 text-right">{formatMoney(cl.total_revenue)}</td>
                      <td className="py-3 px-4 text-right">{formatMoney(cl.total_collected)}</td>
                      <td className={`py-3 px-4 text-right font-medium ${cl.revenue_variance !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatMoney(cl.revenue_variance)}
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
          </div>
        </div>
      )}
    </div>
  )
}
