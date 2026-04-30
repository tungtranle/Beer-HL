'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'
import { Pin } from 'lucide-react'

/**
 * PinnedNotesBar — §17 UX Spec v5
 * Ghi chú ghim đầu order detail — không bị chìm trong timeline.
 * Max 3 ghim hiển thị.
 */

interface PinnedNote {
  id: string
  content: string
  note_type: string
  user_name: string
  created_at: string
  is_pinned: boolean
}

export function PinnedNotesBar({ orderId }: { orderId: string }) {
  const [notes, setNotes] = useState<PinnedNote[]>([])

  const load = () => {
    apiFetch<any>(`/orders/${orderId}/notes`)
      .then(r => {
        const all = r.data || []
        setNotes(all.filter((n: PinnedNote) => n.is_pinned).slice(0, 3))
      })
      .catch(() => {})
  }

  useEffect(() => { load() }, [orderId])

  const handleUnpin = async (noteId: string) => {
    try {
      await apiFetch(`/orders/${orderId}/notes/${noteId}/pin`, { method: 'DELETE' })
      setNotes(prev => prev.filter(n => n.id !== noteId))
      toast.success('Đã bỏ ghim')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (notes.length === 0) return null

  return (
    <div className="mb-4 space-y-2">
      {notes.map(note => (
        <div key={note.id} className="flex items-start gap-3 px-4 py-3 bg-amber-50 border-l-4 border-amber-400 rounded-lg">
          <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800">{note.content}</p>
            <p className="text-xs text-gray-400 mt-1">
              {note.user_name} · {new Date(note.created_at).toLocaleString('vi-VN')}
            </p>
          </div>
          <button
            onClick={() => handleUnpin(note.id)}
            className="text-xs text-gray-400 hover:text-red-500 transition shrink-0"
            title="Bỏ ghim"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
