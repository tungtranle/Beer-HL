'use client'

import { useCallback, useEffect, useState } from 'react'

const API = '/api/test-portal/aqf'

// ─────────────────────────────────────────────────────────────
// Types (mirrors aqf_types.go)
// ─────────────────────────────────────────────────────────────

interface GateStatus {
  gate: string
  status: 'pass' | 'fail' | 'warn' | 'skip' | 'unknown' | 'running'
  duration_s: number
  summary: string
  run_at?: string
}

interface FailDetail {
  case_id: string
  scenario?: string
  message: string
  expected?: string
  actual?: string
}

interface GoldenResult {
  invariant_id: string
  name: string
  module: string
  priority: 'critical' | 'high'
  status: 'pass' | 'fail' | 'skip' | 'error'
  total_cases: number
  passed_cases: number
  failed_cases: number
  fail_details?: FailDetail[]
  duration_ms: number
  golden_file: string
}

interface DecisionBrief {
  verdict: 'SHIP' | 'CAUTION' | 'HOLD'
  confidence: number
  summary: string
  blocking_issues: string[]
  warnings: string[]
  gates: GateStatus[]
  run_at: string
  evidence_id: string
}

interface BusinessHealth {
  orders_today: number
  pending_approval: number
  active_trips: number
  pending_recon: number
  open_discrepancies: number
  failed_integrations: number
  low_stock_alerts: number
  db_conn_ok: boolean
  redis_ok: boolean
}

interface EvidenceRecord {
  id: string
  run_at: string
  verdict: 'SHIP' | 'CAUTION' | 'HOLD'
  confidence: number
  golden_pass: number
  golden_fail: number
  blocking_count: number
  warning_count: number
  notes?: string
}

interface OpenQuestion {
  id: string
  question: string
  affects: string
  block_ship: boolean
  answer?: string
  answered_at?: string
}

interface AQFStatusResponse {
  last_run_at?: string
  brief?: DecisionBrief
  golden_results: GoldenResult[]
  health: BusinessHealth
  evidence_log: EvidenceRecord[]
  open_questions: OpenQuestion[]
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(API + path)
    const json = await res.json()
    return json.success ? json.data : null
  } catch { return null }
}

async function apiPost<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json()
    return json.success ? json.data : null
  } catch { return null }
}

