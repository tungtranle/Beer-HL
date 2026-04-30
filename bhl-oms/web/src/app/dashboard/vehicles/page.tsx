'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface Vehicle {
  id: string
  plate_number: string
  vehicle_type: string
  capacity_kg: number
  capacity_m3: number | null
  status: string
  warehouse_id: string
  default_driver_id?: string | null
  default_driver_name?: string
}

interface Driver {
  id: string
  full_name: string
  status: string
  warehouse_id: string
}

const vehicleTypeLabels: Record<string, string> = {
  truck_3t5: 'Xe tải 3.5T',
  truck_5t: 'Xe tải 5T',
  truck_8t: 'Xe tải 8T',
  truck_15t: 'Xe tải 15T',
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  maintenance: 'bg-amber-100 text-amber-700',
  inactive: 'bg-red-100 text-red-700',
  broken: 'bg-red-100 text-red-700',
  impounded: 'bg-gray-100 text-gray-700',
}

const statusLabels: Record<string, string> = {
  active: 'Hoạt động',
  maintenance: 'Bảo trì',
  inactive: 'Ngưng',
  broken: 'Hỏng',
  impounded: 'Tạm giữ',
}

const emptyVehicle = {
  plate_number: '', vehicle_type: 'truck_5t', capacity_kg: 5000,
  capacity_m3: null as number | null, status: 'active',
  warehouse_id: 'a0000000-0000-0000-0000-000000000001',
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [form, setForm] = useState(emptyVehicle)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([
      apiFetch<any>('/vehicles'),
      apiFetch<any>('/drivers'),
    ]).then(([vRes, dRes]) => {
      setVehicles(vRes.data || [])
      setDrivers((dRes.data || []).filter((d: Driver) => d.status === 'active'))
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = vehicles.filter(v =>
    v.plate_number.toLowerCase().includes(search.toLowerCase()) ||
    (vehicleTypeLabels[v.vehicle_type] || v.vehicle_type).toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setForm(emptyVehicle)
    setEditId(null)
    setModal('create')
  }

  const openEdit = (v: Vehicle) => {
    setForm({ plate_number: v.plate_number, vehicle_type: v.vehicle_type, capacity_kg: v.capacity_kg, capacity_m3: v.capacity_m3, status: v.status, warehouse_id: v.warehouse_id })
    setEditId(v.id)
    setModal('edit')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (modal === 'create') {
        await apiFetch('/vehicles', { method: 'POST', body: form })
      } else if (modal === 'edit' && editId) {
        await apiFetch(`/vehicles/${editId}`, { method: 'PUT', body: form })
      }
      setModal(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, plate: string) => {
    if (!confirm(`Vô hiệu hóa xe "${plate}"?`)) return
    try {
      await apiFetch(`/vehicles/${id}`, { method: 'DELETE' })
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const handleSetDefaultDriver = async (vehicleId: string, driverId: string | null) => {
    try {
      await apiFetch(`/vehicles/${vehicleId}/default-driver`, {
        method: 'PUT',
        body: { driver_id: driverId || null },
      })
      toast.success('Đã cập nhật tài xế mặc định')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  if (loading) {
    return (
      <div>
        <div className="h-8 bg-gray-200 rounded w-64 animate-pulse mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-gray-100 rounded-xl h-20 animate-pulse" />)}
        </div>
        <div className="bg-white rounded-xl border overflow-hidden">
          {[...Array(5)].map((_, i) => <div key={i} className="flex gap-4 px-4 py-3 border-b">
            <div className="h-4 bg-gray-100 rounded w-24 animate-pulse" />
            <div className="h-4 bg-gray-100 rounded w-32 animate-pulse" />
            <div className="h-4 bg-gray-100 rounded w-20 animate-pulse" />
          </div>)}
        </div>
      </div>
    )
  }

  const activeCount = vehicles.filter(v => v.status === 'active').length
  const filteredByStatus = filtered.filter(v => !statusFilter || v.status === statusFilter)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🚗 Danh sách phương tiện</h1>
          <p className="text-sm text-gray-500 mt-1">{vehicles.length} phương tiện ({activeCount} đang hoạt động)</p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Tìm theo biển số, loại xe..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm w-64 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
          <button onClick={openCreate} className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600">
            + Thêm xe
          </button>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${!statusFilter ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          Tất cả ({vehicles.length})
        </button>
        {Object.entries(statusLabels).map(([s, lbl]) => {
          const cnt = vehicles.filter(v => v.status === s).length
          if (cnt === 0) return null
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${statusFilter === s ? 'bg-brand-500 text-white' : `${statusColors[s] || 'bg-gray-100 text-gray-600'} hover:opacity-80`}`}>
              {lbl} ({cnt})
            </button>
          )
        })}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {Object.entries(vehicleTypeLabels).map(([type, label]) => {
          const count = vehicles.filter(v => v.vehicle_type === type).length
          return (
            <div key={type} className="bg-white rounded-xl border p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{count}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Biển số</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Loại xe</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Tải trọng (kg)</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Thể tích (m³)</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tài xế mặc định</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Trạng thái</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredByStatus.map(v => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-bold text-gray-900">{v.plate_number}</td>
                <td className="px-4 py-3 text-gray-600">{vehicleTypeLabels[v.vehicle_type] || v.vehicle_type}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{v.capacity_kg.toLocaleString('vi-VN')}</td>
                <td className="px-4 py-3 text-right text-gray-600">{v.capacity_m3 ? v.capacity_m3.toFixed(1) : '—'}</td>
                <td className="px-4 py-3">
                  <select
                    value={v.default_driver_id || ''}
                    onChange={e => handleSetDefaultDriver(v.id, e.target.value || null)}
                    className="text-xs border rounded px-2 py-1 w-full max-w-[160px] bg-white"
                  >
                    <option value="">— Chưa gán —</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.full_name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[v.status] || 'bg-gray-100 text-gray-600'}`}>
                    {statusLabels[v.status] || v.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <Link href={`/dashboard/vehicles/${v.id}/profile`} className="text-stone-700 hover:underline text-xs mr-2">📜 Hồ sơ</Link>
                  <Link href={`/dashboard/vehicles/${v.id}/documents`} className="text-brand-500 hover:underline text-xs mr-2">Giấy tờ</Link>
                  <button onClick={() => openEdit(v)} className="text-brand-500 hover:underline text-xs mr-2">Sửa</button>
                  <button onClick={() => handleDelete(v.id, v.plate_number)} className="text-red-600 hover:underline text-xs">Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400">Không tìm thấy phương tiện nào</div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{modal === 'create' ? 'Thêm phương tiện' : 'Sửa phương tiện'}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Biển số</label>
                <input value={form.plate_number} onChange={e => setForm({ ...form, plate_number: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Loại xe</label>
                <select value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {Object.entries(vehicleTypeLabels).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Trạng thái</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {Object.entries(statusLabels).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tải trọng (kg)</label>
                <input type="number" value={form.capacity_kg || ''} onChange={e => setForm({ ...form, capacity_kg: parseFloat(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Thể tích (m³)</label>
                <input type="number" step="0.1" value={form.capacity_m3 || ''} onChange={e => setForm({ ...form, capacity_m3: e.target.value ? parseFloat(e.target.value) : null })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModal(null)} className="px-4 py-2 border rounded-lg text-sm">Hủy</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
