'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, getUser } from '@/lib/api'
import { handleError } from '@/lib/handleError'
import { toast } from '@/lib/useToast'

interface CreditLimit {
  id: string
  customer_id: string
  customer_name: string
  customer_code: string
  credit_limit: number
  effective_from: string
  effective_to?: string
  created_at: string
}

const formatVND = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' ₫'

export default function CreditLimitsPage() {
  const router = useRouter()
  const user = getUser()
  const [limits, setLimits] = useState<CreditLimit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<CreditLimit | null>(null)
  const [form, setForm] = useState({ customer_id: '', credit_limit: '', effective_from: '', effective_to: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user?.role !== 'admin') {
      router.replace('/dashboard')
      return
    }
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/admin/credit-limits')
      setLimits(res.data || [])
    } catch (err) {
      handleError(err, { userMessage: 'Không tải được hạn mức công nợ' })
    } finally {
      setLoading(false)
    }
  }

  const filtered = limits.filter(l => {
    if (!search) return true
    const q = search.toLowerCase()
    return l.customer_name.toLowerCase().includes(q) || l.customer_code.toLowerCase().includes(q)
  })

  const openCreate = () => {
    setEditItem(null)
    setForm({ customer_id: '', credit_limit: '', effective_from: new Date().toISOString().slice(0, 10), effective_to: '' })
    setError('')
    setShowModal(true)
  }

  const openEdit = (item: CreditLimit) => {
    setEditItem(item)
    setForm({
      customer_id: item.customer_id,
      credit_limit: String(item.credit_limit),
      effective_from: item.effective_from,
      effective_to: item.effective_to || '',
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      if (editItem) {
        await apiFetch(`/admin/credit-limits/${editItem.id}`, {
          method: 'PUT',
          body: {
            credit_limit: parseFloat(form.credit_limit) || undefined,
            effective_to: form.effective_to || undefined,
          },
        })
      } else {
        if (!form.customer_id || !form.credit_limit) {
          setError('Vui lòng nhập đầy đủ thông tin')
          setSaving(false)
          return
        }
        await apiFetch('/admin/credit-limits', {
          method: 'POST',
          body: {
            customer_id: form.customer_id,
            credit_limit: parseFloat(form.credit_limit),
            effective_from: form.effective_from,
            effective_to: form.effective_to || null,
          },
        })
      }
      setShowModal(false)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Xóa hạn mức tín dụng của "${name}"?`)) return
    try {
      await apiFetch(`/admin/credit-limits/${id}`, { method: 'DELETE' })
      await loadData()
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800"> Hạn mức tín dụng</h1>
          <p className="text-sm text-gray-500">Quản lý hạn mức công nợ cho từng khách hàng</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/dashboard/settings')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Quản trị
          </button>
          <button onClick={openCreate}
            className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">
            + Thêm hạn mức
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Tìm theo tên hoặc mã khách hàng..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full md:w-80 px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Khách hàng</th>
              <th className="px-4 py-3 font-medium text-right">Hạn mức</th>
              <th className="px-4 py-3 font-medium">Hiệu lực từ</th>
              <th className="px-4 py-3 font-medium">Đến</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  {search ? 'Không tìm thấy kết quả' : 'Chưa có hạn mức nào. Nhấn "Thêm hạn mức" để tạo mới.'}
                </td>
              </tr>
            ) : (
              filtered.map(l => {
                const today = new Date().toISOString().slice(0, 10)
                const isActive = l.effective_from <= today && (!l.effective_to || l.effective_to >= today)
                const isExpired = l.effective_to && l.effective_to < today
                return (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{l.customer_name}</div>
                      <div className="text-xs text-gray-400">{l.customer_code}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">{formatVND(l.credit_limit)}</td>
                    <td className="px-4 py-3 text-gray-600">{l.effective_from}</td>
                    <td className="px-4 py-3 text-gray-600">{l.effective_to || '—'}</td>
                    <td className="px-4 py-3">
                      {isExpired ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Hết hạn</span>
                      ) : isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Đang áp dụng</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">Chưa hiệu lực</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => openEdit(l)} className="text-brand-500 hover:underline text-xs mr-3">Sửa</button>
                      <button onClick={() => handleDelete(l.id, l.customer_name)} className="text-red-500 hover:underline text-xs">Xóa</button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{editItem ? 'Sửa hạn mức' : 'Thêm hạn mức tín dụng'}</h2>
            {error && <div className="mb-3 p-2 bg-red-50 text-red-700 text-sm rounded">{error}</div>}

            {!editItem && (
              <label className="block mb-3">
                <span className="text-sm text-gray-600">Customer ID</span>
                <input type="text" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="UUID khách hàng" />
              </label>
            )}

            <label className="block mb-3">
              <span className="text-sm text-gray-600">Hạn mức (VNĐ)</span>
              <input type="number" value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="50000000" />
            </label>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="block">
                <span className="text-sm text-gray-600">Từ ngày</span>
                <input type="date" value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" disabled={!!editItem} />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">Đến ngày (tùy chọn)</span>
                <input type="date" value={form.effective_to} onChange={e => setForm(f => ({ ...f, effective_to: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">Hủy</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
                {saving ? 'Đang lưu...' : editItem ? 'Cập nhật' : 'Tạo mới'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
