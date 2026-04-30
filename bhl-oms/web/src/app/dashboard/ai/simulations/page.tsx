'use client'

import { useState } from 'react'
import { FlaskConical, Play } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { SimulationCard, UndoBanner } from '@/components/ai'
import { useAIFeature } from '@/hooks/useAIFeature'

interface SimulationSnapshot {
  id: string
  type: string
  status: string
  options: { id: string; title: string; metrics: Record<string, unknown>; warnings: string[] }[]
  recommended_option_id: string
  explanation: string
  expires_at: string
}

export default function AISimulationsPage() {
  const { enabled, loading: flagLoading } = useAIFeature('ai.simulation')
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const createSimulation = async () => {
    setBusy(true)
    setMessage('')
    try {
      const res: any = await apiFetch('/ai/simulations', { method: 'POST', body: { type: 'vrp_what_if', context: { vehicles_delta: 1, objective: 'balance_cost_otd' } } })
      if (res.data?.status === 'disabled') {
        setMessage(res.data.message)
        return
      }
      setSnapshot(res.data)
    } finally {
      setBusy(false)
    }
  }

  const applyOption = async (optionId: string) => {
    if (!snapshot) return
    setBusy(true)
    try {
      const res: any = await apiFetch(`/ai/simulations/${snapshot.id}/apply`, { method: 'POST', body: { option_id: optionId } })
      setSnapshot(res.data?.simulation || snapshot)
      setMessage(`Option ${optionId} đã chuyển sang approval-required. Chưa mutate bảng nghiệp vụ.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2"><FlaskConical className="h-6 w-6 text-brand-600" /> AI Simulation Lab</h1>
          <p className="mt-1 text-sm text-slate-500">Dry-run trước khi áp dụng. Snapshot hết hạn sau 5 phút và cần approval.</p>
        </div>
        <Button leftIcon={Play} onClick={createSimulation} loading={busy || flagLoading}>Chạy VRP what-if</Button>
      </div>

      {!enabled && !flagLoading && (
        <Card><CardHeader title="Simulation đang tắt" subtitle="Dispatcher vẫn dùng flow lập tuyến thủ công. Admin có thể bật ai.simulation trong Cài đặt AI." /></Card>
      )}

      {message && <UndoBanner message={message} ttlSeconds={30} />}

      {snapshot ? (
        <SimulationCard
          title={`Simulation ${snapshot.type}`}
          status={snapshot.status}
          options={snapshot.options}
          recommendedOptionId={snapshot.recommended_option_id}
          explanation={snapshot.explanation}
          expiresAt={snapshot.expires_at}
          onApply={applyOption}
          applying={busy}
        />
      ) : (
        <Card><CardHeader title="Chưa có simulation" subtitle="Bấm chạy VRP what-if để tạo snapshot dry-run." /></Card>
      )}
    </div>
  )
}