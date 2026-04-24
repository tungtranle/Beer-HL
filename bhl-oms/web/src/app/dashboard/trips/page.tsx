'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { apiFetch, getUser, getToken } from '@/lib/api'
import { handleError } from '@/lib/handleError'
import { useDataRefresh } from '@/lib/notifications'
import { Pagination } from '@/components/ui/Pagination'

interface Trip {
  id: string; trip_number: string; vehicle_plate: string; driver_name: string
  status: string; total_distance_km: number; total_weight_kg: number
  total_stops: number; planned_date: string; created_at: string
}

const statusLabels: Record<string, string> = {
  planned: 'Đã lên kế hoạch', assigned: 'Đã phân công', ready: 'Sẵn sàng',
  in_transit: 'Đang giao', completed: 'Hoàn thành', cancelled: 'Đã hủy',
}

const statusColors: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700', assigned: 'bg-indigo-100 text-indigo-700',
  ready: 'bg-amber-100 text-amber-700', in_transit: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700',
}

const statusDot: Record<string, string> = {
  planned: 'bg-blue-400', assigned: 'bg-indigo-400', ready: 'bg-amber-400',
  in_transit: 'bg-green-500 animate-pulse', completed: 'bg-green-400', cancelled: 'bg-red-400',
}

type SavedView = 'all' | 'today' | 'active' | 'issues'

