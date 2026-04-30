'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface WorkOrder {
  id: string
  wo_number: string
  vehicle_id: string
  vehicle_plate: string
  driver_name: string
  garage_name: string
  trigger_type: string
  category: string
  priority: string
  description: string
  status: string
  quoted_amount: string
  actual_amount: string
  is_emergency: boolean
  is_recurring: boolean
  created_at: string
}

const statusLabels: Record<string, string> = {
  draft: 'Nháp', quoted: 'Đã báo giá', approved: 'Đã duyệt',
  in_progress: 'Đang sửa', completed: 'Hoàn thành', verified: 'Đã xác nhận', cancelled: 'Đã hủy',
}
const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700', quoted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700', in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-emerald-100 text-emerald-700', verified: 'bg-teal-100 text-teal-700',
  cancelled: 'bg-red-100 text-red-700',
}
const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600', medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600', critical: 'bg-red-100 text-red-600',
}
const categoryLabels: Record<string, string> = {
  engine: 'Động cơ', brake: 'Phanh', tyre: 'Lốp',
  electrical: 'Điện', body: 'Thân xe', ac: 'Điều hoà',
  transmission: 'Hộp số', other: 'Khác',
}

export default function RepairsPage() {
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const [newWO, setNewWO] = useState({ vehicle_id: '', trigger_type: 'driver_report', category: 'engine', priority: 'normal', description: '', is_emergency: false })

  const handleCreate = async () => {
    try {
      await apiFetch('/fleet/work-orders', { method: 'POST', body: JSON.stringify(newWO) })
      toast.success('Đã tạo lệnh sửa chữa')
      setShowCreate(false)
      setNewWO({ vehicle_id: '', trigger_type: 'driver_report', category: 'engine', priority: 'normal', description: '', is_emergency: false })
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const load = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await apiFetch<any>(`/fleet/work-orders?${params}`)
      setOrders(res.data || [])
      setTotal(res.meta?.total || 0)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter])

  const filtered = orders.filter(o =>
    o.wo_number.toLowerCase().includes(search.toLowerCase()) ||
    o.vehicle_plate.toLowerCase().includes(search.toLowerCase()) ||
    o.description.toLowerCase().includes(search.toLowerCase())
  )

  const fmt = (v: string) => {
    const n = parseFloat(v)
    return isNaN(n) ? '0' : n.toLocaleString('vi-VN') + ' ₫'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900"> Lệnh sửa chữa (Work Orders)</h1>
          <p className="text-sm text-gray-500 mt-1">Tổng: {total} lệnh</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600">
          + Tạo lệnh mới
        </button>
      </div>

      {/* Status summary chips */}
      {orders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${!statusFilter ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Tất cả ({orders.length})
          </button>
          {Object.entries(statusLabels).map(([k, v]) => {
            const count = orders.filter(o => o.status === k).length
            if (count === 0) return null
            return (
              <button key={k} onClick={() => setStatusFilter(k === statusFilter ? '' : k)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${statusFilter === k ? 'ring-2 ring-offset-1 ring-brand-500' : ''} ${statusColors[k]}`}>
                {v} ({count})
              </button>
            )
          })}
          {orders.filter(o => o.is_emergency).length > 0 && (
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-600 text-white animate-pulse">
              🚨 Khẩn cấp: {orders.filter(o => o.is_emergency).length}
            </span>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo mã, biển số..."
          className="flex-1 px-3 py-2 border rounded-lg text-sm" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm">
          <option value="">Tất cả trạng thái</option>
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Mã WO</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Xe</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Loại</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Ưu tiên</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Mô tả</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Trạng thái</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Báo giá</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Thực tế</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Không có dữ liệu</td></tr>
            ) : filtered.map(o => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">
                  {o.wo_number}
                  {o.is_emergency && <span className="ml-1 text-red-500">🚨</span>}
                </td>
                <td className="px-4 py-3">{o.vehicle_plate}</td>
                <td className="px-4 py-3">{categoryLabels[o.category] || o.category}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[o.priority] || ''}`}>
                    {o.priority}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-[200px] truncate">{o.description}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[o.status] || ''}`}>
                    {statusLabels[o.status] || o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{fmt(o.quoted_amount)}</td>
                <td className="px-4 py-3 text-right">{fmt(o.actual_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold">Tạo lệnh sửa chữa mới</h2>
            <div className="space-y-3">
              <input value={newWO.vehicle_id} onChange={e => setNewWO({ ...newWO, vehicle_id: e.target.value })}
                placeholder="Vehicle ID (UUID)" className="w-full px-3 py-2 border rounded-lg text-sm" />
              <select value={newWO.trigger_type} onChange={e => setNewWO({ ...newWO, trigger_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="driver_report">Báo cáo tài xế</option>
                <option value="predictive">Dự đoán</option>
                <option value="scheduled">Lịch trình</option>
                <option value="breakdown">Hỏng</option>
                <option value="inspection">Kiểm tra</option>
              </select>
              <select value={newWO.category} onChange={e => setNewWO({ ...newWO, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm">
                {Object.entries(categoryLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={newWO.priority} onChange={e => setNewWO({ ...newWO, priority: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="low">Thấp</option>
                <option value="normal">Bình thường</option>
                <option value="high">Cao</option>
                <option value="emergency">Khẩn cấp</option>
              </select>
              <textarea value={newWO.description} onChange={e => setNewWO({ ...newWO, description: e.target.value })}
                placeholder="Mô tả sự cố..." rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newWO.is_emergency} onChange={e => setNewWO({ ...newWO, is_emergency: e.target.checked })} />
                Khẩn cấp (tự động duyệt nếu ≤ 5 triệu)
              </label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg text-sm">Hủy</button>
              <button onClick={handleCreate} disabled={!newWO.vehicle_id || !newWO.description}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm hover:bg-brand-600 disabled:opacity-50">
                Tạo lệnh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
