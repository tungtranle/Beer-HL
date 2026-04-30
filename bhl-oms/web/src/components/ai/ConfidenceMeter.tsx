'use client'

interface ConfidenceMeterProps {
  value?: number
  label?: string
  dataFreshness?: string
  sampleSize?: number | string
  source?: string
  compact?: boolean
}

export function ConfidenceMeter({ value, label = 'Tin cậy', dataFreshness, sampleSize, source, compact }: ConfidenceMeterProps) {
  const normalized = typeof value === 'number' ? (value > 1 ? value / 100 : value) : undefined
  const pct = typeof normalized === 'number' ? Math.max(0, Math.min(100, Math.round(normalized * 100))) : undefined
  const tone = pct === undefined ? 'bg-slate-300' : pct >= 80 ? 'bg-emerald-500' : pct >= 55 ? 'bg-sky-500' : 'bg-amber-500'

  const meta = [
    source,
    sampleSize !== undefined ? `${sampleSize} mẫu` : undefined,
    dataFreshness,
  ].filter(Boolean)

  return (
    <div className={compact ? 'min-w-[120px]' : 'min-w-[180px]'}>
      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-600">
        <span>{label}</span>
        <span className="tabular-nums text-slate-800">{pct !== undefined ? `${pct}%` : '—'}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct ?? 0}%` }} />
      </div>
      {!compact && meta.length > 0 && (
        <div className="mt-1 truncate text-[11px] text-slate-500">{meta.join(' · ')}</div>
      )}
    </div>
  )
}