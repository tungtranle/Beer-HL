'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'
import { handleError } from '@/lib/handleError'
import { useDataRefresh } from '@/lib/notifications'

interface Anomaly {
  id: string
  vehicle_id: string
  vehicle_plate?: string
  trip_id?: string
  driver_id?: string
  driver_name?: string
  anomaly_type: 'deviation' | 'stop_overdue' | 'speed_high' | 'off_route'
  severity: 'P0' | 'P1' | 'P2'
  lat: number
  lng: number
  distance_km?: number
  duration_min?: number
  speed_kmh?: number
  description: string
  detected_at: string
  status: 'open' | 'acknowledged' | 'resolved' | 'false_positive'
  acknowledged_at?: string
  resolved_at?: string
  resolution_note?: string
  zalo_sent: boolean
}

const TYPE_LABELS: Record<Anomaly['anomaly_type'], string> = {
  deviation: 'Lệch tuyến',
  stop_overdue: 'Đứng quá lâu',
  speed_high: 'Vượt tốc độ',
  off_route: 'Ra ngoài tuyến',
}

const TYPE_ICONS: Record<Anomaly['anomaly_type'], string> = {
  deviation: '🛣️',
  stop_overdue: '⏱️',
  speed_high: '🏎️',
  off_route: '⚠️',
}

const SEVERITY_COLORS: Record<Anomaly['severity'], string> = {
  P0: 'bg-red-600 text-white',
  P1: 'bg-amber-500 text-white',
  P2: 'bg-blue-500 text-white',
}

const STATUS_LABELS: Record<Anomaly['status'], string> = {
  open: 'Mở',
  acknowledged: 'Đã ghi nhận',
  resolved: 'Đã xử lý',
  false_positive: 'Báo nhầm',
}

const STATUS_COLORS: Record<Anomaly['status'], string> = {
  open: 'bg-red-100 text-red-700 border-red-300',
  acknowledged: 'bg-amber-100 text-amber-700 border-amber-300',
  resolved: 'bg-green-100 text-green-700 border-green-300',
  false_positive: 'bg-gray-100 text-gray-700 border-gray-300',
}

