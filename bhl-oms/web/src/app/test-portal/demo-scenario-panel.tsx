'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock3, Database, ExternalLink, Play, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/Button'

interface ScenarioStep {
  role: string
  page: string
  action: string
  expected: string
}

interface ScenarioDataPoint {
  label: string
  value: string
}

interface DemoScenario {
  id: string
  title: string
  category: string
  description: string
  roles: string[]
  steps: ScenarioStep[]
  data_summary: string
  preview_data: ScenarioDataPoint[]
}

interface DemoRun {
  id: string
  scenario_id: string
  scenario_title: string
  status: string
  cleanup_deleted_count: number
  created_count: number
  historical_rows_touched: number
  error_message?: string
  started_at: string
  created_by_name?: string
}

interface DemoResult {
  scenario_id: string
  scenario_title: string
  status: string
  message: string
  created_count: number
  cleanup_deleted_count: number
  historical_rows_touched: number
  assertions: string[]
  delivery_date?: string
  app_url?: string
}

interface DemoPayload {
  scenarios: DemoScenario[]
  credentials: { username: string; password: string; role: string }
  safety: { mode: string; ownership_registry: string; historical_rows_touched: number; forbid_truncate: boolean }
}

const fmtDate = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '-'

export default function DemoScenarioPanel() {
  const [payload, setPayload] = useState<DemoPayload | null>(null)
  const [runs, setRuns] = useState<DemoRun[]>([])
  const [selectedID, setSelectedID] = useState('')
  const [busyID, setBusyID] = useState<string | null>(null)
  const [result, setResult] = useState<DemoResult | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()

  const selected = useMemo(
    () => payload?.scenarios.find((scenario) => scenario.id === selectedID) || payload?.scenarios[0],
    [payload, selectedID],
  )

  const load = useCallback(async () => {
    setError('')
    try {
      const scenariosRes: any = await apiFetch('/test-portal/demo-scenarios')
      const data = scenariosRes.data as DemoPayload
      setPayload(data)
      setSelectedID((current) => current || data.scenarios[0]?.id || '')
      const runsRes: any = await apiFetch('/test-portal/demo-runs?limit=12')
      setRuns(runsRes.data || [])
    } catch (err: any) {
      setError(err.message || 'Không tải được kịch bản demo')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const runAction = async (scenarioID: string, action: 'load' | 'cleanup') => {
    setBusyID(`${action}:${scenarioID}`)
    setResult(null)
    setError('')
    try {
      const res: any = await apiFetch(`/test-portal/demo-scenarios/${scenarioID}/${action}`, { method: 'POST' })
      setResult(res.data)
      await load()
    } catch (err: any) {
      setError(err.message || 'Không thực hiện được thao tác')
    } finally {
      setBusyID(null)
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-200 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">QA Demo Portal</p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Kịch bản demo khách hàng</h1>
          <p className="text-sm text-slate-500 mt-1">Nạp/xóa theo scenario ownership, không reset dữ liệu lịch sử.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
          <div className="rounded-lg border border-slate-200 px-3 py-2 bg-slate-50">
            <div className="font-semibold text-slate-900">{payload?.credentials.username || 'qa.demo'}</div>
            <div>demo123</div>
          </div>
          <div className="rounded-lg border border-emerald-200 px-3 py-2 bg-emerald-50 text-emerald-700">
            <div className="font-semibold">Historical</div>
            <div>0 touched</div>
          </div>
          <div className="rounded-lg border border-sky-200 px-3 py-2 bg-sky-50 text-sky-700">
            <div className="font-semibold">Registry</div>
            <div>qa_owned</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {result && (
        <div className="mx-6 mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold">{result.scenario_id} · {result.message}</div>
              <div className="mt-1">Tạo {result.created_count} record, cleanup {result.cleanup_deleted_count} record (toàn bộ kịch bản cũ), historical touched {result.historical_rows_touched}.</div>
              {result.delivery_date && (
                <div className="mt-1 text-xs text-emerald-600">Ngày demo: <strong>{result.delivery_date}</strong></div>
              )}
            </div>
            {result.app_url && (
              <a
                href={result.app_url}
                onClick={(e) => { e.preventDefault(); router.push(result.app_url!) }}
                className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-emerald-400 bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-200 transition"
              >
                <ExternalLink className="h-4 w-4" />
                Xem trong App
              </a>
            )}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[320px_1fr] gap-0">
        <aside className="border-r border-slate-200 bg-slate-50/70 p-4 space-y-2">
          {payload?.scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setSelectedID(scenario.id)}
              className={`w-full text-left rounded-lg border px-4 py-3 transition ${selected?.id === scenario.id ? 'bg-white border-brand-300 shadow-sm' : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-brand-600">{scenario.id}</span>
                <span className="text-[11px] rounded-full bg-slate-200 px-2 py-0.5 text-slate-700">{scenario.category}</span>
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{scenario.title}</div>
              <div className="mt-1 text-xs text-slate-500 line-clamp-2">{scenario.description}</div>
            </button>
          ))}
        </aside>

        <div className="p-6">
          {selected ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm text-brand-600 font-semibold">
                    <Database className="h-4 w-4" /> {selected.category}
                  </div>
                  <h2 className="mt-2 text-xl font-bold text-slate-900">{selected.title}</h2>
                  <p className="mt-2 text-sm text-slate-600 max-w-3xl">{selected.description}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    onClick={() => runAction(selected.id, 'load')}
                    loading={busyID === `load:${selected.id}`}
                    size="sm"
                  >
                    <Play className="h-4 w-4 mr-1" /> Nạp data
                  </Button>
                  <button
                    type="button"
                    onClick={() => runAction(selected.id, 'cleanup')}
                    disabled={!!busyID}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" /> Xóa scoped
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                {selected.preview_data.map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs text-slate-500">{item.label}</div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">{item.value}</div>
                  </div>
                ))}
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                  <div className="text-xs">Safety</div>
                  <div className="text-sm font-semibold mt-1 flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Không xóa lịch sử</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Luồng demo</h3>
                <div className="space-y-2">
                  {selected.steps.map((step, index) => (
                    <div key={`${step.role}-${index}`} className="grid md:grid-cols-[130px_1fr_1fr] gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm">
                      <div className="font-semibold text-slate-900">{index + 1}. {step.role}</div>
                      <div className="text-slate-600">{step.action}</div>
                      <div className="text-emerald-700 flex items-start gap-1.5"><CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> {step.expected}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Run gần đây</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Scenario</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-right">Created</th>
                        <th className="px-3 py-2 text-right">Cleaned</th>
                        <th className="px-3 py-2 text-right">Historical</th>
                        <th className="px-3 py-2 text-left">Run at</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {runs.map((run) => (
                        <tr key={run.id} className={run.scenario_id === selected.id ? 'bg-brand-50/40' : 'bg-white'}>
                          <td className="px-3 py-2 font-medium text-slate-900">{run.scenario_id}</td>
                          <td className="px-3 py-2 text-slate-600"><Clock3 className="inline h-3.5 w-3.5 mr-1" />{run.status}</td>
                          <td className="px-3 py-2 text-right">{run.created_count}</td>
                          <td className="px-3 py-2 text-right">{run.cleanup_deleted_count}</td>
                          <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{run.historical_rows_touched}</td>
                          <td className="px-3 py-2 text-slate-500">{fmtDate(run.started_at)}</td>
                        </tr>
                      ))}
                      {runs.length === 0 && (
                        <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Chưa có run demo</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-slate-500">
              <RotateCcw className="h-8 w-8 mx-auto mb-2 animate-spin" /> Đang tải kịch bản demo...
            </div>
          )}
        </div>
      </div>
    </section>
  )
}