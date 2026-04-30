'use client'

import { useEffect, useState, useRef } from 'react'
import { apiFetch } from '@/lib/api'
import { orderStatusLabels } from '@/lib/status-config'
import { toast } from '@/lib/useToast'
import { handleError } from '@/lib/handleError'
import {
  FileEdit, CheckCircle2, XCircle, AlarmClock, Unlock, Ban, Pencil, RefreshCw, Package,
  AlertTriangle, MessageCircle, Smartphone, Hourglass, Map, ClipboardList, Truck, Truck as TruckLoad,
  CheckCheck, Pin, User, Cog, Store, Clock, type LucideIcon
} from 'lucide-react'

interface TimelineEvent {
  id: string
  event_type: string
  actor_type: string
  actor_id?: string
  actor_name: string
  title: string
  detail: Record<string, any>
  created_at: string
}

interface InlineNote {
  id: string
  content: string
  note_type: string
  user_name: string
  is_pinned: boolean
  created_at: string
}

// Merged timeline entry: event or note
type TimelineEntry = 
  | { kind: 'event'; data: TimelineEvent }
  | { kind: 'note'; data: InlineNote }

const eventConfig: Record<string, { Icon: LucideIcon; bg: string; ring: string; category: string }> = {
  'order.created':              { Icon: FileEdit,       bg: 'bg-blue-500',   ring: 'ring-blue-100',   category: 'lifecycle' },
  'order.confirmed_by_customer':{ Icon: CheckCircle2,   bg: 'bg-green-500',  ring: 'ring-green-100',  category: 'lifecycle' },
  'order.rejected_by_customer': { Icon: XCircle,        bg: 'bg-red-500',    ring: 'ring-red-100',    category: 'lifecycle' },
  'order.auto_confirmed':       { Icon: AlarmClock,     bg: 'bg-amber-500',  ring: 'ring-amber-100',  category: 'lifecycle' },
  'order.approved':             { Icon: Unlock,         bg: 'bg-green-600',  ring: 'ring-green-100',  category: 'lifecycle' },
  'order.cancelled':            { Icon: Ban,            bg: 'bg-red-600',    ring: 'ring-red-100',    category: 'lifecycle' },
  'order.updated':              { Icon: Pencil,         bg: 'bg-gray-500',   ring: 'ring-gray-100',   category: 'edit' },
  'order.status_changed':       { Icon: RefreshCw,      bg: 'bg-purple-500', ring: 'ring-purple-100', category: 'lifecycle' },
  'order.delivery_confirmed':   { Icon: Package,        bg: 'bg-teal-500',   ring: 'ring-teal-100',   category: 'delivery' },
  'order.delivery_disputed':    { Icon: AlertTriangle,  bg: 'bg-orange-500', ring: 'ring-orange-100', category: 'delivery' },
  'order.note_added':           { Icon: MessageCircle,  bg: 'bg-gray-400',   ring: 'ring-gray-100',   category: 'note' },
  'order.zalo_sent':            { Icon: Smartphone,     bg: 'bg-blue-400',   ring: 'ring-blue-100',   category: 'notification' },
  'order.confirmation_expired': { Icon: Hourglass,      bg: 'bg-gray-500',   ring: 'ring-gray-100',   category: 'lifecycle' },
  'order.planned':              { Icon: Map,            bg: 'bg-indigo-500', ring: 'ring-indigo-100', category: 'logistics' },
  'order.picking':              { Icon: ClipboardList,  bg: 'bg-indigo-500', ring: 'ring-indigo-100', category: 'logistics' },
  'order.loaded':               { Icon: TruckLoad,      bg: 'bg-violet-500', ring: 'ring-violet-100', category: 'logistics' },
  'order.in_transit':           { Icon: Truck,          bg: 'bg-purple-500', ring: 'ring-purple-100', category: 'logistics' },
  'order.delivered':            { Icon: CheckCheck,     bg: 'bg-teal-500',   ring: 'ring-teal-100',   category: 'delivery' },
  'order.partial_delivered':    { Icon: AlertTriangle,  bg: 'bg-orange-500', ring: 'ring-orange-100', category: 'delivery' },
  'order.delivery_rejected':    { Icon: XCircle,        bg: 'bg-red-500',    ring: 'ring-red-100',    category: 'delivery' },
  'order.redelivery_created':   { Icon: RefreshCw,      bg: 'bg-rose-500',   ring: 'ring-rose-100',   category: 'lifecycle' },
}

const defaultConfig = { Icon: Pin, bg: 'bg-gray-400', ring: 'ring-gray-100', category: 'other' }

const actorIconMap: Record<string, LucideIcon> = {
  user: User, system: Cog, customer: Store, cron: Clock,
}

