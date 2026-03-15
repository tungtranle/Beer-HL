'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface Product {
  id: string
  sku: string
  name: string
  unit: string
  weight_kg: number
  volume_m3: number
  price: number
  deposit_price: number
  category: string | null
  is_active: boolean
}

const emptyProduct: Omit<Product, 'id' | 'is_active'> = {
  sku: '', name: '', unit: 'thùng', weight_kg: 0, volume_m3: 0,
  price: 0, deposit_price: 0, category: null,
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [form, setForm] = useState<Omit<Product, 'id' | 'is_active'>>(emptyProduct)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    apiFetch<any>('/products').then(res => {
      setProducts(res.data || [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  const formatVND = (n: number) => n.toLocaleString('vi-VN') + ' ₫'

  const openCreate = () => {
    setForm(emptyProduct)
    setEditId(null)
    setModal('create')
  }

  const openEdit = (p: Product) => {
    setForm({ sku: p.sku, name: p.name, unit: p.unit, weight_kg: p.weight_kg, volume_m3: p.volume_m3, price: p.price, deposit_price: p.deposit_price, category: p.category })
    setEditId(p.id)
    setModal('edit')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (modal === 'create') {
        await apiFetch('/products', { method: 'POST', body: { ...form, is_active: true } })
      } else if (modal === 'edit' && editId) {
        await apiFetch(`/products/${editId}`, { method: 'PUT', body: { ...form, is_active: true } })
      }
      setModal(null)
      load()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Vô hiệu hóa sản phẩm "${name}"?`)) return
    try {
      await apiFetch(`/products/${id}`, { method: 'DELETE' })
      load()
    } catch (e: any) {
      alert(e.message)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Đang tải...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📦 Danh mục sản phẩm</h1>
          <p className="text-sm text-gray-500 mt-1">{products.length} sản phẩm</p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Tìm theo tên, SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm w-64 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
          />
          <button onClick={openCreate} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">
            + Thêm sản phẩm
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tên sản phẩm</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Danh mục</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">ĐVT</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Trọng lượng</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Đơn giá</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Giá cọc vỏ</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Trạng thái</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                <td className="px-4 py-3 text-gray-600">{p.category || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{p.unit}</td>
                <td className="px-4 py-3 text-right text-gray-600">{p.weight_kg} kg</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{formatVND(p.price)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{formatVND(p.deposit_price)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {p.is_active ? 'Hoạt động' : 'Ngưng'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => openEdit(p)} className="text-blue-600 hover:underline text-xs mr-2">Sửa</button>
                  <button onClick={() => handleDelete(p.id, p.name)} className="text-red-600 hover:underline text-xs">Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400">Không tìm thấy sản phẩm nào</div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold mb-4">{modal === 'create' ? 'Thêm sản phẩm' : 'Sửa sản phẩm'}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">SKU</label>
                <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tên sản phẩm</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Đơn vị tính</label>
                <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Danh mục</label>
                <input value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value || null })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Trọng lượng (kg)</label>
                <input type="number" step="0.01" value={form.weight_kg} onChange={e => setForm({ ...form, weight_kg: parseFloat(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Thể tích (m³)</label>
                <input type="number" step="0.0001" value={form.volume_m3} onChange={e => setForm({ ...form, volume_m3: parseFloat(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Đơn giá (₫)</label>
                <input type="number" value={form.price} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Giá cọc vỏ (₫)</label>
                <input type="number" value={form.deposit_price} onChange={e => setForm({ ...form, deposit_price: parseFloat(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModal(null)} className="px-4 py-2 border rounded-lg text-sm">Hủy</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
