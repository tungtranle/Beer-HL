'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { handleError } from '@/lib/handleError'

interface ServiceHealth {
  name: string; status: string; latency_ms: number
}
interface DBPoolStats {
  total_conns: number; idle_conns: number; max_conns: number
}
interface GPSTrackingStats {
  active_vehicles: number; stale_vehicles: number
}
interface RecentOpsStats {
  orders_today: number; trips_active: number; audit_logs_24h: number; notifications_today: number
}
interface HealthData {
  status: string; uptime: string
  services: ServiceHealth[]
  db_stats: DBPoolStats
  counts: Record<string, number>
  gps_tracking?: GPSTrackingStats
  recent_ops?: RecentOpsStats
}
interface BuildInfo {
  current_version: string
  minimum_version: string
  force_update: boolean
  update_url: string
  release_notes_vi: string
  commit_sha?: string
  build_time?: string
  branch?: string
  service_version?: string
}
interface SlowQuery {
  query: string; calls: number; mean_time_ms: number; max_time_ms: number; total_time_ms: number
}

const statusIcon: Record<string, string> = { ok: '🟢', degraded: '🟡', down: '🔴' }
const statusLabel: Record<string, string> = { ok: 'Hoạt động', degraded: 'Chậm', down: 'Ngừng' }
const countLabels: Record<string, string> = {
  users: 'Người dùng', customers: 'Khách hàng', orders: 'Đơn hàng',
  trips: 'Chuyến xe', vehicles: 'Phương tiện', warehouses: 'Kho',
}

