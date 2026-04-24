'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface ScorecardData {
  driver_id: string
  driver_name: string
  current_score: number
  rank: number
  rank_total: number
  history: Array<{
    score_date: string
    total_score: number
    otd_score: number
    delivery_score: number
    safety_score: number
    compliance_score: number
    customer_score: number
    trips_count: number
  }>
  badges: Array<{
    badge_name: string
    badge_emoji: string
    period_month: string
    bonus_vnd: string
  }>
}

export default function ScorecardPage() {
  const [driverIdInput, setDriverIdInput] = useState('')
  const [data, setData] = useState<ScorecardData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!driverIdInput.trim()) return
    try {
      setLoading(true)
      const res = await apiFetch<any>(`/drivers/${driverIdInput}/scorecard`)
      setData(res.data)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const scoreBar = (label: string, score: number, weight: string) => (
    <div className="flex items-center gap-3">
      <span className="w-24 text-sm text-gray-600">{label} ({weight})</span>
      <div className="flex-1 bg-gray-200 rounded-full h-3">
        <div className="bg-brand-500 h-3 rounded-full" style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="w-12 text-right text-sm font-medium">{score.toFixed(1)}</span>
    </div>
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Bảng điểm Tài xế</h1>

      <div className="flex gap-3">
        <input value={driverIdInput} onChange={e => setDriverIdInput(e.target.value)}
          placeholder="Nhập Driver ID..." className="flex-1 px-3 py-2 border rounded-lg text-sm" />
        <button onClick={load} disabled={loading}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
          {loading ? 'Đang tải...' : 'Xem'}
        </button>
      </div>

      {data && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">{data.driver_name}</h2>
                <p className="text-sm text-gray-500">Hạng <strong className="text-gray-800">{data.rank}</strong>/{data.rank_total} · Top {Math.round((data.rank / data.rank_total) * 100)}%</p>
              </div>
              <div className="text-center">
                <div className={`text-5xl font-black tabular-nums ${data.current_score >= 80 ? 'text-green-600' : data.current_score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{data.current_score.toFixed(1)}</div>
                <p className="text-xs text-gray-500">/ 100 điểm</p>
                <div className="mt-1 w-full bg-gray-100 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${data.current_score >= 80 ? 'bg-green-500' : data.current_score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${data.current_score}%` }} />
                </div>
              </div>
            </div>

            {data.history.length > 0 && (
              <div className="space-y-3">
                {scoreBar('Đúng giờ', data.history[0].otd_score, '30%')}
                {scoreBar('Giao hàng', data.history[0].delivery_score, '25%')}
                {scoreBar('An toàn', data.history[0].safety_score, '25%')}
                {scoreBar('Tuân thủ', data.history[0].compliance_score, '10%')}
                {scoreBar('Khách hàng', data.history[0].customer_score, '10%')}
              </div>
            )}
          </div>

          {data.badges.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-semibold mb-4">🏅 Huy hiệu</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.badges.map((b, i) => (
                  <div key={i} className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-2xl">{b.badge_emoji}</p>
                    <p className="text-sm font-medium mt-1">{b.badge_name}</p>
                    <p className="text-xs text-gray-500">{b.period_month}</p>
                    {parseFloat(b.bonus_vnd) > 0 && (
                      <p className="text-xs text-green-600 font-medium">+{parseFloat(b.bonus_vnd).toLocaleString('vi-VN')} ₫</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.history.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-semibold mb-4">📊 Xu hướng điểm (30 ngày)</h3>
              {/* CSS sparkline */}
              <div className="flex items-end gap-0.5 h-16 mb-3">
                {data.history.slice().reverse().map((h, i) => {
                  const pct = Math.max(0, Math.min(100, h.total_score))
                  const color = h.total_score >= 80 ? 'bg-green-400' : h.total_score >= 60 ? 'bg-amber-400' : 'bg-red-400'
                  return (
                    <div key={i} title={`${h.score_date}: ${h.total_score.toFixed(1)}`}
                      className={`flex-1 rounded-sm ${color} opacity-80 hover:opacity-100 transition-all`}
                      style={{ height: `${pct}%` }} />
                  )
                })}
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Ngày</th>
                    <th className="px-3 py-2 text-center">Tổng</th>
                    <th className="px-3 py-2 text-center">OTD</th>
                    <th className="px-3 py-2 text-center">Giao</th>
                    <th className="px-3 py-2 text-center">AT</th>
                    <th className="px-3 py-2 text-center">Chuyến</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.history.map((h, i) => (
                    <tr key={i} className={i === 0 ? 'bg-brand-50 font-medium' : ''}>
                      <td className="px-3 py-2">{h.score_date}</td>
                      <td className="px-3 py-2 text-center font-medium">{h.total_score.toFixed(1)}</td>
                      <td className="px-3 py-2 text-center">{h.otd_score.toFixed(0)}</td>
                      <td className="px-3 py-2 text-center">{h.delivery_score.toFixed(0)}</td>
                      <td className="px-3 py-2 text-center">{h.safety_score.toFixed(0)}</td>
                      <td className="px-3 py-2 text-center">{h.trips_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
