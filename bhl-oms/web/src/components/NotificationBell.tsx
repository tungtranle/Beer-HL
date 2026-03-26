'use client'

import { useState, useEffect } from 'react'
import { useNotifications } from '@/lib/notifications'
import { useRouter } from 'next/navigation'
import { PersistentToast } from '@/components/notifications/PersistentToast'
import { AutoToast } from '@/components/notifications/AutoToast'

const categoryIcons: Record<string, string> = {
  success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️',
  order: '📋', delivery: '🚛', system: '🔔',
  oms: '📋', tms: '🚛', wms: '📦', rec: '💰',
  eod_checkpoint: '📋', eod_confirmed: '✅', eod_rejected: '❌',
  document_expiry: '📄',
}

const filterTabs = [
  { key: '', label: 'Tất cả' },
  { key: 'oms', label: 'OMS' },
  { key: 'tms', label: 'TMS' },
  { key: 'wms', label: 'WMS' },
  { key: 'rec', label: 'Đối soát' },
  { key: 'system', label: 'Hệ thống' },
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

export function NotificationBell() {
  const {
    notifications, unreadCount, markRead, markAllRead,
    urgentToasts, autoToast, dismissUrgentToast, dismissAutoToast,
  } = useNotifications()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const router = useRouter()

  // Lock body scroll when panel is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
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

  const filtered = filter
    ? notifications.filter(n => n.category === filter)
    : notifications

  return (
    <>
      {/* 4-layer toast rendering */}
      <PersistentToast notifications={urgentToasts} onDismiss={dismissUrgentToast} />
      <AutoToast notification={autoToast} onDismiss={dismissAutoToast} />

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
          <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#F68634] text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Overlay + Slide-in Panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20 animate-fade-in"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
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

            {/* Filter chips */}
            <div className="px-5 py-2.5 border-b border-gray-100 flex gap-1.5 overflow-x-auto styled-scrollbar">
              {filterTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
                    filter === tab.key
                      ? 'bg-[#F68634] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Notifications list */}
            <div className="flex-1 overflow-y-auto styled-scrollbar">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                  <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-sm">{filter ? 'Không có thông báo trong mục này' : 'Chưa có thông báo'}</p>
                </div>
              ) : (
                <div>
                  {filtered.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-colors border-b border-gray-50 ${
                        !n.is_read
                          ? 'bg-orange-50/60 hover:bg-orange-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Category icon */}
                      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm ${
                        !n.is_read ? 'bg-orange-100' : 'bg-gray-100'
                      }`}>
                        {categoryIcons[n.category] || '🔔'}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                            {n.title}
                          </p>
                          {n.priority === 'urgent' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-100 text-red-700">Khẩn</span>
                          )}
                        </div>
                        <p className="text-[13px] text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>
                        <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                      </div>

                      {/* Unread dot — brand color */}
                      {!n.is_read && (
                        <div className="flex-shrink-0 mt-1.5">
                          <span className="block w-2 h-2 rounded-full bg-[#F68634]" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