export default function HealthDashboard() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [slowQueries, setSlowQueries] = useState<SlowQuery[]>([])
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [])

  const load = async () => {
    try {
      const [hRes, sqRes]: any[] = await Promise.all([
        apiFetch('/admin/health'),
        apiFetch('/admin/slow-queries?limit=10'),
      ])
      setHealth(hRes.data)
      setSlowQueries(sqRes.data || [])

      try {
        const versionRes = await fetch('/api/app/version')
        const versionJson = await versionRes.json()
        if (versionRes.ok && versionJson.success) {
          setBuildInfo(versionJson.data)
        }
      } catch {}

      setLastUpdated(new Date())
    } catch (err) { handleError(err, { userMessage: 'Không tải được health metrics' }) }
    finally { setLoading(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div></div>

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🏥 System Health & Monitoring</h1>
        <div className="text-xs text-gray-400">
          Tự động làm mới mỗi 15s {lastUpdated && `• Cập nhật: ${lastUpdated.toLocaleTimeString('vi-VN')}`}
        </div>
      </div>

      {/* Overall Status */}
      <div className="flex items-center gap-3 bg-white rounded-lg p-4 shadow-sm">
        <span className="text-3xl">{statusIcon[health?.status || 'down']}</span>
        <div>
          <p className="text-lg font-bold">{statusLabel[health?.status || 'down']}</p>
          <p className="text-sm text-gray-500">Uptime: {health?.uptime}</p>
        </div>
      </div>

      {buildInfo && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="font-bold mb-3">🏷️ Build đang chạy</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Service version</div>
              <div className="font-semibold">{buildInfo.service_version || buildInfo.current_version}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Commit SHA</div>
              <div className="font-mono text-xs break-all">{buildInfo.commit_sha || 'unknown'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Branch</div>
              <div className="font-semibold">{buildInfo.branch || 'unknown'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Build time</div>
              <div className="font-semibold">{buildInfo.build_time || 'unknown'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Services */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {health?.services?.map(s => (
          <div key={s.name} className={`bg-white rounded-lg p-4 shadow-sm border-l-4 ${
            s.status === 'ok' ? 'border-green-500' : s.status === 'degraded' ? 'border-yellow-500' : 'border-red-500'
          }`}>
            <div className="flex items-center gap-2">
              <span>{statusIcon[s.status]}</span>
              <span className="font-medium">{s.name}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Latency: {s.latency_ms}ms</p>
          </div>
        ))}
      </div>

      {/* GPS Tracking + Recent Operations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {health?.gps_tracking && (
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h2 className="font-bold mb-3">📡 GPS Tracking</h2>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{health.gps_tracking.active_vehicles}</div>
                <div className="text-xs text-gray-500">Xe đang hoạt động</div>
                <div className="text-[10px] text-gray-400">(cập nhật &lt; 5 phút)</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${health.gps_tracking.stale_vehicles > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                  {health.gps_tracking.stale_vehicles}
                </div>
                <div className="text-xs text-gray-500">Mất tín hiệu</div>
                <div className="text-[10px] text-gray-400">(cập nhật &gt; 5 phút)</div>
              </div>
            </div>
          </div>
        )}

        {health?.recent_ops && (
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h2 className="font-bold mb-3">📋 Hoạt động gần đây</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-blue-700">{health.recent_ops.orders_today}</div>
                <div className="text-xs text-gray-500">Đơn hàng hôm nay</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-green-700">{health.recent_ops.trips_active}</div>
                <div className="text-xs text-gray-500">Chuyến đang chạy</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-purple-700">{health.recent_ops.audit_logs_24h}</div>
                <div className="text-xs text-gray-500">Audit logs (24h)</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-amber-700">{health.recent_ops.notifications_today}</div>
                <div className="text-xs text-gray-500">Thông báo hôm nay</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DB Pool Stats */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h2 className="font-bold mb-3">🔗 DB Connection Pool</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{health?.db_stats?.total_conns || 0}</div>
            <div className="text-xs text-gray-500">Total Conns</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{health?.db_stats?.idle_conns || 0}</div>
            <div className="text-xs text-gray-500">Idle</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-600">{health?.db_stats?.max_conns || 0}</div>
            <div className="text-xs text-gray-500">Max</div>
          </div>
        </div>
        {health?.db_stats && (
          <div className="mt-3 bg-gray-100 rounded-full h-3 overflow-hidden">
            <div className="bg-blue-500 h-full transition-all"
              style={{ width: `${(health.db_stats.total_conns / Math.max(health.db_stats.max_conns, 1)) * 100}%` }} />
          </div>
        )}
      </div>

      {/* Entity Counts */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h2 className="font-bold mb-3">📊 Entity Counts</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(health?.counts || {}).map(([key, val]) => (
            <div key={key} className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold">{val}</div>
              <div className="text-xs text-gray-500">{countLabels[key] || key}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Monitoring Links */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h2 className="font-bold mb-3">🔍 Công cụ Monitoring</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-1">Prometheus</h3>
            <p className="text-xs text-gray-500 mb-2">Metrics: HTTP requests, DB queries, business counters</p>
            <code className="text-xs bg-gray-200 px-2 py-1 rounded">http://localhost:9090</code>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-1">Grafana Dashboards</h3>
            <p className="text-xs text-gray-500 mb-2">Visual: Operations, latency, error rate, GPS connections</p>
            <code className="text-xs bg-gray-200 px-2 py-1 rounded">http://localhost:3030</code>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-1">Khởi chạy Monitoring</h3>
            <p className="text-xs text-gray-500 mb-2">Docker Compose profile &quot;monitoring&quot;</p>
            <code className="text-xs bg-gray-200 px-2 py-1 rounded block">docker compose --profile monitoring up -d</code>
          </div>
        </div>
      </div>

      {/* Slow Queries */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h2 className="font-bold mb-3">🐌 Slow Queries (Top 10)</h2>
        {slowQueries.length === 0 ? (
          <p className="text-sm text-gray-400">Không có slow query nào 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Query</th>
                  <th className="text-right px-3 py-2">Calls</th>
                  <th className="text-right px-3 py-2">Mean (ms)</th>
                  <th className="text-right px-3 py-2">Max (ms)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {slowQueries.map((q, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 max-w-lg truncate font-mono text-xs">{q.query}</td>
                    <td className="px-3 py-2 text-right">{q.calls}</td>
                    <td className="px-3 py-2 text-right">{q.mean_time_ms?.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right text-red-600">{q.max_time_ms?.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
