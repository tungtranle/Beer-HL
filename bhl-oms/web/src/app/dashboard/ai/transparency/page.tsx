'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { AIStatusBadge } from '@/components/ai'

interface ProviderStatus {
  name: string
  route: 'cloud' | 'local' | 'rules' | 'blocked'
  available: boolean
  reason?: string
}

interface TransparencySnapshot {
  generated_at: string
  flags: Record<string, boolean>
  providers: ProviderStatus[]
  guardrails: string[]
  cost_mode: string
}

export default function AITransparencyPage() {
  const [snapshot, setSnapshot] = useState<TransparencySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res: any = await apiFetch('/ai/transparency')
      setSnapshot(res.data)
    } catch (err: any) {
      setError(err.message || 'Không tải được Transparency Center')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-brand-600" /> AI Transparency Center</h1>
          <p className="mt-1 text-sm text-slate-500">Trạng thái provider, flag và guardrail. AI OFF không làm mất baseline workflow.</p>
        </div>
        <Button variant="secondary" leftIcon={RefreshCw} onClick={load} loading={loading}>Tải lại</Button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        {snapshot?.providers.map((provider) => (
          <Card key={provider.name}>
            <CardHeader title={provider.name} subtitle={provider.reason || provider.route} />
            <AIStatusBadge enabled={provider.available} label="Provider" route={provider.route} />
          </Card>
        ))}
        {!snapshot && !loading && <Card><CardHeader title="Chưa có dữ liệu" subtitle="Thử tải lại hoặc kiểm tra backend." /></Card>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Guardrails" subtitle={snapshot?.cost_mode || 'free-tier-first'} />
          <div className="space-y-2">
            {(snapshot?.guardrails || []).map((item) => (
              <div key={item} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{item}</div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Effective Flags" subtitle={snapshot ? new Date(snapshot.generated_at).toLocaleString('vi-VN') : ''} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Object.entries(snapshot?.flags || {}).map(([key, enabled]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-xs">
                <span className="font-mono text-slate-600">{key}</span>
                <span className={enabled ? 'font-semibold text-brand-700' : 'text-slate-400'}>{enabled ? 'ON' : 'OFF'}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}