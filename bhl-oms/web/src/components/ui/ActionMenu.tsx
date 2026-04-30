'use client'

/**
 * ActionMenu — dropdown menu với trigger button.
 * Replaces: 22 `absolute bg-white shadow-lg` ad-hoc dropdown.
 *
 * Reference: BHL_Component_System_Proposal.md §4.3 P1
 *
 * @example
 * <ActionMenu
 *   items={[
 *     { label: 'Xem chi tiết', icon: Eye, onClick: () => router.push(`/orders/${id}`) },
 *     { label: 'Sửa', icon: Pencil, onClick: () => setEditOpen(true) },
 *     { separator: true },
 *     { label: 'Hủy đơn', icon: Trash2, danger: true, onClick: () => setConfirm(true) },
 *   ]}
 * />
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'

export type ActionMenuItem =
  | {
      label: string
      icon?: LucideIcon
      onClick: () => void
      danger?: boolean
      disabled?: boolean
      separator?: never
    }
  | { separator: true; label?: never; icon?: never; onClick?: never; danger?: never; disabled?: never }

interface ActionMenuProps {
  items: ActionMenuItem[]
  /** Custom trigger — mặc định là icon ⋯ */
  trigger?: ReactNode
  /** Menu mở về hướng nào */
  align?: 'left' | 'right'
  className?: string
}

export function ActionMenu({ items, trigger, align = 'right', className = '' }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  const alignClass = align === 'right' ? 'right-0' : 'left-0'

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((p) => !p) }}
        aria-haspopup="true"
        aria-expanded={open}
        className={[
          'p-1.5 rounded-lg transition-colors',
          open
            ? 'bg-brand-100 text-brand-700'
            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
        ].join(' ')}
      >
        {trigger ?? <MoreHorizontal className="w-4 h-4" />}
      </button>

      {/* Menu */}
      {open && (
        <div
          className={[
            'absolute z-50 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1',
            alignClass,
          ].join(' ')}
          role="menu"
        >
          {items.map((item, idx) => {
            if ('separator' in item && item.separator) {
              return <div key={idx} className="my-1 border-t border-slate-100" />
            }
            const Icon = item.icon
            return (
              <button
                key={idx}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => { item.onClick(); setOpen(false) }}
                className={[
                  'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                  item.disabled
                    ? 'opacity-40 cursor-not-allowed text-slate-500'
                    : item.danger
                    ? 'text-rose-600 hover:bg-rose-50'
                    : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700',
                ].join(' ')}
              >
                {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
