'use client'

import { useEffect, useState } from 'react'
import { apiFetch, getUser } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface GateCheck {
  trip_id: string; trip_number: string; plate_number: string
  driver_name: string; result: string; checked_by: string
  total_items: number; discrepancies: number; checked_at: string; notes: string
}

interface QueueItem {
  trip_id: string; trip_number: string; plate_number: string
  driver_name: string; total_stops: number; status: string; departure_time: string
}

export default function GateCheckPage() {
  const [tripId, setTripId] = useState('')
  const [tripNumber, setTripNumber] = useState('')
  const [checks, setChecks] = useState<GateCheck[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<'pass' | 'fail'>('pass')
  const [notes, setNotes] = useState('')
  const [failReason, setFailReason] = useState('')
  const [searchResult, setSearchResult] = useState<any>(null)
  const [gateResult, setGateResult] = useState<'pass' | 'fail' | null>(null)
  const [gateDiscrepancy, setGateDiscrepancy] = useState('')

  const user = getUser()

  useEffect(() => {
    loadQueue()
  }, [])

  const loadQueue = async () => {
    try {
      const res: any = await apiFetch('/warehouse/gate-check-queue')
      setQueue(res.data || [])
    } catch { /* ignore */ }
  }

  const searchTrip = async () => {
    if (!tripNumber.trim()) return
    setLoading(true)
    try {
      const res: any = await apiFetch(`/trips?search=${encodeURIComponent(tripNumber.trim())}`)
      const trips = res.data || []
      if (trips.length > 0) {
        const trip = trips[0]
        setTripId(trip.id)
        setSearchResult(trip)
        const gc: any = await apiFetch(`/warehouse/gate-checks/${trip.id}`).catch(() => ({ data: null }))
        if (gc.data) setChecks(Array.isArray(gc.data) ? gc.data : [gc.data])
      } else {
        setSearchResult(null)
        toast.warning('Không tìm thấy chuyến xe')
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const selectFromQueue = (item: QueueItem) => {
    setTripNumber(item.trip_number)
    setTripId(item.trip_id)
    setSearchResult({
      trip_number: item.trip_number,
      plate_number: item.plate_number,
      driver_name: item.driver_name,
      status: item.status,
    })
  }

  const performCheck = async () => {
    if (!tripId) return
    if (result === 'fail' && !failReason.trim()) {
      toast.warning('Vui lòng nhập lý do không đạt')
      return
    }
    setSubmitting(true)
    try {
      const finalNotes = result === 'fail' ? `[LÝ DO] ${failReason}\n${notes}`.trim() : notes || undefined
      await apiFetch('/warehouse/gate-check', {
        method: 'POST',
        body: { trip_id: tripId, result, notes: finalNotes },
      })
      // Show full-screen result
      setGateResult(result)
      setGateDiscrepancy(result === 'fail' ? failReason : '')
      loadQueue()
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const resetAfterResult = () => {
    setGateResult(null)
    setGateDiscrepancy('')
    setTripNumber('')
    setTripId('')
    setSearchResult(null)
    setNotes('')
    setFailReason('')
    setResult('pass')
  }

  // ── Full-screen Gate Check PASS ──
  if (gateResult === 'pass') return (
    <div className="min-h-screen bg-green-600 flex flex-col items-center justify-center p-6 -m-6">
      <p className="text-white text-6xl mb-4">✓</p>
      <h1 className="text-2xl font-bold text-white mb-2">Cho xe xuất cổng</h1>
      <p className="text-green-100 text-base mb-1">{searchResult?.trip_number} · {searchResult?.plate_number}</p>
      <p className="text-green-200 text-sm mb-8">Kiểm đếm khớp 100% — R01 passed</p>
      <button
        onClick={resetAfterResult}
        className="w-full max-w-md h-14 bg-white text-green-700 font-bold rounded-xl text-lg"
      >
        Kiểm tra xe tiếp theo
      </button>
    </div>
  )

  // ── Full-screen Gate Check FAIL ──
  if (gateResult === 'fail') return (
    <div className="min-h-screen bg-red-600 flex flex-col items-center justify-center p-6 -m-6">
      <p className="text-white text-6xl mb-4">✗</p>
      <h1 className="text-2xl font-bold text-white mb-2">Không được xuất cổng</h1>
      <p className="text-red-100 text-base mb-1">{searchResult?.trip_number} · {searchResult?.plate_number}</p>
      <p className="text-red-200 text-sm mb-6">{gateDiscrepancy} — vi phạm R01</p>
      <button
        onClick={resetAfterResult}
        className="w-full max-w-md h-14 bg-white text-red-600 font-bold rounded-xl text-lg mb-3"
      >
        Quay lại
      </button>
    </div>
  )

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-800">🚧 Kiểm tra cổng</h1>
        {queue.length > 0 && (
          <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium animate-pulse">
            {queue.length} xe chờ kiểm tra
          </span>
        )}
      </div>
      <p className="text-base text-gray-500 mb-6">Kiểm đếm hàng trên xe trước khi xuất kho</p>

      {/* Gate check queue */}
      {queue.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <h2 className="font-semibold text-amber-800 mb-3">⏳ Hàng đợi kiểm tra ({queue.length})</h2>
          <div className="space-y-2">
            {queue.map(item => (
              <button key={item.trip_id}
                onClick={() => selectFromQueue(item)}
                className="w-full flex items-center justify-between bg-white rounded-lg px-4 h-14 border border-amber-100 cursor-pointer hover:border-amber-300 transition text-left">
                <div>
                  <span className="font-medium text-gray-800">{item.trip_number}</span>
                  <span className="text-gray-400 mx-2">·</span>
                  <span className="text-sm text-gray-600">{item.plate_number}</span>
                  <span className="text-gray-400 mx-2">·</span>
                  <span className="text-sm text-gray-500">{item.driver_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{item.total_stops} điểm</span>
                  {item.departure_time && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      Xuất: {item.departure_time.substring(11, 16)}
                    </span>
                  )}
                  <span className="text-brand-500 text-sm font-medium">Kiểm tra →</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search trip */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-700 mb-3 text-base">Tìm chuyến xe</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={tripNumber}
            onChange={e => setTripNumber(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchTrip()}
            placeholder="Nhập mã chuyến (VD: TR-20260316-001)"
            className="flex-1 px-4 h-12 border rounded-lg text-base"
          />
          <button
            onClick={searchTrip}
            disabled={loading}
            className="px-6 h-12 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition text-base disabled:opacity-50"
          >
            {loading ? 'Đang tìm...' : '🔍 Tìm'}
          </button>
        </div>
      </div>

      {/* Trip info + gate check form */}
      {searchResult && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-700 mb-3 text-base">Thông tin chuyến</h2>
          <div className="grid grid-cols-2 gap-4 text-base mb-4">
            <div><span className="text-gray-500">Mã chuyến:</span> <strong>{searchResult.trip_number}</strong></div>
            <div><span className="text-gray-500">Biển số:</span> <strong>{searchResult.plate_number}</strong></div>
            <div><span className="text-gray-500">Tài xế:</span> <strong>{searchResult.driver_name || '—'}</strong></div>
            <div><span className="text-gray-500">Trạng thái:</span> <strong>{searchResult.status}</strong></div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-700 mb-3 text-base">Kết quả kiểm tra</h3>
            <div className="flex gap-4 mb-4">
              <label className={`flex-1 flex items-center justify-center gap-2 h-14 rounded-xl border-2 cursor-pointer transition text-base ${result === 'pass' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                <input type="radio" name="result" value="pass" checked={result === 'pass'} onChange={() => setResult('pass')} className="hidden" />
                <span className="text-2xl">✅</span>
                <span className="font-medium">Đạt — Hàng khớp</span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 h-14 rounded-xl border-2 cursor-pointer transition text-base ${result === 'fail' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                <input type="radio" name="result" value="fail" checked={result === 'fail'} onChange={() => setResult('fail')} className="hidden" />
                <span className="text-2xl">❌</span>
                <span className="font-medium">Không đạt — Sai lệch</span>
              </label>
            </div>

            {/* Mandatory fail reason */}
            {result === 'fail' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-red-700 mb-1">
                  Lý do không đạt <span className="text-red-500">*</span>
                </label>
                <select
                  value={failReason}
                  onChange={e => setFailReason(e.target.value)}
                  className="w-full px-3 h-12 border border-red-300 rounded-lg text-base bg-red-50 focus:ring-2 focus:ring-red-500"
                >
                  <option value="">-- Chọn lý do --</option>
                  <option value="Thiếu hàng">Thiếu hàng</option>
                  <option value="Thừa hàng">Thừa hàng</option>
                  <option value="Hàng hư hỏng">Hàng hư hỏng</option>
                  <option value="Sai sản phẩm">Sai sản phẩm</option>
                  <option value="Sai số lượng">Sai số lượng</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
            )}

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={result === 'fail' ? 'Chi tiết sai lệch (sản phẩm, số lượng chênh lệch...)' : 'Ghi chú (nếu có)'}
              className="w-full px-3 py-3 border rounded-lg text-base mb-4"
              rows={3}
            />
            <button
              onClick={performCheck}
              disabled={submitting || (result === 'fail' && !failReason)}
              className={`w-full h-14 rounded-xl text-white font-bold text-lg transition ${result === 'pass' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}
            >
              {submitting ? 'Đang xử lý...' : result === 'pass' ? '✅ Cho xe qua cổng' : '❌ Ghi nhận không đạt'}
            </button>
          </div>
        </div>
      )}

      {/* Recent checks */}
      {checks.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 mb-3 text-base">Lịch sử kiểm tra cổng</h2>
          <div className="space-y-2">
            {checks.map((c, i) => (
              <div key={i} className={`flex items-center justify-between p-4 rounded-lg border ${c.result === 'pass' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div>
                  <div className="font-medium text-base">{c.trip_number} · {c.plate_number}</div>
                  <div className="text-xs text-gray-500">Kiểm tra bởi: {c.checked_by} · {new Date(c.checked_at).toLocaleString('vi-VN')}</div>
                  {c.notes && <div className="text-sm text-gray-600 mt-1">{c.notes}</div>}
                </div>
                <span className={`text-base font-bold ${c.result === 'pass' ? 'text-green-600' : 'text-red-600'}`}>
                  {c.result === 'pass' ? '✅ Đạt' : '❌ Không đạt'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
