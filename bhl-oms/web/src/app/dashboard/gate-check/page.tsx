'use client'

import { useState, useEffect } from 'react'
import { apiFetch, getUser } from '@/lib/api'
import { toast } from '@/lib/useToast'
import { useDataRefresh } from '@/lib/notifications'

interface Signatory {
  role: string; role_label: string
  user_id?: string; name?: string; signed_at?: string; action?: string
}

interface HandoverRecord {
  id: string; handover_type: string; trip_id: string; status: string
  signatories: Signatory[]; photo_urls: string[]
  reject_reason?: string; notes?: string; created_at: string
}

interface TripForGate {
  id: string; trip_number: string; vehicle_plate: string
  driver_name: string; status: string; total_stops: number
}

const statusConfig: Record<string, { label: string; color: string; icon: string; bg: string }> = {
  completed: { label: 'Bàn giao hoàn tất — Cho xe qua', color: 'text-green-800', icon: '✅', bg: 'bg-green-50 border-green-300' },
  partially_signed: { label: 'Đang chờ xác nhận', color: 'text-yellow-800', icon: '⏳', bg: 'bg-yellow-50 border-yellow-300' },
  pending: { label: 'Chưa có ai xác nhận', color: 'text-yellow-800', icon: '⏳', bg: 'bg-yellow-50 border-yellow-300' },
  rejected: { label: 'Bàn giao bị từ chối', color: 'text-red-800', icon: '❌', bg: 'bg-red-50 border-red-300' },
}

