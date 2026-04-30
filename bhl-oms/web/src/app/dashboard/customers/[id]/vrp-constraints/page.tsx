'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface Window {
  start: string  // "06:00"
  end: string    // "11:00"
  days: number[] // 1=Mon..7=Sun
  reason?: string
}

interface Constraints {
  max_vehicle_weight_kg: number
  delivery_windows: Window[]
  forbidden_windows: Window[]
  access_notes: string | null
}

const DAY_LABELS = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const emptyWindow = (): Window => ({ start: '08:00', end: '17:00', days: [1, 2, 3, 4, 5, 6] })

export default function CustomerVRPConstraintsPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id

  const [customerName, setCustomerName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<Constraints>({
    max_vehicle_weight_kg: 0,
    delivery_windows: [],
    forbidden_windows: [],
    access_notes: '',
  })

  useEffect(() => {
    if (!id) return
    Promise.all([
      apiFetch<any>(`/customers/${id}`).then(r => r.data).catch(() => null),
      apiFetch<any>(`/customers/${id}/vrp-constraints`).then(r => r.data).catch(() => null),
    ]).then(([cust, vrp]) => {
      if (cust) setCustomerName(`${cust.code} — ${cust.name}`)
      if (vrp) setData({
        max_vehicle_weight_kg: vrp.max_vehicle_weight_kg ?? 0,
        delivery_windows: Array.isArray(vrp.delivery_windows) ? vrp.delivery_windows : [],
        forbidden_windows: Array.isArray(vrp.forbidden_windows) ? vrp.forbidden_windows : [],
        access_notes: vrp.access_notes ?? '',
      })
    }).finally(() => setLoading(false))
  }, [id])

  const save = async () => {
    setSaving(true)
    try {
      await apiFetch(`/customers/${id}/vrp-constraints`, {
        method: 'PUT',
        body: {
          max_vehicle_weight_kg: Number(data.max_vehicle_weight_kg) || 0,
          delivery_windows: data.delivery_windows,
          forbidden_windows: data.forbidden_windows,
          access_notes: data.access_notes || null,
        },
      })
      toast.success('Đã lưu ràng buộc VRP')
    } catch (e: any) {
      toast.error(e.message || 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  const updateWindow = (kind: 'delivery_windows' | 'forbidden_windows', idx: number, patch: Partial<Window>) => {
    setData(prev => ({
      ...prev,
      [kind]: prev[kind].map((w, i) => (i === idx ? { ...w, ...patch } : w)),
    }))
  }
  const addWindow = (kind: 'delivery_windows' | 'forbidden_windows') => {
    setData(prev => ({ ...prev, [kind]: [...prev[kind], emptyWindow()] }))
  }
  const removeWindow = (kind: 'delivery_windows' | 'forbidden_windows', idx: number) => {
    setData(prev => ({ ...prev, [kind]: prev[kind].filter((_, i) => i !== idx) }))
  }
  const toggleDay = (kind: 'delivery_windows' | 'forbidden_windows', idx: number, day: number) => {
    const w = data[kind][idx]
    const has = w.days.includes(day)
    const next = has ? w.days.filter(d => d !== day) : [...w.days, day].sort()
    updateWindow(kind, idx, { days: next })
  }

  const summary = useMemo(() => {
    const parts: string[] = []
    if (data.max_vehicle_weight_kg > 0) parts.push(`≤${(data.max_vehicle_weight_kg / 1000).toFixed(1)}T`)
    if (data.delivery_windows.length > 0) parts.push(`${data.delivery_windows.length} khung giao`)
    if (data.forbidden_windows.length > 0) parts.push(`${data.forbidden_windows.length} khung cấm`)
    if (data.access_notes) parts.push('có ghi chú lối vào')
    return parts.length ? parts.join(' • ') : 'Chưa cấu hình ràng buộc nào'
  }, [data])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Đang tải...</div>

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-2">← Quay lại</button>
          <h1 className="text-2xl font-bold text-gray-900">🚚 Ràng buộc giao hàng cho VRP</h1>
          <p className="text-sm text-gray-500 mt-1">{customerName}</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? 'Đang lưu...' : '💾 Lưu thay đổi'}
        </button>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-6 text-sm text-emerald-800">
        <span className="font-semibold">Tóm tắt:</span> {summary}
      </div>

      {/* Max weight */}
      <section className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2">⚖️ Trọng tải tối đa cho phép vào</h2>
        <p className="text-xs text-gray-500 mb-3">VRP sẽ chỉ chọn xe có tải ≤ giá trị này. Để 0 nếu không giới hạn.</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            step={500}
            value={data.max_vehicle_weight_kg}
            onChange={e => setData({ ...data, max_vehicle_weight_kg: Number(e.target.value) })}
            className="w-40 border rounded-lg px-3 py-2 text-sm font-mono text-right"
          />
          <span className="text-sm text-gray-600">kg ({(data.max_vehicle_weight_kg / 1000).toFixed(1)} tấn)</span>
        </div>
      </section>

      {/* Delivery windows */}
      <WindowSection
        title="🟢 Khung giờ được phép giao"
        description="Xe chỉ được tới NPP trong các khung này. Ưu tiên 1-2 khung sáng/chiều."
        items={data.delivery_windows}
        onAdd={() => addWindow('delivery_windows')}
        onRemove={i => removeWindow('delivery_windows', i)}
        onUpdate={(i, p) => updateWindow('delivery_windows', i, p)}
        onToggleDay={(i, d) => toggleDay('delivery_windows', i, d)}
        accent="emerald"
        showReason={false}
      />

      {/* Forbidden windows */}
      <WindowSection
        title="🚫 Khung giờ cấm tải / cấm xe"
        description="VRP sẽ tránh các khung này. Có thể ghi lý do (cấm tải nội đô, giờ cao điểm...)."
        items={data.forbidden_windows}
        onAdd={() => addWindow('forbidden_windows')}
        onRemove={i => removeWindow('forbidden_windows', i)}
        onUpdate={(i, p) => updateWindow('forbidden_windows', i, p)}
        onToggleDay={(i, d) => toggleDay('forbidden_windows', i, d)}
        accent="red"
        showReason={true}
      />

      {/* Access notes */}
      <section className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2">📝 Ghi chú lối vào / liên hệ</h2>
        <p className="text-xs text-gray-500 mb-3">Hiển thị cho tài xế trên ứng dụng khi giao hàng.</p>
        <textarea
          rows={4}
          value={data.access_notes || ''}
          onChange={e => setData({ ...data, access_notes: e.target.value })}
          placeholder="VD: Cổng phụ phía sau chợ, liên hệ anh Hưng 091xxx trước 10 phút..."
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </section>
    </div>
  )
}

interface WindowSectionProps {
  title: string
  description: string
  items: Window[]
  onAdd: () => void
  onRemove: (idx: number) => void
  onUpdate: (idx: number, patch: Partial<Window>) => void
  onToggleDay: (idx: number, day: number) => void
  accent: 'emerald' | 'red'
  showReason: boolean
}

function WindowSection({ title, description, items, onAdd, onRemove, onUpdate, onToggleDay, accent, showReason }: WindowSectionProps) {
  const accentClasses = accent === 'emerald'
    ? { btn: 'bg-emerald-600 hover:bg-emerald-700', chip: 'bg-emerald-100 text-emerald-700 border-emerald-300', chipOff: 'bg-gray-50 text-gray-400 border-gray-200' }
    : { btn: 'bg-red-600 hover:bg-red-700', chip: 'bg-red-100 text-red-700 border-red-300', chipOff: 'bg-gray-50 text-gray-400 border-gray-200' }

  return (
    <section className="bg-white rounded-xl shadow-sm border p-6 mb-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
        <button
          onClick={onAdd}
          className={`px-3 py-1.5 text-white rounded-lg text-xs font-semibold ${accentClasses.btn}`}
        >
          + Thêm khung
        </button>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed rounded-lg">
          Chưa có khung nào
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((w, i) => (
            <div key={i} className="border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="time"
                  value={w.start}
                  onChange={e => onUpdate(i, { start: e.target.value })}
                  className="border rounded px-2 py-1 text-sm font-mono"
                />
                <span className="text-gray-400">→</span>
                <input
                  type="time"
                  value={w.end}
                  onChange={e => onUpdate(i, { end: e.target.value })}
                  className="border rounded px-2 py-1 text-sm font-mono"
                />
                <div className="flex-1" />
                <button onClick={() => onRemove(i)} className="text-red-500 hover:text-red-700 text-xs">Xóa</button>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {[1, 2, 3, 4, 5, 6, 7].map(d => {
                  const on = w.days.includes(d)
                  return (
                    <button
                      key={d}
                      onClick={() => onToggleDay(i, d)}
                      className={`w-10 h-7 rounded border text-xs font-semibold transition ${on ? accentClasses.chip : accentClasses.chipOff}`}
                    >
                      {DAY_LABELS[d]}
                    </button>
                  )
                })}
              </div>
              {showReason && (
                <input
                  type="text"
                  placeholder="Lý do (tùy chọn) — VD: Cấm tải nội đô"
                  value={w.reason || ''}
                  onChange={e => onUpdate(i, { reason: e.target.value })}
                  className="w-full border rounded px-2 py-1 text-xs"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
