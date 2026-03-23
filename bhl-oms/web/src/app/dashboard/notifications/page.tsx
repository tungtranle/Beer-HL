'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'

// ── Types ──
interface Notification {
  id: string; title: string; body: string
  category: string; priority: string
  link?: string; entity_type?: string; entity_id?: string
  is_read: boolean; created_at: string
  actions?: { label: string; action: string }[]
}

type Tab = 'architecture' | 'center' | 'routing' | 'settings' | 'escalation'
type CategoryFilter = 'all' | 'order' | 'delivery' | 'recon' | 'system'

// ── Priority config (ảnh 1) ──
const PRIORITY = {
  P0: { label: 'P0 — Critical', title: 'Yêu cầu xử lý ngay', color: 'bg-red-50 border-red-200 text-red-700', badge: 'bg-red-600',
    examples: 'Gate check fail, xe tai nạn, sai lệch hàng tại cổng, DLQ hết retry',
    channels: ['Web popup', 'App push', 'SMS fallback'] },
  P1: { label: 'P1 — Urgent', title: 'Phải xử lý hôm nay', color: 'bg-amber-50 border-amber-200 text-amber-700', badge: 'bg-amber-600',
    examples: 'CK timeout, đơn chờ duyệt, sai lệch T+1 cần deadline, xe dừng bất thường',
    channels: ['Web toast', 'App push', 'Escalate nếu 30\''] },
  P2: { label: 'P2 — Important', title: 'Cần biết, không khẩn', color: 'bg-blue-50 border-blue-200 text-blue-600', badge: 'bg-blue-500',
    examples: 'Trip hoàn thành, NPP từ chối đơn, vỏ cần đếm, hạn mức sắp hết thời kỳ',
    channels: ['Web bell', 'App badge'] },
  P3: { label: 'P3 — Digest', title: 'FYI — Gộp theo giờ', color: 'bg-gray-50 border-gray-200 text-gray-600', badge: 'bg-gray-500',
    examples: 'Đơn mới tạo, DMS synced, Bravo confirmed, trạng thái đổi thường',
    channels: ['Web bell', 'Hourly digest'] },
}

// ── Category badges for notifications ──
const CATEGORY_BADGE: Record<string, { icon: string; label: string; color: string }> = {
  order: { icon: 'ĐH', label: 'Đơn hàng', color: 'bg-green-100 text-green-700' },
  delivery: { icon: 'VC', label: 'Vận chuyển', color: 'bg-blue-100 text-blue-700' },
  recon: { icon: 'ĐS', label: 'Đối soát', color: 'bg-purple-100 text-purple-700' },
  system: { icon: 'HT', label: 'Hệ thống', color: 'bg-gray-100 text-gray-700' },
  warehouse: { icon: 'KH', label: 'Kho', color: 'bg-amber-100 text-amber-700' },
  payment: { icon: 'KT', label: 'Kế toán', color: 'bg-orange-100 text-orange-700' },
}

// ── Priority border for notification cards ──
const PRIORITY_BORDER: Record<string, string> = {
  urgent: 'border-l-4 border-l-red-500',
  high: 'border-l-4 border-l-amber-500',
  normal: 'border-l-4 border-l-blue-400',
  low: 'border-l-4 border-l-gray-300',
}

