'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface DailyCloseRecord {
  id: string; close_date: string; warehouse_id: string; warehouse_name: string
  total_trips: number; reconciled_trips: number; unreconciled_trips: number
  total_cash_collected: number; total_discrepancies: number
  status: string; closed_by: string; closed_at: string
}

interface Discrepancy {
  id: string; trip_number: string; driver_name: string
  type: string; description: string; amount: number
  status: string; created_at: string
}

export default function DailyClosePage() {
  const [closes, setCloses] = useState<DailyCloseRecord[]>([])
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([])
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [resolving, setResolving] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      apiFetch<any>('/reconciliation/daily-close').then(r => setCloses(r.data || [])).catch(() => {}),
      apiFetch<any>('/reconciliation/discrepancies').then(r => setDiscrepancies(r.data || [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const generateClose = async () => {
    setClosing(true)
    try {
      await apiFetch('/reconciliation/daily-close', {
        method: 'POST',
        body: { close_date: selectedDate },
      })
      const res: any = await apiFetch('/reconciliation/daily-close')
      setCloses(res.data || [])
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    } finally {
      setClosing(false)
    }
  }

  const resolveDiscrepancy = async (id: string) => {
    setResolving(id)
    try {
      await apiFetch(`/reconciliation/discrepancies/${id}/resolve`, {
        method: 'POST',
        body: { resolution: 'Đã xác nhận và xử lý' },
      })
      const res: any = await apiFetch('/reconciliation/discrepancies')
      setDiscrepancies(res.data || [])
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    } finally {
      setResolving(null)
    }
  }

  const formatMoney = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>

  const openDiscrepancies = discrepancies.filter(d => d.status === 'open' || d.status === 'investigating')

  return (
    <div className="max-w-[1200px] mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">📊 Đối soát cuối ngày</h1>
      <p className="text-sm text-gray-500 mb-6">Kiểm tra và chốt sổ cuối ngày. Xử lý sai lệch.</p>

      {/* Generate close */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">Chốt sổ ngày</h2>
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          />
          <button
            onClick={generateClose}
            disabled={closing}
            className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm disabled:opacity-50"
          >
            {closing ? 'Đang xử lý...' : '📊 Chốt sổ cuối ngày'}
          </button>
        </div>
      </div>

      {/* Open discrepancies */}
      {openDiscrepancies.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-red-700 mb-3">⚠️ Sai lệch chưa xử lý ({openDiscrepancies.length})</h2>
          <div className="space-y-3">
            {openDiscrepancies.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50">
                <div>
                  <div className="font-medium text-sm">{d.trip_number} · {d.driver_name}</div>
                  <div className="text-xs text-gray-500">{d.type}: {d.description}</div>
                  {d.amount > 0 && <div className="text-xs text-red-600 font-medium mt-1">Chênh lệch: {formatMoney(d.amount)}</div>}
                </div>
                <button
                  onClick={() => resolveDiscrepancy(d.id)}
                  disabled={resolving === d.id}
                  className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-50"
                >
                  {resolving === d.id ? '...' : '✅ Xử lý'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-3">Lịch sử chốt sổ</h2>
        {closes.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Chưa có phiên chốt sổ nào</p>
        ) : (
          <div className="space-y-2">
            {closes.map(c => (
              <div key={c.id} className={`flex items-center justify-between p-4 rounded-lg border ${c.unreconciled_trips > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                <div>
                  <div className="font-medium">{c.close_date}</div>
                  <div className="text-xs text-gray-500">
                    {c.total_trips} chuyến · {c.reconciled_trips} đã soát · {c.unreconciled_trips > 0 ? `${c.unreconciled_trips} chưa soát` : 'Hoàn tất'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-sm">{formatMoney(c.total_cash_collected)}</div>
                  <div className={`text-xs ${c.total_discrepancies > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {c.total_discrepancies > 0 ? `${c.total_discrepancies} sai lệch` : '✓ Không sai lệch'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
