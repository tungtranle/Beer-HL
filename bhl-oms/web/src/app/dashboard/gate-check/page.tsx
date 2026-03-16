'use client'

import { useEffect, useState } from 'react'
import { apiFetch, getUser } from '@/lib/api'

interface GateCheck {
  trip_id: string; trip_number: string; plate_number: string
  driver_name: string; result: string; checked_by: string
  total_items: number; discrepancies: number; checked_at: string; notes: string
}

export default function GateCheckPage() {
  const [tripId, setTripId] = useState('')
  const [tripNumber, setTripNumber] = useState('')
  const [checks, setChecks] = useState<GateCheck[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<'pass' | 'fail'>('pass')
  const [notes, setNotes] = useState('')
  const [searchResult, setSearchResult] = useState<any>(null)

  const user = getUser()

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
        // Load existing gate checks
        const gc: any = await apiFetch(`/warehouse/gate-checks/${trip.id}`).catch(() => ({ data: null }))
        if (gc.data) setChecks(Array.isArray(gc.data) ? gc.data : [gc.data])
      } else {
        setSearchResult(null)
        alert('Không tìm thấy chuyến xe')
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const performCheck = async () => {
    if (!tripId) return
    setSubmitting(true)
    try {
      await apiFetch('/warehouse/gate-check', {
        method: 'POST',
        body: { trip_id: tripId, result, notes: notes || undefined },
      })
      alert(result === 'pass' ? '✅ Xe đã qua cổng!' : '❌ Đã ghi nhận không đạt')
      setTripNumber('')
      setTripId('')
      setSearchResult(null)
      setNotes('')
      setResult('pass')
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-[800px] mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">🚧 Kiểm tra cổng</h1>
      <p className="text-sm text-gray-500 mb-6">Kiểm đếm hàng trên xe trước khi xuất kho</p>

      {/* Search trip */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">Tìm chuyến xe</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={tripNumber}
            onChange={e => setTripNumber(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchTrip()}
            placeholder="Nhập mã chuyến (VD: TR-20260316-001)"
            className="flex-1 px-4 py-2 border rounded-lg text-sm"
          />
          <button
            onClick={searchTrip}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm disabled:opacity-50"
          >
            {loading ? 'Đang tìm...' : '🔍 Tìm'}
          </button>
        </div>
      </div>

      {/* Trip info + gate check form */}
      {searchResult && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-700 mb-3">Thông tin chuyến</h2>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div><span className="text-gray-500">Mã chuyến:</span> <strong>{searchResult.trip_number}</strong></div>
            <div><span className="text-gray-500">Biển số:</span> <strong>{searchResult.plate_number}</strong></div>
            <div><span className="text-gray-500">Tài xế:</span> <strong>{searchResult.driver_name || '—'}</strong></div>
            <div><span className="text-gray-500">Trạng thái:</span> <strong>{searchResult.status}</strong></div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-700 mb-3">Kết quả kiểm tra</h3>
            <div className="flex gap-4 mb-4">
              <label className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition ${result === 'pass' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                <input type="radio" name="result" value="pass" checked={result === 'pass'} onChange={() => setResult('pass')} className="hidden" />
                <span className="text-2xl">✅</span>
                <span className="font-medium">Đạt — Hàng khớp</span>
              </label>
              <label className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition ${result === 'fail' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                <input type="radio" name="result" value="fail" checked={result === 'fail'} onChange={() => setResult('fail')} className="hidden" />
                <span className="text-2xl">❌</span>
                <span className="font-medium">Không đạt — Sai lệch</span>
              </label>
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ghi chú (nếu có sai lệch, ghi chi tiết)"
              className="w-full px-3 py-2 border rounded-lg text-sm mb-4"
              rows={3}
            />
            <button
              onClick={performCheck}
              disabled={submitting}
              className={`w-full py-3 rounded-xl text-white font-medium text-lg transition ${result === 'pass' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}
            >
              {submitting ? 'Đang xử lý...' : result === 'pass' ? '✅ Cho xe qua cổng' : '❌ Ghi nhận không đạt'}
            </button>
          </div>
        </div>
      )}

      {/* Recent checks */}
      {checks.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 mb-3">Lịch sử kiểm tra cổng</h2>
          <div className="space-y-2">
            {checks.map((c, i) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${c.result === 'pass' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div>
                  <div className="font-medium text-sm">{c.trip_number} · {c.plate_number}</div>
                  <div className="text-xs text-gray-500">Kiểm tra bởi: {c.checked_by} · {new Date(c.checked_at).toLocaleString('vi-VN')}</div>
                </div>
                <span className={`text-sm font-bold ${c.result === 'pass' ? 'text-green-600' : 'text-red-600'}`}>
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
