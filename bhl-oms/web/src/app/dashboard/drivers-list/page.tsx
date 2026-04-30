'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'
import { PageHeader, Input, Button } from '@/components/ui'
import { Users, Plus, Search } from 'lucide-react'

interface Driver {
  id: string
  full_name: string
  phone: string
  license_number: string | null
  status: string
  warehouse_id: string
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  on_trip: 'bg-blue-100 text-blue-700',
  off_duty: 'bg-gray-100 text-gray-600',
  inactive: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  active: 'Sẵn sàng',
  on_trip: 'Đang chạy',
  off_duty: 'Nghỉ',
  inactive: 'Ngưng',
}

const emptyDriver = {
  full_name: '', phone: '', license_number: null as string | null,
  status: 'active', warehouse_id: 'a0000000-0000-0000-0000-000000000001',
}

export default function DriversListPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [form, setForm] = useState(emptyDriver)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    apiFetch<any>('/drivers').then(res => {
      setDrivers(res.data || [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const _filtered = drivers.filter(d =>
    d.full_name.toLowerCase().includes(search.toLowerCase()) ||
    d.phone.includes(search)
  )

  const openCreate = () => {
    setForm(emptyDriver)
    setEditId(null)
    setModal('create')
  }

  const openEdit = (d: Driver) => {
    setForm({ full_name: d.full_name, phone: d.phone, license_number: d.license_number, status: d.status, warehouse_id: d.warehouse_id })
    setEditId(d.id)
    setModal('edit')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (modal === 'create') {
        await apiFetch('/drivers', { method: 'POST', body: form })
      } else if (modal === 'edit' && editId) {
        await apiFetch(`/drivers/${editId}`, { method: 'PUT', body: form })
      }
      setModal(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Vô hiệu hóa tài xế "${name}"?`)) return
    try {
      await apiFetch(`/drivers/${id}`, { method: 'DELETE' })
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const [statusFilter, setStatusFilter] = useState('')

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Đang tải...</div>
  }
  const activeCount = drivers.filter(d => d.status === 'active').length
  const onTripCount = drivers.filter(d => d.status === 'on_trip').length

  const filteredDrivers = drivers
    .filter(d => !statusFilter || d.status === statusFilter)
    .filter(d => d.full_name.toLowerCase().includes(search.toLowerCase()) || d.phone.includes(search))

  return (
    <div>
      <PageHeader
        title="Danh sách tài xế"
        subtitle={`${drivers.length} tài xế · ${activeCount} sẵn sàng · ${onTripCount} đang chạy`}
        icon={Users}
        iconTone="neutral"
        actions={
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
              <Input
                type="text"
                placeholder="Tìm theo tên, SĐT..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button variant="primary" size="sm" leftIcon={Plus} onClick={openCreate}>Thêm tài xế</Button>
          </div>
        }
      />

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${!statusFilter ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          Tất cả ({drivers.length})
        </button>
        {Object.entries(statusLabels).map(([k, v]) => {
          const count = drivers.filter(d => d.status === k).length
          if (count === 0) return null
          return (
            <button key={k} onClick={() => setStatusFilter(k === statusFilter ? '' : k)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${statusFilter === k ? 'ring-2 ring-offset-1 ring-brand-500' : ''} ${statusColors[k]}`}>
              {v} ({count})
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tài xế</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Số điện thoại</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Số GPLX</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Trạng thái</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredDrivers.map(d => {
              const initials = d.full_name.split(' ').slice(-2).map(n => n[0]).join('').toUpperCase()
              return (
                <tr key={d.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {initials}
                      </div>
                      <span className="font-medium text-gray-900">{d.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{d.phone}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.license_number || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[d.status] || 'bg-gray-100 text-gray-600'}`}>
                      {statusLabels[d.status] || d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link href={`/dashboard/drivers-list/${d.id}/profile`} className="text-stone-700 hover:underline text-xs mr-2">📜 Hồ sơ</Link>
                    <Link href={`/dashboard/drivers-list/${d.id}/documents`} className="text-brand-500 hover:underline text-xs mr-2">Giấy tờ</Link>
                    <button onClick={() => openEdit(d)} className="text-brand-500 hover:underline text-xs mr-2">Sửa</button>
                    <button onClick={() => handleDelete(d.id, d.full_name)} className="text-red-600 hover:underline text-xs">Xóa</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filteredDrivers.length === 0 && (
          <div className="text-center py-8 text-gray-400">Không tìm thấy tài xế nào</div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{modal === 'create' ? 'Thêm tài xế' : 'Sửa tài xế'}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Họ tên</label>
                <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Số điện thoại</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Số GPLX</label>
                <input value={form.license_number || ''} onChange={e => setForm({ ...form, license_number: e.target.value || null })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Trạng thái</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {Object.entries(statusLabels).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
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
