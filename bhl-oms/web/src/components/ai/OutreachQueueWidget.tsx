'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, MessageSquareText, PhoneOutgoing, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'
import { useAIFeature } from '@/hooks/useAIFeature'

interface OutreachItem {
  customer_id?: string
  customer_code: string
  customer_name: string
  province?: string
  health_score: number
  risk_band: string
  recency_days: number
  suggested_action: string
  reason: string
  priority: number
}

interface NPPZaloDraft {
  customer_id: string
  customer_name: string
  health_score: number
  draft_message: string
  reason: string
  provider: string
}

export function OutreachQueueWidget() {
  const [items, setItems] = useState<OutreachItem[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<NPPZaloDraft | null>(null)
  const [draftLoadingId, setDraftLoadingId] = useState<string | null>(null)
  const { enabled } = useAIFeature('ai.forecast')

  useEffect(() => {
    if (!enabled) { setItems([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    apiFetch<{ data?: OutreachItem[] }>('/ai/outreach-queue?limit=3')
      .then((res) => { if (!cancelled) setItems(res.data || []) })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [enabled])

  if (!enabled) return null

  const openDraft = async (item: OutreachItem) => {
    if (!item.customer_id || item.customer_id === '00000000-0000-0000-0000-000000000000') {
      toast.error('NPP này chưa map được customer_id để tạo nháp Zalo')
      return
    }
    setDraftLoadingId(item.customer_id)
    try {
      const res = await apiFetch<{ data?: NPPZaloDraft }>('/ai/npp-zalo-draft', { method: 'POST', body: { customer_id: item.customer_id } })
      setDraft(res.data || null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tạo được nháp Zalo')
    } finally {
      setDraftLoadingId(null)
    }
  }

  const markContacted = (item: OutreachItem) => {
    setItems(prev => prev.filter(next => next.customer_code !== item.customer_code))
    toast.success(`Đã đánh dấu liên hệ ${item.customer_code}`)
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PhoneOutgoing className="h-5 w-5 text-brand-600" />
          <h2 className="text-base font-semibold text-slate-900">NPP cần liên hệ hôm nay</h2>
        </div>
        <Link href="/dashboard/customers" className="text-xs font-medium text-brand-700 hover:text-brand-800">Mở DS</Link>
      </div>
      <div className="mt-4 space-y-3">
        {loading && <div className="h-20 animate-pulse rounded-md bg-slate-100" />}
        {!loading && items.length === 0 && <div className="rounded-md bg-slate-50 px-4 py-5 text-sm text-slate-500">Không có NPP rủi ro cần ưu tiên.</div>}
        {items.map((item) => (
          <div key={item.customer_code} className="rounded-md border border-slate-200 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.risk_band === 'RED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{item.risk_band}</span>
                  <span className="truncate text-sm font-semibold text-slate-900">{item.customer_code} · {item.customer_name}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.reason}</p>
                <p className="mt-2 text-sm text-slate-700">{item.suggested_action}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/dashboard/customers?q=${encodeURIComponent(item.customer_code)}`} className="inline-flex items-center rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    Mở NPP
                  </Link>
                  <button
                    type="button"
                    onClick={() => openDraft(item)}
                    disabled={draftLoadingId === item.customer_id}
                    className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    <MessageSquareText className="h-3.5 w-3.5" />
                    {draftLoadingId === item.customer_id ? 'Đang tạo...' : 'Nháp Zalo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => markContacted(item)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    <Check className="h-3.5 w-3.5" /> Đã liên hệ
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDraft(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Nháp Zalo chăm sóc NPP</h3>
                <p className="mt-1 text-sm text-slate-500">{draft.customer_name} · health {draft.health_score}/100</p>
              </div>
              <button type="button" onClick={() => setDraft(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng nháp Zalo">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800 whitespace-pre-wrap">{draft.draft_message}</div>
            <p className="mt-3 text-xs text-slate-500">{draft.reason} · {draft.provider}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDraft(null)} className="rounded-lg border px-4 py-2 text-sm">Đóng</button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(draft.draft_message)
                  toast.success('Đã copy nháp Zalo')
                }}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Copy để gửi tay
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}