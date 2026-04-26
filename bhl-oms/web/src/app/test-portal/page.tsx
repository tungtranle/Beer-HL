'use client'

import { useEffect, useState } from 'react'
import SearchableSelect from '@/lib/SearchableSelect'
import AQFCommandCenter from './aqf-command-center'

const API = '/api/test-portal'

// ===== Types =====
interface Order {
  id: string; order_number: string; customer_name: string; status: string
  total_amount: number; delivery_date: string; atp_status: string; credit_status: string
  created_at: string; confirm_token: string | null; confirm_status: string | null
  confirm_expires: string | null; reject_reason: string | null
}
interface OrderConfirmation {
  id: string; order_id: string; order_number: string; customer_name: string
  token: string; phone: string; status: string; total_amount: number
  pdf_url: string | null; sent_at: string; confirmed_at: string | null
  rejected_at: string | null; reject_reason: string | null
  auto_confirmed_at: string | null; expires_at: string
}
interface DeliveryConfirmation {
  id: string; order_id: string; order_number: string; customer_name: string
  token: string; phone: string; status: string; total_amount: number
  sent_at: string; confirmed_at: string | null; disputed_at: string | null
  dispute_reason: string | null; auto_confirmed_at: string | null
}
interface StockRow {
  product_id: string; product_name: string; product_sku: string
  warehouse_id: string; warehouse_name: string; total_qty: number
  reserved: number; available: number; batch_number: string; expiry_date: string
}
interface CreditRow {
  id: string; code: string; name: string; credit_limit: number
  current_balance: number; available_limit: number
}
interface Customer {
  id: string; code: string; name: string; phone: string; address: string; credit_limit: number
}
interface Product {
  id: string; sku: string; name: string; price: number; deposit_price: number
  weight_kg: number; volume_m3: number
}

type Tab = 'aqf' | 'test-cases' | 'orders' | 'order-confirm' | 'delivery-confirm' | 'stock' | 'credit' | 'ops-audit' | 'create-order' | 'gps-sim' | 'drivers'

interface TimelineEvent {
  id: string; event_type: string; actor_type: string; actor_name: string
  title: string; detail: Record<string, unknown>; created_at: string
}

interface OrderNote {
  id: string; user_name: string; content: string; note_type: string
  is_pinned: boolean; created_at: string
}

interface OpsAuditData {
  admin: {
    permission_rules: number; overrides: number; active_sessions: number
    routes: number; configs: number; credit_limits: number
    recent_sessions: { id: string; user_name: string; ip_address: string; user_agent: string; last_seen_at: string; created_at: string; revoked_at?: string | null }[]
  }
  integration: {
    pending: number; retrying: number; failed: number; resolved: number
    recent: { id: string; adapter: string; operation: string; status: string; retry_count: number; max_retries: number; error_message: string; created_at: string }[]
  }
  reconciliation: {
    total_recons: number; open_discrepancies: number; resolved_discrepancies: number; daily_closes: number
    recent_discrepancies: { id: string; trip_number: string; disc_type: string; status: string; description: string; variance: number; deadline?: string | null; created_at: string }[]
    recent_daily_closes: { id: string; close_date: string; warehouse_name: string; completed_trips: number; total_trips: number; total_discrepancies: number; resolved_discrepancies: number; total_revenue: number }[]
  }
  kpi: {
    snapshots: number; issue_orders: number; cancellation_orders: number; redelivery_orders: number
    recent_snapshots: { snapshot_date: string; warehouse_name: string; otd_rate: number; delivery_success_rate: number; total_orders: number; total_revenue: number }[]
  }
}

// Scenario types from backend
interface ScenarioMeta {
  id: string; title: string; description: string; category: string
  roles: string[]; steps: ScenarioStep[]; data_summary: string
  gps_scenario?: string; preview_data: ScenarioDataPoint[]
}
interface ScenarioStep {
  role: string; page: string; action: string; expected: string
}
interface ScenarioDataPoint {
  label: string; value: string
}

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'aqf', label: 'AQF Command Center', icon: '⚡' },
  { key: 'test-cases', label: 'Kịch bản test', icon: '🎯' },
  { key: 'orders', label: 'Đơn hàng', icon: '📋' },
  { key: 'order-confirm', label: 'Xác nhận đơn (Zalo)', icon: '📱' },
  { key: 'delivery-confirm', label: 'Xác nhận giao hàng', icon: '🚛' },
  { key: 'stock', label: 'Tồn kho / ATP', icon: '📦' },
  { key: 'credit', label: 'Dư nợ / Tín dụng', icon: '💰' },
  { key: 'ops-audit', label: 'Ops & Audit', icon: '🧭' },
  { key: 'create-order', label: 'Tạo đơn test', icon: '➕' },
  { key: 'gps-sim', label: 'Giả lập GPS', icon: '📡' },
  { key: 'drivers', label: 'Tài xế', icon: '🚛' },
]

const statusBadge = (status: string) => {
  const m: Record<string, string> = {
    pending_customer_confirm: 'bg-yellow-100 text-yellow-800',
    pending_approval: 'bg-orange-100 text-orange-800',
    confirmed: 'bg-green-100 text-green-800',
    delivered: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
    sent: 'bg-yellow-100 text-yellow-700',
    auto_confirmed: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-700',
    disputed: 'bg-red-100 text-red-700',
    draft: 'bg-gray-100 text-gray-700',
  }
  return m[status] || 'bg-gray-100 text-gray-600'
}

const statusLabel: Record<string, string> = {
  pending_customer_confirm: 'Chờ KH xác nhận',
  pending_approval: 'Chờ duyệt credit',
  confirmed: 'Đã xác nhận',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
  sent: 'Chờ xác nhận',
  auto_confirmed: 'Tự động xác nhận',
  rejected: 'KH từ chối',
  disputed: 'Khiếu nại',
  draft: 'Nháp',
}

const fmtMoney = (n: number) => n?.toLocaleString('vi-VN') + 'đ'
const fmtDate = (s: string) => s ? new Date(s).toLocaleString('vi-VN') : '-'

async function api<T>(path: string, opts?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(API + path, opts)
    const json = await res.json()
    return json.success ? json.data : null
  } catch { return null }
}

