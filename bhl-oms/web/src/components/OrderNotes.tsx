'use client'

import { useEffect, useState, useRef } from 'react'
import { apiFetch, getUser } from '@/lib/api'
import { toast } from '@/lib/useToast'
import { handleError } from '@/lib/handleError'

interface OrderNote {
  id: string
  user_name: string
  content: string
  note_type?: string
  created_at: string
}

// v4 spec §3.4 — Note styles by type
const NOTE_STYLE: Record<string, { border: string; label: string; opacity: string }> = {
  internal:     { border: 'border-l-4 border-amber-400 bg-amber-50',  label: '🔒 Nội bộ',                  opacity: 'opacity-80' },
  npp_feedback: { border: 'border-l-4 border-blue-400 bg-blue-50',    label: 'Phản hồi NPP (qua Zalo/ĐT)', opacity: '' },
  driver_note:  { border: 'border-l-4 border-green-400 bg-green-50',  label: 'Tài xế ghi',                 opacity: '' },
  system:       { border: 'border-l-4 border-stone-300 bg-stone-50',  label: 'Hệ thống',                   opacity: 'opacity-70' },
}

export function OrderNotes({ orderId }: { orderId: string }) {
  const [notes, setNotes] = useState<OrderNote[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [noteType, setNoteType] = useState<'internal' | 'npp_feedback'>('internal')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const loadNotes = () => {
    apiFetch<any>(`/orders/${orderId}/notes`)
      .then((r) => setNotes(r.data || []))
      .catch(err => handleError(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadNotes() }, [orderId])

  const handleSubmit = async () => {
    if (!content.trim()) return
    setSubmitting(true)
    try {
      await apiFetch(`/orders/${orderId}/notes`, {
        method: 'POST',
        body: { content: content.trim(), note_type: noteType },
      })
      setContent('')
      loadNotes()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div>
      {/* Note Composer — v4 spec §3.5: luôn hiển thị cuối, KHÔNG phải tab riêng */}
      <div className="mb-4 pt-4 border-t border-stone-100">
        {/* Note type toggle */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setNoteType('internal')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
              noteType === 'internal'
                ? 'bg-amber-100 text-amber-700 border-amber-300'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >🔒 Nội bộ</button>
          <button
            onClick={() => setNoteType('npp_feedback')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
              noteType === 'npp_feedback'
                ? 'bg-blue-100 text-blue-700 border-blue-300'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >📱 Phản hồi NPP</button>
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={noteType === 'internal' ? 'Ghi chú nội bộ... (Ctrl+Enter để gửi)' : 'Phản hồi NPP (từ Zalo/ĐT)... (Ctrl+Enter để gửi)'}
          className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
          rows={3}
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-400">
            {noteType === 'internal' ? 'Ghi chú chỉ hiển thị cho nhân viên nội bộ' : 'Ghi nhận phản hồi NPP qua Zalo/ĐT'}
          </span>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
            className="px-4 py-1.5 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? 'Đang gửi...' : '💬 Thêm ghi chú'}
          </button>
        </div>
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="py-4 text-center text-gray-400">Đang tải...</div>
      ) : notes.length === 0 ? (
        <div className="py-6 text-center text-gray-400">
          <p className="text-3xl mb-2">💬</p>
          <p>Chưa có ghi chú nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const style = NOTE_STYLE[note.note_type || 'internal'] || NOTE_STYLE.internal
            return (
              <div key={note.id} className={`rounded-lg p-3 ${style.border} ${style.opacity}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{style.label}</span>
                  <span className="text-sm font-medium text-gray-800">👤 {note.user_name}</span>
                  <span className="text-xs text-gray-400">· {formatTime(note.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
