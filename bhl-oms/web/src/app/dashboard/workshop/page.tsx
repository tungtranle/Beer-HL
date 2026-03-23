'use client'

import { useEffect, useState } from 'react'
import { apiFetch, getUser } from '@/lib/api'
import { toast } from '@/lib/useToast'
import { useRouter } from 'next/navigation'

interface BottleClassification {
  id: string; trip_id: string; trip_number: string
  product_id: string; product_name: string
  bottles_sent: number; bottles_returned_good: number
  bottles_returned_damaged: number; bottles_missing: number
  notes: string; classified_at: string
}

interface BottleSummary {
  total_sent: number; total_returned_good: number
  total_returned_damaged: number; total_missing: number
  trips_processed: number
}

interface Trip {
  id: string; trip_number: string; vehicle_plate: string
  driver_name: string; status: string
}

export default function WorkshopPage() {
  const router = useRouter()
  const user = getUser()
  const [summary, setSummary] = useState<BottleSummary | null>(null)
  const [tripSearch, setTripSearch] = useState('')
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [classifications, setClassifications] = useState<BottleClassification[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form
  const [productId, setProductId] = useState('')
  const [productName, setProductName] = useState('')
  const [sent, setSent] = useState(0)
  const [returnedGood, setReturnedGood] = useState(0)
  const [returnedDmg, setReturnedDmg] = useState(0)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!user || !['admin', 'warehouse', 'workshop'].includes(user.role)) {
      router.replace('/dashboard')
      return
    }
    apiFetch<any>('/warehouse/bottles/summary')
      .then(r => setSummary(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const searchTrip = async () => {
    if (!tripSearch.trim()) return
    try {
      const res: any = await apiFetch(`/trips?search=${encodeURIComponent(tripSearch.trim())}`)
      const trips = res.data || []
      if (trips.length > 0) {
        setSelectedTrip(trips[0])
        const bc: any = await apiFetch(`/warehouse/bottles/trip/${trips[0].id}`)
        setClassifications(bc.data || [])
      } else {
        toast.warning('Không tìm thấy chuyến xe')
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message)
    }
  }

  const handleClassify = async () => {
    if (!selectedTrip || !productId) return
    setSubmitting(true)
    try {
      await apiFetch('/warehouse/bottles/classify', {
        method: 'POST',
        body: {
          trip_id: selectedTrip.id,
          trip_number: selectedTrip.trip_number,
          product_id: productId,
          product_name: productName,
          bottles_sent: sent,
          bottles_returned_good: returnedGood,
          bottles_returned_damaged: returnedDmg,
          notes,
        },
      })
      // Reload
      const bc: any = await apiFetch(`/warehouse/bottles/trip/${selectedTrip.id}`)
      setClassifications(bc.data || [])
      const sm: any = await apiFetch('/warehouse/bottles/summary')
      setSummary(sm.data)
      // Reset form
      setProductId(''); setProductName(''); setSent(0); setReturnedGood(0); setReturnedDmg(0); setNotes('')
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" /></div>

  return (
    <div className="max-w-[1200px] mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">🏭 Phân xưởng — Phân loại vỏ</h1>
      <p className="text-sm text-gray-500 mb-6">Phân loại vỏ/két thu hồi theo chuyến xe</p>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
            <div className="text-xs text-gray-500 mb-1">Vỏ xuất</div>
            <div className="text-2xl font-bold text-blue-700">{summary.total_sent.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
            <div className="text-xs text-gray-500 mb-1">Thu hồi tốt</div>
            <div className="text-2xl font-bold text-green-700">{summary.total_returned_good.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-amber-500">
            <div className="text-xs text-gray-500 mb-1">Hư hỏng</div>
            <div className="text-2xl font-bold text-amber-700">{summary.total_returned_damaged.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-red-500">
            <div className="text-xs text-gray-500 mb-1">Thiếu/mất</div>
            <div className="text-2xl font-bold text-red-700">{summary.total_missing.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-gray-400">
            <div className="text-xs text-gray-500 mb-1">Chuyến đã xử lý</div>
            <div className="text-2xl font-bold text-gray-700">{summary.trips_processed}</div>
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
            placeholder="Nhập mã chuyến (VD: TR-20260316-001)"
            className="flex-1 px-4 py-2 border rounded-lg text-sm"
          />
          <button onClick={searchTrip} className="px-6 py-2 bg-[#F68634] text-white rounded-lg hover:bg-[#e5752a] transition text-sm">
            🔍 Tìm
          </button>
        </div>
      </div>

      {/* Trip detail + classify form */}
      {selectedTrip && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-700">Chuyến: {selectedTrip.trip_number}</h2>
              <p className="text-sm text-gray-500">{selectedTrip.vehicle_plate} — {selectedTrip.driver_name}</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-700">{selectedTrip.status}</span>
          </div>

          {/* Existing classifications */}
          {classifications.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Đã phân loại:</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-3">Sản phẩm</th>
                    <th className="text-right py-2 px-3">Xuất</th>
                    <th className="text-right py-2 px-3">Tốt</th>
                    <th className="text-right py-2 px-3">Hỏng</th>
                    <th className="text-right py-2 px-3">Thiếu</th>
                    <th className="text-left py-2 px-3">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {classifications.map(bc => (
                    <tr key={bc.id} className="border-t">
                      <td className="py-2 px-3">{bc.product_name}</td>
                      <td className="py-2 px-3 text-right">{bc.bottles_sent}</td>
                      <td className="py-2 px-3 text-right text-green-600">{bc.bottles_returned_good}</td>
                      <td className="py-2 px-3 text-right text-amber-600">{bc.bottles_returned_damaged}</td>
                      <td className={`py-2 px-3 text-right font-medium ${bc.bottles_missing > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {bc.bottles_missing}
                      </td>
                      <td className="py-2 px-3 text-gray-500 text-xs">{bc.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add new classification */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-600 mb-3">Thêm phân loại:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500">Mã SP</label>
                <input type="text" value={productId} onChange={e => setProductId(e.target.value)}
                  placeholder="UUID sản phẩm" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Tên SP</label>
                <input type="text" value={productName} onChange={e => setProductName(e.target.value)}
                  placeholder="Bia Heineken 330ml" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Vỏ xuất</label>
                <input type="number" value={sent} onChange={e => setSent(+e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Vỏ thu tốt</label>
                <input type="number" value={returnedGood} onChange={e => setReturnedGood(+e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Vỏ hư hỏng</label>
                <input type="number" value={returnedDmg} onChange={e => setReturnedDmg(+e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Ghi chú</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Ghi chú..." className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500">
                Thiếu: <strong className={sent - returnedGood - returnedDmg > 0 ? 'text-red-600' : 'text-green-600'}>
                  {Math.max(0, sent - returnedGood - returnedDmg)}
                </strong>
              </div>
              <button
                onClick={handleClassify}
                disabled={!productId || submitting}
                className="ml-auto px-6 py-2 bg-[#F68634] text-white rounded-lg hover:bg-[#e5752a] transition text-sm disabled:opacity-50"
              >
                {submitting ? 'Đang lưu...' : '✅ Phân loại'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
