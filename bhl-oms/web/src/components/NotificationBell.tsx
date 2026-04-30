'use client'

import { useState, useEffect, useMemo } from 'react'
import { useNotifications } from '@/lib/notifications'
import { useRouter } from 'next/navigation'
import { PersistentToast } from '@/components/notifications/PersistentToast'
import { AutoToast } from '@/components/notifications/AutoToast'

const categoryIcons: Record<string, string> = {
  success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️',
  order: '📋', delivery: '🚛', system: '🔔',
  trip: '🚛', eod: '📋', reconciliation: '💰', finance: '💰',
  oms: '📋', tms: '🚛', wms: '📦', rec: '💰',
  document: '📄', asset: '🔧', incident: '⚠️', kpi: '📊',
  eod_checkpoint: '📋', eod_confirmed: '✅', eod_rejected: '❌',
  document_expiry: '📄',
}

// Priority left-border color: inline style for dynamic classes (avoids Tailwind purge)
const priorityBorderStyle: Record<string, React.CSSProperties> = {
  urgent: { borderLeftWidth: 4, borderLeftColor: '#ef4444', borderLeftStyle: 'solid' },
  high:   { borderLeftWidth: 4, borderLeftColor: '#f97316', borderLeftStyle: 'solid' },
  normal: { borderLeftWidth: 2, borderLeftColor: '#e5e7eb', borderLeftStyle: 'solid' },
  low:    { borderLeftWidth: 2, borderLeftColor: '#f3f4f6', borderLeftStyle: 'solid' },
}

const filterTabs = [
  { key: '', label: 'Tất cả' },
  { key: 'order', label: 'Đơn hàng' },
  { key: 'trip', label: 'Chuyến' },
  { key: 'eod', label: 'EoD' },
  { key: 'reconciliation', label: 'Đối soát' },
  { key: 'finance', label: 'Tài chính' },
]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return `${mins}p trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h trước`
  if (hours < 48) return 'Hôm qua'
  return `${Math.floor(hours / 24)}d trước`
}

