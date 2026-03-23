'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, getUser } from '@/lib/api'

interface AuditLog {
  id: string
  entity_type: string
  entity_id: string
  event_type: string
  actor_type: string
  actor_id?: string
  actor_name: string
  title: string
  detail?: Record<string, unknown>
  created_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

const entityTypeLabels: Record<string, string> = {
  order: 'Đơn hàng',
  trip: 'Chuyến xe',
  stop: 'Điểm giao',
  shipment: 'Lô hàng',
  vehicle: 'Phương tiện',
  driver: 'Tài xế',
  customer: 'Khách hàng',
  product: 'Sản phẩm',
  warehouse: 'Kho',
  user: 'Người dùng',
  picking_order: 'Lệnh soạn',
  gate_check: 'Kiểm tra cổng',
  reconciliation: 'Đối soát',
  payment: 'Thanh toán',
  notification: 'Thông báo',
}

const entityTypeColors: Record<string, string> = {
  order: 'bg-blue-100 text-blue-700',
  trip: 'bg-purple-100 text-purple-700',
  stop: 'bg-indigo-100 text-indigo-700',
  vehicle: 'bg-amber-100 text-amber-700',
  driver: 'bg-teal-100 text-teal-700',
  customer: 'bg-green-100 text-green-700',
  user: 'bg-red-100 text-red-700',
}

export default function AuditLogsPage() {
  const router = useRouter()
  const user = getUser()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, total_pages: 0 })
  const [loading, setLoading] = useState(true)

  // Filters
  const [entityType, setEntityType] = useState('')
  const [eventType, setEventType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role !== 'admin') {
      router.replace('/dashboard')
      return
    }
    loadData(1)
  }, [])

  const loadData = useCallback(async (page: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '50')
      if (entityType) params.set('entity_type', entityType)
      if (eventType) params.set('event_type', eventType)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)

      const res: any = await apiFetch(`/admin/audit-logs?${params}`)
      setLogs(res.data?.data || [])
      setPagination(res.data?.pagination || { page: 1, limit: 50, total: 0, total_pages: 0 })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [entityType, eventType, dateFrom, dateTo])

  const handleFilter = () => {
    loadData(1)
  }

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.total_pages) return
    loadData(newPage)
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📋 Nhật ký hệ thống</h1>
          <p className="text-sm text-gray-500">Audit log — Lịch sử mọi thay đổi trong hệ thống (entity_events)</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/settings')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Quản trị hệ thống
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap gap-3 items-end">
        <label className="block">
          <span className="text-xs text-gray-500">Đối tượng</span>
          <select value={entityType} onChange={e => setEntityType(e.target.value)}
            className="block mt-1 px-3 py-1.5 border rounded-lg text-sm">
            <option value="">Tất cả</option>
            {Object.entries(entityTypeLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Loại sự kiện</span>
          <input type="text" value={eventType} onChange={e => setEventType(e.target.value)}
            placeholder="vd: status_changed"
            className="block mt-1 px-3 py-1.5 border rounded-lg text-sm w-48" />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Từ ngày</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="block mt-1 px-3 py-1.5 border rounded-lg text-sm" />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Đến ngày</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="block mt-1 px-3 py-1.5 border rounded-lg text-sm" />
        </label>
        <button onClick={handleFilter}
          className="px-4 py-1.5 bg-brand-500 text-white rounded-lg text-sm hover:bg-brand-600">
          Lọc
        </button>
      </div>

      {/* Results */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <p className="text-lg font-medium">Chưa có sự kiện nào</p>
            <p className="text-sm mt-1">Các hoạt động trong hệ thống sẽ được ghi lại tại đây</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Thời gian</th>
                  <th className="px-4 py-3 font-medium">Đối tượng</th>
                  <th className="px-4 py-3 font-medium">Sự kiện</th>
                  <th className="px-4 py-3 font-medium">Nội dung</th>
                  <th className="px-4 py-3 font-medium">Người thực hiện</th>
                  <th className="px-4 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map(log => (
                  <>
                    <tr key={log.id} className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{log.created_at}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${entityTypeColors[log.entity_type] || 'bg-gray-100 text-gray-600'}`}>
                          {entityTypeLabels[log.entity_type] || log.entity_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-600">{log.event_type}</td>
                      <td className="px-4 py-3 text-gray-800 truncate max-w-xs">{log.title}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <span className="text-xs">{log.actor_name || '—'}</span>
                        <span className="text-xs text-gray-400 ml-1">({log.actor_type})</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{log.detail ? '▾' : ''}</td>
                    </tr>
                    {expandedId === log.id && log.detail && (
                      <tr key={`${log.id}-detail`}>
                        <td colSpan={6} className="px-4 py-3 bg-gray-50">
                          {isConfigChange(log) ? (
                            <ConfigDiffView detail={log.detail} />
                          ) : (
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all max-h-48 overflow-auto">
                            {JSON.stringify(log.detail, null, 2)}
                          </pre>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t text-sm">
              <span className="text-gray-500">
                Hiển thị {logs.length} / {pagination.total} sự kiện
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-100"
                >
                  ← Trước
                </button>
                <span className="px-3 py-1 text-gray-600">
                  Trang {pagination.page} / {pagination.total_pages || 1}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.total_pages}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-100"
                >
                  Sau →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function isConfigChange(log: AuditLog): boolean {
  return log.entity_type === 'config' && log.event_type === 'config_updated' && !!(log.detail as any)?.changes
}

function ConfigDiffView({ detail }: { detail: Record<string, unknown> }) {
  const changes = (detail as any).changes as Array<{ key: string; before: string; after: string }> | undefined
  if (!changes || changes.length === 0) {
    return <p className="text-xs text-gray-400">Không có thay đổi</p>
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-700 mb-2">Thay đổi cấu hình:</p>
      {changes.map((c, i) => (
        <div key={i} className="flex items-start gap-3 text-xs bg-white rounded-lg p-2 border">
          <span className="font-mono font-medium text-gray-800 min-w-[180px]">{c.key}</span>
          <div className="flex-1 flex gap-2">
            {c.before && (
              <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded line-through">{c.before}</span>
            )}
            <span className="text-gray-400">→</span>
            <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded font-medium">{c.after}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
