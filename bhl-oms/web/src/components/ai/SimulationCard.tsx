'use client'

import { Clock3, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ExplainabilityPopover } from './ExplainabilityPopover'

interface SimulationOption {
  id: string
  title: string
  metrics: Record<string, unknown>
  warnings: string[]
}

interface SimulationCardProps {
  title: string
  status: string
  options: SimulationOption[]
  recommendedOptionId?: string
  explanation?: string
  expiresAt?: string
  onApply?: (optionId: string) => void
  applying?: boolean
}

export function SimulationCard({ title, status, options, recommendedOptionId, explanation, expiresAt, onApply, applying }: SimulationCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FlaskConical className="h-4 w-4 text-brand-600" /> {title}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" /> {status}{expiresAt ? ` · hết hạn ${new Date(expiresAt).toLocaleTimeString('vi-VN')}` : ''}</div>
        </div>
        <ExplainabilityPopover reasons={[explanation || 'Simulation là snapshot dry-run; apply cần revalidate và approval.']} source="simulation" confidence={0.78} />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {options.map((option) => {
          const recommended = option.id === recommendedOptionId
          return (
            <div key={option.id} className={`rounded-lg border p-4 ${recommended ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900">{option.title}</h4>
                {recommended && <span className="rounded-full bg-brand-500 px-2 py-0.5 text-xs font-medium text-white">Đề xuất</span>}
              </div>
              <dl className="mt-3 space-y-1 text-xs text-slate-600">
                {Object.entries(option.metrics || {}).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3"><dt>{key}</dt><dd className="font-medium text-slate-900">{String(value)}</dd></div>
                ))}
              </dl>
              {option.warnings?.length > 0 && <div className="mt-3 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">{option.warnings.join(', ')}</div>}
              <Button className="mt-4" size="sm" variant={recommended ? 'primary' : 'secondary'} loading={applying} onClick={() => onApply?.(option.id)} fullWidth>Áp dụng {option.id}</Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}