export default function TestPortalPage() {
  const [tab, setTab] = useState<Tab>('test-cases')
  const [refreshKey, setRefreshKey] = useState(0)
  const [resetting, setResetting] = useState(false)
  const [toast, setToast] = useState('')
  const [preferredGPSScenario, setPreferredGPSScenario] = useState('')

  const refresh = () => setRefreshKey(k => k + 1)
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleReset = async () => {
    if (!confirm('Xóa toàn bộ dữ liệu test?\n\n(Giữ lại: NPP, Sản phẩm, Kho, Tồn kho)')) return
    setResetting(true)
    const res = await api<{ message: string }>('/reset-data', { method: 'POST' })
    showToast(res?.message || 'Đã reset dữ liệu')
    setResetting(false)
    refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-amber-700 text-white py-4 px-6 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🧪 Test Portal — BHL OMS</h1>
            <p className="text-amber-200 text-sm mt-1">Module test nghiệp vụ, xác nhận đơn hàng, tồn kho, dư nợ</p>
          </div>
          <div className="flex gap-3">
            <button onClick={refresh}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-400 rounded-lg text-sm font-medium transition">
              🔄 Refresh
            </button>
            <button onClick={handleReset} disabled={resetting}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition disabled:opacity-50">
              {resetting ? '⏳ Đang xóa...' : '🗑️ Reset Data'}
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce">
          {toast}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 mt-4">
        <div className="flex gap-1 flex-wrap bg-white rounded-xl p-1 shadow-sm">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 min-w-[140px] px-3 py-2.5 rounded-lg text-sm font-medium transition
                ${tab === t.key ? 'bg-brand-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-4">
        {tab === 'aqf' && <AQFCommandCenter />}
        {tab === 'test-cases' && <TestCasesTab setTab={setTab} setPreferredGPSScenario={setPreferredGPSScenario} showToast={showToast} refresh={refresh} />}
        {tab === 'orders' && <OrdersTab refreshKey={refreshKey} showToast={showToast} refresh={refresh} />}
        {tab === 'order-confirm' && <OrderConfirmTab refreshKey={refreshKey} showToast={showToast} refresh={refresh} />}
        {tab === 'delivery-confirm' && <DeliveryConfirmTab refreshKey={refreshKey} />}
        {tab === 'stock' && <StockTab refreshKey={refreshKey} />}
        {tab === 'credit' && <CreditTab refreshKey={refreshKey} />}
        {tab === 'ops-audit' && <OpsAuditTab refreshKey={refreshKey} />}
        {tab === 'create-order' && <CreateOrderTab showToast={showToast} refresh={refresh} />}
        {tab === 'gps-sim' && <GPSSimTab refreshKey={refreshKey} showToast={showToast} preferredScenario={preferredGPSScenario} />}
        {tab === 'drivers' && <DriversTab />}
      </div>
    </div>
  )
}

function TestCasesTab({ setTab, setPreferredGPSScenario, showToast, refresh }: { setTab: (t: Tab) => void; setPreferredGPSScenario: (scenarioId: string) => void; showToast: (m: string) => void; refresh: () => void }) {
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [activeScenario, setActiveScenario] = useState<ScenarioMeta | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setLoading(true)
    setLoadError('')
    api<ScenarioMeta[]>('/scenarios')
      .then((data) => {
        if (data === null) {
          setScenarios([])
          setLoadError('Frontend dang chay nhung backend Test Portal tren cong 8080 chua len, nen chua tai duoc kich ban va du lieu test.')
          return
        }
        const nextScenarios = (data || []).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
        setScenarios(nextScenarios)
      })
      .finally(() => setLoading(false))
  }, [])

  const categories = ['all', ...Array.from(new Set(scenarios.map(s => s.category)))]
  const filtered = filterCat === 'all' ? scenarios : scenarios.filter(s => s.category === filterCat)

  const handleLoadScenario = async (scenarioId: string) => {
    if (!confirm(`Nạp dữ liệu cho kịch bản ${scenarioId}?\n\nThao tác này sẽ XÓA toàn bộ dữ liệu nghiệp vụ (đơn, chuyến, đối soát...) và nạp dữ liệu mới phù hợp với kịch bản.`)) return
    setLoadingId(scenarioId)
    const res = await api<{ scenario_id: string; status: string; message: string }>('/load-scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: scenarioId })
    })
    setLoadingId(null)
    if (res) {
      showToast(res.message)
      const sc = scenarios.find(s => s.id === scenarioId)
      setActiveScenario(sc || null)
      setExpandedId(scenarioId)
      setPreferredGPSScenario(sc?.gps_scenario || '')
      setCompletedSteps({})
      refresh()
      return
    }
    showToast('❌ Lỗi nạp dữ liệu — kiểm tra backend Test Portal')
  }

  const toggleStep = (key: string) => {
    setCompletedSteps(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const catColor: Record<string, string> = {
    E2E: 'bg-red-100 text-red-700 border-red-200',
    CREDIT: 'bg-orange-100 text-orange-700 border-orange-200',
    ATP: 'bg-purple-100 text-purple-700 border-purple-200',
    ZALO: 'bg-blue-100 text-blue-700 border-blue-200',
    TMS: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    DRIVER: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    WMS: 'bg-teal-100 text-teal-700 border-teal-200',
    RECON: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  }

  const catIcon: Record<string, string> = {
    E2E: '🔄', CREDIT: '💳', ATP: '📦', ZALO: '📱',
    TMS: '🗺️', DRIVER: '🚛', WMS: '🏭', RECON: '📊',
  }

  const roleIcon: Record<string, string> = {
    dvkh: '👩‍💼', accountant: '🧾', dispatcher: '🗺️', warehouse: '📦',
    security: '🛡️', driver: '🚛', management: '📊', admin: '⚙️',
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-xl mb-2">🎯 Kịch bản Test — Chọn & Nạp dữ liệu</h3>
            <p className="text-gray-300 text-sm">
              Test Portal không còn nhúng sẵn dữ liệu test trong frontend.
              <br />Chỉ khi bạn nhấn <strong>&quot;Nạp data&quot;</strong> thì hệ thống mới reset dữ liệu nghiệp vụ cũ và nạp bộ data test tương ứng từ backend.
            </p>
          </div>
        </div>

        {activeScenario && (
          <div className="mt-4 bg-green-500/20 border border-green-400/30 rounded-lg p-3 flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400" />
            </span>
            <span className="text-green-200 text-sm">
              Đang test: <strong className="text-white">{activeScenario.id} — {activeScenario.title}</strong>
            </span>
          </div>
        )}

        <div className="flex gap-2 mt-4 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setFilterCat(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                filterCat === c ? 'bg-white text-gray-900' : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}>
              {c === 'all' ? '📋 Tất cả' : `${catIcon[c] || '📁'} ${c}`}
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">
          <h3 className="font-bold text-base">Backend Test Portal chua chay</h3>
          <p className="mt-2 text-sm leading-6">{loadError}</p>
          <p className="mt-2 text-sm leading-6">
            Cach don gian nhat: vao thu muc <strong>bhl-oms</strong> va bam dup file <strong>START_TEST_PORTAL.bat</strong>.
          </p>
          <p className="mt-2 text-sm leading-6">
            Khi backend len lai, bam <strong>Refresh</strong> de tai danh sach kich ban.
          </p>
        </div>
      )}

      {!loadError && !filtered.length && (
        <EmptyState text="Chưa có kịch bản nào được trả về từ backend. Hãy kiểm tra Test Portal backend hoặc cấu hình ENABLE_TEST_PORTAL." />
      )}

      {filtered.map(sc => {
        const isExpanded = expandedId === sc.id
        const isActive = activeScenario?.id === sc.id
        const isLoading = loadingId === sc.id
        const totalSteps = sc.steps.length
        const doneSteps = sc.steps.filter((_, i) => completedSteps[`${sc.id}-${i}`]).length

        return (
          <div key={sc.id} className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all ${
            isActive ? 'border-green-400 ring-2 ring-green-100' : 'border-gray-100 hover:border-gray-200'
          }`}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : sc.id)}
              className="w-full px-5 py-4 flex items-center gap-3 hover:bg-gray-50 transition text-left"
            >
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${catColor[sc.category] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {catIcon[sc.category] || '📁'} {sc.category}
              </span>
              <span className="font-mono text-sm text-gray-400">{sc.id}</span>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-gray-900">{sc.title}</span>
                {!isExpanded && <p className="text-xs text-gray-400 mt-0.5 truncate">{sc.description}</p>}
              </div>
              <div className="hidden md:flex gap-1 mr-2 flex-shrink-0">
                {Array.from(new Set(sc.roles)).slice(0, 4).map((r, i) => (
                  <span key={i} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm" title={r}>{roleIcon[r] || '👤'}</span>
                ))}
              </div>
              <svg className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="border-t">
                <div className="px-5 py-4 bg-gradient-to-r from-orange-50 to-amber-50 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{sc.description}</p>
                    <p className="text-xs text-gray-500 mt-1">📊 {sc.data_summary}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleLoadScenario(sc.id) }}
                    disabled={isLoading}
                    className={`px-6 py-3 rounded-xl text-base font-bold transition flex items-center gap-2 flex-shrink-0 shadow-md ${
                      isActive ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-[#F68634] text-white hover:bg-[#e5762a]'
                    } disabled:opacity-50`}>
                    {isLoading ? <><span className="animate-spin">⏳</span> Đang nạp...</> : isActive ? <><span>✅</span> Nạp lại data</> : <><span>▶️</span> Nạp data cho kịch bản này</>}
                  </button>
                </div>

                <div className="px-5 pb-5 bg-gray-50 space-y-4 pt-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-blue-700 uppercase mb-2">📊 Dữ liệu sẽ được nạp</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {sc.preview_data.map((dp, i) => (
                        <div key={i} className="flex gap-2 text-sm">
                          <span className="text-blue-500 font-medium min-w-[80px]">{dp.label}:</span>
                          <span className="text-blue-900">{dp.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-gray-500 uppercase">📝 Các bước thực hiện ({doneSteps}/{totalSteps})</h4>
                      {isActive && totalSteps > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-1.5">
                            <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${(doneSteps / totalSteps) * 100}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{Math.round((doneSteps / totalSteps) * 100)}%</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {sc.steps.map((s, i) => {
                        const stepKey = `${sc.id}-${i}`
                        const isDone = completedSteps[stepKey]
                        return (
                          <div key={i} className={`flex gap-3 items-start rounded-lg p-3 border transition ${isDone ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                            {isActive ? (
                              <button onClick={() => toggleStep(stepKey)}
                                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition text-xs font-bold ${isDone ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}>
                                {isDone ? '✓' : i + 1}
                              </button>
                            ) : (
                              <span className="bg-amber-100 text-amber-700 font-bold text-xs rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">{i + 1}</span>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs" title={s.role}>{roleIcon[s.role] || '👤'}</span>
                                <span className="text-xs text-gray-400 font-medium">{s.role}</span>
                                <span className="text-xs text-gray-300">→</span>
                                <span className="text-xs text-gray-400 font-mono">{s.page}</span>
                              </div>
                              <p className={`text-sm font-medium ${isDone ? 'text-green-700 line-through' : 'text-gray-800'}`}>{s.action}</p>
                              {s.expected && <p className="text-xs text-green-600 mt-1">✓ Kỳ vọng: {s.expected}</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {sc.gps_scenario && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                      <span className="text-sm text-emerald-700">📡 Kịch bản GPS: <strong>{sc.gps_scenario}</strong></span>
                      <button onClick={() => { setPreferredGPSScenario(sc.gps_scenario || ''); setTab('gps-sim') }}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition">
                        Mở GPS Simulator →
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t flex-wrap">
                    <button onClick={() => setTab('ops-audit')}
                      className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition">
                      🧭 Ops & Audit
                    </button>
                    {sc.roles.includes('dvkh') && (
                      <button onClick={() => setTab('create-order')}
                        className="px-3 py-1.5 bg-[#F68634] text-white rounded-lg text-xs font-medium hover:bg-[#e5762a] transition">
                        ➕ Tạo đơn test
                      </button>
                    )}
                    <button onClick={() => setTab('orders')}
                      className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-xs font-medium hover:bg-gray-700 transition">
                      📋 Đơn hàng
                    </button>
                    <button onClick={() => setTab('order-confirm')}
                      className="px-3 py-1.5 bg-brand-500 text-white rounded-lg text-xs font-medium hover:bg-brand-600 transition">
                      📱 Zalo
                    </button>
                    <button onClick={() => setTab('stock')}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition">
                      📦 Tồn kho
                    </button>
                    <button onClick={() => setTab('credit')}
                      className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 transition">
                      💰 Dư nợ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ===== Tab: Orders =====
function OrdersTab({ refreshKey, showToast: _showToast, refresh: _refresh }: { refreshKey: number; showToast: (msg: string) => void; refresh: () => void }) {
  const [items, setItems] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api<Order[]>('/orders').then(d => { setItems(d || []); setLoading(false) })
  }, [refreshKey])

  if (loading) return <Spinner />
  if (!items.length) return <EmptyState text="Chưa có đơn hàng test nào. Hãy nạp kịch bản hoặc tạo đơn test mới." />

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50">
        <h2 className="font-bold text-lg">📋 Đơn hàng test ({items.length})</h2>
        <p className="text-sm text-gray-500 mt-1">Danh sách đơn hàng đang có trong môi trường Test Portal.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Mã đơn</th>
              <th className="px-4 py-3 text-left">Khách hàng</th>
              <th className="px-4 py-3 text-left">Trạng thái</th>
              <th className="px-4 py-3 text-right">Tổng tiền</th>
              <th className="px-4 py-3 text-left">ATP</th>
              <th className="px-4 py-3 text-left">Credit</th>
              <th className="px-4 py-3 text-left">Ngày giao</th>
              <th className="px-4 py-3 text-left">Tạo lúc</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-amber-50">
                <td className="px-4 py-3 font-mono text-amber-700">{item.order_number}</td>
                <td className="px-4 py-3">{item.customer_name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(item.status)}`}>
                    {statusLabel[item.status] || item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium">{fmtMoney(item.total_amount)}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{item.atp_status || '-'}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{item.credit_status || '-'}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{fmtDate(item.delivery_date)}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{fmtDate(item.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===== Tab: Order Confirmations =====
function OrderConfirmTab({ refreshKey, showToast, refresh }: { refreshKey: number; showToast: (m: string) => void; refresh: () => void }) {
  const [items, setItems] = useState<OrderConfirmation[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api<OrderConfirmation[]>('/order-confirmations').then(d => { setItems(d || []); setLoading(false) })
  }, [refreshKey])

  const handleConfirm = async (token: string) => {
    setActing(token)
    const res = await fetch(`/api/order-confirm/${token}/confirm`, { method: 'POST' })
    const json = await res.json()
    showToast(json.success ? '✅ Đơn hàng đã xác nhận!' : `❌ ${json.error?.message || 'Lỗi'}`)
    setActing(null)
    refresh()
  }

  const handleReject = async (token: string) => {
    const reason = prompt('Lý do từ chối:')
    if (!reason) return
    setActing(token)
    const res = await fetch(`/api/order-confirm/${token}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    })
    const json = await res.json()
    showToast(json.success ? '❌ Đơn hàng đã từ chối!' : `Lỗi: ${json.error?.message}`)
    setActing(null)
    refresh()
  }

  if (loading) return <Spinner />
  if (!items.length) return <EmptyState text="Chưa có xác nhận đơn hàng nào. Tạo đơn test trước." />

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-bold text-blue-700 mb-2">📱 Mô phỏng xác nhận đơn hàng qua Zalo</h3>
        <p className="text-sm text-blue-600">
          Sau khi DVKH tạo đơn → Zalo gửi link cho KH → KH nhấn Xác nhận hoặc Từ chối.
          <br />Nếu 2h không phản hồi → tự động xác nhận.
          <br />Nhấn nút bên dưới để mô phỏng hành động của khách hàng.
        </p>
      </div>

      {items.map(item => (
        <div key={item.id} className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-amber-500">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-mono font-bold text-amber-700 text-lg">{item.order_number}</span>
              <span className="ml-3 text-gray-500">{item.customer_name}</span>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusBadge(item.status)}`}>
              {statusLabel[item.status] || item.status}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
            <div><span className="text-gray-500">Tổng tiền:</span> <span className="font-bold">{fmtMoney(item.total_amount)}</span></div>
            <div><span className="text-gray-500">SĐT:</span> {item.phone}</div>
            <div><span className="text-gray-500">Gửi lúc:</span> {fmtDate(item.sent_at)}</div>
            <div><span className="text-gray-500">Hết hạn:</span>
              <span className={new Date(item.expires_at) < new Date() ? 'text-red-600 font-medium' : ''}>
                {' '}{fmtDate(item.expires_at)}
              </span>
            </div>
            {item.confirmed_at && <div><span className="text-gray-500">Xác nhận lúc:</span> <span className="text-green-600">{fmtDate(item.confirmed_at)}</span></div>}
            {item.rejected_at && <div><span className="text-gray-500">Từ chối lúc:</span> <span className="text-red-600">{fmtDate(item.rejected_at)}</span></div>}
            {item.reject_reason && <div className="col-span-2"><span className="text-gray-500">Lý do:</span> <span className="text-red-600">{item.reject_reason}</span></div>}
            {item.auto_confirmed_at && <div><span className="text-gray-500">Tự động XN:</span> <span className="text-blue-600">{fmtDate(item.auto_confirmed_at)}</span></div>}
          </div>

          {item.status === 'sent' && (
            <div className="flex gap-3 pt-3 border-t">
              <button onClick={() => handleConfirm(item.token)} disabled={acting === item.token}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition">
                {acting === item.token ? '⏳...' : '✅ Xác nhận đơn hàng (vai KH)'}
              </button>
              <button onClick={() => handleReject(item.token)} disabled={acting === item.token}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition">
                {acting === item.token ? '⏳...' : '❌ Từ chối đơn hàng (vai KH)'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ===== Tab: Delivery Confirmations =====
function DeliveryConfirmTab({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<DeliveryConfirmation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api<DeliveryConfirmation[]>('/delivery-confirmations').then(d => { setItems(d || []); setLoading(false) })
  }, [refreshKey])

  if (loading) return <Spinner />
  if (!items.length) return <EmptyState text="Chưa có xác nhận giao hàng nào." />

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50">
        <h2 className="font-bold text-lg">🚛 Xác nhận giao hàng — Zalo ({items.length})</h2>
        <p className="text-sm text-gray-500 mt-1">Sau tài xế giao hàng → Zalo gửi NPP → NPP xác nhận/khiếu nại (24h auto)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Mã đơn</th>
              <th className="px-4 py-3 text-left">Khách hàng</th>
              <th className="px-4 py-3 text-left">SĐT</th>
              <th className="px-4 py-3 text-left">Trạng thái</th>
              <th className="px-4 py-3 text-right">Tổng tiền</th>
              <th className="px-4 py-3 text-left">Gửi lúc</th>
              <th className="px-4 py-3 text-left">XN/Khiếu nại</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-amber-50">
                <td className="px-4 py-3 font-mono text-amber-700">{item.order_number}</td>
                <td className="px-4 py-3">{item.customer_name}</td>
                <td className="px-4 py-3 text-gray-500">{item.phone}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(item.status)}`}>
                    {statusLabel[item.status] || item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{fmtMoney(item.total_amount)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(item.sent_at)}</td>
                <td className="px-4 py-3 text-xs">
                  {item.confirmed_at && <span className="text-green-600">{fmtDate(item.confirmed_at)}</span>}
                  {item.disputed_at && <span className="text-red-600">{fmtDate(item.disputed_at)}: {item.dispute_reason}</span>}
                  {item.auto_confirmed_at && <span className="text-blue-600">Auto: {fmtDate(item.auto_confirmed_at)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===== Tab: Stock =====
function StockTab({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api<StockRow[]>('/stock').then(d => { setItems(d || []); setLoading(false) })
  }, [refreshKey])

  if (loading) return <Spinner />
  if (!items.length) return <EmptyState text="Chưa có dữ liệu tồn kho." />

  // Group by warehouse
  const grouped: Record<string, StockRow[]> = {}
  items.forEach(i => {
    const k = i.warehouse_name || 'Unknown'
    if (!grouped[k]) grouped[k] = []
    grouped[k].push(i)
  })

  return (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <h3 className="font-bold text-green-700 mb-1">📦 Tồn kho / ATP (Available-To-Promise)</h3>
        <p className="text-sm text-green-600">
          Available = Tổng - Reserved. Khi tạo đơn → Reserved tăng. Khi hủy đơn → Reserved giảm.
        </p>
      </div>

      {Object.entries(grouped).map(([wh, rows]) => (
        <div key={wh} className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-3 bg-gray-50 border-b">
            <h3 className="font-bold">🏭 {wh}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-left">Sản phẩm</th>
                  <th className="px-4 py-3 text-right">Tổng</th>
                  <th className="px-4 py-3 text-right">Đã đặt</th>
                  <th className="px-4 py-3 text-right">Khả dụng (ATP)</th>
                  <th className="px-4 py-3 text-left">Lô</th>
                  <th className="px-4 py-3 text-left">Hạn sử dụng</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((s, i) => (
                  <tr key={i} className="hover:bg-amber-50">
                    <td className="px-4 py-2 font-mono text-xs">{s.product_sku}</td>
                    <td className="px-4 py-2">{s.product_name}</td>
                    <td className="px-4 py-2 text-right font-medium">{s.total_qty}</td>
                    <td className="px-4 py-2 text-right text-orange-600">{s.reserved}</td>
                    <td className={`px-4 py-2 text-right font-bold ${s.available <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {s.available}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{s.batch_number || '-'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{s.expiry_date || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// ===== Tab: Credit =====
function CreditTab({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<CreditRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api<CreditRow[]>('/credit-balances').then(d => { setItems(d || []); setLoading(false) })
  }, [refreshKey])

  if (loading) return <Spinner />
  if (!items.length) return <EmptyState text="Chưa có dữ liệu dư nợ." />

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50">
        <h2 className="font-bold text-lg">💰 Dư nợ & Hạn mức tín dụng NPP</h2>
        <p className="text-sm text-gray-500 mt-1">
          Khi Available {'<'} Tổng tiền đơn hàng → Đơn chuyển pending_approval → Kế toán duyệt
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Mã NPP</th>
              <th className="px-4 py-3 text-left">Tên NPP</th>
              <th className="px-4 py-3 text-right">Hạn mức</th>
              <th className="px-4 py-3 text-right">Dư nợ hiện tại</th>
              <th className="px-4 py-3 text-right">Khả dụng</th>
              <th className="px-4 py-3 text-left">Tình trạng</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(c => {
              const pct = c.credit_limit > 0 ? (c.current_balance / c.credit_limit * 100) : 0
              return (
                <tr key={c.id} className="hover:bg-amber-50">
                  <td className="px-4 py-3 font-mono text-amber-700">{c.code}</td>
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3 text-right">{fmtMoney(c.credit_limit)}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{fmtMoney(c.current_balance)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${c.available_limit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {fmtMoney(c.available_limit)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{pct.toFixed(0)}%</span>
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

// ===== Tab: Create Order =====
function CreateOrderTab({ showToast, refresh }: { showToast: (m: string) => void; refresh: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [orderItems, setOrderItems] = useState<{ productId: string; quantity: number }[]>([{ productId: '', quantity: 10 }])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    api<Customer[]>('/customers').then(d => setCustomers(d || []))
    api<Product[]>('/products').then(d => setProducts(d || []))
    // Get warehouses from stock data
    api<StockRow[]>('/stock').then(d => {
      if (!d) return
      const whMap = new Map<string, string>()
      d.forEach(s => whMap.set(s.warehouse_id, s.warehouse_name))
      setWarehouses(Array.from(whMap.entries()).map(([id, name]) => ({ id, name })))
    })
  }, [])

  const addItem = () => setOrderItems(prev => [...prev, { productId: '', quantity: 10 }])
  const removeItem = (idx: number) => setOrderItems(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async () => {
    if (!selectedCustomer || !selectedWarehouse || !orderItems.some(i => i.productId && i.quantity > 0)) {
      showToast('Vui lòng chọn khách hàng, kho và sản phẩm')
      return
    }
    setSubmitting(true)
    setResult(null)
    const body = {
      customer_id: selectedCustomer,
      warehouse_id: selectedWarehouse,
      items: orderItems.filter(i => i.productId && i.quantity > 0).map(i => ({
        product_id: i.productId, quantity: i.quantity
      }))
    }
    const res = await api<Record<string, unknown>>('/create-test-order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (res) {
      setResult(res)
      showToast(`✅ Tạo đơn thành công: ${res.order_number}`)
      refresh()
    } else {
      showToast('❌ Lỗi tạo đơn - kiểm tra console')
    }
    setSubmitting(false)
  }

  const totalAmount = orderItems.reduce((sum, item) => {
    const p = products.find(pr => pr.id === item.productId)
    return sum + (p ? p.price * item.quantity : 0)
  }, 0)

  const selectedCust = customers.find(c => c.id === selectedCustomer)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 className="font-bold text-amber-700 mb-1">➕ Tạo đơn test nhanh</h3>
        <p className="text-sm text-amber-600">
          Tạo đơn hàng trực tiếp qua DB (bypass business validation). Đơn sẽ ở trạng thái pending_customer_confirm
          hoặc pending_approval (nếu vượt credit).
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        {/* Customer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Khách hàng (NPP)</label>
          <SearchableSelect
            options={customers.map(c => ({
              value: c.id,
              label: `${c.code} — ${c.name}`,
              sublabel: `HM: ${fmtMoney(c.credit_limit)} | ${c.phone || ''} | ${c.address?.substring(0, 50) || ''}`
            }))}
            value={selectedCustomer}
            onChange={setSelectedCustomer}
            placeholder="🔍 Tìm NPP theo mã hoặc tên..."
          />
          {selectedCust && (
            <p className="text-xs text-gray-500 mt-1">
              📞 {selectedCust.phone || 'N/A'} | 📍 {selectedCust.address?.substring(0, 60) || 'N/A'}
            </p>
          )}
        </div>

        {/* Warehouse */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kho xuất</label>
          <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">-- Chọn kho --</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {/* Items */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Sản phẩm</label>
          {orderItems.map((item, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <div className="flex-1">
                <SearchableSelect
                  options={products.map(p => ({
                    value: p.id,
                    label: `${p.sku} — ${p.name}`,
                    sublabel: `${fmtMoney(p.price)}/thùng`
                  }))}
                  value={item.productId}
                  onChange={val => setOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, productId: val } : it))}
                  placeholder="🔍 Tìm sản phẩm..."
                />
              </div>
              <input type="number" min="1" value={item.quantity || ''}
                onChange={e => setOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Number(e.target.value) || 0 } : it))}
                className="w-24 border rounded-lg px-3 py-2 text-sm text-center"
              />
              {orderItems.length > 1 && (
                <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 px-2">✕</button>
              )}
            </div>
          ))}
          <button onClick={addItem} className="text-sm text-amber-600 hover:text-amber-800 mt-1">+ Thêm sản phẩm</button>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between text-lg font-bold">
            <span>Tổng tiền:</span>
            <span className="text-amber-700">{fmtMoney(totalAmount)}</span>
          </div>
          {selectedCust && (
            <p className={`text-sm mt-1 ${totalAmount > selectedCust.credit_limit ? 'text-red-600 font-medium' : 'text-green-600'}`}>
              {totalAmount > selectedCust.credit_limit
                ? `⚠️ Vượt hạn mức! (${fmtMoney(selectedCust.credit_limit)}) → Đơn sẽ pending_approval`
                : `✅ Trong hạn mức (${fmtMoney(selectedCust.credit_limit)})`
              }
            </p>
          )}
        </div>

        <button onClick={handleSubmit} disabled={submitting}
          className="w-full py-3 bg-brand-500 text-white rounded-lg font-bold text-lg hover:bg-brand-600 disabled:opacity-50 transition">
          {submitting ? '⏳ Đang tạo...' : '🛒 Tạo đơn hàng test'}
        </button>

        {result && (
          <div className="bg-green-50 border border-green-300 rounded-lg p-4">
            <h4 className="font-bold text-green-700 mb-2">✅ Đơn đã tạo thành công!</h4>
            <pre className="text-xs text-green-800 overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

function OpsAuditTab({ refreshKey }: { refreshKey: number }) {
  const [ops, setOps] = useState<OpsAuditData | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [notes, setNotes] = useState<OrderNote[]>([])
  const [loading, setLoading] = useState(true)
  const [timelineLoading, setTimelineLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api<OpsAuditData>('/ops-audit'),
      api<Order[]>('/orders'),
    ]).then(([opsData, ordersData]) => {
      setOps(opsData)
      const nextOrders = ordersData || []
      setOrders(nextOrders)
      setSelectedOrderId(prev => prev || nextOrders[0]?.id || '')
    }).finally(() => setLoading(false))
  }, [refreshKey])

  useEffect(() => {
    if (!selectedOrderId) {
      setTimeline([])
      setNotes([])
      return
    }
    setTimelineLoading(true)
    Promise.all([
      api<TimelineEvent[]>(`/orders/${selectedOrderId}/timeline`),
      api<OrderNote[]>(`/orders/${selectedOrderId}/notes`),
    ]).then(([timelineData, notesData]) => {
      setTimeline(timelineData || [])
      setNotes(notesData || [])
    }).finally(() => setTimelineLoading(false))
  }, [selectedOrderId])

  if (loading) return <Spinner />
  if (!ops) return <EmptyState text="Chưa lấy được dữ liệu Ops & Audit." />

  const selectedOrder = orders.find(order => order.id === selectedOrderId)
  const dlqBadge: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    retrying: 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700',
    resolved: 'bg-green-100 text-green-700',
  }
  const noteBadge: Record<string, string> = {
    internal: 'bg-slate-100 text-slate-700',
    driver_note: 'bg-cyan-100 text-cyan-700',
    npp_feedback: 'bg-violet-100 text-violet-700',
    system: 'bg-amber-100 text-amber-700',
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white rounded-xl p-6">
        <h3 className="text-xl font-bold mb-2">🧭 Ops & Audit Coverage</h3>
        <p className="text-slate-300 text-sm">
          Tab này gom các vùng trước đây Test Portal chưa chạm sâu: order timeline/notes, integration DLQ,
          reconciliation, daily close, KPI snapshot và admin smoke counters.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'RBAC rules', value: ops.admin.permission_rules, tone: 'bg-slate-100 text-slate-800' },
          { label: 'Overrides', value: ops.admin.overrides, tone: 'bg-indigo-100 text-indigo-800' },
          { label: 'Active sessions', value: ops.admin.active_sessions, tone: 'bg-cyan-100 text-cyan-800' },
          { label: 'DLQ failed', value: ops.integration.failed, tone: 'bg-red-100 text-red-800' },
          { label: 'Open disc', value: ops.reconciliation.open_discrepancies, tone: 'bg-orange-100 text-orange-800' },
          { label: 'Redelivery', value: ops.kpi.redelivery_orders, tone: 'bg-emerald-100 text-emerald-800' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl p-4 ${card.tone}`}>
            <p className="text-xs uppercase tracking-wide opacity-70">{card.label}</p>
            <p className="text-2xl font-bold mt-2">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold">📜 Order Timeline & Notes</h3>
              <p className="text-sm text-gray-500">Chọn đơn để soi event log và ghi chú ghim.</p>
            </div>
            <select value={selectedOrderId} onChange={e => setSelectedOrderId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm min-w-[260px]">
              <option value="">-- Chọn đơn hàng --</option>
              {orders.map(order => (
                <option key={order.id} value={order.id}>{order.order_number} • {order.customer_name}</option>
              ))}
            </select>
          </div>

          {selectedOrder && (
            <div className="rounded-lg border bg-gray-50 p-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-amber-700 font-semibold">{selectedOrder.order_number}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(selectedOrder.status)}`}>{statusLabel[selectedOrder.status] || selectedOrder.status}</span>
                <span className="text-gray-500">{selectedOrder.customer_name}</span>
              </div>
            </div>
          )}

          {timelineLoading ? <Spinner /> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Timeline events</h4>
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {timeline.map(event => (
                    <div key={event.id} className="rounded-lg border p-3 bg-white">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-gray-400">{event.event_type}</span>
                        <span className="text-xs text-gray-400">{fmtDate(event.created_at)}</span>
                      </div>
                      <p className="font-medium text-sm text-gray-900 mt-1">{event.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{event.actor_name || event.actor_type}</p>
                    </div>
                  ))}
                  {timeline.length === 0 && <EmptyState text="Đơn này chưa có entity_events." />}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Order notes</h4>
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {notes.map(note => (
                    <div key={note.id} className="rounded-lg border p-3 bg-white">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${noteBadge[note.note_type] || 'bg-gray-100 text-gray-700'}`}>{note.note_type}</span>
                        {note.is_pinned && <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">PIN</span>}
                        <span className="text-xs text-gray-400 ml-auto">{fmtDate(note.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-900 mt-2">{note.content}</p>
                      <p className="text-xs text-gray-500 mt-1">{note.user_name}</p>
                    </div>
                  ))}
                  {notes.length === 0 && <EmptyState text="Đơn này chưa có note." />}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-lg font-semibold mb-3">🔌 Integration DLQ</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-sm">
              <div className="rounded-lg bg-amber-50 p-3"><p className="text-xs text-amber-600">Pending</p><p className="text-xl font-bold text-amber-700">{ops.integration.pending}</p></div>
              <div className="rounded-lg bg-blue-50 p-3"><p className="text-xs text-blue-600">Retrying</p><p className="text-xl font-bold text-blue-700">{ops.integration.retrying}</p></div>
              <div className="rounded-lg bg-red-50 p-3"><p className="text-xs text-red-600">Failed</p><p className="text-xl font-bold text-red-700">{ops.integration.failed}</p></div>
              <div className="rounded-lg bg-green-50 p-3"><p className="text-xs text-green-600">Resolved</p><p className="text-xl font-bold text-green-700">{ops.integration.resolved}</p></div>
            </div>
            <div className="space-y-2">
              {ops.integration.recent.map(item => (
                <div key={item.id} className="rounded-lg border bg-gray-50 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${dlqBadge[item.status] || 'bg-gray-100 text-gray-700'}`}>{item.status}</span>
                    <span className="font-medium text-sm">{item.adapter} · {item.operation}</span>
                    <span className="text-xs text-gray-400 ml-auto">{fmtDate(item.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Retry {item.retry_count}/{item.max_retries}</p>
                  <p className="text-sm text-gray-700 mt-1">{item.error_message || 'Không có error message'}</p>
                </div>
              ))}
              {ops.integration.recent.length === 0 && <EmptyState text="Chưa có DLQ entries." />}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-lg font-semibold mb-3">🧾 Reconciliation & KPI</h3>
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div className="rounded-lg bg-orange-50 p-3"><p className="text-xs text-orange-600">Open discrepancy</p><p className="text-xl font-bold text-orange-700">{ops.reconciliation.open_discrepancies}</p></div>
              <div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs text-emerald-600">Resolved discrepancy</p><p className="text-xl font-bold text-emerald-700">{ops.reconciliation.resolved_discrepancies}</p></div>
              <div className="rounded-lg bg-sky-50 p-3"><p className="text-xs text-sky-600">Daily closes</p><p className="text-xl font-bold text-sky-700">{ops.reconciliation.daily_closes}</p></div>
              <div className="rounded-lg bg-violet-50 p-3"><p className="text-xs text-violet-600">KPI snapshots</p><p className="text-xl font-bold text-violet-700">{ops.kpi.snapshots}</p></div>
            </div>

            <div className="space-y-2 mb-4">
              {ops.reconciliation.recent_discrepancies.map(item => (
                <div key={item.id} className="rounded-lg border p-3 bg-gray-50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{item.trip_number}</span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">{item.disc_type}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.status}</span>
                    <span className="text-xs text-gray-400 ml-auto">{fmtDate(item.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{item.description}</p>
                  <p className="text-xs text-gray-500 mt-1">Variance: {fmtMoney(item.variance)}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Ngày</th>
                    <th className="px-3 py-2 text-left">Kho</th>
                    <th className="px-3 py-2 text-right">OTD</th>
                    <th className="px-3 py-2 text-right">Success</th>
                    <th className="px-3 py-2 text-right">Đơn</th>
                    <th className="px-3 py-2 text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ops.kpi.recent_snapshots.map((item, idx) => (
                    <tr key={`${item.snapshot_date}-${idx}`}>
                      <td className="px-3 py-2">{item.snapshot_date}</td>
                      <td className="px-3 py-2">{item.warehouse_name}</td>
                      <td className="px-3 py-2 text-right">{item.otd_rate.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right">{item.delivery_success_rate.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right">{item.total_orders}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(item.total_revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-lg font-semibold mb-3">🛡️ Admin smoke</h3>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div className="rounded-lg bg-gray-50 p-3">Configs: <strong>{ops.admin.configs}</strong></div>
              <div className="rounded-lg bg-gray-50 p-3">Credit limits: <strong>{ops.admin.credit_limits}</strong></div>
              <div className="rounded-lg bg-gray-50 p-3">Routes: <strong>{ops.admin.routes}</strong></div>
              <div className="rounded-lg bg-gray-50 p-3">Sessions: <strong>{ops.admin.active_sessions}</strong></div>
            </div>
            <div className="space-y-2">
              {ops.admin.recent_sessions.map(item => (
                <div key={item.id} className="rounded-lg border p-3 bg-gray-50 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{item.user_name}</span>
                    {item.revoked_at ? <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">revoked</span> : <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">active</span>}
                    <span className="text-xs text-gray-400 ml-auto">{fmtDate(item.last_seen_at)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{item.ip_address || 'N/A'} · {item.user_agent || 'N/A'}</p>
                </div>
              ))}
              {ops.admin.recent_sessions.length === 0 && <EmptyState text="Chưa có active session nào để soi." />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== Shared Components =====
// ===== Tab: GPS Simulation =====
interface GPSScenario {
  id: string; name: string; description: string; category: string
  vehicle_count: number; duration: string
  routes?: { name: string; waypoints: { lat: number; lng: number; name: string }[] }[]
}
interface GPSVehicle {
  id: string; plate: string; type: string; driver_name: string; trip_status: string
}
interface GPSSimStatusData {
  running: boolean; scenario_id?: string; scenario_name?: string
  vehicle_count?: number; started_at?: string; tick_count?: number
  vehicle_states?: { vehicle_id: string; plate: string; lat: number; lng: number; speed: number; heading: number; status: string; waypoint_idx: number }[]
}

function GPSSimTab({ refreshKey, showToast, preferredScenario }: { refreshKey: number; showToast: (m: string) => void; preferredScenario: string }) {
  const [scenarios, setScenarios] = useState<GPSScenario[]>([])
  const [vehicles, setVehicles] = useState<GPSVehicle[]>([])
  const [selectedScenario, setSelectedScenario] = useState<string>('')
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([])
  const [intervalMs, setIntervalMs] = useState(3000)
  const [status, setStatus] = useState<GPSSimStatusData | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    api<GPSScenario[]>('/gps/scenarios').then(d => d && setScenarios(d))
    api<GPSVehicle[]>('/gps/vehicles').then(d => d && setVehicles(d))
    api<GPSSimStatusData>('/gps/status').then(d => d && setStatus(d))
  }, [refreshKey])

  useEffect(() => {
    if (preferredScenario) setSelectedScenario(preferredScenario)
  }, [preferredScenario])

  // Auto-refresh status every 3s while running
  useEffect(() => {
    if (!autoRefresh) return
    const iv = setInterval(async () => {
      const s = await api<GPSSimStatusData>('/gps/status')
      if (s) setStatus(s)
      if (s && !s.running) setAutoRefresh(false)
    }, 3000)
    return () => clearInterval(iv)
  }, [autoRefresh])

  const handleStart = async () => {
    if (!selectedScenario) { showToast('Chọn kịch bản trước'); return }
    setLoading(true)
    const res = await api<{ message: string }>('/gps/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario_id: selectedScenario,
        vehicle_ids: selectedVehicles.length > 0 ? selectedVehicles : undefined,
        interval_ms: intervalMs,
      }),
    })
    setLoading(false)
    if (res) {
      showToast(res.message)
      setAutoRefresh(true)
      const s = await api<GPSSimStatusData>('/gps/status')
      if (s) setStatus(s)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    const res = await api<{ message: string }>('/gps/stop', { method: 'POST' })
    setLoading(false)
    if (res) showToast(res.message)
    setAutoRefresh(false)
    const s = await api<GPSSimStatusData>('/gps/status')
    if (s) setStatus(s)
  }

  const toggleVehicle = (id: string) => {
    setSelectedVehicles(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])
  }

  const sc = scenarios.find(s => s.id === selectedScenario)
  const catColor: Record<string, string> = {
    delivery: 'bg-green-100 text-green-700', anomaly: 'bg-red-100 text-red-700',
    performance: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {status?.running && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
            <div>
              <p className="font-semibold text-green-800">Đang chạy: {status.scenario_name}</p>
              <p className="text-sm text-green-600">
                {status.vehicle_count} xe · Tick #{status.tick_count} · Bắt đầu: {status.started_at ? fmtDate(status.started_at) : '-'}
              </p>
            </div>
          </div>
          <button onClick={handleStop} disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 text-sm font-medium disabled:opacity-50">
            ⏹️ Dừng
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Scenario selection */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-lg font-semibold mb-4">📡 Chọn kịch bản giả lập</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scenarios.map(s => (
                <button key={s.id} onClick={() => setSelectedScenario(s.id)}
                  className={`text-left p-4 rounded-lg border-2 transition ${
                    selectedScenario === s.id ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${catColor[s.category] || 'bg-gray-100 text-gray-600'}`}>
                      {s.category}
                    </span>
                    <span className="text-xs text-gray-400">{s.duration}</span>
                  </div>
                  <p className="font-medium text-gray-900">{s.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{s.description}</p>
                  {s.vehicle_count > 0 && <p className="text-xs text-gray-400 mt-1">🚛 {s.vehicle_count} xe mặc định</p>}
                </button>
              ))}
            </div>
          </div>

          {/* Route preview */}
          {sc?.routes && sc.routes.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-lg font-semibold mb-3">🗺️ Tuyến đường trong kịch bản</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sc.routes.map((r, i) => (
                  <div key={i} className="border rounded-lg p-3">
                    <p className="font-medium text-sm">{r.name}</p>
                    <div className="mt-2 space-y-1">
                      {r.waypoints?.map((wp, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs text-gray-600">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                            j === 0 ? 'bg-green-500' : j === (r.waypoints?.length || 0) - 1 ? 'bg-red-500' : 'bg-amber-500'
                          }`}>{j + 1}</span>
                          {wp.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Controls + Vehicle selection */}
        <div className="space-y-4">
          {/* Controls */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-lg font-semibold mb-4">⚙️ Cài đặt</h3>

            <label className="block text-sm font-medium text-gray-700 mb-1">Tần suất GPS (ms)</label>
            <input type="range" min={1000} max={10000} step={500} value={intervalMs}
              onChange={e => setIntervalMs(Number(e.target.value))}
              className="w-full mb-1" />
            <p className="text-xs text-gray-500 mb-4">{intervalMs}ms ({(intervalMs / 1000).toFixed(1)}s mỗi update)</p>

            <div className="flex gap-2">
              <button onClick={handleStart} disabled={loading || !selectedScenario || status?.running === true}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-500 text-sm font-medium disabled:opacity-50 transition">
                {loading ? '⏳...' : '▶️ Bắt đầu'}
              </button>
              <button onClick={handleStop} disabled={loading || !status?.running}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-500 text-sm font-medium disabled:opacity-50 transition">
                ⏹️ Dừng
              </button>
            </div>

            <a href="/dispatcher" target="_blank" rel="noopener noreferrer"
              className="block text-center mt-3 text-sm text-amber-600 hover:text-amber-700 font-medium">
              🗺️ Mở Control Tower để xem bản đồ →
            </a>
          </div>

          {/* Vehicle selection */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold mb-3">🚛 Chọn xe (tuỳ chọn)</h3>
            <p className="text-xs text-gray-500 mb-3">Không chọn = dùng xe mặc định từ DB</p>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {vehicles.map(v => (
                <label key={v.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input type="checkbox" checked={selectedVehicles.includes(v.id)}
                    onChange={() => toggleVehicle(v.id)} className="rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.plate}</p>
                    <p className="text-xs text-gray-500">{v.driver_name} · {v.trip_status === 'has_trip' ? '🟢 Có trip' : '⚪ Rảnh'}</p>
                  </div>
                </label>
              ))}
              {vehicles.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Không có xe</p>}
            </div>
          </div>

          {/* Live vehicle states */}
          {status?.running && status.vehicle_states && status.vehicle_states.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold mb-3">📍 Trạng thái xe</h3>
              <div className="space-y-2">
                {status.vehicle_states.map(vs => {
                  const stColor: Record<string, string> = {
                    moving: 'bg-green-100 text-green-700', delivering: 'bg-amber-100 text-amber-700',
                    idle: 'bg-gray-100 text-gray-600', lost_signal: 'bg-red-100 text-red-700',
                  }
                  return (
                    <div key={vs.vehicle_id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-gray-50">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${stColor[vs.status] || 'bg-gray-100'}`}>
                        {vs.status}
                      </span>
                      <span className="font-medium">{vs.plate}</span>
                      <span className="text-gray-400 text-xs ml-auto">
                        {vs.speed.toFixed(0)} km/h · WP {vs.waypoint_idx}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500" />
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-20 text-gray-500">
      <div className="text-4xl mb-3">📭</div>
      <p>{text}</p>
    </div>
  )
}

// ===== Tab: Tài xế & Tài khoản =====
interface DriverInfo {
  id: string; full_name: string; phone: string; license_number: string | null
  status: string; warehouse_id: string; user_id: string
}

function DriversTab() {
  const [drivers, setDrivers] = useState<DriverInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<DriverInfo[]>('/drivers')
      .then(d => setDrivers(d || []))
      .finally(() => setLoading(false))
  }, [])

  const getWarehouseName = (whId: string) => {
    if (whId?.includes('0001')) return '🏭 Kho Hạ Long'
    if (whId?.includes('0002')) return '🏭 Kho Hải Phòng'
    return whId || '-'
  }

  if (loading) return <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>

  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
        <h3 className="font-bold text-amber-800 text-lg mb-3">📋 Hướng dẫn test với dữ liệu do Test Portal nạp</h3>
        <div className="space-y-2 text-sm text-amber-900">
          <p><strong>Bước 1:</strong> Vào tab Kịch bản test và nhấn <strong>Nạp data</strong> cho scenario cần kiểm thử.</p>
          <p><strong>Bước 2:</strong> Nếu scenario sinh chuyến giao hàng, đối chiếu danh sách tài xế thực tế ở bảng bên dưới.</p>
          <p><strong>Bước 3:</strong> Phân công hoặc kiểm tra chuyến ở các màn hình nghiệp vụ tương ứng.</p>
          <p><strong>Bước 4:</strong> Không dùng tài khoản/mật khẩu hardcode từ Test Portal; đăng nhập bằng tài khoản được hệ thống hoặc quản trị cấp.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">🚛 Danh sách tài xế hiện có</h3>
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">{drivers.length} tài xế</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left py-3 px-4">#</th>
                <th className="text-left py-3 px-4">Tên tài xế</th>
                <th className="text-left py-3 px-4">SĐT</th>
                <th className="text-left py-3 px-4">GPLX</th>
                <th className="text-left py-3 px-4">Kho</th>
                <th className="text-left py-3 px-4">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drivers.map((d, idx) => (
                <tr key={d.id} className="hover:bg-amber-50 transition">
                  <td className="py-2.5 px-4 text-gray-400">{idx + 1}</td>
                  <td className="py-2.5 px-4 font-medium text-gray-900">{d.full_name}</td>
                  <td className="py-2.5 px-4 text-gray-600">{d.phone}</td>
                  <td className="py-2.5 px-4 text-gray-600 font-mono text-xs">{d.license_number || '-'}</td>
                  <td className="py-2.5 px-4 text-xs">{getWarehouseName(d.warehouse_id)}</td>
                  <td className="py-2.5 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      d.status === 'active' ? 'bg-green-100 text-green-700'
                      : d.status === 'on_trip' ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600'
                    }`}>
                      {d.status === 'active' ? 'Sẵn sàng' : d.status === 'on_trip' ? 'Đang giao' : d.status}
                    </span>
                  </td>
                </tr>
              ))}
              {drivers.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Chưa có dữ liệu tài xế trong hệ thống</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
