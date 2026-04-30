'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { Pagination } from '@/components/ui/Pagination'

// ── Types ──
interface Notification {
  id: string; title: string; body: string
  category: string; priority: string
  link?: string; entity_type?: string; entity_id?: string
  is_read: boolean; created_at: string
  group_key?: string
  actions?: { label: string; action: string }[]
}

type View = 'center' | 'settings'
type CategoryFilter = 'all' | 'order' | 'trip' | 'reconciliation' | 'eod' | 'finance'

// ── Category badges ──
const CATEGORY_BADGE: Record<string, { icon: string; label: string; color: string }> = {
  order:          { icon: 'ĐH', label: 'Đơn hàng',    color: 'bg-green-100 text-green-700' },
  trip:           { icon: 'VC', label: 'Vận chuyển',  color: 'bg-blue-100 text-blue-700' },
  reconciliation: { icon: 'ĐS', label: 'Đối soát',    color: 'bg-purple-100 text-purple-700' },
  eod:            { icon: 'EoD', label: 'EoD',         color: 'bg-amber-100 text-amber-700' },
  finance:        { icon: 'KT', label: 'Tài chính',   color: 'bg-orange-100 text-orange-700' },
  document:       { icon: 'TL', label: 'Tài liệu',    color: 'bg-gray-100 text-gray-700' },
  incident:       { icon: '⚠', label: 'Sự cố',        color: 'bg-red-100 text-red-700' },
  asset:          { icon: '', label: 'Thiết bị',    color: 'bg-gray-100 text-gray-600' },
  kpi:            { icon: '', label: 'KPI',          color: 'bg-indigo-100 text-indigo-700' },
  system:         { icon: 'HT', label: 'Hệ thống',    color: 'bg-gray-100 text-gray-700' },
}

// ── Priority left-border ──
const PRIORITY_BORDER: Record<string, string> = {
  urgent: 'border-l-4 border-l-red-500',
  high:   'border-l-4 border-l-amber-500',
  normal: 'border-l-4 border-l-blue-400',
  low:    'border-l-4 border-l-gray-300',
}

// ── Settings event list ──
const SETTINGS_EVENTS = [
  'Đơn chờ duyệt hạn mức', 'Xác nhận chuyển khoản', 'Trip hoàn thành',
  'Sai lệch đối soát', 'DLQ lỗi tích hợp', 'Hàng cận date',
]

