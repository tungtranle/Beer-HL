'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { handleError } from '@/lib/handleError'
import { toast } from '@/lib/useToast'

interface Route {
  id: string; code: string; name: string
  warehouse_id: string; warehouse_name: string
  customer_ids: string[]; customer_count: number; created_at: string
}
interface Warehouse { id: string; name: string }

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editRoute, setEditRoute] = useState<Route | null>(null)
  const [form, setForm] = useState({ code: '', name: '', warehouse_id: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const [rRes, wRes]: any[] = await Promise.all([
        apiFetch('/admin/routes'),
        apiFetch('/warehouses'),
      ])
      setRoutes(rRes.data || [])
      setWarehouses(wRes.data || [])
    } catch (err) { handleError(err, { userMessage: 'Không tải được danh sách tuyến/kho' }) }
    finally { setLoading(false) }
  }

  const openCreate = () => {
    setEditRoute(null)
    setForm({ code: '', name: '', warehouse_id: warehouses[0]?.id || '' })
    setShowModal(true)
  }

  const openEdit = (r: Route) => {
    setEditRoute(r)
    setForm({ code: r.code, name: r.name, warehouse_id: r.warehouse_id })
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editRoute) {
        await apiFetch(`/admin/routes/${editRoute.id}`, {
          method: 'PUT',
          body: { code: form.code, name: form.name, warehouse_id: form.warehouse_id },
        })
      } else {
        await apiFetch('/admin/routes', {
          method: 'POST',
          body: { code: form.code, name: form.name, warehouse_id: form.warehouse_id, customer_ids: [] },
        })
      }
      setShowModal(false)
      await load()
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa tuyến giao hàng này?')) return
    try {
      await apiFetch(`/admin/routes/${id}`, { method: 'DELETE' })
      await load()
    } catch (err: any) { toast.error(err.message) }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div></div>
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🛣️ Tuyến giao hàng</h1>
        <button onClick={openCreate}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600">
          + Thêm tuyến
        </button>
      </div>

      {routes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Chưa có tuyến giao hàng nào</p>
          <p className="text-sm mt-1">Tạo tuyến mới để gán NPP vào lộ trình giao hàng cố định</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">Mã tuyến</th>
                <th className="text-left px-4 py-3">Tên tuyến</th>
                <th className="text-left px-4 py-3">Kho</th>
                <th className="text-center px-4 py-3">Số NPP</th>
                <th className="text-right px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {routes.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium">{r.code}</td>
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3 text-gray-500">{r.warehouse_name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{r.customer_count || 0}</span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(r)} className="text-blue-600 hover:underline text-xs">Sửa</button>
                    <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:underline text-xs">Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold">{editRoute ? 'Sửa tuyến' : 'Thêm tuyến mới'}</h2>
            <div>
              <label className="text-sm font-medium text-gray-700">Mã tuyến</label>
              <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="VD: T01-HN" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Tên tuyến</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="VD: Tuyến Hà Nội Bắc" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Kho</label>
              <select value={form.warehouse_id} onChange={e => setForm({ ...form, warehouse_id: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Hủy</button>
              <button onClick={handleSave} disabled={saving || !form.code || !form.name}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50">
                {saving ? 'Đang lưu...' : editRoute ? 'Cập nhật' : 'Tạo mới'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