const fmtDate = (s?: string) => s ? new Date(s).toLocaleString('vi-VN') : '—'
const fmtDuration = (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`

// ─────────────────────────────────────────────────────────────
// Verdict Card — big, unmistakable
// ─────────────────────────────────────────────────────────────

function VerdictCard({ brief, running }: { brief?: DecisionBrief; running: boolean }) {
  if (running) {
    return (
      <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-6 flex items-center gap-4 animate-pulse">
        <div className="text-4xl">⏳</div>
        <div>
          <div className="text-xl font-bold text-blue-700">Đang chạy QA...</div>
          <div className="text-blue-600 text-sm mt-1">Đang validate golden datasets và business health</div>
        </div>
      </div>
    )
  }

  if (!brief) {
    return (
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center">
        <div className="text-3xl mb-2">🎯</div>
        <div className="text-gray-600 font-medium">Chưa có kết quả QA</div>
        <div className="text-gray-400 text-sm mt-1">Bấm &quot;Run Full QA&quot; để bắt đầu</div>
      </div>
    )
  }

  const styles = {
    SHIP: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-400',
      badge: 'bg-emerald-500 text-white',
      text: 'text-emerald-700',
      icon: '✅',
      bar: 'bg-emerald-500',
    },
    CAUTION: {
      bg: 'bg-amber-50',
      border: 'border-amber-400',
      badge: 'bg-amber-500 text-white',
      text: 'text-amber-700',
      icon: '⚠️',
      bar: 'bg-amber-500',
    },
    HOLD: {
      bg: 'bg-red-50',
      border: 'border-red-400',
      badge: 'bg-red-600 text-white',
      text: 'text-red-700',
      icon: '🚫',
      bar: 'bg-red-500',
    },
  }

  const s = styles[brief.verdict]

  return (
    <div className={`${s.bg} border-2 ${s.border} rounded-2xl p-6`}>
      <div className="flex items-start gap-4">
        <div className="text-5xl">{s.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`${s.badge} text-2xl font-black px-4 py-1 rounded-xl tracking-wide`}>
              {brief.verdict}
            </span>
            <span className={`text-3xl font-black ${s.text}`}>{brief.confidence}<span className="text-lg font-normal">/100</span></span>
          </div>
          <p className={`mt-2 text-sm ${s.text} font-medium`}>{brief.summary}</p>

          {/* Confidence bar */}
          <div className="mt-3 bg-gray-200 rounded-full h-2.5 w-full max-w-sm">
            <div
              className={`${s.bar} h-2.5 rounded-full transition-all duration-700`}
              style={{ width: `${brief.confidence}%` }}
            />
          </div>

          <div className="mt-2 text-xs text-gray-500">
            Evidence ID: <code className="font-mono">{brief.evidence_id}</code> · {fmtDate(brief.run_at)}
          </div>
        </div>
      </div>

      {/* Blocking issues */}
      {brief.blocking_issues?.length > 0 && (
        <div className="mt-4 space-y-1">
          {brief.blocking_issues.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-red-700 bg-red-100 rounded-lg px-3 py-2">
              <span className="mt-0.5 shrink-0">🔴</span>
              <span>{issue}</span>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {brief.warnings?.length > 0 && (
        <div className="mt-2 space-y-1">
          {brief.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-amber-700 bg-amber-100 rounded-lg px-3 py-2">
              <span className="mt-0.5 shrink-0">🟡</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Gate Status Row (G0-G4)
// ─────────────────────────────────────────────────────────────

function GateRow({ gates }: { gates: GateStatus[] }) {
  const statusStyle = (s: string) => {
    switch (s) {
      case 'pass': return 'bg-emerald-100 text-emerald-700 border-emerald-300'
      case 'fail': return 'bg-red-100 text-red-700 border-red-300'
      case 'warn': return 'bg-amber-100 text-amber-700 border-amber-300'
      case 'running': return 'bg-blue-100 text-blue-700 border-blue-300 animate-pulse'
      default: return 'bg-gray-100 text-gray-500 border-gray-200'
    }
  }
  const statusIcon = (s: string) => {
    switch (s) {
      case 'pass': return '✅'
      case 'fail': return '❌'
      case 'warn': return '⚠️'
      case 'running': return '⏳'
      default: return '⏸️'
    }
  }

  const gateDesc: Record<string, string> = {
    G0: 'Pre-commit',
    G1: 'Infrastructure',
    G2: 'Domain / Golden',
    G3: 'E2E / UX',
    G4: 'Production Watch',
  }

  return (
    <div className="grid grid-cols-5 gap-2">
      {(gates.length > 0 ? gates : ['G0','G1','G2','G3','G4'].map(g => ({ gate: g, status: 'unknown', summary: '—', duration_s: 0 } as GateStatus))).map((g) => (
        <div key={g.gate} className={`border rounded-xl p-3 text-center ${statusStyle(g.status)}`}>
          <div className="text-lg font-black">{g.gate}</div>
          <div className="text-xs font-medium mt-0.5">{gateDesc[g.gate] || g.gate}</div>
          <div className="text-xl mt-1">{statusIcon(g.status)}</div>
          <div className="text-xs mt-1 leading-tight truncate" title={g.summary}>{g.summary || g.status}</div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Golden Dataset Table
// ─────────────────────────────────────────────────────────────

function GoldenTable({ results }: { results: GoldenResult[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!results.length) {
    return <div className="text-center text-gray-400 py-8">Chưa có kết quả golden tests. Bấm Run Full QA.</div>
  }

  const statusBadge = (s: string) => {
    switch (s) {
      case 'pass': return 'bg-emerald-100 text-emerald-700'
      case 'fail': return 'bg-red-100 text-red-700'
      case 'error': return 'bg-orange-100 text-orange-700'
      default: return 'bg-gray-100 text-gray-500'
    }
  }

  const priorityBadge = (p: string) =>
    p === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'

  return (
    <div className="space-y-2">
      {results.map(r => (
        <div key={r.invariant_id} className="border rounded-xl overflow-hidden bg-white">
          <button
            className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition"
            onClick={() => setExpanded(expanded === r.invariant_id ? null : r.invariant_id)}
          >
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusBadge(r.status)}`}>
              {r.status.toUpperCase()}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${priorityBadge(r.priority)}`}>
              {r.priority}
            </span>
            <span className="font-medium text-sm flex-1">{r.name}</span>
            <span className="text-xs text-gray-400 shrink-0">{r.module}</span>
            <span className="text-xs text-gray-400 shrink-0">
              {r.passed_cases}/{r.total_cases} pass · {fmtDuration(r.duration_ms)}
            </span>
            <span className="text-gray-400 text-xs">{expanded === r.invariant_id ? '▲' : '▼'}</span>
          </button>

          {expanded === r.invariant_id && (
            <div className="px-4 pb-4 border-t bg-gray-50">
              <div className="text-xs text-gray-500 mt-2 mb-2">
                <code className="bg-gray-200 px-1.5 py-0.5 rounded">{r.invariant_id}</code>
                {' '}·{' '}
                <code className="bg-gray-200 px-1.5 py-0.5 rounded">{r.golden_file}</code>
              </div>

              {/* Case progress bar */}
              {r.total_cases > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full"
                      style={{ width: `${(r.passed_cases / r.total_cases) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600">{r.passed_cases}/{r.total_cases} cases pass</span>
                </div>
              )}

              {/* Fail details */}
              {r.fail_details && r.fail_details.length > 0 ? (
                <div className="space-y-2">
                  {r.fail_details.map((d, i) => (
                    <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
                      <div className="font-bold text-red-700 mb-1">[{d.case_id}] {d.scenario}</div>
                      {d.message && <div className="text-red-600 mb-1">❌ {d.message}</div>}
                      {d.expected && <div className="text-gray-600">Expected: <code className="bg-red-100 px-1 rounded">{d.expected}</code></div>}
                      {d.actual && <div className="text-gray-600 mt-0.5">Actual: <code className="bg-red-100 px-1 rounded">{d.actual}</code></div>}
                    </div>
                  ))}
                </div>
              ) : (
                r.status === 'pass' && (
                  <div className="text-emerald-600 text-xs font-medium">✅ Tất cả {r.total_cases} cases pass</div>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Business Health Panel
// ─────────────────────────────────────────────────────────────

function HealthPanel({ health }: { health?: BusinessHealth }) {
  if (!health) return <div className="text-gray-400 text-center py-6">Chưa load health data</div>

  const metric = (icon: string, label: string, value: number | string, color = 'text-gray-700', alert = false) => (
    <div className={`bg-white rounded-xl border p-4 ${alert ? 'border-red-300 bg-red-50' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <div>
          <div className={`text-xl font-bold ${color}`}>{value}</div>
          <div className="text-xs text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Connectivity */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl border p-3 flex items-center gap-2 ${health.db_conn_ok ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'}`}>
          <span className="text-lg">{health.db_conn_ok ? '🟢' : '🔴'}</span>
          <div>
            <div className="text-sm font-bold">PostgreSQL</div>
            <div className={`text-xs ${health.db_conn_ok ? 'text-emerald-600' : 'text-red-600'}`}>{health.db_conn_ok ? 'Connected' : 'DISCONNECTED'}</div>
          </div>
        </div>
        <div className={`rounded-xl border p-3 flex items-center gap-2 ${health.redis_ok ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'}`}>
          <span className="text-lg">{health.redis_ok ? '🟢' : '🟡'}</span>
          <div>
            <div className="text-sm font-bold">Redis</div>
            <div className={`text-xs ${health.redis_ok ? 'text-emerald-600' : 'text-amber-600'}`}>{health.redis_ok ? 'Connected' : 'Unavailable'}</div>
          </div>
        </div>
      </div>

      {/* Business metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {metric('📋', 'Đơn hàng hôm nay', health.orders_today)}
        {metric('⏳', 'Chờ duyệt credit', health.pending_approval, health.pending_approval > 5 ? 'text-amber-600' : 'text-gray-700', health.pending_approval > 10)}
        {metric('🚛', 'Chuyến đang chạy', health.active_trips, 'text-blue-600')}
        {metric('📊', 'Chờ đối soát', health.pending_recon, health.pending_recon > 3 ? 'text-amber-600' : 'text-gray-700', health.pending_recon > 10)}
        {metric('⚠️', 'Discrepancy mở', health.open_discrepancies, health.open_discrepancies > 0 ? 'text-amber-600' : 'text-gray-700', health.open_discrepancies > 5)}
        {metric('❌', 'Integration failed', health.failed_integrations, health.failed_integrations > 0 ? 'text-red-600' : 'text-gray-700', health.failed_integrations > 0)}
        {metric('📦', 'Cảnh báo tồn kho', health.low_stock_alerts, health.low_stock_alerts > 0 ? 'text-amber-600' : 'text-gray-700')}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Evidence Log
// ─────────────────────────────────────────────────────────────

function EvidenceLog({ records }: { records: EvidenceRecord[] }) {
  if (!records.length) {
    return <div className="text-center text-gray-400 py-8">Chưa có evidence nào. Bấm Run Full QA để tạo evidence đầu tiên.</div>
  }

  const verdictStyle = (v: string) => {
    switch (v) {
      case 'SHIP': return 'bg-emerald-100 text-emerald-700'
      case 'CAUTION': return 'bg-amber-100 text-amber-700'
      default: return 'bg-red-100 text-red-700'
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b">
            <th className="pb-2 pr-4">Thời gian</th>
            <th className="pb-2 pr-4">Verdict</th>
            <th className="pb-2 pr-4">Confidence</th>
            <th className="pb-2 pr-4">Golden Pass/Fail</th>
            <th className="pb-2 pr-4">Blocking</th>
            <th className="pb-2">Evidence ID</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {records.map(r => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">{fmtDate(r.run_at)}</td>
              <td className="py-2 pr-4">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${verdictStyle(r.verdict)}`}>{r.verdict}</span>
              </td>
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${r.verdict === 'SHIP' ? 'bg-emerald-500' : r.verdict === 'CAUTION' ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${r.confidence}%` }}
                    />
                  </div>
                  <span className="text-gray-700 font-medium">{r.confidence}</span>
                </div>
              </td>
              <td className="py-2 pr-4">
                <span className="text-emerald-600 font-medium">{r.golden_pass}✓</span>
                {r.golden_fail > 0 && <span className="text-red-600 font-medium ml-1">{r.golden_fail}✗</span>}
              </td>
              <td className="py-2 pr-4">
                {r.blocking_count > 0
                  ? <span className="text-red-600 font-medium">{r.blocking_count} issues</span>
                  : <span className="text-gray-400">—</span>}
              </td>
              <td className="py-2 font-mono text-xs text-gray-400">{r.id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Open Questions Panel
// ─────────────────────────────────────────────────────────────

function OpenQuestionsPanel({ questions, onAnswer }: { questions: OpenQuestion[]; onAnswer: () => void }) {
  const [answering, setAnswering] = useState<string | null>(null)

  const handleAnswer = async (id: string, answer: string) => {
    setAnswering(id)
    await apiPost('/answer', { id, answer })
    setAnswering(null)
    onAnswer()
  }

  return (
    <div className="space-y-3">
      {questions.map(q => (
        <div key={q.id} className={`rounded-xl border p-4 ${q.block_ship && !q.answer ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              {q.answer
                ? <span className="text-lg">✅</span>
                : q.block_ship
                  ? <span className="text-lg">🚫</span>
                  : <span className="text-lg">❓</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-gray-500">{q.id}</span>
                {q.block_ship && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">block ship</span>}
                {q.answer && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">answered: {q.answer}</span>}
              </div>
              <p className="text-sm text-gray-800 font-medium mt-1">{q.question}</p>
              <p className="text-xs text-gray-500 mt-0.5">Affects: <code className="bg-gray-100 px-1 rounded">{q.affects}</code></p>
              {q.answered_at && <p className="text-xs text-gray-400 mt-0.5">Answered: {fmtDate(q.answered_at)}</p>}

              {!q.answer && (
                <div className="flex gap-2 mt-3">
                  {(['yes', 'no', 'defer'] as const).map(a => (
                    <button
                      key={a}
                      disabled={answering === q.id}
                      onClick={() => handleAnswer(q.id, a)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50
                        ${a === 'yes' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : a === 'no' ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {a === 'yes' ? '✓ Yes' : a === 'no' ? '✗ No' : '→ Defer'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Run Control Panel
// ─────────────────────────────────────────────────────────────

function RunControl({ onRun, running }: { onRun: (section?: string) => void; running: boolean }) {
  const btn = (label: string, icon: string, section?: string, color = 'bg-brand-500 hover:bg-brand-600 text-white') => (
    <button
      onClick={() => onRun(section)}
      disabled={running}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition disabled:opacity-50 ${color}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )

  return (
    <div className="bg-gray-50 rounded-xl border p-4">
      <h3 className="text-sm font-bold text-gray-700 mb-3">🕹️ Run Control</h3>
      <div className="flex flex-wrap gap-2">
        {btn('Run Full QA', '▶', undefined, 'bg-blue-600 hover:bg-blue-700 text-white')}
        {btn('Golden Tests Only', '🔬', 'golden', 'bg-purple-100 hover:bg-purple-200 text-purple-700')}
        {btn('Health Check', '💊', 'health', 'bg-green-100 hover:bg-green-200 text-green-700')}
      </div>
      <div className="mt-3 text-xs text-gray-400 space-y-1">
        <div>G0 (pre-commit): <code className="bg-gray-200 px-1 rounded">AQF_G0_CHECK.bat</code> — run from File Explorer</div>
        <div>G3 (E2E Playwright): <code className="bg-gray-200 px-1 rounded">cd web && npm run test:e2e</code></div>
        <div>CI Gates (G1/G2/G3): push to GitHub → Actions auto-trigger</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main AQF Command Center Component
// ─────────────────────────────────────────────────────────────

type View = 'overview' | 'golden' | 'health' | 'evidence' | 'questions'

export default function AQFCommandCenter() {
  const [data, setData] = useState<AQFStatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [view, setView] = useState<View>('overview')
  const [toast, setToast] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  const loadStatus = useCallback(async () => {
    setLoading(true)
    const result = await apiGet<AQFStatusResponse>('/status')
    if (result) setData(result)
    setLoading(false)
  }, [])

  const handleRun = async (section?: string) => {
    setRunning(true)
    let result: AQFStatusResponse | null = null
    if (!section || section === 'full') {
      const runResult = await apiPost<{ brief: DecisionBrief; golden_results: GoldenResult[]; health: BusinessHealth }>('/run')
      if (runResult) {
        result = {
          last_run_at: runResult.brief.run_at,
          brief: runResult.brief,
          golden_results: runResult.golden_results,
          health: runResult.health,
          evidence_log: data?.evidence_log ?? [],
          open_questions: data?.open_questions ?? [],
        }
        showToast(`✅ QA hoàn thành — Verdict: ${runResult.brief.verdict} (${runResult.brief.confidence}/100)`)
      }
    } else if (section === 'golden') {
      const goldenResult = await apiGet<GoldenResult[]>('/golden')
      if (goldenResult && data) {
        result = { ...data, golden_results: goldenResult }
        showToast(`✅ Golden tests done — ${goldenResult.filter(r => r.status === 'pass').length}/${goldenResult.length} pass`)
      }
    } else if (section === 'health') {
      const healthResult = await apiGet<BusinessHealth>('/health')
      if (healthResult && data) {
        result = { ...data, health: healthResult }
        showToast(`✅ Health check done`)
      }
    }
    if (result) setData(result)
    setRunning(false)
  }

  // Auto-refresh on mount and when autoRefresh is on
  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(loadStatus, 30_000)
    return () => clearInterval(interval)
  }, [autoRefresh, loadStatus])

  const views: { key: View; label: string; icon: string }[] = [
    { key: 'overview', label: 'Tổng quan', icon: '🎯' },
    { key: 'golden', label: 'Golden Tests', icon: '🔬' },
    { key: 'health', label: 'Business Health', icon: '💊' },
    { key: 'evidence', label: 'Evidence Log', icon: '📋' },
    { key: 'questions', label: 'Open Questions', icon: '❓' },
  ]

  const goldenPass = data?.golden_results.filter(r => r.status === 'pass').length ?? 0
  const goldenFail = data?.golden_results.filter(r => r.status === 'fail').length ?? 0

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-xl z-50 text-sm font-medium max-w-sm">
          {toast}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-800">⚡ AQF Command Center</h2>
          <p className="text-xs text-gray-500">
            {data?.last_run_at ? `Lần cuối: ${fmtDate(data.last_run_at)}` : 'Chưa chạy QA'}
            {data?.golden_results.length ? ` · ${goldenPass}/${data.golden_results.length} golden pass` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh 30s
          </label>
          <button
            onClick={loadStatus}
            disabled={loading}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium transition disabled:opacity-50"
          >
            {loading ? '⏳' : '🔄'} Refresh
          </button>
          <button
            onClick={() => handleRun()}
            disabled={running}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition disabled:opacity-50"
          >
            {running ? '⏳ Running...' : '▶ Run Full QA'}
          </button>
        </div>
      </div>

      {/* Verdict + Gates */}
      <VerdictCard brief={data?.brief} running={running} />
      {data?.brief?.gates && <GateRow gates={data.brief.gates} />}

      {/* Quick stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-white border rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-emerald-600">{goldenPass}</div>
            <div className="text-xs text-gray-500">Golden Pass</div>
          </div>
          <div className="bg-white border rounded-xl p-3 text-center">
            <div className={`text-2xl font-black ${goldenFail > 0 ? 'text-red-600' : 'text-gray-300'}`}>{goldenFail}</div>
            <div className="text-xs text-gray-500">Golden Fail</div>
          </div>
          <div className="bg-white border rounded-xl p-3 text-center">
            <div className={`text-2xl font-black ${data.health.orders_today > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{data.health.orders_today}</div>
            <div className="text-xs text-gray-500">Orders hôm nay</div>
          </div>
          <div className="bg-white border rounded-xl p-3 text-center">
            <div className={`text-2xl font-black ${data.health.active_trips > 0 ? 'text-purple-600' : 'text-gray-400'}`}>{data.health.active_trips}</div>
            <div className="text-xs text-gray-500">Trips đang chạy</div>
          </div>
        </div>
      )}

      {/* Run control */}
      <RunControl onRun={handleRun} running={running} />

      {/* Sub-views */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="flex gap-0 border-b overflow-x-auto">
          {views.map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition
                ${view === v.key ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {v.icon} {v.label}
              {v.key === 'golden' && goldenFail > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{goldenFail}</span>
              )}
              {v.key === 'questions' && data?.open_questions.filter(q => q.block_ship && !q.answer).length
                ? <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">!</span>
                : null
              }
            </button>
          ))}
        </div>
        <div className="p-4">
          {view === 'overview' && (
            <div className="space-y-4">
              {data?.brief?.blocking_issues?.length ? (
                <div>
                  <h3 className="text-sm font-bold text-red-700 mb-2">🚫 Blocking Issues</h3>
                  {data.brief.blocking_issues.map((issue, i) => (
                    <div key={i} className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-1">{issue}</div>
                  ))}
                </div>
              ) : data?.brief && (
                <div className="text-emerald-600 text-sm font-medium">✅ Không có blocking issues</div>
              )}
              {data?.brief?.warnings?.length ? (
                <div>
                  <h3 className="text-sm font-bold text-amber-700 mb-2">⚠️ Warnings</h3>
                  {data.brief.warnings.map((w, i) => (
                    <div key={i} className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-1">{w}</div>
                  ))}
                </div>
              ) : null}
              {!data && !loading && (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">🎯</div>
                  <div>Bấm &quot;Run Full QA&quot; để bắt đầu kiểm tra chất lượng</div>
                </div>
              )}
            </div>
          )}
          {view === 'golden' && <GoldenTable results={data?.golden_results ?? []} />}
          {view === 'health' && <HealthPanel health={data?.health} />}
          {view === 'evidence' && <EvidenceLog records={data?.evidence_log ?? []} />}
          {view === 'questions' && (
            <OpenQuestionsPanel
              questions={data?.open_questions ?? []}
              onAnswer={loadStatus}
            />
          )}
        </div>
      </div>
    </div>
  )
}