// ── Helpers ──
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'vừa xong'
  if (mins < 60) return `${mins} phút`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ`
  return `${Math.floor(hours / 24)}d`
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function navigateLink(link: string) {
  if (link.startsWith('/dashboard')) return link
  return `/dashboard${link}`
}

function mergeGroups(notifs: Notification[]): { grouped: boolean; items: Notification[]; key: string | null }[] {
  const groupKeyMap: Record<string, Notification[]> = {}
  const processedGroupKeys: Record<string, boolean> = {}
  const result: { grouped: boolean; items: Notification[]; key: string | null }[] = []

  for (const n of notifs) {
    if (n.group_key) {
      const arr = groupKeyMap[n.group_key] || []
      arr.push(n)
      groupKeyMap[n.group_key] = arr
    }
  }

  for (const n of notifs) {
    if (n.group_key) {
      if (processedGroupKeys[n.group_key]) continue
      processedGroupKeys[n.group_key] = true
      const groupItems = groupKeyMap[n.group_key]!
      result.push({ grouped: groupItems.length > 1, items: groupItems, key: n.group_key })
    } else {
      result.push({ grouped: false, items: [n], key: null })
    }
  }
  return result
}

function groupByTime(notifs: Notification[]) {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 3600000)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const groups: { label: string; items: Notification[] }[] = [
    { label: 'Ngay bây giờ', items: [] },
    { label: 'Hôm nay', items: [] },
    { label: 'Trước đó', items: [] },
  ]

  for (const n of notifs) {
    const d = new Date(n.created_at)
    if (d >= oneHourAgo) groups[0].items.push(n)
    else if (d >= todayStart) groups[1].items.push(n)
    else groups[2].items.push(n)
  }
  return groups.filter(g => g.items.length > 0)
}

export default function NotificationsPage() {
  const router = useRouter()
  const [view, setView] = useState<View>('center')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<CategoryFilter>('all')
  const [unreadCount, setUnreadCount] = useState(0)
  const [settingsToggles, setSettingsToggles] = useState<Record<string, Record<string, boolean>>>({})
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [totalRows, setTotalRows] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const categoryParam = filter !== 'all' ? `&category=${filter}` : ''
      const res = await apiFetch<any>(`/notifications?page=${page}&limit=${limit}${categoryParam}`)
      setNotifications(res.data || [])
      setTotalRows(res.meta?.total ?? 0)
    } catch { /* ignore */ }
    try {
      const res = await apiFetch<any>('/notifications/unread-count')
      setUnreadCount(res.data?.unread_count || 0)
    } catch { /* ignore */ }
    setLoading(false)
  }, [page, limit, filter])

  useEffect(() => { load() }, [load])

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'POST' })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch { /* ignore */ }
  }

  const markAllRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'POST' })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch { /* ignore */ }
  }

  const handleClick = (n: Notification) => {
    if (!n.is_read) markRead(n.id)
    if (n.link) router.push(navigateLink(n.link))
  }

  const toggleSetting = (event: string, channel: string) => {
    setSettingsToggles(prev => ({
      ...prev,
      [event]: { ...(prev[event] || {}), [channel]: !(prev[event]?.[channel]) }
    }))
  }

  const setFilterAndReset = (f: CategoryFilter) => {
    setFilter(f)
    setPage(1)
  }

  // Search is client-side within current page
  const displayedNotifications = searchQuery
    ? notifications.filter(n =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.body.toLowerCase().includes(searchQuery.toLowerCase()))
    : notifications

  return (
    <div className="max-w-4xl mx-auto">
      {/* ═══════ Notification Center ═══════ */}
      {view === 'center' && (
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Thông báo</h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">{unreadCount}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead}
                  className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                  Đánh dấu tất cả đã đọc
                </button>
              )}
              <button
                onClick={() => setView('settings')}
                className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                Cài đặt
              </button>
            </div>
          </div>

          {/* Search + Category filters */}
          <div className="flex flex-col gap-3 mb-5">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Tìm theo tiêu đề, nội dung..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F68634]/40 focus:border-[#F68634] transition"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {([
                { key: 'all' as CategoryFilter,           label: 'Tất cả' },
                { key: 'order' as CategoryFilter,         label: 'Đơn hàng' },
                { key: 'trip' as CategoryFilter,          label: 'Vận chuyển' },
                { key: 'reconciliation' as CategoryFilter, label: 'Đối soát' },
                { key: 'eod' as CategoryFilter,           label: 'EoD' },
                { key: 'finance' as CategoryFilter,       label: 'Tài chính' },
              ]).map(f => (
                <button key={f.key} onClick={() => setFilterAndReset(f.key)}
                  className={`px-3.5 py-1.5 text-sm rounded-lg border transition ${
                    filter === f.key
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notification list */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F68634]"></div>
            </div>
          ) : displayedNotifications.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-4xl mb-3"></p>
              {searchQuery ? (
                <>
                  <p className="text-gray-700 font-medium">Không tìm thấy kết quả</p>
                  <p className="text-gray-400 text-sm mt-1">cho &ldquo;{searchQuery}&rdquo;</p>
                  <button onClick={() => setSearchQuery('')} className="mt-3 text-sm text-[#F68634] hover:underline">Xóa tìm kiếm</button>
                </>
              ) : filter !== 'all' ? (
                <p className="text-gray-500">Không có thông báo nào trong mục này</p>
              ) : (
                <p className="text-gray-500">Chưa có thông báo nào</p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {groupByTime(displayedNotifications).map(group => (
                <div key={group.label}>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{group.label}</p>
                  <div className="space-y-2">
                    {mergeGroups(group.items).map(({ grouped, items, key }) => {
                      const n = items[0]
                      const isExpanded = key ? expandedGroups.has(key) : false
                      const cat = CATEGORY_BADGE[n.category] || CATEGORY_BADGE.system
                      const borderClass = PRIORITY_BORDER[n.priority] || PRIORITY_BORDER.normal
                      return (
                        <div key={n.id} className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${borderClass}`}>
                          <div
                            onClick={() => handleClick(n)}
                            className={`p-4 cursor-pointer hover:shadow-md transition ${!n.is_read ? 'bg-amber-50/30' : ''}`}>
                            <div className="flex items-start gap-3">
                              <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${cat.color}`}>
                                {cat.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className={`text-sm font-semibold ${!n.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                                    {n.title}
                                  </span>
                                  {n.priority === 'urgent' && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700">Khẩn</span>
                                  )}
                                  {n.priority === 'high' && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-700">Cần duyệt</span>
                                  )}
                                  {grouped && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-600 border border-blue-200">
                                      {items.length} cập nhật
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 leading-relaxed">{n.body}</p>
                                {(n.priority === 'urgent' || n.priority === 'high') && n.link && (
                                  <div className="flex gap-2 mt-2.5">
                                    <button className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                                      onClick={e => { e.stopPropagation(); router.push(navigateLink(n.link!)) }}>
                                      Xem chi tiết
                                    </button>
                                  </div>
                                )}
                              </div>
                              <span
                                className="text-xs text-gray-400 whitespace-nowrap shrink-0 cursor-default"
                                title={formatDateTime(n.created_at)}
                              >
                                {timeAgo(n.created_at)}
                              </span>
                            </div>
                          </div>

                          {grouped && (
                            <>
                              <button
                                onClick={() => setExpandedGroups(prev => {
                                  const next = new Set(prev)
                                  if (next.has(key!)) next.delete(key!)
                                  else next.add(key!)
                                  return next
                                })}
                                className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 border-t border-gray-100 transition text-xs text-gray-500 font-medium"
                              >
                                <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                                {isExpanded ? 'Thu gọn' : `Xem ${items.length - 1} cập nhật trước`}
                              </button>
                              {isExpanded && items.slice(1).map(sub => {
                                const subCat = CATEGORY_BADGE[sub.category] || CATEGORY_BADGE.system
                                return (
                                  <div key={sub.id}
                                    onClick={() => { if (!sub.is_read) markRead(sub.id); if (sub.link) router.push(navigateLink(sub.link)) }}
                                    className={`flex items-start gap-3 px-4 py-3 border-t border-gray-100 cursor-pointer transition hover:bg-gray-50 ${!sub.is_read ? 'bg-amber-50/20' : 'bg-gray-50/50'}`}>
                                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${subCat.color} opacity-70`}>
                                      {subCat.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-xs ${!sub.is_read ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{sub.title}</p>
                                      <p className="text-xs text-gray-500 mt-0.5">{sub.body}</p>
                                    </div>
                                    <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0" title={formatDateTime(sub.created_at)}>
                                      {timeAgo(sub.created_at)}
                                    </span>
                                  </div>
                                )
                              })}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && totalRows > 0 && (
            <div className="mt-4 bg-white rounded-xl border border-gray-200">
              <Pagination page={page} limit={limit} total={totalRows}
                onPageChange={setPage}
                onLimitChange={(n) => { setLimit(n); setPage(1) }} />
            </div>
          )}
        </div>
      )}

      {/* ═══════ Cài đặt thông báo ═══════ */}
      {view === 'settings' && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => setView('center')} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Quay lại
            </button>
            <h2 className="text-lg font-semibold text-gray-900">Cài đặt thông báo</h2>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Tự cài đặt nhận thông báo nào, qua kênh nào — hệ thống ghi nhớ theo role mặc định.
          </p>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Sự kiện</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-500 w-20">Web</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-500 w-20">App push</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-500 w-20">Digest</th>
                  <th className="text-center py-3 px-3 font-medium text-gray-500 w-20">Snooze</th>
                </tr>
              </thead>
              <tbody>
                {SETTINGS_EVENTS.map(evt => (
                  <tr key={evt} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-gray-700">{evt}</td>
                    {['web', 'push', 'digest', 'snooze'].map(ch => (
                      <td key={ch} className="text-center py-3 px-3">
                        <button
                          onClick={() => toggleSetting(evt, ch)}
                          className={`w-10 h-5 rounded-full transition relative ${
                            settingsToggles[evt]?.[ch] ? 'bg-[#F68634]' : 'bg-gray-300'
                          }`}>
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            settingsToggles[evt]?.[ch] ? 'translate-x-5' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Digest: gộp thông báo P3 thành 1 web notification theo giờ. Snooze: tạm dừng loại thông báo trong 1 giờ khi đang bận.
          </p>
        </div>
      )}
    </div>
  )
}