export default function GateCheckPage() {
  const [tripSearch, setTripSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [trip, setTrip] = useState<TripForGate | null>(null)
  const [handover, setHandover] = useState<HandoverRecord | null>(null)
  const [handoverStatus, setHandoverStatus] = useState<string>('none')
  const [confirming, setConfirming] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [pendingQueue, setPendingQueue] = useState<TripForGate[]>([])
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrInput, setQrInput] = useState('')

  const user = getUser()

  const loadPendingQueue = () => {
    apiFetch<any>('/trips?status=ready&limit=20').then(res => {
      setPendingQueue(res.data || [])
    }).catch(() => {})
  }

  useEffect(() => { loadPendingQueue() }, [])

  const searchTrip = async () => {
    if (!tripSearch.trim()) return
    setSearching(true)
    setHandover(null)
    setHandoverStatus('none')
    try {
      const res: any = await apiFetch(`/trips?search=${encodeURIComponent(tripSearch.trim())}`)
      const trips = res.data || []
      if (trips.length === 0) {
        toast.warning('Không tìm thấy chuyến xe')
        setTrip(null)
        return
      }
      const t = trips[0]
      setTrip(t)
      const hRes: any = await apiFetch(`/warehouse/handovers/trip/${t.id}`)
      const handovers = (hRes.data || []).filter((h: HandoverRecord) => h.handover_type === 'A')
      if (handovers.length > 0) {
        const h = handovers[handovers.length - 1]
        setHandover(h)
        setHandoverStatus(h.status)
      } else {
        setHandoverStatus('none')
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setSearching(false)
    }
  }

  const securityConfirm = async () => {
    if (!handover) return
    setConfirming(true)
    try {
      await apiFetch(`/warehouse/handovers/${handover.id}/sign`, {
        method: 'POST',
        body: { role: 'security', action: 'confirm' },
      })
      toast.success('Bảo vệ đã xác nhận bàn giao')
      await searchTrip()
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setConfirming(false)
    }
  }

  const securityReject = async () => {
    if (!handover || !rejectReason.trim()) {
      toast.warning('Vui lòng nhập lý do từ chối')
      return
    }
    setConfirming(true)
    try {
      await apiFetch(`/warehouse/handovers/${handover.id}/sign`, {
        method: 'POST',
        body: { role: 'security', action: 'reject', reject_reason: rejectReason },
      })
      toast.success('Đã từ chối bàn giao')
      setShowRejectForm(false)
      await searchTrip()
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setConfirming(false)
    }
  }

  useDataRefresh('handover', () => { if (trip) searchTrip() })

  const securitySig = handover?.signatories?.find(s => s.role === 'security')
  const securityDone = securitySig?.action === 'confirm' || securitySig?.action === 'reject'
  const canPass = handoverStatus === 'completed'

  // Full-screen PASS result
  if (canPass && trip) {
    return (
      <div className="min-h-screen bg-green-600 flex flex-col items-center justify-center p-6 -m-6">
        <p className="text-white text-6xl mb-4">✓</p>
        <h1 className="text-2xl font-bold text-white mb-2">Cho xe xuất cổng</h1>
        <p className="text-green-100 text-base mb-1">{trip.trip_number} · {trip.vehicle_plate}</p>
        <p className="text-green-200 text-sm mb-2">{trip.driver_name}</p>
        <p className="text-green-200 text-sm mb-8">Bàn giao A hoàn tất — {(handover?.signatories || []).length}/{(handover?.signatories || []).length} đã xác nhận</p>
        <button
          onClick={() => { setTrip(null); setHandover(null); setHandoverStatus('none'); setTripSearch('') }}
          className="w-full max-w-md h-14 bg-white text-green-700 font-bold rounded-xl text-lg"
        >
          Kiểm tra xe tiếp theo
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold text-gray-800">🔒 Kiểm soát cổng</h1>
      </div>
      <p className="text-base text-gray-500 mb-6">Kiểm tra Bàn giao A đã hoàn tất → mở barrier cho xe xuất kho</p>

      {/* Pending queue */}
      {pendingQueue.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <h2 className="text-sm font-bold text-amber-800 mb-2">🚦 Hàng chờ xuất cổng ({pendingQueue.length} chuyến)</h2>
          <div className="flex flex-wrap gap-2">
            {pendingQueue.map(q => (
              <button key={q.id}
                onClick={() => { setTripSearch(q.trip_number); setTimeout(() => searchTrip(), 50) }}
                className="bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-sm hover:bg-amber-100 transition text-left"
              >
                <div className="font-semibold text-gray-800">{q.trip_number}</div>
                <div className="text-xs text-gray-500">{q.vehicle_plate}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search trip */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">Tìm chuyến xe</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={tripSearch}
            onChange={e => setTripSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchTrip()}
            placeholder="Nhập mã chuyến hoặc biển số xe"
            className="flex-1 px-4 h-12 border rounded-lg text-base"
          />
          <button
            onClick={() => setShowQrModal(true)}
            className="px-4 h-12 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-base border"
            title="Quét mã QR"
          >
            📷 QR
          </button>
          <button
            onClick={searchTrip}
            disabled={searching}
            className="px-6 h-12 bg-[#F68634] text-white rounded-lg hover:bg-orange-600 transition text-base disabled:opacity-50"
          >
            {searching ? 'Đang tìm...' : '🔍 Tìm'}
          </button>
        </div>
      </div>

      {/* QR Scan Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowQrModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">📷</div>
              <h3 className="text-lg font-bold text-gray-800">Quét mã QR chuyến xe</h3>
              <p className="text-sm text-gray-500 mt-1">Camera tự động quét — hoặc nhập thủ công</p>
            </div>
            {/* QR viewfinder placeholder */}
            <div className="w-full aspect-square rounded-xl bg-gray-900 flex items-center justify-center mb-4 relative overflow-hidden">
              <div className="absolute inset-4 border-2 border-white/40 rounded-lg" />
              <div className="absolute top-4 left-4 w-6 h-6 border-t-4 border-l-4 border-brand-400 rounded-tl-md" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-4 border-r-4 border-brand-400 rounded-tr-md" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-4 border-l-4 border-brand-400 rounded-bl-md" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-4 border-r-4 border-brand-400 rounded-br-md" />
              {/* Scan line animation */}
              <div className="absolute w-full h-0.5 bg-brand-400/70 animate-bounce" style={{ top: '50%' }} />
              <div className="text-white/60 text-sm text-center px-8">
                Camera sẽ hoạt động khi tích hợp thư viện QR<br/>
                <span className="text-xs">(html5-qrcode / zxing)</span>
              </div>
            </div>
            {/* Manual input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={qrInput}
                onChange={e => setQrInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && qrInput.trim()) {
                    setTripSearch(qrInput.trim())
                    setShowQrModal(false)
                    setQrInput('')
                    setTimeout(searchTrip, 50)
                  }
                }}
                placeholder="Nhập thủ công..."
                autoFocus
                className="flex-1 px-3 py-2.5 border rounded-lg text-sm"
              />
              <button
                onClick={() => {
                  if (qrInput.trim()) {
                    setTripSearch(qrInput.trim())
                    setShowQrModal(false)
                    setQrInput('')
                    setTimeout(searchTrip, 50)
                  }
                }}
                className="px-4 py-2.5 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition"
              >
                Tìm
              </button>
            </div>
            <button onClick={() => { setShowQrModal(false); setQrInput('') }}
              className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700">
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Trip info + Handover status */}
      {trip && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-700 mb-3">Thông tin chuyến</h2>
          <div className="grid grid-cols-2 gap-4 text-base mb-4">
            <div><span className="text-gray-500">Mã chuyến:</span> <strong>{trip.trip_number}</strong></div>
            <div><span className="text-gray-500">Biển số:</span> <strong>{trip.vehicle_plate}</strong></div>
            <div><span className="text-gray-500">Tài xế:</span> <strong>{trip.driver_name || '—'}</strong></div>
            <div><span className="text-gray-500">Điểm giao:</span> <strong>{trip.total_stops}</strong></div>
          </div>

          {/* Handover A Status */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-700 mb-3">Trạng thái Bàn giao A</h3>

            {handoverStatus === 'none' ? (
              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 text-center">
                <span className="text-2xl">📋</span>
                <p className="text-gray-500 mt-2 font-medium">Chưa có biên bản bàn giao cho chuyến này</p>
                <p className="text-gray-400 text-sm mt-1">Thủ kho cần tạo biên bản bàn giao trước</p>
              </div>
            ) : (
              <>
                {/* Status badge */}
                {(() => {
                  const sc = statusConfig[handoverStatus] || statusConfig.pending
                  return (
                    <div className={`border-2 rounded-xl p-4 mb-4 ${sc.bg}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{sc.icon}</span>
                        <span className={`font-bold text-lg ${sc.color}`}>{sc.label}</span>
                      </div>
                    </div>
                  )
                })()}

                {/* Reject reason */}
                {handover?.reject_reason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <span className="text-red-700 font-medium">Lý do từ chối:</span> {handover.reject_reason}
                  </div>
                )}

                {/* Signatories */}
                <div className="space-y-2 mb-4">
                  {(handover?.signatories || []).map((sig, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <span>{sig.action === 'confirm' ? '✅' : sig.action === 'reject' ? '❌' : '⏳'}</span>
                        <span className="font-medium">{sig.role_label || sig.role}</span>
                        {sig.name && <span className="text-sm text-gray-500">({sig.name})</span>}
                      </div>
                      {sig.signed_at ? (
                        <span className="text-xs text-gray-400">{new Date(sig.signed_at).toLocaleString('vi-VN')}</span>
                      ) : (
                        <span className="text-xs text-yellow-600 font-medium">Chờ xác nhận</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Photos */}
                {handover?.photo_urls && handover.photo_urls.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">Ảnh phiếu xuất kho:</h4>
                    <div className="flex gap-2 flex-wrap">
                      {handover.photo_urls.map((url, idx) => (
                        <img key={idx} src={url} alt={`Phiếu ${idx + 1}`}
                          className="w-20 h-20 object-cover rounded-lg border cursor-pointer"
                          onClick={() => window.open(url, '_blank')}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Security actions */}
                {!securityDone && handoverStatus !== 'rejected' && (
                  <div className="border-t pt-4">
                    {!showRejectForm ? (
                      <div className="flex gap-3">
                        <button
                          onClick={securityConfirm}
                          disabled={confirming}
                          className="flex-1 h-14 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition disabled:opacity-50"
                        >
                          {confirming ? 'Đang xử lý...' : '✅ Xác nhận — Cho qua cổng'}
                        </button>
                        <button
                          onClick={() => setShowRejectForm(true)}
                          className="px-6 h-14 bg-red-100 text-red-700 rounded-xl font-medium hover:bg-red-200 transition"
                        >
                          ❌ Từ chối
                        </button>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-red-700 mb-2">Lý do từ chối</label>
                        <textarea
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          placeholder="Nhập lý do từ chối..."
                          className="w-full border border-red-300 rounded-lg px-3 py-2 text-base mb-3 bg-red-50"
                          rows={2}
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={securityReject}
                            disabled={confirming || !rejectReason.trim()}
                            className="flex-1 h-14 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition disabled:opacity-50"
                          >
                            {confirming ? 'Đang xử lý...' : '❌ Xác nhận từ chối'}
                          </button>
                          <button
                            onClick={() => setShowRejectForm(false)}
                            className="px-6 h-14 border rounded-xl text-gray-600 hover:bg-gray-50 transition"
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
