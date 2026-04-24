'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export interface PaginationProps {
  page: number          // current page (1-based)
  limit: number         // page size
  total: number         // total items
  onPageChange: (page: number) => void
  onLimitChange?: (limit: number) => void
  pageSizeOptions?: number[]
  className?: string
}

/**
 * Reusable pagination control. Use with backend endpoints that return
 * `meta: { page, limit, total, total_pages }`.
 */
export function Pagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [20, 50, 100, 200],
  className = '',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(limit, 1)))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const fromItem = total === 0 ? 0 : (safePage - 1) * limit + 1
  const toItem = Math.min(safePage * limit, total)

  // Build a small range of page numbers around current page
  const range: (number | '…')[] = []
  const push = (n: number | '…') => {
    if (n === '…' && range[range.length - 1] === '…') return
    range.push(n)
  }
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - safePage) <= 1) push(i)
    else push('…')
  }

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-gray-600 ${className}`}>
      <div className="flex items-center gap-2">
        <span>
          Hiển thị <strong className="text-gray-900">{fromItem.toLocaleString('vi-VN')}–{toItem.toLocaleString('vi-VN')}</strong>{' '}
          / <strong className="text-gray-900">{total.toLocaleString('vi-VN')}</strong>
        </span>
        {onLimitChange && (
          <>
            <span className="text-gray-300">|</span>
            <label className="flex items-center gap-1">
              Mỗi trang
              <select
                value={limit}
                onChange={(e) => onLimitChange(Number(e.target.value))}
                className="border border-gray-200 rounded px-1.5 py-0.5 bg-white"
              >
                {pageSizeOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safePage === 1}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Trang đầu"
        >
          <ChevronsLeft size={14} />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage === 1}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Trang trước"
        >
          <ChevronLeft size={14} />
        </button>
        {range.map((n, idx) =>
          n === '…' ? (
            <span key={`ell-${idx}`} className="px-1 text-gray-400">…</span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPageChange(n)}
              className={`min-w-[28px] px-2 py-1 rounded text-xs font-semibold ${
                n === safePage
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {n}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage === totalPages}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Trang sau"
        >
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage === totalPages}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Trang cuối"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  )
}
