'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { formatVND } from '@/lib/status-config'

interface KPIReport {
  period: string
  otd_rate: number
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

interface IssueItem {
  id: string; type: string; order_number: string; customer_name: string
  status: string; reason: string; amount: number; date: string
}
interface IssuesReport {
  summary: { failed_deliveries: number; discrepancies: number; late_deliveries: number; total: number }
  items: IssueItem[] | null
}

interface CancellationItem {
  id: string; type: string; order_number: string; customer_name: string
  status: string; reason: string; total_amount: number; credit_status: string; date: string
}
interface CancellationsReport {
  summary: { cancelled: number; rejected: number; on_credit: number; pending_approval: number; total_debt: number }
  items: CancellationItem[] | null
}

type Tab = 'overview' | 'issues' | 'cancellations'

export default function KPIDashboardPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [report, setReport] = useState<KPIReport | null>(null)
  const [issues, setIssues] = useState<IssuesReport | null>(null)
  const [cancellations, setCancellations] = useState<CancellationsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('today')

  const loadOverview = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch(`/kpi/report?period=${period}`)
      setReport(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const loadIssues = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/kpi/issues')
      setIssues(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const loadCancellations = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/kpi/cancellations')
      setCancellations(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (tab === 'overview') loadOverview()
    else if (tab === 'issues') loadIssues()
    else loadCancellations()
  }, [tab, period]) // eslint-disable-line react-hooks/exhaustive-deps

  // formatVND imported from status-config (single source of truth)

  const issueTypeLabel: Record<string, string> = {
    failed_delivery: 'Giao thất bại', discrepancy: 'Sai lệch', late_delivery: 'Giao trễ'
  }
  const cancelTypeLabel: Record<string, string> = {
    cancelled: 'Đã hủy', rejected: 'Bị từ chối', on_credit: 'Nợ', pending_approval: 'Chờ duyệt'
  }

  const Spinner = () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📈 Bảng điều khiển KPI</h1>
          <p className="text-sm text-gray-500">Chỉ số hiệu suất vận hành</p>
        </div>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {([
          { value: 'overview' as Tab, label: 'Tổng quan', icon: '📊' },
          { value: 'issues' as Tab, label: 'Có vấn đề', icon: '⚠️' },
          { value: 'cancellations' as Tab, label: 'Hủy / Nợ', icon: '🚫' },
        ]).map(t => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === t.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.icon} {t.label}
            {t.value === 'issues' && issues && issues.summary.total > 0 && (
              <span className="ml-1.5 bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full">{issues.summary.total}</span>
            )}
            {t.value === 'cancellations' && cancellations && (cancellations.summary.cancelled + cancellations.summary.rejected + cancellations.summary.on_credit) > 0 && (
              <span className="ml-1.5 bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full">
                {cancellations.summary.cancelled + cancellations.summary.rejected + cancellations.summary.on_credit}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* === Tab: Overview === */}
      {tab === 'overview' && (
        <>
          <div className="flex gap-2 mb-6">
            {[
              { value: 'today', label: 'Hôm nay' },
              { value: 'week', label: 'Tuần này' },
              { value: 'month', label: 'Tháng này' },
            ].map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${period === p.value ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {p.label}
              </button>
            ))}
          </div>

          {loading ? <Spinner /> : !report ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <p className="text-gray-400">Chưa có dữ liệu KPI cho kỳ này</p>
            </div>
          ) : (
            <div className="space-y-6">
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
                <div onClick={() => router.push('/dashboard/planning')}
                  className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-amber-500 cursor-pointer hover:ring-2 hover:ring-amber-200 transition">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tổng chuyến</div>
                  <div className="text-3xl font-bold text-amber-700">{report.total_trips || 0}</div>
                  <div className="text-xs text-gray-400 mt-1">Nhấn để xem →</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-purple-500">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tổng điểm giao</div>
                  <div className="text-3xl font-bold text-purple-700">{report.total_deliveries || 0}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <div className="text-xs text-gray-500 mb-1">Tổng quãng đường</div>
                  <div className="text-xl font-bold text-gray-700">{(report.total_distance_km || 0).toFixed(0)} km</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <div className="text-xs text-gray-500 mb-1">Điểm/chuyến TB</div>
                  <div className="text-xl font-bold text-gray-700">{(report.avg_stops_per_trip || 0).toFixed(1)}</div>
                </div>
                <div onClick={() => router.push('/dashboard/orders?status=rejected')}
                  className="bg-white rounded-xl shadow-sm p-5 cursor-pointer hover:ring-2 hover:ring-red-200 transition">
                  <div className="text-xs text-gray-500 mb-1">Giao thất bại</div>
                  <div className={`text-xl font-bold ${(report.failed_deliveries || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {report.failed_deliveries || 0}
                  </div>
                  {(report.failed_deliveries || 0) > 0 && <div className="text-xs text-gray-400 mt-1">Nhấn để xem →</div>}
                </div>
                <div onClick={() => router.push('/dashboard/orders?status=re_delivery')}
                  className="bg-white rounded-xl shadow-sm p-5 cursor-pointer hover:ring-2 hover:ring-orange-200 transition">
                  <div className="text-xs text-gray-500 mb-1">Giao lại</div>
                  <div className="text-xl font-bold text-orange-600">{report.redelivery_count || 0}</div>
                  {(report.redelivery_count || 0) > 0 && <div className="text-xs text-gray-400 mt-1">Nhấn để xem →</div>}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="font-semibold text-gray-700 mb-3">Tài chính</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Doanh thu</div>
                    <div className="text-lg font-bold text-green-700">{formatVND(report.total_revenue || 0)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Đã thu tiền</div>
                    <div className="text-lg font-bold text-blue-700">{formatVND(report.cash_collected || 0)}</div>
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
        </>
      )}

      {/* === Tab: Issues === */}
      {tab === 'issues' && (
        loading ? <Spinner /> : !issues ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-gray-400">Không có dữ liệu vấn đề</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div onClick={() => router.push('/dashboard/orders?status=rejected')}
                className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-red-500 cursor-pointer hover:ring-2 hover:ring-red-200 transition">
                <div className="text-xs text-gray-500 mb-1">Giao thất bại</div>
                <div className="text-2xl font-bold text-red-600">{issues.summary.failed_deliveries}</div>
              </div>
              <div onClick={() => router.push('/dashboard/reconciliation')}
                className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-amber-500 cursor-pointer hover:ring-2 hover:ring-amber-200 transition">
                <div className="text-xs text-gray-500 mb-1">Sai lệch</div>
                <div className="text-2xl font-bold text-amber-600">{issues.summary.discrepancies}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-500">
                <div className="text-xs text-gray-500 mb-1">Giao trễ</div>
                <div className="text-2xl font-bold text-orange-600">{issues.summary.late_deliveries}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-gray-500">
                <div className="text-xs text-gray-500 mb-1">Tổng vấn đề</div>
                <div className="text-2xl font-bold text-gray-700">{issues.summary.total}</div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-600">Mã đơn</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Khách hàng</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Loại vấn đề</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Lý do</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">Giá trị</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Ngày</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(issues.items || []).length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Không có vấn đề nào trong kỳ này 🎉</td></tr>
                  ) : (issues.items || []).map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{item.order_number}</td>
                      <td className="px-4 py-3">{item.customer_name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          item.type === 'failed_delivery' ? 'bg-red-100 text-red-700' :
                          item.type === 'discrepancy' ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'
                        }`}>{issueTypeLabel[item.type] || item.type}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{item.reason}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatVND(item.amount)}</td>
                      <td className="px-4 py-3 text-gray-500">{item.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* === Tab: Cancellations === */}
      {tab === 'cancellations' && (
        loading ? <Spinner /> : !cancellations ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-gray-400">Không có dữ liệu hủy/nợ</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-red-500">
                <div className="text-xs text-gray-500 mb-1">Đã hủy</div>
                <div className="text-2xl font-bold text-red-600">{cancellations.summary.cancelled}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-rose-500">
                <div className="text-xs text-gray-500 mb-1">Bị từ chối</div>
                <div className="text-2xl font-bold text-rose-600">{cancellations.summary.rejected}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-amber-500">
                <div className="text-xs text-gray-500 mb-1">Nợ</div>
                <div className="text-2xl font-bold text-amber-600">{cancellations.summary.on_credit}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-yellow-500">
                <div className="text-xs text-gray-500 mb-1">Chờ duyệt</div>
                <div className="text-2xl font-bold text-yellow-600">{cancellations.summary.pending_approval}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-gray-800">
                <div className="text-xs text-gray-500 mb-1">Tổng nợ</div>
                <div className="text-xl font-bold text-gray-800">{formatVND(cancellations.summary.total_debt)}</div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-600">Mã đơn</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Khách hàng</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Loại</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Lý do</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right">Giá trị</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Ngày</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(cancellations.items || []).length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Không có đơn hủy/nợ nào trong kỳ này</td></tr>
                  ) : (cancellations.items || []).map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{item.order_number}</td>
                      <td className="px-4 py-3">{item.customer_name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          item.type === 'cancelled' ? 'bg-red-100 text-red-700' :
                          item.type === 'rejected' ? 'bg-rose-100 text-rose-700' :
                          item.type === 'on_credit' ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{cancelTypeLabel[item.type] || item.type}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{item.reason}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatVND(item.total_amount)}</td>
                      <td className="px-4 py-3 text-gray-500">{item.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