export default function TripsPage() {
  const user = getUser()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<SavedView>('today')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [plannedDate, setPlannedDate] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [totalRows, setTotalRows] = useState(0)

  const todayStr = new Date().toISOString().split('T')[0]

  const loadTrips = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter) params.set('status', filter)
    if (plannedDate) params.set('planned_date', plannedDate)
    params.set('page', String(page))
    params.set('limit', String(limit))
    apiFetch<any>(`/trips?${params}`)
      .then((r) => {
        setTrips(r.data || [])
        setTotalRows(r.meta?.total ?? (r.data?.length || 0))
      })
      .catch(err => handleError(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadTrips() }, [filter, plannedDate, page, limit])
  useEffect(() => { setPage(1) }, [filter, plannedDate])
  useDataRefresh('trip', loadTrips)

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (filter) params.set('status', filter)
      const res = await fetch(`/api/trips/export?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chuyen-xe-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Đã tải xuống file Excel')
    } catch (err: any) {
      toast.error('Lỗi xuất Excel: ' + err.message)
    }
  }

  // Apply saved view filter (only client-side for displayed trips on this page)
  const viewedTrips = trips.filter(t => {
    if (view === 'today') return t.planned_date?.startsWith(todayStr)
    if (view === 'active') return ['in_transit', 'assigned', 'ready'].includes(t.status)
    if (view === 'issues') return t.status === 'cancelled'
    return true
  })

  // Apply search
  const filtered = viewedTrips.filter(t =>
    !search ||
    t.trip_number.toLowerCase().includes(search.toLowerCase()) ||
    t.vehicle_plate.toLowerCase().includes(search.toLowerCase()) ||
    (t.driver_name || '').toLowerCase().includes(search.toLowerCase())
  )

  // Count badges per status from current page only
  const counts = trips.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const viewCounts = {
    all: trips.length,
    today: trips.filter(t => t.planned_date?.startsWith(todayStr)).length,
    active: trips.filter(t => ['in_transit', 'assigned', 'ready'].includes(t.status)).length,
    issues: trips.filter(t => t.status === 'cancelled').length,
  }

  // Saved view click → tải dữ liệu từ server với filter tương ứng
  const applyView = (v: SavedView) => {
    setView(v)
    if (v === 'today') { setPlannedDate(todayStr); setFilter('') }
    else if (v === 'active') { setPlannedDate(''); setFilter('in_transit') }
    else if (v === 'issues') { setPlannedDate(''); setFilter('cancelled') }
    else { setPlannedDate(''); setFilter('') }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(t => t.id)))
  }

  const savedViews: { key: SavedView; label: string; icon: string }[] = [
    { key: 'today', label: 'Hôm nay', icon: '📅' },
    { key: 'active', label: 'Đang chạy', icon: '🚛' },
    { key: 'all', label: 'Tất cả', icon: '📋' },
    { key: 'issues', label: 'Có vấn đề', icon: '⚠️' },
  ]

  const statusFilters = [
    { label: 'Tất cả', value: '' },
    { label: 'Đã lên KH', value: 'planned' },
    { label: 'Đã phân công', value: 'assigned' },
    { label: 'Sẵn sàng', value: 'ready' },
    { label: 'Đang giao', value: 'in_transit' },
    { label: 'Hoàn thành', value: 'completed' },
  ]

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">🚛 Quản lý chuyến xe</h1>
        <button onClick={loadTrips} title="Làm mới"
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <div className="ml-auto flex gap-2">
          <Link href="/dashboard/planning"
            className="px-3 py-1.5 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600 transition font-medium">
            + Tạo chuyến mới
          </Link>
          <button onClick={handleExport}
            className="px-3 py-1.5 bg-white border text-sm rounded-lg hover:bg-gray-50 transition text-gray-600">
            📥 Xuất Excel
          </button>
        </div>
      </div>

      {/* Saved views (Linear/Notion style) */}
      <div className="flex items-center gap-1 mb-3 border-b pb-2">
        {savedViews.map(v => (
          <button key={v.key} onClick={() => applyView(v.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${view === v.key ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            <span>{v.icon}</span>
            <span>{v.label}</span>
            <span className={`text-[10px] px-1.5 rounded-full font-bold ${view === v.key ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-600'}`}>
              {viewCounts[v.key]}
            </span>
          </button>
        ))}
        <div className="flex-1" />
        {/* Status filter chips */}
        <div className="flex items-center gap-1">
          {statusFilters.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${filter === f.value ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f.label}
              {f.value && counts[f.value] ? ` (${counts[f.value]})` : ''}
            </button>
          ))}
          {/* Date filter */}
          <input
            type="date"
            value={plannedDate}
            onChange={(e) => setPlannedDate(e.target.value)}
            className="ml-2 border border-gray-200 rounded px-2 py-1 text-xs"
            title="Lọc theo ngày"
          />
          {plannedDate && (
            <button onClick={() => setPlannedDate('')} className="text-brand-600 text-xs hover:underline ml-1">Xóa ngày</button>
          )}
        </div>
      </div>

      {/* Search + bulk action bar */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Tìm mã chuyến, biển số, tài xế..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
        </div>
        <span className="text-sm text-gray-500">{filtered.length} chấn / trang • tổng {totalRows.toLocaleString('vi-VN')}</span>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-50 border border-brand-200 rounded-lg">
            <span className="text-sm font-medium text-brand-700">{selected.size} đã chọn</span>
            <button onClick={() => setSelected(new Set())} className="text-xs text-brand-500 hover:underline">Bỏ chọn</button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b animate-pulse">
              <div className="w-4 h-4 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded w-32" />
              <div className="h-4 bg-gray-200 rounded w-20" />
              <div className="h-4 bg-gray-200 rounded w-24 flex-1" />
              <div className="h-6 bg-gray-200 rounded-full w-20" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-16 text-center">
          <div className="text-5xl mb-4">🚛</div>
          <h3 className="text-base font-semibold text-gray-700 mb-1">
            {view === 'today' ? 'Không có chuyến nào hôm nay' : 'Không tìm thấy chuyến xe'}
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            {view === 'today' ? 'Tạo chuyến từ trang lập kế hoạch' : 'Thử bỏ bộ lọc hoặc tìm kiếm khác'}
          </p>
          <Link href="/dashboard/planning" className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition">
            Đến Lập kế hoạch →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="py-2.5 px-3 w-8">
                  <input type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="rounded border-gray-300 text-brand-500" />
                </th>
                <th className="text-left py-2.5 px-3 font-medium text-gray-600">Mã chuyến</th>
                <th className="text-left py-2.5 px-3 font-medium text-gray-600">Xe / Tài xế</th>
                <th className="text-center py-2.5 px-3 font-medium text-gray-600">Điểm</th>
                <th className="text-right py-2.5 px-3 font-medium text-gray-600">Quãng đường</th>
                <th className="text-right py-2.5 px-3 font-medium text-gray-600">Tải trọng</th>
                <th className="text-center py-2.5 px-3 font-medium text-gray-600">Trạng thái</th>
                <th className="text-center py-2.5 px-3 font-medium text-gray-600">Ngày giao</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}
                  className={`border-t transition ${selected.has(t.id) ? 'bg-brand-50' : 'hover:bg-gray-50'}`}>
                  <td className="py-2.5 px-3">
                    <input type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggleSelect(t.id)}
                      className="rounded border-gray-300 text-brand-500" />
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[t.status] || 'bg-gray-300'}`} />
                      <span className="font-mono font-medium text-gray-800">{t.trip_number}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-gray-800">{t.vehicle_plate}</div>
                    <div className="text-xs text-gray-400">{t.driver_name || '—'}</div>
                  </td>
                  <td className="py-2.5 px-3 text-center text-gray-600">{t.total_stops}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{t.total_distance_km?.toFixed(1)} km</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{(t.total_weight_kg || 0).toFixed(0)} kg</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[t.status] || 'bg-gray-100 text-gray-600'}`}>
                      {statusLabels[t.status] || t.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center text-gray-500 text-xs">
                    {new Date(t.planned_date).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <Link href={`/dashboard/trips/${t.id}`}
                      className="text-xs font-medium text-brand-500 hover:text-brand-700 whitespace-nowrap">
                      Chi tiết →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalRows > 0 && (
            <Pagination
              page={page}
              limit={limit}
              total={totalRows}
              onPageChange={setPage}
              onLimitChange={(n) => { setLimit(n); setPage(1) }}
              className="border-t bg-gray-50"
            />
          )}
        </div>
      )}
    </div>
  )
}

