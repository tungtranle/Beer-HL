'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { formatVND } from '@/lib/status-config'
import { handleError } from '@/lib/handleError'

interface KPIReport {
  period: string
  scope_from?: string
  scope_to?: string
  data_as_of?: string
  latest_fallback?: boolean
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

interface RouteStats {
  route_name: string
  trip_count: number
  total_revenue: number
  total_distance_km: number
  revenue_per_km: number
  avg_capacity_util: number
  failed_deliveries: number
  on_time_rate: number
}
interface RoutePnlReport {
  routes: RouteStats[]
  top_route: string
  worst_route: string
}

interface KpiInsight {
  type: 'positive' | 'warning' | 'info'
  message: string
}
interface KpiHero {
  today_revenue: number
  yesterday_revenue: number
  delta_pct: number
  trend_7d: number[]
  insights: KpiInsight[]
}

interface ApiResponse<T> {
  data: T
}

type Tab = 'overview' | 'issues' | 'cancellations' | 'route_pnl'
type ReportPeriod = 'today' | 'week' | 'month' | 'history'

const PERIODS: { value: ReportPeriod; label: string; helper: string }[] = [
  { value: 'today', label: 'Hôm nay', helper: 'Vận hành trong ngày' },
  { value: 'week', label: '7 ngày', helper: 'Tuần vận hành gần nhất' },
  { value: 'month', label: '30 ngày', helper: 'Chu kỳ quản trị tháng' },
  { value: 'history', label: 'Dữ liệu lịch sử', helper: 'Chủ động xem 90 ngày gần nhất' },
]

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function scopeFor(period: ReportPeriod) {
  const now = new Date()
  const to = formatDate(now)
  const fromDate = new Date(now)
  if (period === 'today') return { from: to, to }
  fromDate.setDate(now.getDate() - (period === 'week' ? 6 : period === 'month' ? 29 : 89))
  return { from: formatDate(fromDate), to }
}

export default function KPIDashboardPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [report, setReport] = useState<KPIReport | null>(null)
  const [issues, setIssues] = useState<IssuesReport | null>(null)
  const [cancellations, setCancellations] = useState<CancellationsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<ReportPeriod>('week')
  const [routePnl, setRoutePnl] = useState<RoutePnlReport | null>(null)
  const [hero, setHero] = useState<KpiHero | null>(null)

  const loadHero = () => {
    apiFetch<ApiResponse<KpiHero>>('/kpi/hero').then(r => setHero(r.data)).catch(() => {})
  }

  const loadOverview = async () => {
    setLoading(true)
    try {
      const res = await apiFetch<ApiResponse<KPIReport>>(`/kpi/report?period=${period}`)
      setReport(res.data)
    } catch (err) { handleError(err, { userMessage: 'Không tải được báo cáo KPI' }) }
    finally { setLoading(false) }
  }

  const loadIssues = async () => {
    setLoading(true)
    try {
      const { from, to } = scopeFor(period)
      const res = await apiFetch<ApiResponse<IssuesReport>>(`/kpi/issues?from=${from}&to=${to}`)
      setIssues(res.data)
    } catch (err) { handleError(err, { userMessage: 'Không tải được danh sách sự cố' }) }
    finally { setLoading(false) }
  }

  const loadCancellations = async () => {
    setLoading(true)
    try {
      const { from, to } = scopeFor(period)
      const res = await apiFetch<ApiResponse<CancellationsReport>>(`/kpi/cancellations?from=${from}&to=${to}`)
      setCancellations(res.data)
    } catch (err) { handleError(err, { userMessage: 'Không tải được đơn hủy/từ chối' }) }
    finally { setLoading(false) }
  }

