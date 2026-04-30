'use client'

/**
 * FilterBar — thanh lọc tiêu chuẩn: search + status dropdown + date range + reset.
 *
 * Reference: BHL_Component_System_Proposal.md §4.3 P1
 *
 * @example
 * <FilterBar
 *   search={q}
 *   onSearchChange={setQ}
 *   statusOptions={[{ value: 'confirmed', label: 'Đã xác nhận' }]}
 *   status={status}
 *   onStatusChange={setStatus}
 *   dateFrom={from}
 *   dateTo={to}
 *   onDateChange={(f, t) => { setFrom(f); setTo(t) }}
 * />
 */

import { Search, X, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'

export interface FilterOption {
  value: string
  label: string
}

interface FilterBarProps {
  /** Search text */
  search?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string

  /** Status / type dropdown */
  statusOptions?: FilterOption[]
  status?: string
  onStatusChange?: (v: string) => void
  statusPlaceholder?: string

  /** Date range (YYYY-MM-DD) */
  dateFrom?: string
  dateTo?: string
  onDateChange?: (from: string, to: string) => void
  /** Label cho cột date (default: "Từ ngày / Đến ngày") */
  dateLabel?: string

  /** Extra filter slot (custom content) */
  extra?: ReactNode

  /** Reset button — hidden nếu không có filter active */
  onReset?: () => void
  /** Có filter đang active không (để hiện nút reset) */
  hasActiveFilter?: boolean

  className?: string
}

export function FilterBar({
  search = '',
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm...',
  statusOptions,
  status = '',
  onStatusChange,
  statusPlaceholder = 'Tất cả trạng thái',
  dateFrom = '',
  dateTo = '',
  onDateChange,
  dateLabel,
  extra,
  onReset,
  hasActiveFilter,
  className = '',
}: FilterBarProps) {
  const showReset = hasActiveFilter ?? (!!(search || status || dateFrom || dateTo))

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Search */}
      {onSearchChange !== undefined && (
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-slate-400"
          />
        </div>
      )}

      {/* Status dropdown */}
      {statusOptions && onStatusChange && (
        <div className="relative">
          <SlidersHorizontal className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="pl-7 pr-7 py-2 text-sm border border-slate-200 rounded-lg bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 text-slate-700 cursor-pointer"
          >
            <option value="">{statusPlaceholder}</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {/* Chevron */}
          <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      )}

      {/* Date range */}
      {onDateChange && (
        <div className="flex items-center gap-1.5">
          {dateLabel && <span className="text-xs text-slate-500 whitespace-nowrap">{dateLabel}</span>}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateChange(e.target.value, dateTo)}
            className="py-2 px-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 text-slate-700"
          />
          <span className="text-slate-400 text-sm">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateChange(dateFrom, e.target.value)}
            min={dateFrom}
            className="py-2 px-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 text-slate-700"
          />
        </div>
      )}

      {/* Extra slot */}
      {extra}

      {/* Reset */}
      {showReset && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Xóa bộ lọc
        </button>
      )}
    </div>
  )
}
