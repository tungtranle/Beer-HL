'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface VehicleHealth {
  vehicle_id: string
  plate_number: string
  vehicle_type: string
  health_score: number | null
  current_km: number | null
  year_of_manufacture: number | null
  open_ros: number
  overdue_maintenance: number
  calculated_score: number
}

const scoreColor = (s: number | null) => {
  if (s === null) return 'text-gray-400'
  if (s >= 80) return 'text-green-600'
  if (s >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

const scoreBg = (s: number | null) => {
  if (s === null) return 'bg-gray-100'
  if (s >= 80) return 'bg-green-50 border-green-200'
  if (s >= 50) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

export default function HealthPage() {
  const [vehicles, setVehicles] = useState<VehicleHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'score_asc' | 'score_desc' | 'plate'>('score_asc')

  const load = async () => {
    try {
      setLoading(true)
      const res = await apiFetch<any>('/fleet/health-overview')
      setVehicles(res.data || [])
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const critical = vehicles.filter(v => (v.health_score ?? 100) < 50)
  const warning = vehicles.filter(v => (v.health_score ?? 100) >= 50 && (v.health_score ?? 100) < 80)
  const healthy = vehicles.filter(v => (v.health_score ?? 100) >= 80)

  const sorted = [...vehicles].sort((a, b) => {
    if (sortBy === 'score_asc') return (a.health_score ?? 100) - (b.health_score ?? 100)
    if (sortBy === 'score_desc') return (b.health_score ?? 100) - (a.health_score ?? 100)
    return a.plate_number.localeCompare(b.plate_number)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">🔧 Sức khỏe Đội xe</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Sắp xếp:</span>
          {[
            { key: 'score_asc', label: 'Nguy hiểm trước' },
            { key: 'score_desc', label: 'Tốt trước' },
            { key: 'plate', label: 'Biển số' },
          ].map(s => (
            <button key={s.key} onClick={() => setSortBy(s.key as typeof sortBy)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${sortBy === s.key ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s.label}
            </button>
          ))}
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition" title="Làm mới">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition" onClick={() => setSortBy('score_asc')}>
          <div className="text-3xl">⚠️</div>
          <div>
            <p className="text-3xl font-bold text-red-600">{critical.length}</p>
            <p className="text-sm text-red-700">Nguy hiểm (&lt;50)</p>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-4">
          <div className="text-3xl">🔔</div>
          <div>
            <p className="text-3xl font-bold text-yellow-600">{warning.length}</p>
            <p className="text-sm text-yellow-700">Cảnh báo (50–79)</p>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-4">
          <div className="text-3xl">✅</div>
          <div>
            <p className="text-3xl font-bold text-green-600">{healthy.length}</p>
            <p className="text-sm text-green-700">Tốt (≥80)</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Biển số</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Loại xe</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 w-48">Điểm sức khỏe</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Km hiện tại</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Năm SX</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">RO mở</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Quá hạn BD</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-gray-100 animate-pulse rounded w-full" /></td></tr>
              ))
            ) : sorted.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Không có dữ liệu</td></tr>
            ) : sorted.map(v => {
              const score = v.health_score ?? null
              const displayScore = score ?? v.calculated_score ?? 0
              const barColor = displayScore >= 80 ? 'bg-green-500' : displayScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              return (
                <tr key={v.vehicle_id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{v.plate_number}</td>
                  <td className="px-4 py-3 text-gray-600">{v.vehicle_type}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold tabular-nums w-8 text-right ${scoreColor(score)}`}>{score ?? '—'}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(displayScore, 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{v.current_km?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{v.year_of_manufacture ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {v.open_ros > 0 ? <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">{v.open_ros}</span> : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {v.overdue_maintenance > 0 ? <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">{v.overdue_maintenance}</span> : <span className="text-gray-400">0</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
