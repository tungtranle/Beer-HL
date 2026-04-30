'use client'

/**
 * Tabs — tab bar + panels.
 * Replaces: 21 file tự implement tab bằng setTab ad-hoc.
 *
 * Usage:
 *   const [tab, setTab] = useState('orders')
 *   <Tabs tabs={[{ key: 'orders', label: 'Đơn hàng' }]} activeKey={tab} onChange={setTab} />
 *   {tab === 'orders' && <OrdersPanel />}
 *
 * Reference: BHL_Component_System_Proposal.md §4.2 P0
 */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface TabItem {
  key: string
  label: string
  icon?: LucideIcon
  /** Number badge (e.g. pending count) */
  badge?: number
  disabled?: boolean
}

interface TabsProps {
  tabs: TabItem[]
  activeKey: string
  onChange: (key: string) => void
  /** 'line' (underline) | 'pill' (rounded buttons) */
  variant?: 'line' | 'pill'
  className?: string
  children?: ReactNode
}

export function Tabs({ tabs, activeKey, onChange, variant = 'line', className = '' }: TabsProps) {
  if (variant === 'pill') {
    return (
      <div
        role="tablist"
        className={`flex gap-1 p-1 bg-slate-100 rounded-xl ${className}`}
      >
        {tabs.map((t) => {
          const Icon = t.icon
          const active = t.key === activeKey
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              disabled={t.disabled}
              onClick={() => onChange(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition
                ${active
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70'
                  : 'text-slate-500 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
            >
              {Icon && <Icon size={14} aria-hidden="true" />}
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none
                    ${active ? 'bg-brand-500 text-white' : 'bg-slate-300 text-slate-600'}`}
                >
                  {t.badge > 99 ? '99+' : t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // variant='line' (default)
  return (
    <div
      role="tablist"
      className={`flex border-b border-slate-200 gap-0 ${className}`}
    >
      {tabs.map((t) => {
        const Icon = t.icon
        const active = t.key === activeKey
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            disabled={t.disabled}
            onClick={() => onChange(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px
              ${active
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
          >
            {Icon && <Icon size={14} aria-hidden="true" />}
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none
                  ${active ? 'bg-brand-500 text-white' : 'bg-slate-200 text-slate-600'}`}
              >
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