  const loadRoutePnl = async () => {
    setLoading(true)
    try {
      const res = await apiFetch<ApiResponse<RoutePnlReport>>(`/kpi/route-pnl?period=${period}`)
      setRoutePnl(res.data)
    } catch { setRoutePnl(null) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (tab === 'overview') { loadOverview(); loadHero() }
    else if (tab === 'issues') loadIssues()
    else if (tab === 'route_pnl') loadRoutePnl()
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

  const scope = scopeFor(period)
  const scopeLabel = period === 'today' ? scope.to : `${scope.from} → ${scope.to}`
  const reportScopeLabel = report?.scope_from && report?.scope_to
    ? (report.scope_from === report.scope_to ? report.scope_to : `${report.scope_from} → ${report.scope_to}`)
    : scopeLabel

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📈 Bảng điều khiển KPI</h1>
          <p className="text-sm text-gray-500">Chỉ số hiệu suất vận hành</p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Phạm vi báo cáo</div>
            <div className="mt-1 text-xs text-slate-500">Mặc định theo ngữ cảnh vận hành, không quét toàn bộ lịch sử nếu người dùng chưa chọn.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)} title={p.helper}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${period === p.value ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2.5 py-1">Scope: {tab === 'overview' && report ? reportScopeLabel : scopeLabel}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1">Source: KPI snapshots + transactional drill-down</span>
          {tab === 'overview' && report?.latest_fallback && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">Ngày gần nhất có dữ liệu: {report.data_as_of}</span>
          )}
          {period === 'history' && <span className="rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-700">Historical là lựa chọn chủ động</span>}
        </div>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {([
          { value: 'overview' as Tab, label: 'Tổng quan', icon: '📊' },
          { value: 'issues' as Tab, label: 'Có vấn đề', icon: '⚠️' },
          { value: 'cancellations' as Tab, label: 'Hủy / Nợ', icon: '🚫' },
          { value: 'route_pnl' as Tab, label: 'Tuyến đường P&L', icon: '🗺️' },
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
          {/* Hero metric — Stripe-style big number */}
          {hero && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-5 flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Doanh thu hôm nay</div>
                <div className="flex items-end gap-3">
                  <span className="text-4xl font-bold text-gray-900">{formatVND(hero.today_revenue)}</span>
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded-md mb-1 ${hero.delta_pct >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {hero.delta_pct >= 0 ? '▲' : '▼'} {Math.abs(hero.delta_pct).toFixed(1)}% so với hôm qua
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">Hôm qua: {formatVND(hero.yesterday_revenue)}</div>
              </div>
              {/* Mini sparkline — pure CSS bar chart */}
              {hero.trend_7d && hero.trend_7d.length > 0 && (
                <div className="flex items-end gap-1 h-12 shrink-0">
                  {(() => {
                    const max = Math.max(...hero.trend_7d, 1)
                    return hero.trend_7d.map((v, i) => (
                      <div key={i}
                        style={{ height: `${Math.max(8, Math.round((v / max) * 48))}px` }}
                        className={`w-5 rounded-t transition-all ${i === hero.trend_7d.length - 1 ? 'bg-brand-500' : 'bg-gray-200'}`}
                        title={formatVND(v)}
                      />
                    ))
                  })()}
                </div>
              )}
              {/* Auto-insights */}
              {hero.insights && hero.insights.length > 0 && (
                <div className="flex-1 space-y-1.5 border-l pl-5">
                  {hero.insights.slice(0, 3).map((ins, i) => (
                    <div key={i} className={`flex items-start gap-2 text-sm px-3 py-1.5 rounded-lg ${ins.type === 'positive' ? 'bg-green-50 text-green-700' : ins.type === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                      <span>{ins.type === 'positive' ? '✅' : ins.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                      <span>{ins.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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

      {/* === Tab: Route P&L (F10) === */}
      {tab === 'route_pnl' && (
        <>
          {loading ? <Spinner /> : !routePnl ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <div className="text-4xl mb-3">🗺️</div>
              <p className="text-gray-500 font-medium">Route P&L sắp ra mắt</p>
              <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">Tính năng này sẽ hiển thị: doanh thu/km theo từng tuyến, tuyến đang lỗ, hiệu suất tải trọng, và đề xuất tối ưu lộ trình.</p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 max-w-lg mx-auto text-left">
                <div className="bg-blue-50 rounded-lg p-3"><div className="text-xs font-semibold text-blue-700">💰 Doanh thu/km</div><div className="text-xs text-blue-600 mt-1">So sánh hiệu quả từng tuyến</div></div>
                <div className="bg-amber-50 rounded-lg p-3"><div className="text-xs font-semibold text-amber-700">📦 Tải trọng TB</div><div className="text-xs text-amber-600 mt-1">% sử dụng thực tế/chuyến</div></div>
                <div className="bg-red-50 rounded-lg p-3"><div className="text-xs font-semibold text-red-700">⚠️ Tuyến lỗ</div><div className="text-xs text-red-600 mt-1">Tuyến nào cần xem lại?</div></div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {routePnl.top_route && (
                <div className="flex gap-3">
                  <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="text-xs text-green-600 font-semibold uppercase">🏆 Tuyến hiệu quả nhất</div>
                    <div className="text-lg font-bold text-green-800 mt-1">{routePnl.top_route}</div>
                  </div>
                  <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="text-xs text-red-600 font-semibold uppercase">⚠️ Tuyến cần cải thiện</div>
                    <div className="text-lg font-bold text-red-800 mt-1">{routePnl.worst_route}</div>
                  </div>
                </div>
              )}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Tuyến</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Chuyến</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Doanh thu</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">VNĐ/km</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Tải %</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">OTD %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(routePnl.routes || []).map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{r.route_name}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{r.trip_count}</td>
                        <td className="px-4 py-3 text-right font-medium text-green-700">{formatVND(r.total_revenue)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${r.revenue_per_km < 5000 ? 'text-red-600' : 'text-green-700'}`}>
                          {formatVND(r.revenue_per_km)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.avg_capacity_util >= 80 ? 'bg-green-100 text-green-700' : r.avg_capacity_util >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {r.avg_capacity_util.toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.on_time_rate >= 90 ? 'bg-green-100 text-green-700' : r.on_time_rate >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {r.on_time_rate.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
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