// ── Routing table data (ảnh 3) ──
const ROUTING: { priority: string; label: string; color: string; rows: { event: string; channels: string[] }[] }[] = [
  { priority: 'P0 Critical', label: 'Routing theo sự kiện — P0 Critical', color: 'border-red-200 bg-red-50/30',
    rows: [
      { event: 'Gate check fail', channels: ['Web popup', 'App push', 'SMS', 'Escalate 5\''] },
      { event: 'Xe tai nạn / sự cố nghiêm trọng', channels: ['Web popup', 'App push', 'SMS'] },
      { event: 'DLQ hết 3 lần retry', channels: ['Web popup', 'SMS Admin'] },
    ]},
  { priority: 'P1 Urgent', label: 'Routing theo sự kiện — P1 Urgent', color: 'border-amber-200 bg-amber-50/30',
    rows: [
      { event: 'Đơn chờ duyệt hạn mức (R15)', channels: ['Web toast', 'App push', 'Escalate 30\''] },
      { event: 'CK timeout chưa xác nhận', channels: ['Web toast', 'App push', 'Escalate config'] },
      { event: 'Sai lệch T+1 còn < 2 giờ', channels: ['Web toast', 'App push'] },
      { event: 'Xe dừng > ngưỡng cảnh báo', channels: ['Web toast', 'App push'] },
      { event: 'NPP từ chối đơn hàng (R16)', channels: ['Web toast'] },
    ]},
  { priority: 'P2 & Zalo OA', label: 'Routing theo sự kiện — P2 & Zalo OA', color: 'border-blue-200 bg-blue-50/30',
    rows: [
      { event: 'Trip hoàn thành', channels: ['Web bell', 'App badge'] },
      { event: 'Xác nhận đơn hàng (R16) — cho NPP', channels: ['Zalo OA'] },
      { event: 'Xác nhận nhận hàng (R13) — cho NPP', channels: ['Zalo OA'] },
      { event: 'Hạn mức NPP sắp hết thời kỳ', channels: ['Web bell'] },
      { event: 'Xe cần kiểm định / bảo dưỡng', channels: ['Web bell', 'App push'] },
    ]},
]

// ── Settings rows (ảnh 4) ──
const SETTINGS_EVENTS = [
  'Đơn chờ duyệt hạn mức', 'Xác nhận chuyển khoản', 'Trip hoàn thành',
  'Sai lệch đối soát', 'DLQ lỗi tích hợp', 'Hàng cận date',
]

// ── Escalation example (ảnh 5) ──
const ESCALATION_STEPS = [
  { time: 'T+0: ngay lập tức', title: 'Kế toán phụ trách nhận notification', desc: 'Web toast + App push — Với nút Duyệt / Từ chối inline', color: 'bg-blue-600' },
  { time: 'T+20 phút', title: 'Nếu chưa xử lý — nhắc lại + badge đổi màu', desc: 'Notification chuyển màu amber, snooze bị tắt', color: 'bg-amber-500' },
  { time: 'T+30 phút', title: 'Kế toán trưởng nhận notification', desc: 'Web toast + App push — note "Kế toán X chưa xử lý"', color: 'bg-orange-500' },
  { time: 'T+45 phút', title: 'Quản lý vận hành nhận Web popup + SMS', desc: 'Đơn sắp quá mốc chốt 16h — cần quyết định ngay', color: 'bg-red-500' },
  { time: 'T+60 phút (hoặc quá 16h cutoff)', title: 'Tự động từ chối nếu không ai xử lý', desc: 'Log đầy đủ ai nhận notification, ai không phản hồi', color: 'bg-gray-800' },
]

