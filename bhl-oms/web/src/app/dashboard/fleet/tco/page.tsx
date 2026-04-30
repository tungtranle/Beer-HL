'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface VehicleTCO {
  vehicle_id: string
  plate_number: string
  vehicle_type: string
  year_of_manufacture: number | null
  repair_cost: string
  fuel_cost: string
  tire_cost: string
  total_cost: string
  km_driven: number
  cost_per_km: string
}

export default function TCOPage() {
  const [vehicles, setVehicles] = useState<VehicleTCO[]>([])
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState(12)

  const load = async () => {
    try {
      setLoading(true)
      const res = await apiFetch<any>(`/fleet/tco/summary?months=${months}`)
      setVehicles(res.data || [])
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [months])

  const fmt = (v: string) => {
    const n = parseFloat(v)
    return isNaN(n) ? '0' : n.toLocaleString('vi-VN')
  }

  const totalAll = vehicles.reduce((s, v) => s + parseFloat(v.total_cost || '0'), 0)

  const sortedByTotal = [...vehicles].sort((a, b) => parseFloat(b.total_cost) - parseFloat(a.total_cost))
  const maxCost = sortedByTotal.length > 0 ? parseFloat(sortedByTotal[0].total_cost) : 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chi phí Sở hữu (TCO)</h1>
          <p className="text-sm text-gray-500">Tổng chi phí toàn đội: <span className="font-semibold text-gray-700">{totalAll.toLocaleString('vi-VN')} ₫</span></p>
        </div>
        <select value={months} onChange={e => setMonths(+e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm">
          <option value={3}>3 tháng</option>
          <option value={6}>6 tháng</option>
          <option value={12}>12 tháng</option>
        </select>
      </div>

      {/* Top cost summary */}
      {vehicles.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Tổng sửa chữa', value: vehicles.reduce((s,v)=>s+parseFloat(v.repair_cost||'0'),0), color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
            { label: 'Tổng nhiên liệu', value: vehicles.reduce((s,v)=>s+parseFloat(v.fuel_cost||'0'),0), color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
            { label: 'Tổng lốp xe', value: vehicles.reduce((s,v)=>s+parseFloat(v.tire_cost||'0'),0), color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
          ].map(item => (
            <div key={item.label} className={`border rounded-xl p-4 ${item.bg}`}>
              <div className={`text-xl font-bold ${item.color}`}>{item.value.toLocaleString('vi-VN')} ₫</div>
              <div className="text-xs text-gray-500 mt-1">{item.label}</div>
              <div className="text-xs text-gray-400">{totalAll > 0 ? ((item.value / totalAll) * 100).toFixed(0) : 0}% tổng chi phí</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Xe</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Loại</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Sửa chữa</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Nhiên liệu</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Lốp</th>
              <th className="px-4 py-3 font-medium text-gray-500 w-48">Chi phí (biểu đồ)</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">₫/km</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              Array.from({length:4}).map((_,i)=>(
                <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-gray-100 animate-pulse rounded w-full"/></td></tr>
              ))
            ) : sortedByTotal.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Không có dữ liệu</td></tr>
            ) : sortedByTotal.map(v => {
              const total = parseFloat(v.total_cost || '0')
              const repair = parseFloat(v.repair_cost || '0')
              const fuel = parseFloat(v.fuel_cost || '0')
              const tire = parseFloat(v.tire_cost || '0')
              const barWidth = maxCost > 0 ? (total / maxCost) * 100 : 0
              const repairPct = total > 0 ? (repair / total) * 100 : 0
              const fuelPct = total > 0 ? (fuel / total) * 100 : 0
              const tirePct = total > 0 ? (tire / total) * 100 : 0
              return (
                <tr key={v.vehicle_id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{v.plate_number}</td>
                  <td className="px-4 py-3 text-gray-600">{v.vehicle_type}</td>
                  <td className="px-4 py-3 text-right text-red-600">{fmt(v.repair_cost)}</td>
                  <td className="px-4 py-3 text-right text-blue-600">{fmt(v.fuel_cost)}</td>
                  <td className="px-4 py-3 text-right text-amber-600">{fmt(v.tire_cost)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden" style={{width: `${barWidth}%`, minWidth: '20px'}}>
                        <div className="h-3 flex">
                          <div className="bg-red-400 h-3" style={{width:`${repairPct}%`}}/>
                          <div className="bg-blue-400 h-3" style={{width:`${fuelPct}%`}}/>
                          <div className="bg-amber-400 h-3" style={{width:`${tirePct}%`}}/>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-gray-700 tabular-nums">{fmt(v.total_cost)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">{fmt(v.cost_per_km)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
