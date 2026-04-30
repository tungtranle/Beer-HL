'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface FuelLog {
  id: string
  vehicle_plate: string
  driver_name: string
  log_date: string
  km_odometer: number
  liters_filled: string
  amount_vnd: string
  station_name: string
  channel: string
  expected_liters: string
  anomaly_ratio: string
  anomaly_flag: boolean
}

interface FuelAnomaly {
  id: string
  vehicle_plate: string
  driver_name: string
  expected_liters: string
  actual_liters: string
  anomaly_ratio: string
  status: string
  explanation_text: string | null
}

const channelLabels: Record<string, string> = { app: 'App', web: 'Web', fleet_card: 'Thẻ Fleet' }
const anomalyStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700', explained: 'bg-green-100 text-green-700',
  escalated: 'bg-red-100 text-red-700', dismissed: 'bg-gray-100 text-gray-700',
}

export default function FuelPage() {
  const [logs, setLogs] = useState<FuelLog[]>([])
  const [anomalies, setAnomalies] = useState<FuelAnomaly[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'logs' | 'anomalies'>('logs')
  const [anomalyOnly, setAnomalyOnly] = useState(false)

  const loadLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (anomalyOnly) params.set('anomaly_only', 'true')
      const res = await apiFetch<any>(`/fleet/fuel-logs?${params}`)
      setLogs(res.data || [])
      setTotal(res.meta?.total || 0)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const loadAnomalies = async () => {
    try {
      setLoading(true)
      const res = await apiFetch<any>('/fleet/fuel-logs/anomalies')
      setAnomalies(res.data || [])
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { tab === 'logs' ? loadLogs() : loadAnomalies() }, [tab, anomalyOnly])

  const fmt = (v: string) => {
    const n = parseFloat(v)
    return isNaN(n) ? '0' : n.toLocaleString('vi-VN')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900"> Quản lý Nhiên liệu</h1>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Tổng nhật ký', value: total.toLocaleString('vi-VN'), icon: '', color: 'bg-gray-50 border-gray-200' },
          { label: 'Tổng lít đã đổ', value: logs.reduce((s, l) => s + parseFloat(l.liters_filled || '0'), 0).toLocaleString('vi-VN', {maximumFractionDigits:0}) + ' L', icon: '', color: 'bg-blue-50 border-blue-200' },
          { label: 'Tổng chi phí', value: logs.reduce((s, l) => s + parseFloat(l.amount_vnd || '0'), 0).toLocaleString('vi-VN') + ' ₫', icon: '', color: 'bg-green-50 border-green-200' },
          { label: 'Bất thường', value: logs.filter(l => l.anomaly_flag).length.toString(), icon: '', color: anomalies.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200' },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-4 flex items-center gap-3 ${s.color}`}>
            <span className="text-2xl">{s.icon}</span>
            <div>
              <div className="text-lg font-bold text-gray-800">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('logs')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'logs' ? 'bg-brand-500 text-white' : 'bg-gray-100'}`}>
          Nhật ký ({total})
        </button>
        <button onClick={() => setTab('anomalies')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'anomalies' ? 'bg-brand-500 text-white' : 'bg-gray-100'}`}>
          Bất thường ({anomalies.length})
        </button>
        {tab === 'logs' && (
          <label className="flex items-center gap-2 ml-4 text-sm">
            <input type="checkbox" checked={anomalyOnly} onChange={e => setAnomalyOnly(e.target.checked)} />
            Chỉ bất thường
          </label>
        )}
      </div>

      {tab === 'logs' ? (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Ngày</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Xe</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tài xế</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Km</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Lít</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Kỳ vọng</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Tiền (₫)</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Kênh</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Không có dữ liệu</td></tr>
              ) : logs.map(l => (
                <tr key={l.id} className={`hover:bg-gray-50 ${l.anomaly_flag ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3">{l.log_date}</td>
                  <td className="px-4 py-3">{l.vehicle_plate}</td>
                  <td className="px-4 py-3">{l.driver_name}</td>
                  <td className="px-4 py-3 text-right">{l.km_odometer.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{fmt(l.liters_filled)}</td>
                  <td className="px-4 py-3 text-right">{fmt(l.expected_liters)}</td>
                  <td className="px-4 py-3 text-right">{fmt(l.amount_vnd)}</td>
                  <td className="px-4 py-3">{channelLabels[l.channel] || l.channel}</td>
                  <td className="px-4 py-3 text-center">{l.anomaly_flag ? '' : '✓'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Xe</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tài xế</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Kỳ vọng (L)</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Thực tế (L)</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Chênh lệch</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {anomalies.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Không có bất thường</td></tr>
              ) : anomalies.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{a.vehicle_plate}</td>
                  <td className="px-4 py-3">{a.driver_name}</td>
                  <td className="px-4 py-3 text-right">{fmt(a.expected_liters)}</td>
                  <td className="px-4 py-3 text-right">{fmt(a.actual_liters)}</td>
                  <td className="px-4 py-3 text-right text-red-600">{(parseFloat(a.anomaly_ratio) * 100).toFixed(0)}%</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${anomalyStatusColors[a.status] || ''}`}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
