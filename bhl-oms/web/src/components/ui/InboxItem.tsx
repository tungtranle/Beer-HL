'use client'

/**
 * InboxItem — U4 Inbox pattern card.
 * Thay thế notifications phân mảnh bằng pattern persist + actionable.
 *
 * Reference: docs/specs/UX_AUDIT_AND_REDESIGN.md §3.2
 */

import { useState } from 'react'
import { Clock, User, Check, BellOff, ArrowRight, AlertTriangle, AlertCircle, Info } from 'lucide-react'

export type InboxPriority = 'P0' | 'P1' | 'P2'
export type InboxStatus = 'open' | 'snoozed' | 'done'

export interface InboxItemData {
  id: string
  priority: InboxPriority
  title: string
  description?: string
  /** Subject context, e.g. "Trip #45 · Xe 14C-1234" */
  subject?: string
  createdAt: string                 // ISO
  status: InboxStatus
  snoozeUntil?: string              // ISO, only when status='snoozed'
  /** Inline CTA */
  cta?: { label: string; onClick: () => void }
  /** Assignee (optional) */
  assignee?: string
}

interface Props {
  item: InboxItemData
  onResolve?: (id: string) => void
  onSnooze?: (id: string, minutes: number) => void
  onAssign?: (id: string) => void
  className?: string
}

const PRIORITY_STYLE: Record<InboxPriority, { border: string; bg: string; chip: string; icon: typeof AlertCircle; label: string }> = {
  P0: { border: 'border-l-red-500',   bg: 'bg-red-50',   chip: 'bg-red-100 text-red-700',     icon: AlertCircle,    label: 'Khẩn' },
  P1: { border: 'border-l-amber-500', bg: 'bg-amber-50', chip: 'bg-amber-100 text-amber-700', icon: AlertTriangle,  label: 'Cao' },
  P2: { border: 'border-l-blue-500',  bg: 'bg-blue-50',  chip: 'bg-blue-100 text-blue-700',   icon: Info,           label: 'Thông tin' },
}

const SNOOZE_OPTIONS = [
  { label: '15 phút', minutes: 15 },
  { label: '1 giờ',   minutes: 60 },
  { label: 'Cuối ngày', minutes: 240 },
]

export function InboxItem({ item, onResolve, onSnooze, onAssign, className = '' }: Props) {
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  const style = PRIORITY_STYLE[item.priority]
  const Icon = style.icon
  const isDone = item.status === 'done'

  return (
    <article
      className={`relative rounded-lg border-l-4 ${style.border} ${isDone ? 'bg-gray-50 opacity-60' : style.bg} border border-gray-200 p-3 ${className}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${
          item.priority === 'P0' ? 'text-red-600' :
          item.priority === 'P1' ? 'text-amber-600' : 'text-blue-600'
        }`} aria-hidden="true" />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${style.chip}`}>{style.label}</span>
                <h4 className={`text-sm font-medium ${isDone ? 'line-through text-gray-500' : 'text-gray-900'} truncate`}>
                  {item.title}
                </h4>
              </div>
              {item.subject && <p className="text-xs text-gray-600 mt-0.5">{item.subject}</p>}
              {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
            </div>

            <time className="text-[10px] text-gray-400 shrink-0" dateTime={item.createdAt}>
              {formatRelative(item.createdAt)}
            </time>
          </div>

          {/* Action row */}
          {!isDone && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {item.cta && (
                <button
                  type="button"
                  onClick={item.cta.onClick}
                  className="inline-flex items-center gap-1 text-xs bg-brand text-white px-2.5 h-7 rounded hover:bg-brand-500 focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {item.cta.label}
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
              {onResolve && (
                <button
                  type="button"
                  onClick={() => onResolve(item.id)}
                  className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-green-700 px-2 h-7 rounded hover:bg-white focus-visible:ring-2 focus-visible:ring-brand"
                  aria-label="Đánh dấu hoàn thành"
                >
                  <Check className="h-3 w-3" aria-hidden="true" /> Xong
                </button>
              )}
              {onSnooze && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSnoozeOpen((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-amber-700 px-2 h-7 rounded hover:bg-white focus-visible:ring-2 focus-visible:ring-brand"
                    aria-haspopup="menu"
                    aria-expanded={snoozeOpen}
                  >
                    <BellOff className="h-3 w-3" aria-hidden="true" /> Snooze
                  </button>
                  {snoozeOpen && (
                    <div role="menu" className="absolute right-0 top-8 z-10 w-32 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                      {SNOOZE_OPTIONS.map((opt) => (
                        <button
                          key={opt.minutes}
                          type="button"
                          onClick={() => { onSnooze(item.id, opt.minutes); setSnoozeOpen(false) }}
                          className="w-full text-left text-xs px-3 py-2 hover:bg-amber-50 focus-visible:bg-amber-50"
                          role="menuitem"
                        >
                          <Clock className="inline h-3 w-3 mr-1" aria-hidden="true" /> {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {onAssign && (
                <button
                  type="button"
                  onClick={() => onAssign(item.id)}
                  className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-blue-700 px-2 h-7 rounded hover:bg-white focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <User className="h-3 w-3" aria-hidden="true" /> Giao việc
                </button>
              )}
              {item.assignee && (
                <span className="text-[10px] text-gray-500 ml-auto">→ {item.assignee}</span>
              )}
            </div>
          )}

          {item.status === 'snoozed' && item.snoozeUntil && (
            <p className="text-[11px] text-amber-600 mt-1">
              <Clock className="inline h-3 w-3 mr-1" aria-hidden="true" />
              Tạm hoãn đến {formatRelative(item.snoozeUntil)}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  const diff = (t - Date.now()) / 1000
  const abs = Math.abs(diff)
  const past = diff < 0
  if (abs < 60) return past ? 'vừa xong' : 'sắp tới'
  if (abs < 3600) {
    const m = Math.round(abs / 60)
    return past ? `${m} phút trước` : `sau ${m} phút`
  }
  if (abs < 86400) {
    const h = Math.round(abs / 3600)
    return past ? `${h} giờ trước` : `sau ${h} giờ`
  }
  const d = Math.round(abs / 86400)
  return past ? `${d} ngày trước` : `sau ${d} ngày`
}
