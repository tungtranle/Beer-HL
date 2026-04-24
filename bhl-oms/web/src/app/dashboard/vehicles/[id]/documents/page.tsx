'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'
import { handleError } from '@/lib/handleError'

interface VehicleDoc {
  id: string
  vehicle_id: string
  doc_type: string
  doc_number: string
  issued_date?: string
  expiry_date: string
  notes?: string
  plate_number: string
  days_to_expiry: number
}

const docTypeLabels: Record<string, string> = {
  registration: 'Đăng ký xe',
  inspection: 'Đăng kiểm',
  insurance: 'Bảo hiểm',
}

const emptyDoc = {
  doc_type: 'registration',
  doc_number: '',
  issued_date: '',
  expiry_date: '',
  notes: '',
}

export default function VehicleDocumentsPage() {
  const params = useParams()
  const router = useRouter()
  const vehicleId = params.id as string
  const [docs, setDocs] = useState<VehicleDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [plateName, setPlateName] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [form, setForm] = useState(emptyDoc)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    apiFetch<any>(`/vehicles/${vehicleId}/documents`)
      .then((r) => {
        const data = r.data || []
        setDocs(data)
        if (data.length > 0) setPlateName(data[0].plate_number)
      })
      .catch(err => handleError(err))
      .finally(() => setLoading(false))

    if (!plateName) {
      apiFetch<any>(`/vehicles/${vehicleId}`)
        .then((r) => setPlateName(r.data?.plate_number || ''))
        .catch(() => {})
    }
  }

  useEffect(() => { load() }, [vehicleId])

  const openCreate = () => {
    setForm(emptyDoc)
    setEditId(null)
    setModal('create')
  }

  const openEdit = (d: VehicleDoc) => {
    setForm({
      doc_type: d.doc_type,
      doc_number: d.doc_number || '',
      issued_date: d.issued_date || '',
      expiry_date: d.expiry_date,
      notes: d.notes || '',
    })
    setEditId(d.id)
    setModal('edit')
  }

  const handleSave = async () => {
    if (!form.doc_type || !form.expiry_date) {
      toast.warning('Loại giấy tờ và ngày hết hạn là bắt buộc')
      return
    }
    setSaving(true)
    try {
      if (modal === 'create') {
        await apiFetch(`/vehicles/${vehicleId}/documents`, { method: 'POST', body: form })
      } else if (modal === 'edit' && editId) {
        await apiFetch(`/vehicles/${vehicleId}/documents/${editId}`, { method: 'PUT', body: form })
      }
      setModal(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, docType: string) => {
    if (!confirm(`Xóa giấy tờ "${docTypeLabels[docType] || docType}"?`)) return
    try {
      await apiFetch(`/vehicles/${vehicleId}/documents/${id}`, { method: 'DELETE' })
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const expiryBadge = (days: number) => {
    if (days <= 0) return 'bg-red-100 text-red-700'
    if (days <= 7) return 'bg-orange-100 text-orange-700'
    if (days <= 30) return 'bg-yellow-100 text-yellow-700'
    return 'bg-green-100 text-green-700'
  }

  const expiryText = (days: number) => {
    if (days <= 0) return 'Đã hết hạn'
    if (days === 1) return 'Còn 1 ngày'
    return `Còn ${days} ngày`
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div></div>

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-1">
            ← Quay lại
          </button>
          <h1 className="text-2xl font-bold text-gray-800">📄 Giấy tờ xe {plateName}</h1>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600">
          + Thêm giấy tờ
        </button>
      </div>

      {docs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          <p className="text-4xl mb-2">📄</p>
          <p>Chưa có giấy tờ nào. Nhấn &quot;+ Thêm giấy tờ&quot; để bắt đầu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((d) => (
            <div key={d.id} className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-gray-800">
                  {docTypeLabels[d.doc_type] || d.doc_type}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${expiryBadge(d.days_to_expiry)}`}>
                  {expiryText(d.days_to_expiry)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                {d.doc_number && (
                  <div><span className="text-gray-400">Số giấy tờ:</span> {d.doc_number}</div>
                )}
                {d.issued_date && (
                  <div><span className="text-gray-400">Ngày cấp:</span> {new Date(d.issued_date).toLocaleDateString('vi-VN')}</div>
                )}
                <div><span className="text-gray-400">Hết hạn:</span> <strong>{new Date(d.expiry_date).toLocaleDateString('vi-VN')}</strong></div>
                {d.notes && (
                  <div className="col-span-2"><span className="text-gray-400">Ghi chú:</span> {d.notes}</div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
                <button onClick={() => openEdit(d)} className="text-brand-500 hover:underline text-xs">Sửa</button>
                <button onClick={() => handleDelete(d.id, d.doc_type)} className="text-red-600 hover:underline text-xs">Xóa</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{modal === 'create' ? 'Thêm giấy tờ' : 'Sửa giấy tờ'}</h2>
            <div className="grid gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Loại giấy tờ *</label>
                <select value={form.doc_type} onChange={e => setForm({ ...form, doc_type: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {Object.entries(docTypeLabels).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Số giấy tờ</label>
                <input value={form.doc_number} onChange={e => setForm({ ...form, doc_number: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ngày cấp</label>
                  <input type="date" value={form.issued_date} onChange={e => setForm({ ...form, issued_date: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ngày hết hạn *</label>
                  <input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ghi chú</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Hủy</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600 disabled:opacity-50">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
