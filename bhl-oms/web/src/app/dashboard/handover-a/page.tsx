'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'
import { useDataRefresh } from '@/lib/notifications'

// ── Types ──────────────────────────────────────────

interface Signatory {
  role: string; role_label: string
  user_id?: string; name?: string; signed_at?: string; action?: string
}

interface HandoverItem {
  product_name: string; product_sku: string; expected_qty: number; actual_qty: number
}

interface HandoverRecord {
  id: string; handover_type: string; trip_id: string; status: string
  signatories: Signatory[]; photo_urls: string[]
  items: HandoverItem[]; reject_reason?: string
  notes?: string; created_at: string; updated_at: string
}

interface TripForHandover {
  id: string; trip_number: string; vehicle_plate: string
  driver_name: string; status: string; total_stops: number
}

// ── Helper ──────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Chờ xác nhận', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  partially_signed: { label: 'Đang xác nhận', color: 'bg-blue-100 text-blue-800', icon: '🔄' },
  completed: { label: 'Hoàn tất', color: 'bg-green-100 text-green-800', icon: '✅' },
  rejected: { label: 'Bị từ chối', color: 'bg-red-100 text-red-800', icon: '❌' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.floor(hours / 24)} ngày trước`
}

// ── Main Page ──────────────────────────────────────────

export default function HandoverAPage() {
  const searchParams = useSearchParams()
  const tripIdFromUrl = searchParams.get('trip_id')

  const [mode, setMode] = useState<'list' | 'create'>('list')
  const [handovers, setHandovers] = useState<HandoverRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Create form state
  const [trips, setTrips] = useState<TripForHandover[]>([])
  const [selectedTrip, setSelectedTrip] = useState<TripForHandover | null>(null)
  const [tripSearch, setTripSearch] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [items, setItems] = useState<HandoverItem[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Detail view
  const [detail, setDetail] = useState<HandoverRecord | null>(null)

  const loadHandovers = useCallback(async () => {
    try {
      const tripsRes: any = await apiFetch('/trips?limit=50&active=true')
      const allTrips = tripsRes.data || []
      const records: HandoverRecord[] = []
      for (const t of allTrips.slice(0, 20)) {
        try {
          const res: any = await apiFetch(`/warehouse/handovers/trip/${t.id}`)
          const recs = (res.data || []).filter((r: HandoverRecord) => r.handover_type === 'A')
          recs.forEach((r: HandoverRecord) => {
            (r as any)._trip = t
          })
          records.push(...recs)
        } catch { /* ignore */ }
      }
      setHandovers(records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  const loadTrips = useCallback(async () => {
    try {
      const res: any = await apiFetch('/trips?limit=50&active=true')
      setTrips((res.data || []).filter((t: TripForHandover) =>
        ['ready', 'assigned', 'pre_check'].includes(t.status)))
    } catch { /* ignore */ }
  }, [])

  // Auto-detect trip from URL param (coming from picking page)
  useEffect(() => {
    if (tripIdFromUrl) {
      // Read trip data from sessionStorage (set by picking page)
      const stored = sessionStorage.getItem('handover_trip')
      if (stored) {
        try {
          const data = JSON.parse(stored)
          if (data.trip_id === tripIdFromUrl) {
            setSelectedTrip({
              id: data.trip_id,
              trip_number: data.trip_number,
              vehicle_plate: data.vehicle_plate,
              driver_name: data.driver_name,
              status: 'ready',
              total_stops: data.total_stops || 0,
            })
            setTripSearch(data.trip_number)
            setItems(data.items || [])
            setMode('create')
            return
          }
        } catch { /* ignore parse error */ }
      }
      // Fallback: just switch to create mode with trip_id
      setMode('create')
      loadTrips()
    }
  }, [tripIdFromUrl, loadTrips])

  useEffect(() => {
    if (!tripIdFromUrl) loadHandovers()
  }, [loadHandovers, tripIdFromUrl])

  useDataRefresh('handover', loadHandovers)

  // ── Photo upload via FileReader (base64) ──

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        setPhotos(prev => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Create handover ──

  const createHandover = async () => {
    if (!selectedTrip) {
      toast.warning('Vui lòng chọn chuyến xe')
      return
    }
    if (photos.length === 0) {
      toast.warning('Vui lòng chụp/đính kèm ảnh phiếu xuất kho Bravo')
      return
    }

    setSubmitting(true)
    try {
      const signatories = [
        { role: 'warehouse_handler', role_label: 'Thủ kho' },
        { role: 'driver', role_label: 'Tài xế' },
        { role: 'security', role_label: 'Bảo vệ' },
      ]

      const res: any = await apiFetch('/warehouse/handovers', {
        method: 'POST',
        body: {
          handover_type: 'A',
          trip_id: selectedTrip.id,
          signatories,
          photo_urls: photos,
          items: items.length > 0 ? items : undefined,
          notes: note || undefined,
        },
      })

      toast.success('Đã tạo biên bản bàn giao A')
      sessionStorage.removeItem('handover_trip')

      // Auto-sign warehouse_handler
      if (res.data?.id) {
        try {
          await apiFetch(`/warehouse/handovers/${res.data.id}/sign`, {
            method: 'POST',
            body: { role: 'warehouse_handler', action: 'confirm' },
          })
        } catch { /* ignore auto-sign error */ }

        // Show the created handover detail
        try {
          const detailRes: any = await apiFetch(`/warehouse/handovers/${res.data.id}`)
          setDetail(detailRes.data)
          setMode('list')
        } catch {
          setMode('list')
          await loadHandovers()
        }
      } else {
        setMode('list')
        await loadHandovers()
      }
      setSelectedTrip(null)
      setPhotos([])
      setNote('')
      setItems([])
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Confirm / Reject ──

  const confirmHandover = async (handoverId: string, role: string) => {
    try {
      await apiFetch(`/warehouse/handovers/${handoverId}/sign`, {
        method: 'POST',
        body: { role, action: 'confirm' },
      })
      toast.success('Đã xác nhận bàn giao')
      // Refresh detail if viewing
      if (detail && detail.id === handoverId) {
        const res: any = await apiFetch(`/warehouse/handovers/${handoverId}`)
        setDetail(res.data)
      }
      await loadHandovers()
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message)
    }
  }

  // ── RENDER ──

  // Create mode
  if (mode === 'create') {
    return (
      <div className="max-w-[800px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setMode('list'); loadHandovers() }} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
          <h1 className="text-2xl font-bold text-gray-800">📋 Tạo biên bản bàn giao A</h1>
        </div>

        {/* Step 1: Select trip */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <h2 className="font-semibold text-gray-700 mb-3">1. Chọn chuyến xe</h2>
          {selectedTrip ? (
            <div className="bg-blue-50 rounded-lg p-3 flex items-center justify-between">
              <div>
                <span className="font-bold text-blue-800">{selectedTrip.trip_number}</span>
                <span className="text-blue-600 text-sm ml-2">{selectedTrip.vehicle_plate} · {selectedTrip.driver_name}</span>
              </div>
              {!tripIdFromUrl && (
                <button onClick={() => { setSelectedTrip(null); setTripSearch(''); setItems([]) }} className="text-blue-400 hover:text-blue-600">✕</button>
              )}
            </div>
          ) : (
            <>
              <input
                type="text"
                value={tripSearch}
                onChange={e => {
                  setTripSearch(e.target.value)
                  if (!trips.length) loadTrips()
                }}
                onFocus={() => { if (!trips.length) loadTrips() }}
                placeholder="Tìm số chuyến hoặc biển số xe..."
                className="w-full border rounded-lg px-4 py-3 text-sm mb-3"
              />
              {trips.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {trips
                    .filter(t => !tripSearch ||
                      t.trip_number.toLowerCase().includes(tripSearch.toLowerCase()) ||
                      t.vehicle_plate.toLowerCase().includes(tripSearch.toLowerCase()))
                    .map(t => (
                      <button
                        key={t.id}
                        onClick={() => { setSelectedTrip(t); setTripSearch(t.trip_number) }}
                        className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition flex items-center justify-between"
                      >
                        <div>
                          <span className="font-medium">{t.trip_number}</span>
                          <span className="text-gray-400 mx-2">·</span>
                          <span className="text-sm text-gray-500">{t.vehicle_plate}</span>
                          <span className="text-gray-400 mx-2">·</span>
                          <span className="text-sm text-gray-500">{t.driver_name}</span>
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t.total_stops} điểm</span>
                      </button>
                    ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Items table (auto-populated from picking) */}
        {items.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
            <h2 className="font-semibold text-gray-700 mb-3">📦 Danh sách hàng hóa bàn giao</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left py-2 px-3">STT</th>
                    <th className="text-left py-2 px-3">Sản phẩm</th>
                    <th className="text-left py-2 px-3">Mã SP</th>
                    <th className="text-right py-2 px-3">SL yêu cầu</th>
                    <th className="text-right py-2 px-3">SL thực tế</th>
                    <th className="text-center py-2 px-3">Khớp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-500">{idx + 1}</td>
                      <td className="py-2 px-3 font-medium">{item.product_name}</td>
                      <td className="py-2 px-3 text-gray-500 font-mono text-xs">{item.product_sku}</td>
                      <td className="py-2 px-3 text-right">{item.expected_qty}</td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          value={item.actual_qty}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0
                            setItems(prev => prev.map((it, i) => i === idx ? { ...it, actual_qty: val } : it))
                          }}
                          className="w-20 text-right border rounded px-2 py-1 text-sm"
                          min={0}
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        {item.actual_qty === item.expected_qty ? (
                          <span className="text-green-600">✅</span>
                        ) : (
                          <span className="text-red-600">⚠️</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Số lượng thực tế được tự động điền từ dữ liệu soạn hàng. Bạn có thể sửa nếu cần.
            </div>
          </div>
        )}

        {/* Step 2: Attach photos */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <h2 className="font-semibold text-gray-700 mb-3">{items.length > 0 ? '2' : '2'}. Chụp/đính kèm phiếu xuất kho Bravo</h2>
          <p className="text-sm text-gray-500 mb-3">In phiếu xuất kho từ Bravo → ký tay 3 bên → chụp ảnh → đính kèm tại đây</p>

          <label className="flex items-center justify-center gap-2 w-full h-14 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#F68634] hover:bg-orange-50 transition text-gray-500">
            <span className="text-lg">📷</span>
            <span className="font-medium">Chụp ảnh hoặc chọn file</span>
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </label>

          {photos.length > 0 && (
            <div className="flex gap-3 mt-3 flex-wrap">
              {photos.map((photo, idx) => (
                <div key={idx} className="relative group">
                  <img src={photo} alt={`Phiếu ${idx + 1}`} className="w-24 h-24 object-cover rounded-lg border" />
                  <button
                    onClick={() => removePhoto(idx)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition"
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 3: Notes */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <h2 className="font-semibold text-gray-700 mb-3">3. Ghi chú (tùy chọn)</h2>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Ghi chú thêm nếu cần..."
            className="w-full border rounded-lg px-4 py-3 text-sm h-20 resize-none"
          />
        </div>

        {/* Submit */}
        <button
          onClick={createHandover}
          disabled={submitting || !selectedTrip || photos.length === 0}
          className="w-full h-14 bg-[#F68634] text-white rounded-xl font-medium text-base hover:bg-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> Đang tạo...</>
          ) : (
            <>📋 Tạo biên bản &amp; gửi cho Tài xế, Bảo vệ xác nhận</>
          )}
        </button>

        <p className="text-xs text-gray-400 text-center mt-3">
          Sau khi tạo, Thủ kho tự động xác nhận — Tài xế và Bảo vệ sẽ nhận thông báo để xác nhận trên thiết bị của họ
        </p>
      </div>
    )
  }

  // Detail view
  if (detail) {
    const sc = statusConfig[detail.status] || statusConfig.pending
    return (
      <div className="max-w-[800px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
          <h1 className="text-2xl font-bold text-gray-800">Chi tiết Bàn giao A</h1>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>{sc.icon} {sc.label}</span>
        </div>

        {/* Reject reason */}
        {detail.reject_reason && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <div className="font-semibold text-red-700 mb-1">❌ Lý do từ chối</div>
            <div className="text-red-600">{detail.reject_reason}</div>
          </div>
        )}

        {/* Items table */}
        {detail.items && detail.items.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
            <h2 className="font-semibold text-gray-700 mb-3">📦 Danh sách hàng hóa bàn giao</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left py-2 px-3">STT</th>
                    <th className="text-left py-2 px-3">Sản phẩm</th>
                    <th className="text-left py-2 px-3">Mã SP</th>
                    <th className="text-right py-2 px-3">SL yêu cầu</th>
                    <th className="text-right py-2 px-3">SL thực tế</th>
                    <th className="text-center py-2 px-3">Khớp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detail.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 text-gray-500">{idx + 1}</td>
                      <td className="py-2 px-3 font-medium">{item.product_name}</td>
                      <td className="py-2 px-3 text-gray-500 font-mono text-xs">{item.product_sku}</td>
                      <td className="py-2 px-3 text-right">{item.expected_qty}</td>
                      <td className="py-2 px-3 text-right">{item.actual_qty}</td>
                      <td className="py-2 px-3 text-center">
                        {item.actual_qty === item.expected_qty ? (
                          <span className="text-green-600">✅</span>
                        ) : (
                          <span className="text-red-600 font-medium">⚠️ {item.actual_qty - item.expected_qty > 0 ? '+' : ''}{item.actual_qty - item.expected_qty}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Signatories status */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700">Trạng thái xác nhận (3 bên)</h2>
            {(() => {
              const signedCount = (detail.signatories || []).filter(s => s.action === 'confirm').length
              const total = detail.signatories?.length || 3
              return (
                <span className={`text-sm font-semibold ${signedCount === total ? 'text-green-600' : 'text-amber-600'}`}>{signedCount}/{total} đã xác nhận</span>
              )
            })()}
          </div>
          {/* Signatory progress segments */}
          {(() => {
            const _total = detail.signatories?.length || 3
            return (
              <div className="flex gap-1 mb-4">
                {(detail.signatories || []).map((sig, i) => (
                  <div key={i} className={`flex-1 h-2 rounded-full ${sig.action === 'confirm' ? 'bg-green-500' : sig.action === 'reject' ? 'bg-red-500' : 'bg-gray-200'}`} />
                ))}
              </div>
            )
          })()}
          <div className="space-y-3">
            {(detail.signatories || []).map((sig, idx) => (
              <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${sig.action === 'confirm' ? 'bg-green-50 border-green-200' : sig.action === 'reject' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {sig.action === 'confirm' ? '✅' : sig.action === 'reject' ? '❌' : '⏳'}
                  </span>
                  <div>
                    <div className="font-medium text-gray-800">{sig.role_label || sig.role}</div>
                    {sig.name && <div className="text-sm text-gray-500">{sig.name}</div>}
                  </div>
                </div>
                <div className="text-right">
                  {sig.signed_at ? (
                    <div className="text-xs text-gray-400">{timeAgo(sig.signed_at)}</div>
                  ) : detail.status !== 'rejected' ? (
                    <button
                      onClick={() => confirmHandover(detail.id, sig.role)}
                      className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200 transition font-medium"
                    >
                      Xác nhận
                    </button>
                  ) : (
                    <div className="text-xs text-gray-400">—</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Photos */}
        {detail.photo_urls && detail.photo_urls.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
            <h2 className="font-semibold text-gray-700 mb-3">📷 Ảnh phiếu xuất kho</h2>
            <div className="flex gap-3 flex-wrap">
              {detail.photo_urls.map((url, idx) => (
                <img key={idx} src={url} alt={`Phiếu ${idx + 1}`}
                  className="w-32 h-32 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition"
                  onClick={() => window.open(url, '_blank')}
                />
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {detail.notes && (
          <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
            <h2 className="font-semibold text-gray-700 mb-2">📝 Ghi chú</h2>
            <p className="text-gray-600">{detail.notes}</p>
          </div>
        )}

        <div className="text-xs text-gray-400 text-center">
          Tạo lúc: {new Date(detail.created_at).toLocaleString('vi-VN')}
        </div>
      </div>
    )
  }

  // List mode
  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">📋 Bàn giao xuất kho (A)</h1>
          <button onClick={loadHandovers} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition" title="Làm mới">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
        <button
          onClick={() => { setMode('create'); loadTrips() }}
          className="px-4 py-2 bg-[#F68634] text-white rounded-lg hover:bg-orange-600 transition text-sm font-medium"
        >
          ➕ Tạo biên bản mới
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Thủ kho tạo biên bản + chụp phiếu Bravo → Thủ kho tự xác nhận → Tài xế &amp; Bảo vệ xác nhận trên thiết bị riêng
      </p>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#F68634]" />
        </div>
      ) : handovers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500 font-medium">Chưa có biên bản bàn giao nào</p>
          <p className="text-gray-400 text-sm mt-1">Bấm &quot;Tạo biên bản mới&quot; sau khi soạn hàng xong</p>
        </div>
      ) : (
        <div className="space-y-3">
          {handovers.map(h => {
            const sc = statusConfig[h.status] || statusConfig.pending
            const trip = (h as any)._trip || {}
            const _confirmed = (h.signatories || []).filter(s => s.action === 'confirm').length
            const _total = (h.signatories || []).length

            return (
              <div
                key={h.id}
                onClick={() => setDetail(h)}
                className="bg-white rounded-xl shadow-sm p-5 border-2 border-gray-200 hover:border-[#F68634] cursor-pointer transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{sc.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800">{trip.trip_number || 'N/A'}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-sm text-gray-500">{trip.vehicle_plate}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-sm text-gray-500">{trip.driver_name}</span>
                      </div>
                      <div className="text-sm text-gray-400 mt-0.5">
                        {timeAgo(h.created_at)} · {h.photo_urls?.length || 0} ảnh
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span>
                      <div className="flex items-center gap-1 justify-end mt-1.5">
                        {(h.signatories || []).map((sig, i) => (
                          <div key={i} className={`w-5 h-5 rounded-full border text-[9px] flex items-center justify-center font-bold ${sig.action === 'confirm' ? 'bg-green-500 border-green-500 text-white' : sig.action === 'reject' ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-gray-300 text-gray-400'}`}>
                            {sig.action === 'confirm' ? '✓' : sig.action === 'reject' ? '✕' : (i + 1)}
                          </div>
                        ))}
                      </div>
                    </div>
                    <span className="text-gray-400">→</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
