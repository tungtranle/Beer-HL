'use client'

/**
 * DateRangePicker — chọn khoảng ngày với presets.
 * Pure HTML date inputs + preset buttons. Không cần thư viện ngoài.
 *
 * Reference: BHL_Component_System_Proposal.md §4.3 P1
 *
 * @example
 * <DateRangePicker
 *   from={from}
 *   to={to}
 *   onChange={(f, t) => { setFrom(f); setTo(t) }}
 * />
 */

import { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronDown, X } from 'lucide-react'

export interface DateRange {
  from: string // YYYY-MM-DD
  to: string   // YYYY-MM-DD
}

interface DateRangePickerProps {
  from?: string
  to?: string
  onChange: (from: string, to: string) => void
  /** Placeholder khi chưa chọn */
  placeholder?: string
  /** Ẩn presets */
  hidePresets?: boolean
  /** Tên bộ preset hiển thị trước */
  defaultPreset?: PresetKey
  className?: string
}

type PresetKey = 'today' | 'yesterday' | 'week' | 'last7' | 'last30' | 'month' | 'lastMonth'

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today',     label: 'Hôm nay' },
  { key: 'yesterday', label: 'Hôm qua' },
  { key: 'last7',     label: '7 ngày qua' },
  { key: 'last30',    label: '30 ngày qua' },
  { key: 'week',      label: 'Tuần này' },
  { key: 'month',     label: 'Tháng này' },
  { key: 'lastMonth', label: 'Tháng trước' },
]

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function resolvePreset(key: PresetKey): DateRange {
  const now = new Date()
  const today = fmt(now)

  switch (key) {
    case 'today': return { from: today, to: today }
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1)
      return { from: fmt(y), to: fmt(y) }
    }
    case 'last7': {
      const s = new Date(now); s.setDate(s.getDate() - 6)
      return { from: fmt(s), to: today }
    }
    case 'last30': {
      const s = new Date(now); s.setDate(s.getDate() - 29)
      return { from: fmt(s), to: today }
    }
    case 'week': {
      const d = now.getDay()
      const mon = new Date(now); mon.setDate(now.getDate() - ((d + 6) % 7))
      return { from: fmt(mon), to: today }
    }
    case 'month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: fmt(s), to: today }
    }
    case 'lastMonth': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const e = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: fmt(s), to: fmt(e) }
    }
  }
}

function formatDisplay(from?: string, to?: string): string {
  if (!from && !to) return ''
  if (from === to) return from || ''
  return `${from ?? '?'} – ${to ?? '?'}`
}

export function DateRangePicker({
  from = '',
  to = '',
  onChange,
  placeholder = 'Chọn khoảng ngày',
  hidePresets = false,
  className = '',
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Derived display
  const display = formatDisplay(from, to)
  const hasValue = !!(from || to)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const applyPreset = (key: PresetKey) => {
    const { from: f, to: t } = resolvePreset(key)
    onChange(f, t)
    setOpen(false)
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('', '')
  }

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={[
          'inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg bg-white transition-colors',
          open
            ? 'border-brand-500 ring-2 ring-brand-500/20 text-slate-800'
            : 'border-slate-200 text-slate-600 hover:border-slate-300',
        ].join(' ')}
      >
        <Calendar className="w-4 h-4 flex-shrink-0 text-slate-400" />
        <span className={hasValue ? 'text-slate-800' : 'text-slate-400'}>
          {display || placeholder}
        </span>
        {hasValue ? (
          <X
            className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 flex-shrink-0"
            onClick={clear}
          />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1.5 left-0 bg-white border border-slate-200 rounded-xl shadow-lg p-4 min-w-[280px]">
          {/* Date inputs */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Từ ngày</label>
              <input
                type="date"
                value={from}
                onChange={(e) => onChange(e.target.value, to)}
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
            </div>
            <span className="text-slate-300 mt-4">–</span>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Đến ngày</label>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => onChange(from, e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
            </div>
          </div>

          {/* Presets */}
          {!hidePresets && (
            <>
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-400 mb-2">Nhanh</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => {
                    const resolved = resolvePreset(p.key)
                    const active = from === resolved.from && to === resolved.to
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => applyPreset(p.key)}
                        className={[
                          'text-xs px-2.5 py-1 rounded-full border transition-colors',
                          active
                            ? 'bg-brand-500 text-white border-brand-500'
                            : 'border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-600',
                        ].join(' ')}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { onChange('', ''); setOpen(false) }}
              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Xóa
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm bg-brand-500 text-white px-3 py-1.5 rounded-lg hover:bg-brand-600 transition-colors"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