// ── Channel badge component ──
function ChannelBadge({ ch }: { ch: string }) {
  const colors: Record<string, string> = {
    'Web popup': 'bg-red-100 text-red-700 border-red-200',
    'App push': 'bg-green-100 text-green-700 border-green-200',
    'SMS': 'bg-amber-100 text-amber-700 border-amber-200',
    'SMS fallback': 'bg-amber-100 text-amber-700 border-amber-200',
    'SMS Admin': 'bg-amber-100 text-amber-700 border-amber-200',
    'Web toast': 'bg-orange-100 text-orange-700 border-orange-200',
    'Web bell': 'bg-blue-100 text-blue-700 border-blue-200',
    'App badge': 'bg-purple-100 text-purple-700 border-purple-200',
    'Hourly digest': 'bg-gray-100 text-gray-700 border-gray-200',
    'Zalo OA': 'bg-blue-100 text-blue-700 border-blue-200',
  }
  const c = colors[ch] || 'bg-gray-100 text-gray-600 border-gray-200'
  const isEscalate = ch.startsWith('Escalate')
  return (
    <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded border ${isEscalate ? 'bg-gray-800 text-white border-gray-800' : c}`}>
      {ch}
    </span>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'vừa xong'
  if (mins < 60) return `${mins} phút`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ`
  return `${Math.floor(hours / 24)}d`
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
  const [tab, setTab] = useState<Tab>('center')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<CategoryFilter>('all')
  const [unreadCount, setUnreadCount] = useState(0)
  const [settingsToggles, setSettingsToggles] = useState<Record<string, Record<string, boolean>>>({})

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<any>('/notifications?limit=50')
      setNotifications(res.data || [])
    } catch { /* ignore */ }
    try {
      const res = await apiFetch<any>('/notifications/unread-count')
      setUnreadCount(res.data?.unread_count || 0)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

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
    if (n.link) router.push(`/dashboard${n.link}`)
  }

  const toggleSetting = (event: string, channel: string) => {
    setSettingsToggles(prev => ({
      ...prev,
      [event]: { ...(prev[event] || {}), [channel]: !(prev[event]?.[channel]) }
    }))
  }

  const filteredNotifications = notifications.filter(n =>
    filter === 'all' || n.category === filter
  )

  const TABS: { key: Tab; label: string }[] = [
    { key: 'architecture', label: 'Kiến trúc' },
    { key: 'center', label: 'Notification center' },
    { key: 'routing', label: 'Routing thông minh' },
    { key: 'settings', label: 'Cài đặt cá nhân' },
    { key: 'escalation', label: 'Escalation chain' },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      {/* Tab bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition ${
              tab === t.key
                ? 'bg-white border-gray-300 shadow-sm text-gray-900'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════ Tab 1: Kiến trúc (ảnh 1) ═══════ */}
      {tab === 'architecture' && (
        <div className="space-y-6">
          {/* 4 Priority cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(PRIORITY).map(([key, p]) => (
              <div key={key} className={`rounded-xl border-2 p-5 ${p.color}`}>
                <p className="text-xs font-bold uppercase tracking-wider mb-1">{p.label}</p>
                <p className="font-semibold text-base mb-2">{p.title}</p>
                <p className="text-sm opacity-80 mb-3">{p.examples}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.channels.map(ch => <ChannelBadge key={ch} ch={ch} />)}
                </div>
              </div>
            ))}
          </div>

          {/* 5 Design principles */}
          <div>
            <h3 className="text-base font-semibold text-gray-800 mb-3">5 nguyên tắc thiết kế</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { name: 'Actionable', desc: 'Mọi thông báo có CTA inline, không phải chỉ "xem thêm"' },
                { name: 'Grouped', desc: 'Nhiều sự kiện cùng Trip/Order gộp thành 1 thread' },
                { name: 'Context-rich', desc: 'Link thẳng đến record, không cần tìm lại' },
                { name: 'Role-aware', desc: 'Kế toán không nhận alert GPS, Tài xế không nhận alert kho' },
                { name: 'Audit trail', desc: 'Ai đã đọc, ai đã xử lý, lúc mấy giờ — có log đầy đủ' },
              ].map(p => (
                <div key={p.name} className="bg-white rounded-lg border border-gray-200 p-4">
                  <p className="font-semibold text-sm text-gray-800 mb-1">{p.name}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Tab 2: Notification Center (ảnh 2) ═══════ */}
      {tab === 'center' && (
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
              <button className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                Cài đặt
              </button>
            </div>
          </div>

          {/* Category filters */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {([
              { key: 'all' as CategoryFilter, label: 'Tất cả' },
              { key: 'order' as CategoryFilter, label: 'Đơn hàng' },
              { key: 'delivery' as CategoryFilter, label: 'Vận chuyển' },
              { key: 'recon' as CategoryFilter, label: 'Đối soát' },
              { key: 'system' as CategoryFilter, label: 'Hệ thống' },
            ]).map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3.5 py-1.5 text-sm rounded-lg border transition ${
                  filter === f.key
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Notification list grouped by time */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F68634]"></div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-4xl mb-3">🔔</p>
              <p className="text-gray-500">Chưa có thông báo nào</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupByTime(filteredNotifications).map(group => (
                <div key={group.label}>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{group.label}</p>
                  <div className="space-y-2">
                    {group.items.map(n => {
                      const cat = CATEGORY_BADGE[n.category] || CATEGORY_BADGE.system
                      const borderClass = PRIORITY_BORDER[n.priority] || PRIORITY_BORDER.normal
                      return (
                        <div key={n.id}
                          onClick={() => handleClick(n)}
                          className={`bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-md transition ${borderClass} ${!n.is_read ? 'bg-amber-50/30' : ''}`}>
                          <div className="flex items-start gap-3">
                            {/* Category circle badge */}
                            <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${cat.color}`}>
                              {cat.icon}
                            </div>

                            {/* Content */}
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
                              </div>
                              <p className="text-sm text-gray-600 leading-relaxed">{n.body}</p>

                              {/* Inline CTA buttons (ảnh 2) */}
                              {n.priority === 'urgent' && (
                                <div className="flex gap-2 mt-2.5">
                                  <button className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                                    onClick={e => { e.stopPropagation(); if (n.link) router.push(`/dashboard${n.link}`) }}>
                                    Xem chi tiết
                                  </button>
                                  <button className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                                    onClick={e => e.stopPropagation()}>
                                    Từ chối xuất
                                  </button>
                                  <button className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                                    onClick={e => e.stopPropagation()}>
                                    Bỏ qua ngoại lệ
                                  </button>
                                </div>
                              )}
                              {n.priority === 'high' && (
                                <div className="flex gap-2 mt-2.5">
                                  <button className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                                    onClick={e => { e.stopPropagation() }}>
                                    Duyệt ngay
                                  </button>
                                  <button className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                                    onClick={e => e.stopPropagation()}>
                                    Từ chối
                                  </button>
                                  <button className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                                    onClick={e => { e.stopPropagation(); if (n.link) router.push(`/dashboard${n.link}`) }}>
                                    Xem công nợ NPP
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Time */}
                            <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{timeAgo(n.created_at)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════ Tab 3: Routing thông minh (ảnh 3) ═══════ */}
      {tab === 'routing' && (
        <div className="space-y-5">
          {ROUTING.map(group => (
            <div key={group.priority} className={`rounded-xl border-2 p-5 ${group.color}`}>
              <h3 className="font-semibold text-sm text-gray-800 mb-4">{group.label}</h3>
              <div className="space-y-3">
                {group.rows.map(row => (
                  <div key={row.event} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-700">{row.event}</span>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {row.channels.map(ch => <ChannelBadge key={ch} ch={ch} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════ Tab 4: Cài đặt cá nhân (ảnh 4) ═══════ */}
      {tab === 'settings' && (
        <div>
          <p className="text-sm text-gray-500 mb-5">
            Mỗi user tự cài đặt nhận thông báo nào, qua kênh nào — hệ thống ghi nhớ theo role mặc định.
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
            Digest: gộp các thông báo P3 thành 1 email/web notification theo giờ. Snooze: tạm dừng loại thông báo trong 1 giờ khi đang bận.
          </p>
        </div>
      )}

      {/* ═══════ Tab 5: Escalation chain (ảnh 5) ═══════ */}
      {tab === 'escalation' && (
        <div>
          <p className="text-sm text-gray-600 mb-5">
            Chuỗi escalation tự động khi thông báo không được xử lý trong thời gian quy định:
          </p>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Ví dụ:</p>
            <p className="font-semibold text-gray-800 mb-5">Đơn vượt hạn mức chờ duyệt</p>

            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-gray-200"></div>

              <div className="space-y-6">
                {ESCALATION_STEPS.map((step, idx) => (
                  <div key={idx} className="relative flex items-start gap-4 pl-0">
                    <div className={`relative z-10 w-6 h-6 rounded-full ${step.color} ring-4 ring-white shrink-0`}></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800">{step.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{step.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
