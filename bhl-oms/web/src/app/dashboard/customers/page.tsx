'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'
import { NppHealthBadge, type NppHealth } from '@/components/ui/NppHealthBadge'
import { Pagination } from '@/components/ui/Pagination'
import { PageHeader, LoadingState } from '@/components/ui'
import { Store, AlertTriangle } from 'lucide-react'

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

interface NPPZaloDraft {
  customer_id: string
  customer_name: string
  health_score: number
  draft_message: string
  reason: string
  provider: string
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
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [totalRows, setTotalRows] = useState(0)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [form, setForm] = useState(emptyCustomer)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [zaloDraft, setZaloDraft] = useState<NPPZaloDraft | null>(null)
  const [draftLoadingId, setDraftLoadingId] = useState<string | null>(null)

  // F2 — NPP health scores by code (batched, fetch-once-per-load).
  const [healthMap, setHealthMap] = useState<Record<string, NppHealth>>({})
  const [healthLoading, setHealthLoading] = useState(false)

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('q', debouncedSearch)
    params.set('page', String(page))
    params.set('limit', String(limit))
    apiFetch<any>(`/customers?${params}`).then(res => {
      setCustomers(res.data || [])
      setTotalRows(res.meta?.total ?? (res.data?.length || 0))
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [debouncedSearch, page, limit])

  // Debounce search input → server query
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  // F2 — fetch NPP health once customers loaded.
  // Uses bulk endpoint: GET /v1/ml/npp/health?risk_band=... × 3 calls (GREEN/YELLOW/RED).
  // Map by npp_code so table can lookup by customer.code.
  useEffect(() => {
    if (customers.length === 0) return
    setHealthLoading(true)
    Promise.all([
      apiFetch<any>('/ml/npp/health?risk_band=GREEN&limit=500').then((r) => r.data || []).catch(() => []),
      apiFetch<any>('/ml/npp/health?risk_band=YELLOW&limit=500').then((r) => r.data || []).catch(() => []),
      apiFetch<any>('/ml/npp/health?risk_band=RED&limit=500').then((r) => r.data || []).catch(() => []),
    ]).then(([g, y, r]) => {
      const m: Record<string, NppHealth> = {}
      for (const h of [...g, ...y, ...r]) m[h.npp_code] = h
      setHealthMap(m)
    }).finally(() => setHealthLoading(false))
  }, [customers.length])

  const [provinceFilter, setProvinceFilter] = useState('')
  const provinces = Array.from(new Set(customers.map(c => c.province || '').filter(Boolean))).sort()

  // Province filter chỉ lọc trên trang hiện tại (server không hỗ trợ filter tỉnh — tạm thời).
  const filtered = customers.filter(c => !provinceFilter || c.province === provinceFilter)

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

  const openZaloDraft = async (customer: Customer) => {
    setDraftLoadingId(customer.id)
    try {
      const res: any = await apiFetch('/ai/npp-zalo-draft', { method: 'POST', body: { customer_id: customer.id } })
      setZaloDraft(res.data || null)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setDraftLoadingId(null)
    }
  }

  if (loading) {
    return <LoadingState size="section" />
  }

  return (
    <div>
      <PageHeader
        title="Danh mục khách hàng"
        icon={Store}
        iconTone="brand"
        subtitle={`${totalRows.toLocaleString('vi-VN')} khách hàng (NPP)`}
        actions={
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
        }
      />

      {/* Province filter chips */}
      {provinces.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          <button onClick={() => setProvinceFilter('')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${!provinceFilter ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Tất cả ({customers.length})
          </button>
          {provinces.map(p => {
            const cnt = customers.filter(c => c.province === p).length
            return (
              <button key={p} onClick={() => setProvinceFilter(provinceFilter === p ? '' : p)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${provinceFilter === p ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {p} ({cnt})
              </button>
            )
          })}
        </div>
      )}

      {/* F2 — NPP Risk Band Summary */}
      {Object.keys(healthMap).length > 0 && (() => {
        const redCount = Object.values(healthMap).filter(h => h.risk_band === 'RED').length
        const yellowCount = Object.values(healthMap).filter(h => h.risk_band === 'YELLOW').length
        const greenCount = Object.values(healthMap).filter(h => h.risk_band === 'GREEN').length
        return (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <div className="text-3xl font-bold text-red-600">{redCount}</div>
              <div>
                <div className="text-sm font-semibold text-red-700">Nguy cơ cao</div>
                <div className="text-xs text-red-500">Cần liên hệ ngay</div>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <div className="text-3xl font-bold text-amber-600">{yellowCount}</div>
              <div>
                <div className="text-sm font-semibold text-amber-700">Cần theo dõi</div>
                <div className="text-xs text-amber-500">Có dấu hiệu giảm</div>
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <div className="text-3xl font-bold text-green-600">{greenCount}</div>
              <div>
                <div className="text-sm font-semibold text-green-700">Khỏe mạnh</div>
                <div className="text-xs text-green-500">Ổn định</div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* F2 — At-risk NPP Quick Actions */}
      {Object.values(healthMap).filter(h => h.risk_band === 'RED').length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-red-600 font-bold text-sm inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />NPP cần chú ý ngay ({Object.values(healthMap).filter(h => h.risk_band === 'RED').length} NPP)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(healthMap)
              .filter(([, h]) => h.risk_band === 'RED')
              .slice(0, 8)
              .map(([code, h]) => {
                const c = customers.find(x => x.code === code)
                return (
                  <div key={code} className="bg-white border border-red-200 rounded-lg px-3 py-2 text-xs">
                    <div className="font-semibold text-gray-800">{c?.name || code}</div>
                    <div className="text-red-600">Score: {h.health_score_0_100?.toFixed(0) ?? '—'}</div>
                    {c && (
                      <button
                        type="button"
                        onClick={() => openZaloDraft(c)}
                        disabled={draftLoadingId === c.id}
                        className="mt-2 px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 disabled:opacity-50"
                      >
                        {draftLoadingId === c.id ? 'Đang tạo...' : 'Nháp Zalo'}
                      </button>
                    )}
                  </div>
                )
              })}
            {Object.values(healthMap).filter(h => h.risk_band === 'RED').length > 8 && (
              <div className="bg-white border border-red-200 rounded-lg px-3 py-2 text-xs text-gray-400 flex items-center">
                +{Object.values(healthMap).filter(h => h.risk_band === 'RED').length - 8} khác
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Mã KH</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tên khách hàng</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Sức khỏe NPP</th>
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
                <td className="px-4 py-3">
                  <NppHealthBadge health={healthMap[c.code] || null} loading={healthLoading && !healthMap[c.code]} size="sm" showWhy={false} />
                </td>
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
                  <a href={`/dashboard/customers/${c.id}/vrp-constraints`} className="text-emerald-600 hover:underline text-xs mr-2" title="Ràng buộc giao hàng cho VRP"> VRP</a>
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

      {zaloDraft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setZaloDraft(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Nháp Zalo chăm sóc NPP</h2>
                <p className="text-sm text-gray-500 mt-1">{zaloDraft.customer_name} · health {zaloDraft.health_score}/100</p>
              </div>
              <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">{zaloDraft.provider}</span>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 whitespace-pre-wrap leading-6">
              {zaloDraft.draft_message}
            </div>
            <p className="text-xs text-gray-500 mt-3">{zaloDraft.reason}</p>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setZaloDraft(null)} className="px-4 py-2 border rounded-lg text-sm">Đóng</button>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(zaloDraft.draft_message)
                  toast.success('Đã copy nháp Zalo')
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Copy để gửi tay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
