'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface Customer {
  id: string
  code: string
  name: string
  address: string
  phone: string | null
  latitude: number | null
  longitude: number | null
  province: string | null
  district: string | null
  route_code: string | null
  is_active: boolean
}

const emptyCustomer = {
  code: '', name: '', address: '', phone: null as string | null,
  latitude: null as number | null, longitude: null as number | null,
  province: null as string | null, district: null as string | null,
  route_code: null as string | null,
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [form, setForm] = useState(emptyCustomer)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    apiFetch<any>('/customers').then(res => {
      setCustomers(res.data || [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.address.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setForm(emptyCustomer)
    setEditId(null)
    setModal('create')
  }

  const openEdit = (c: Customer) => {
    setForm({ code: c.code, name: c.name, address: c.address, phone: c.phone, latitude: c.latitude, longitude: c.longitude, province: c.province, district: c.district, route_code: c.route_code })
    setEditId(c.id)
    setModal('edit')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (modal === 'create') {
        await apiFetch('/customers', { method: 'POST', body: { ...form, is_active: true } })
      } else if (modal === 'edit' && editId) {
        await apiFetch(`/customers/${editId}`, { method: 'PUT', body: { ...form, is_active: true } })
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
    if (!confirm(`Vô hiệu hóa khách hàng "${name}"?`)) return
    try {
      await apiFetch(`/customers/${id}`, { method: 'DELETE' })
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Đang tải...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🏪 Danh mục khách hàng</h1>
          <p className="text-sm text-gray-500 mt-1">{customers.length} khách hàng (NPP)</p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Tìm theo tên, mã, địa chỉ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm w-64 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
          <button onClick={openCreate} className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600">
            + Thêm khách hàng
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Mã KH</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tên khách hàng</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Địa chỉ</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">SĐT</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tỉnh/TP</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tuyến</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Trạng thái</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.code}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{c.address}</td>
                <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{c.province || '—'}</td>
                <td className="px-4 py-3">
                  {c.route_code ? (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{c.route_code}</span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {c.is_active ? 'Hoạt động' : 'Ngưng'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => openEdit(c)} className="text-brand-500 hover:underline text-xs mr-2">Sửa</button>
                  <button onClick={() => handleDelete(c.id, c.name)} className="text-red-600 hover:underline text-xs">Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400">Không tìm thấy khách hàng nào</div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold mb-4">{modal === 'create' ? 'Thêm khách hàng' : 'Sửa khách hàng'}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mã KH</label>
                <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tên khách hàng</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Địa chỉ</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">SĐT</label>
                <input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value || null })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tuyến</label>
                <input value={form.route_code || ''} onChange={e => setForm({ ...form, route_code: e.target.value || null })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tỉnh/TP</label>
                <input value={form.province || ''} onChange={e => setForm({ ...form, province: e.target.value || null })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Quận/Huyện</label>
                <input value={form.district || ''} onChange={e => setForm({ ...form, district: e.target.value || null })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Latitude</label>
                <input type="number" step="0.0000001" value={form.latitude ?? ''} onChange={e => setForm({ ...form, latitude: e.target.value ? parseFloat(e.target.value) : null })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
                <input type="number" step="0.0000001" value={form.longitude ?? ''} onChange={e => setForm({ ...form, longitude: e.target.value ? parseFloat(e.target.value) : null })} className="w-full border rounded-lg px-3 py-2 text-sm" />
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