export default function AnomaliesPage() {
  const [items, setItems] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('open')
  const [resolving, setResolving] = useState<string | null>(null)
  const [resolveNote, setResolveNote] = useState('')
  const [resolveModal, setResolveModal] = useState<Anomaly | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('limit', '100')
      const res: any = await apiFetch(`/anomalies?${params}`)
      setItems(res.data || [])
    } catch (err) {
      handleError(err, { userMessage: 'Không tải được danh sách cảnh báo GPS' })
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { load() }, [load])
  useDataRefresh('gps', load)

  const handleAck = async (id: string) => {
    try {
      await apiFetch(`/anomalies/${id}/ack`, { method: 'PATCH' })
      toast.success('Đã ghi nhận cảnh báo')
      load()
    } catch (err) {
      handleError(err, { userMessage: 'Không ghi nhận được cảnh báo' })
    }
  }

  const submitResolve = async (falsePositive: boolean) => {
    if (!resolveModal) return
    setResolving(resolveModal.id)
    try {
      await apiFetch(`/anomalies/${resolveModal.id}/resolve`, {
        method: 'PATCH',
        body: { note: resolveNote, false_positive: falsePositive },
      })
      toast.success(falsePositive ? 'Đánh dấu báo nhầm' : 'Đã đóng cảnh báo')
      setResolveModal(null)
      setResolveNote('')
      load()
    } catch (err) {
      handleError(err, { userMessage: 'Không đóng được cảnh báo' })
    } finally {
      setResolving(null)
    }
  }

  const counts = {
    P0: items.filter(i => i.severity === 'P0' && i.status === 'open').length,
    P1: items.filter(i => i.severity === 'P1' && i.status === 'open').length,
    P2: items.filter(i => i.severity === 'P2' && i.status === 'open').length,
  }

  const allOpenP2 = items.filter(i => i.severity === 'P2' && i.status === 'open')

  const batchAckP2 = async () => {
    if (allOpenP2.length === 0) return
    try {
      await Promise.all(allOpenP2.map(a => apiFetch(`/anomalies/${a.id}/ack`, { method: 'PATCH' }).catch(() => {})))
      toast.success(`Đã ghi nhận ${allOpenP2.length} cảnh báo P2`)
      load()
    } catch { toast.error('Lỗi ghi nhận hàng loạt') }
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">🚨 Cảnh báo GPS</h1>
        <Link href="/dashboard/control-tower" className="text-sm text-brand-600 hover:underline">
          ← Control Tower
        </Link>
      </div>

      {/* Triage summary */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { sev: 'P0', label: 'Nghiêm trọng', color: 'bg-red-600', pulse: true },
          { sev: 'P1', label: 'Cần xử lý', color: 'bg-amber-500', pulse: false },
          { sev: 'P2', label: 'Theo dõi', color: 'bg-blue-500', pulse: false },
        ].map(({ sev, label, color, pulse }) => {
          const cnt = counts[sev as 'P0' | 'P1' | 'P2']
          return (
            <button key={sev} onClick={() => setStatusFilter('open')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${color} text-white shadow-sm hover:opacity-90 transition ${pulse && cnt > 0 ? 'animate-pulse' : ''}`}>
              <div>
                <div className="text-xl font-black tabular-nums">{cnt}</div>
                <div className="text-[10px] font-medium opacity-80">{sev} — {label}</div>
              </div>
            </button>
          )
        })}
        <div className="flex-1" />
        {allOpenP2.length > 0 && (
          <button onClick={batchAckP2}
            className="px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-50 transition shadow-sm">
            ✓ Ghi nhận tất cả P2 ({allOpenP2.length})
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {[
          { v: 'open', l: 'Mở' },
          { v: 'acknowledged', l: 'Đã ghi nhận' },
          { v: 'resolved', l: 'Đã xử lý' },
          { v: '', l: 'Tất cả' },
        ].map(t => (
          <button
            key={t.v}
            onClick={() => setStatusFilter(t.v)}
            className={`px-4 py-2 text-sm font-medium transition ${
              statusFilter === t.v
                ? 'border-b-2 border-brand-600 text-brand-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-5xl mb-2">✅</div>
          <p>Không có cảnh báo {STATUS_LABELS[statusFilter as Anomaly['status']]?.toLowerCase() || ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(a => (
            <div
              key={a.id}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl">{TYPE_ICONS[a.anomaly_type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${SEVERITY_COLORS[a.severity]}`}>
                      {a.severity}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {TYPE_LABELS[a.anomaly_type]}
                    </span>
                    <span className={`px-2 py-0.5 rounded border text-xs ${STATUS_COLORS[a.status]}`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                    {a.zalo_sent && (
                      <span className="text-xs text-blue-600">📨 Đã gửi Zalo</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-700 mb-1">{a.description}</div>
                  <div className="text-xs text-gray-500 flex flex-wrap gap-3">
                    {a.vehicle_plate && <span>🚛 {a.vehicle_plate}</span>}
                    {a.driver_name && <span>👤 {a.driver_name}</span>}
                    <span>📍 {a.lat.toFixed(4)}, {a.lng.toFixed(4)}</span>
                    <span>⏰ {new Date(a.detected_at).toLocaleString('vi-VN')}</span>
                  </div>
                  {a.resolution_note && (
                    <div className="mt-2 text-xs text-gray-600 italic border-l-2 border-gray-300 pl-2">
                      Ghi chú xử lý: {a.resolution_note}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {a.status === 'open' && (
                    <button
                      onClick={() => handleAck(a.id)}
                      className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 transition"
                    >
                      Ghi nhận
                    </button>
                  )}
                  {(a.status === 'open' || a.status === 'acknowledged') && (
                    <button
                      onClick={() => { setResolveModal(a); setResolveNote('') }}
                      className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition"
                    >
                      Đóng
                    </button>
                  )}
                  <a
                    href={`https://www.google.com/maps?q=${a.lat},${a.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition text-center"
                  >
                    📍 Map
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolve modal */}
      {resolveModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !resolving && setResolveModal(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-3">Đóng cảnh báo</h2>
            <p className="text-sm text-gray-600 mb-3">{resolveModal.description}</p>
            <textarea
              className="w-full border border-gray-300 rounded p-2 text-sm mb-3"
              rows={3}
              placeholder="Ghi chú xử lý (tùy chọn)"
              value={resolveNote}
              onChange={e => setResolveNote(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setResolveModal(null)}
                disabled={!!resolving}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={() => submitResolve(true)}
                disabled={!!resolving}
                className="px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
              >
                Báo nhầm
              </button>
              <button
                onClick={() => submitResolve(false)}
                disabled={!!resolving}
                className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {resolving ? 'Đang xử lý...' : 'Đã giải quyết'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