// Vietnamese label for actor type
const actorTypeLabels: Record<string, string> = {
  user: 'Nhân viên',
  system: 'Hệ thống',
  customer: 'Khách hàng',
  cron: 'Tự động',
}

const NOTE_STYLE: Record<string, { border: string; bg: string; label: string }> = {
  internal:     { border: 'border-l-4 border-amber-400', bg: 'bg-amber-50', label: ' Nội bộ' },
  npp_feedback: { border: 'border-l-4 border-blue-400',  bg: 'bg-blue-50',  label: 'Phản hồi NPP' },
  driver_note:  { border: 'border-l-4 border-green-400', bg: 'bg-green-50', label: 'Tài xế ghi' },
  system:       { border: 'border-l-4 border-stone-300', bg: 'bg-stone-50', label: 'Hệ thống' },
}

export function OrderTimeline({ orderId }: { orderId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [notes, setNotes] = useState<InlineNote[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'lifecycle' | 'delivery' | 'note'>('all')
  
  // Note composer state
  const [newNote, setNewNote] = useState('')
  const [noteType, setNoteType] = useState<'internal' | 'npp_feedback'>('internal')
  const [saving, setSaving] = useState(false)
  const submitted = useRef(false)

  const loadData = () => {
    setLoading(true)
    Promise.all([
      apiFetch<any>(`/orders/${orderId}/timeline`).then(r => setEvents(r.data || [])),
      apiFetch<any>(`/orders/${orderId}/notes`).then(r => setNotes(r.data || [])),
    ])
      .catch(err => handleError(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [orderId])

  // Save note
  const handleSaveNote = async () => {
    if (!newNote.trim() || submitted.current) return
    submitted.current = true
    setSaving(true)
    try {
      await apiFetch(`/orders/${orderId}/notes`, {
        method: 'POST',
        body: { content: newNote.trim(), note_type: noteType },
      })
      setNewNote('')
      toast.success('Đã lưu ghi chú')
      loadData()
    } catch (err: any) {
      submitted.current = false
      toast.error(err.message)
    } finally {
      setSaving(false)
      submitted.current = false
    }
  }

  // Pin/unpin note
  const handleTogglePin = async (noteId: string, isPinned: boolean) => {
    try {
      await apiFetch(`/orders/${orderId}/notes/${noteId}/pin`, {
        method: isPinned ? 'DELETE' : 'PUT',
      })
      loadData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Merge events + notes into one timeline sorted by timestamp DESC
  const mergedEntries: TimelineEntry[] = [
    ...events.map(e => ({ kind: 'event' as const, data: e })),
    // Only include notes that are NOT already in events (avoid duplicate note_added events)
    ...notes
      .filter(n => !events.some(e => e.event_type === 'order.note_added' && e.detail?.content === n.content && Math.abs(new Date(e.created_at).getTime() - new Date(n.created_at).getTime()) < 60000))
      .map(n => ({ kind: 'note' as const, data: n })),
  ].sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime())

  // Format time — absolute + relative
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  }

  const formatRelative = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Vừa xong'
    if (diffMins < 60) return `${diffMins} phút trước`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} giờ trước`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays} ngày trước`
    return ''
  }

  // Calculate duration between consecutive entries + color coding (§21)
  const getDuration = (idx: number): { text: string; color: string } | null => {
    if (idx >= mergedEntries.length - 1) return null
    const current = new Date(mergedEntries[idx].data.created_at)
    const prev = new Date(mergedEntries[idx + 1].data.created_at)
    const diffMs = current.getTime() - prev.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return null
    let text: string
    if (mins < 60) text = `${mins} phút`
    else {
      const hours = Math.floor(mins / 60)
      const remainMins = mins % 60
      if (hours < 24) text = remainMins > 0 ? `${hours}g ${remainMins}p` : `${hours} giờ`
      else {
        const days = Math.floor(hours / 24)
        const remainHours = hours % 24
        text = remainHours > 0 ? `${days}d ${remainHours}g` : `${days} ngày`
      }
    }
    // Color coding: <30min gray, 30m-2h amber, >2h red
    const color = mins < 30 ? 'text-gray-400' : mins < 120 ? 'text-amber-500 font-medium' : 'text-red-500 font-bold'
    return { text, color }
  }

  // Filtered entries
  const filtered = mergedEntries.filter(entry => {
    if (filter === 'all') return true
    if (entry.kind === 'note') return filter === 'note'
    const cfg = eventConfig[entry.data.event_type] || defaultConfig
    if (filter === 'delivery') return ['delivery', 'logistics'].includes(cfg.category)
    return cfg.category === filter
  })

  // Group entries by date
  const groupByDate = (entries: TimelineEntry[]) => {
    const groups: { date: string; label: string; entries: TimelineEntry[] }[] = []
    let currentDate = ''
    for (const entry of entries) {
      const d = new Date(entry.data.created_at)
      const dateStr = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
      if (dateStr !== currentDate) {
        currentDate = dateStr
        const today = new Date()
        const isToday = d.toDateString() === today.toDateString()
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
        const isYesterday = d.toDateString() === yesterday.toDateString()
        const label = isToday ? 'Hôm nay' : isYesterday ? 'Hôm qua' : dateStr
        groups.push({ date: dateStr, label, entries: [] })
      }
      groups[groups.length - 1].entries.push(entry)
    }
    return groups
  }

  const groups = groupByDate(filtered)

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-spin w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-gray-400 text-sm">Đang tải lịch sử đơn hàng...</p>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="py-8 text-center">
        <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden="true" />
        <p className="font-medium text-gray-500">Chưa có lịch sử</p>
        <p className="text-sm mt-1">Các hoạt động của đơn hàng sẽ được ghi nhận tại đây</p>
      </div>
    )
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { key: 'all' as const, label: 'Tất cả', count: mergedEntries.length },
          { key: 'lifecycle' as const, label: 'Trạng thái', count: mergedEntries.filter(e => e.kind === 'event' && (eventConfig[e.data.event_type] || defaultConfig).category === 'lifecycle').length },
          { key: 'delivery' as const, label: 'Giao hàng', count: mergedEntries.filter(e => e.kind === 'event' && ['delivery', 'logistics'].includes((eventConfig[e.data.event_type] || defaultConfig).category)).length },
          { key: 'note' as const, label: 'Ghi chú', count: notes.length },
        ].filter(t => t.count > 0).map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === tab.key
                ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/60 text-xs">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Summary banner */}
      {mergedEntries.length > 1 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg mb-5 text-xs">
          <span className="font-medium text-amber-700">Tổng quan:</span>
          <span className="text-gray-600">{events.length} hoạt động · {notes.length} ghi chú</span>
          {events.length > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-gray-600">
                Từ {new Date(events[events.length - 1].created_at).toLocaleDateString('vi-VN')} đến {new Date(events[0].created_at).toLocaleDateString('vi-VN')}
              </span>
            </>
          )}
        </div>
      )}

      {/* Timeline grouped by date */}
      {groups.map((group) => (
        <div key={group.date} className="mb-6">
          {/* Date header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-gray-200"></div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{group.label}</span>
            <div className="h-px flex-1 bg-gray-200"></div>
          </div>

          {/* Entries in this date */}
          <div className="relative ml-1">
            <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-gray-200 via-gray-200 to-transparent"></div>

            {group.entries.map((entry, idx) => {
              const globalIdx = mergedEntries.indexOf(entry)
              const duration = getDuration(globalIdx)
              const relative = formatRelative(entry.data.created_at)

              // ── Inline Note Card ──
              if (entry.kind === 'note') {
                const n = entry.data
                const style = NOTE_STYLE[n.note_type] || NOTE_STYLE.internal
                return (
                  <div key={`note-${n.id}`}>
                    {duration && idx > 0 && (
                      <div className="relative flex items-center py-1 pl-2 ml-[6px]">
                        <div className="w-[18px] flex justify-center"><span className="text-[10px] text-gray-300">⋮</span></div>
                        <span className={`ml-4 text-[10px] bg-gray-50 px-2 py-0.5 rounded-full ${duration.color}`}>⏱ {duration.text} sau</span>
                      </div>
                    )}
                    <div className="relative flex items-start gap-4 py-2.5 pl-0 group">
                      <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full text-sm shrink-0 bg-amber-400 ring-4 ring-amber-100 shadow-sm">
                        <MessageCircle className="w-4 h-4 text-white" aria-hidden="true" />
                      </div>
                      <div className={`flex-1 min-w-0 ${style.bg} ${style.border} rounded-lg p-3`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{style.label}</span>
                            <p className="text-sm text-gray-800 mt-1">{n.content}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {relative && <span className="text-[10px] text-gray-400 whitespace-nowrap">{relative}</span>}
                            <button
                              onClick={() => handleTogglePin(n.id, n.is_pinned)}
                              className="p-0 border-0 bg-transparent cursor-pointer"
                              title={n.is_pinned ? 'Bỏ ghim' : 'Ghim'}
                            >
                              <Pin
                                className={`w-3.5 h-3.5 transition ${n.is_pinned ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {(() => { const AI = actorIconMap[n.note_type] ?? User; return <AI className="w-3 h-3 text-gray-500" aria-hidden="true" /> })()}
                          <span className="text-[11px] text-gray-500">{n.user_name}</span>
                          <span className="text-[11px] text-gray-400">{formatTime(n.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }

              // ── Event Card ──
              const evt = entry.data
              const cfg = eventConfig[evt.event_type] || defaultConfig

              return (
                <div key={evt.id}>
                  {duration && idx > 0 && (
                    <div className="relative flex items-center py-1 pl-2 ml-[6px]">
                      <div className="w-[18px] flex justify-center"><span className="text-[10px] text-gray-300">⋮</span></div>
                      <span className={`ml-4 text-[10px] bg-gray-50 px-2 py-0.5 rounded-full ${duration.color}`}>⏱ {duration.text} sau</span>
                    </div>
                  )}

                  <div className="relative flex items-start gap-4 py-2.5 pl-0 group">
                    <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full text-sm shrink-0 ${cfg.bg} ring-4 ${cfg.ring} shadow-sm group-hover:scale-110 transition-transform`}>
                      {(() => { const IconComp = cfg.Icon; return <IconComp className="w-4 h-4 text-white" aria-hidden="true" /> })()}
                    </div>

                    <div className="flex-1 min-w-0 bg-white border border-gray-100 rounded-lg p-3 hover:border-gray-200 hover:shadow-sm transition group-hover:bg-gray-50/50">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 leading-snug">{evt.title}</p>
                        {relative && <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0 mt-0.5">{relative}</span>}
                      </div>

                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full text-[11px] text-gray-600">
                          {(() => { const AI = actorIconMap[evt.actor_type] ?? User; return <AI className="w-3 h-3" aria-hidden="true" /> })()}
                          <span className="font-medium">{evt.actor_name || 'Hệ thống'}</span>
                          <span className="text-gray-400">· {actorTypeLabels[evt.actor_type] || evt.actor_type}</span>
                        </span>
                        <span className="text-[11px] text-gray-400">{formatTime(evt.created_at)}</span>
                      </div>

                      {/* Note content with note_type styling */}
                      {evt.event_type === 'order.note_added' && evt.detail?.content && (() => {
                        const nt = evt.detail?.note_type || 'internal'
                        const ns = NOTE_STYLE[nt] || NOTE_STYLE.internal
                        return (
                          <div className={`mt-2 p-2.5 rounded-lg text-sm text-gray-700 ${ns.bg} ${ns.border}`}>
                            <span className="text-[10px] font-medium text-gray-500 uppercase">{ns.label}</span>
                            <p className="mt-0.5"><MessageCircle className="w-3.5 h-3.5 inline mr-0.5" aria-hidden="true" />{evt.detail.content}</p>
                          </div>
                        )
                      })()}

                      {evt.detail?.reason && evt.event_type !== 'order.note_added' && (
                        <div className="mt-2 p-2 bg-red-50 rounded-lg text-xs text-red-700 border-l-3 border-red-400">
                          <span className="font-medium">Lý do:</span> {evt.detail.reason}
                        </div>
                      )}

                      {evt.detail?.old_status && evt.detail?.new_status && (
                        <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 bg-purple-50 rounded-lg text-xs">
                          <span className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">
                            {orderStatusLabels[evt.detail.old_status] || evt.detail.old_status}
                          </span>
                          <span className="text-purple-400">→</span>
                          <span className="px-1.5 py-0.5 bg-purple-200 rounded text-purple-700 font-medium">
                            {orderStatusLabels[evt.detail.new_status] || evt.detail.new_status}
                          </span>
                        </div>
                      )}

                      {evt.detail?.total_amount && (
                        <div className="mt-2 text-xs text-gray-600 inline-flex items-center gap-1">
                          <span className="font-medium">Giá trị:</span> <span className="font-medium text-gray-800">{Number(evt.detail.total_amount).toLocaleString('vi-VN')}đ</span>
                        </div>
                      )}

                      {evt.detail?.customer_name && evt.event_type === 'order.created' && (
                        <div className="mt-2 text-xs text-gray-600 inline-flex items-center gap-1">
                          <Store className="w-3 h-3" aria-hidden="true" /> <span className="font-medium">{evt.detail.customer_name}</span>
                        </div>
                      )}

                      {evt.detail?.attempt_number && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-rose-50 rounded-lg text-xs text-rose-700">
                          <RefreshCw className="w-3 h-3" aria-hidden="true" /> Lần giao lại thứ <span className="font-bold">{evt.detail.attempt_number}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Note Composer — always at bottom (§18 v5) */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setNoteType('internal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              noteType === 'internal' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
             Nội bộ
          </button>
          <button
            onClick={() => setNoteType('npp_feedback')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              noteType === 'npp_feedback' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            Phản hồi NPP
          </button>
        </div>
        <div className="flex gap-2">
          <textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder={noteType === 'internal' ? 'Ghi chú nội bộ...' : 'Phản hồi NPP (từ Zalo/ĐT)...'}
            className="flex-1 border rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300"
            rows={2}
          />
          <button
            onClick={handleSaveNote}
            disabled={saving || !newNote.trim()}
            className="px-4 py-2 bg-[#F68634] text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50 self-end"
          >
            {saving ? '...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  )
}