function isToday(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function isYesterday(dateStr: string) {
  const d = new Date(dateStr)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate()
}

function isThisWeek(dateStr: string) {
  const d = new Date(dateStr).getTime()
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  return d >= weekAgo
}

export function NotificationBell() {
  const {
    notifications, unreadCount, markRead, markAllRead, acknowledge,
    urgentToasts, autoToast, autoToastQueueCount, dismissUrgentToast, dismissAutoToast,
  } = useNotifications()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const router = useRouter()

  const hasUrgentUnread = notifications.some(n => !n.is_read && n.priority === 'urgent')

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const handleClick = (n: any) => {
    if (!n.is_read) markRead(n.id)
    if (n.link) {
      const path = n.link.startsWith('/dashboard') ? n.link : `/dashboard${n.link}`
      router.push(path)
    }
    setOpen(false)
  }

  const handleAcknowledge = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    acknowledge(id)
  }

  // Filter by category + search
  const filtered = useMemo(() => {
    let list = filter ? notifications.filter(n => n.category === filter) : notifications
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
    }
    return list
  }, [notifications, filter, search])

  // Time sections
  const sections = useMemo(() => {
    const today: typeof filtered = []
    const yesterday: typeof filtered = []
    const thisWeek: typeof filtered = []
    const older: typeof filtered = []
    for (const n of filtered) {
      if (isToday(n.created_at)) today.push(n)
      else if (isYesterday(n.created_at)) yesterday.push(n)
      else if (isThisWeek(n.created_at)) thisWeek.push(n)
      else older.push(n)
    }
    return [
      { label: 'Hôm nay', items: today },
      { label: 'Hôm qua', items: yesterday },
      { label: 'Tuần này', items: thisWeek },
      { label: 'Cũ hơn', items: older },
    ].filter(s => s.items.length > 0)
  }, [filtered])

  return (
    <>
      {/* 4-layer toast rendering */}
      <PersistentToast
        notifications={urgentToasts}
        onDismiss={dismissUrgentToast}
        onAcknowledge={acknowledge}
      />
      <AutoToast notification={autoToast} onDismiss={dismissAutoToast} queueCount={autoToastQueueCount} />

      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
        title="Thông báo"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className={`absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white ${
            hasUrgentUnread ? 'bg-red-600' : 'bg-[#F68634]'
          }`}>
            {unreadCount > 9 ? '9+' : unreadCount}
            {hasUrgentUnread && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
            )}
          </span>
        )}
      </button>

      {/* Overlay + Slide-in Panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20 animate-fade-in" onClick={() => setOpen(false)} />

          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-panel-in">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Thông báo</h2>
                {unreadCount > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">{unreadCount} chưa đọc</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead()}
                    className="text-xs text-[#F68634] hover:text-[#e5762a] font-medium px-2 py-1 rounded hover:bg-orange-50 transition"
                  >
                    Đọc hết
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Search bar */}
            <div className="px-5 pt-3 pb-1">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm trong thông báo..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F68634]/30 focus:border-[#F68634]"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Filter chips */}
            <div className="px-5 py-2.5 border-b border-gray-100 flex gap-1.5 overflow-x-auto styled-scrollbar">
              {filterTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
                    filter === tab.key ? 'bg-[#F68634] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Notifications list with time sections */}
            <div className="flex-1 overflow-y-auto styled-scrollbar">
              {sections.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                  <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-sm">{filter || search ? 'Không tìm thấy thông báo' : 'Chưa có thông báo'}</p>
                </div>
              ) : (
                sections.map(section => (
                  <div key={section.label}>
                    {/* Section header */}
                    <div className="sticky top-0 z-10 px-5 py-1.5 bg-gray-50/95 backdrop-blur-sm border-b border-gray-100">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{section.label}</span>
                    </div>

                    {section.items.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleClick(n)}
                        style={priorityBorderStyle[n.priority] || priorityBorderStyle.normal}
                        className={`flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-colors border-b border-gray-50 ${
                          !n.is_read ? 'bg-orange-50/60 hover:bg-orange-50' : 'hover:bg-gray-50'
                        } ${n.resolved_at ? 'opacity-60' : ''}`}
                      >
                        {/* Category icon */}
                        <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm ${
                          !n.is_read ? 'bg-orange-100' : 'bg-gray-100'
                        }`}>
                          {categoryIcons[n.category] || '🔔'}
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                              {n.title}
                            </p>
                            {n.priority === 'urgent' && !n.is_acknowledged && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-100 text-red-700">Khẩn</span>
                            )}
                            {n.is_acknowledged && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-green-100 text-green-700">
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                Đã xử lý
                              </span>
                            )}
                            {n.resolved_at && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-100 text-gray-500">Đã giải quyết</span>
                            )}
                          </div>
                          <p className="text-[13px] text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>
                          <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                        </div>

                        {/* Right side: unread dot + ACK button for urgent */}
                        <div className="flex-shrink-0 flex flex-col items-center gap-2 mt-1">
                          {!n.is_read && (
                            <span className="block w-2 h-2 rounded-full bg-[#F68634]" />
                          )}
                          {n.priority === 'urgent' && !n.is_acknowledged && n.is_read && (
                            <button
                              onClick={(e) => handleAcknowledge(e, n.id)}
                              className="text-[10px] font-medium text-green-600 hover:text-green-700 hover:bg-green-50 px-1.5 py-1 rounded transition whitespace-nowrap"
                              title="Đánh dấu đã xử lý"
                            >
                              ✓ Xử lý
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-5 py-3">
              <button
                onClick={() => { router.push('/dashboard/notifications'); setOpen(false) }}
                className="w-full text-center text-sm text-[#F68634] hover:text-[#e5762a] font-medium py-1.5 rounded-lg hover:bg-orange-50 transition"
              >
                Xem tất cả thông báo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
