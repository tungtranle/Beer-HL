'use client'

/**
 * DataTable — bảng dữ liệu chuẩn với sort, sticky header, loading skeleton, empty state.
 *
 * Reference: BHL_Component_System_Proposal.md §4.3 P1
 * Replaces: ad-hoc table patterns rải rác trong 49 trang
 *
 * @example
 * <DataTable
 *   columns={[
 *     { key: 'name', label: 'Tên', sortable: true },
 *     { key: 'status', label: 'Trạng thái', render: (row) => <StatusChip status={row.status} /> },
 *   ]}
 *   data={orders}
 *   loading={loading}
 *   keyField="id"
 * />
 */

import { useState, type ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export type SortDir = 'asc' | 'desc'

export interface ColumnDef<T> {
  /** Field key trong data hoặc unique id nếu dùng render */
  key: string
  label: ReactNode
  /** Hàm render custom — nếu không có dùng `row[key]` */
  render?: (row: T, index: number) => ReactNode
  /** Cho phép sort theo cột này */
  sortable?: boolean
  /** Căn chỉnh nội dung ô */
  align?: 'left' | 'center' | 'right'
  /** Width cố định (tailwind class hoặc inline) */
  width?: string
  /** Sticky column (chỉ hỗ trợ cột đầu) */
  sticky?: boolean
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  /** Field dùng làm key cho row (bắt buộc để tránh re-render) */
  keyField: keyof T
  loading?: boolean
  /** Số skeleton rows khi loading */
  skeletonRows?: number
  /** Custom empty state */
  emptyText?: string
  emptyIcon?: ReactNode
  /** Highlight row theo điều kiện */
  rowClassName?: (row: T, index: number) => string
  /** Callback khi click row */
  onRowClick?: (row: T) => void
  /** Sort state từ ngoài (controlled) */
  sortKey?: string
  sortDir?: SortDir
  onSort?: (key: string, dir: SortDir) => void
  /** Sticky header — scroll trong container */
  stickyHeader?: boolean
  /** Max height khi sticky header */
  maxHeight?: string
  className?: string
}

const ALIGN: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

function SortIcon({ colKey, sortKey, sortDir }: { colKey: string; sortKey?: string; sortDir?: SortDir }) {
  if (sortKey !== colKey) return <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
  if (sortDir === 'asc') return <ChevronUp className="w-3.5 h-3.5 text-brand-600" />
  return <ChevronDown className="w-3.5 h-3.5 text-brand-600" />
}

export function DataTable<T>({
  columns,
  data,
  keyField,
  loading = false,
  skeletonRows = 5,
  emptyText = 'Không có dữ liệu',
  emptyIcon,
  rowClassName,
  onRowClick,
  sortKey: externalSortKey,
  sortDir: externalSortDir,
  onSort,
  stickyHeader = false,
  maxHeight = '600px',
  className = '',
}: DataTableProps<T>) {
  // Internal sort state (dùng khi không có onSort prop)
  const [internalSortKey, setInternalSortKey] = useState<string | undefined>()
  const [internalSortDir, setInternalSortDir] = useState<SortDir>('asc')

  const sortKey = externalSortKey ?? internalSortKey
  const sortDir = externalSortDir ?? internalSortDir

  const handleSort = (key: string) => {
    const newDir: SortDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'
    if (onSort) {
      onSort(key, newDir)
    } else {
      setInternalSortKey(key)
      setInternalSortDir(newDir)
    }
  }

  // Internal client-side sort (khi không dùng server sort)
  const sortedData = !onSort && sortKey
    ? [...data].sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortKey]
        const bv = (b as Record<string, unknown>)[sortKey]
        const cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'vi', { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    : data

  const wrapperClass = stickyHeader
    ? `overflow-auto border border-slate-200 rounded-lg`
    : `overflow-x-auto`

  const wrapperStyle = stickyHeader ? { maxHeight } : undefined

  return (
    <div className={`${wrapperClass} ${className}`} style={wrapperStyle}>
      <table className="min-w-full divide-y divide-slate-200">
        <thead className={`bg-slate-50 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className={[
                  'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap select-none',
                  ALIGN[col.align ?? 'left'],
                  col.sortable ? 'cursor-pointer hover:text-slate-700' : '',
                  col.sticky ? 'sticky left-0 bg-slate-50 z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,.08)]' : '',
                ].join(' ')}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && <SortIcon colKey={col.key} sortKey={sortKey} sortDir={sortDir} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {loading
            ? Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="animate-pulse">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            : sortedData.length === 0
            ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      {emptyIcon ?? (
                        <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      )}
                      <span className="text-sm">{emptyText}</span>
                    </div>
                  </td>
                </tr>
              )
            : sortedData.map((row, idx) => {
                const key = String(row[keyField])
                const extra = rowClassName?.(row, idx) ?? ''
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={[
                      'transition-colors',
                      onRowClick ? 'cursor-pointer hover:bg-brand-50' : 'hover:bg-slate-50',
                      extra,
                    ].join(' ')}
                  >
                    {columns.map((col) => {
                      const cellValue = col.render
                        ? col.render(row, idx)
                        : String((row as Record<string, unknown>)[col.key] ?? '')
                      return (
                        <td
                          key={col.key}
                          className={[
                            'px-4 py-3 text-sm text-slate-700',
                            ALIGN[col.align ?? 'left'],
                            col.sticky
                              ? 'sticky left-0 bg-white z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,.06)]'
                              : '',
                          ].join(' ')}
                        >
                          {cellValue}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
        </tbody>
      </table>
    </div>
  )
}
