'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface KPIReport {
  period: string
  otd_rate: number         // On-time delivery %
  vehicle_utilization: number
  avg_capacity_util: number
  total_trips: number
  total_deliveries: number
  total_distance_km: number
  failed_deliveries: number
  redelivery_count: number
  avg_stops_per_trip: number
  total_revenue: number
  cash_collected: number
  empty_run_rate: number
}

export default function KPIDashboardPage() {
  const [report, setReport] = useState<KPIReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('today')

  const loadData = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch(`/kpi/report?period=${period}`)
      setReport(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  const formatMoney = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📈 Bảng điều khiển KPI</h1>
          <p className="text-sm text-gray-500">Chỉ số hiệu suất vận hành</p>
        </div>
        <div className="flex gap-2">
          {[
            { value: 'today', label: 'Hôm nay' },
            { value: 'week', label: 'Tuần này' },
            { value: 'month', label: 'Tháng này' },
          ].map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${period === p.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!report ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-gray-400">Chưa có dữ liệu KPI cho kỳ này</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-500">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tỉ lệ giao đúng hẹn (OTD)</div>
              <div className={`text-3xl font-bold ${(report.otd_rate || 0) >= 90 ? 'text-green-600' : 'text-red-600'}`}>
                {(report.otd_rate || 0).toFixed(1)}%
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-blue-500">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Sử dụng tải trọng TB</div>
              <div className="text-3xl font-bold text-blue-700">{(report.avg_capacity_util || 0).toFixed(0)}%</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-amber-500">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tổng chuyến</div>
              <div className="text-3xl font-bold text-amber-700">{report.total_trips || 0}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-purple-500">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tổng điểm giao</div>
              <div className="text-3xl font-bold text-purple-700">{report.total_deliveries || 0}</div>
            </div>
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="text-xs text-gray-500 mb-1">Tổng quãng đường</div>
              <div className="text-xl font-bold text-gray-700">{(report.total_distance_km || 0).toFixed(0)} km</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="text-xs text-gray-500 mb-1">Điểm/chuyến TB</div>
              <div className="text-xl font-bold text-gray-700">{(report.avg_stops_per_trip || 0).toFixed(1)}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="text-xs text-gray-500 mb-1">Giao thất bại</div>
              <div className={`text-xl font-bold ${(report.failed_deliveries || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {report.failed_deliveries || 0}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="text-xs text-gray-500 mb-1">Giao lại</div>
              <div className="text-xl font-bold text-orange-600">{report.redelivery_count || 0}</div>
            </div>
          </div>

          {/* Financial KPIs */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-3">Tài chính</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-500">Doanh thu</div>
                <div className="text-lg font-bold text-green-700">{formatMoney(report.total_revenue || 0)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Đã thu tiền</div>
                <div className="text-lg font-bold text-blue-700">{formatMoney(report.cash_collected || 0)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Tỉ lệ xe chạy không</div>
                <div className={`text-lg font-bold ${(report.empty_run_rate || 0) > 5 ? 'text-red-600' : 'text-green-600'}`}>
                  {(report.empty_run_rate || 0).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
