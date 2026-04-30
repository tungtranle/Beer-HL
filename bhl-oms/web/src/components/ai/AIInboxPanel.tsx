'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox, ArrowRight, CheckCheck, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useAIFeature } from '@/hooks/useAIFeature'
import { ExplainabilityPopover } from './ExplainabilityPopover'

interface AISuggestion {
  label?: string
  route?: string
  action?: string
  explain?: string
  risk?: string
}

interface AIInboxItem {
  id: string
  type: string
  priority: string
  title: string
  detail: string
  status: string
  explainable: boolean
  ai_suggestion?: AISuggestion
}

const PRIORITY_STYLE: Record<string, string> = {
  P0: 'bg-rose-100 text-rose-700',
  P1: 'bg-amber-100 text-amber-700',
  P2: 'bg-blue-100 text-blue-700',
  P3: 'bg-slate-100 text-slate-600',
}

export function AIInboxPanel() {
  const router = useRouter()
  const [items, setItems] = useState<AIInboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const { enabled } = useAIFeature('ai.copilot')

  useEffect(() => {
    if (!enabled) { setItems([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    apiFetch<{ data?: AIInboxItem[] }>('/ai/inbox')
      .then((res) => { if (!cancelled) setItems(res.data || []) })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [enabled])

  if (!enabled) return null

  async function handleAction(item: AIInboxItem, status: 'done' | 'dismissed') {
    const shouldRemove = status === 'dismissed'

    if (status === 'done' && item.ai_suggestion?.route) {
      router.push(item.ai_suggestion.route)
      return
    }

    if (shouldRemove) {
      setItems(prev => prev.filter(i => i.id !== item.id))
    }

    try {
      await apiFetch(`/ai/inbox/${item.id}/action`, { method: 'PATCH', body: { status } })
    } catch {
      if (shouldRemove) {
        setItems(prev => prev.some(i => i.id === item.id) ? prev : [item, ...prev])
      }
      return
    }

  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Inbox className="h-5 w-5 text-brand-600" />
        <h2 className="text-base font-semibold text-slate-900">AI Inbox</h2>
      </div>
      <div className="mt-4 space-y-3">
        {loading && <div className="h-16 animate-pulse rounded-lg bg-slate-100" />}
        {!loading && items.length === 0 && (
          <div className="rounded-lg bg-slate-50 px-4 py-5 text-sm text-slate-500">Không có item cần xử lý.</div>
        )}
        {items.map((item) => {
          const sug = item.ai_suggestion
          const ctaLabel = sug?.label ?? 'Xem chi tiết'
          const hasRoute = !!sug?.route
          return (
            <div key={item.id} className="rounded-lg border border-slate-200 px-4 py-3 transition-shadow hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_STYLE[item.priority] ?? PRIORITY_STYLE.P3}`}>
                      {item.priority}
                    </span>
                    {item.explainable && (
                      <ExplainabilityPopover
                        reasons={[sug?.explain ?? `Nguồn: ${item.type}`, 'Gợi ý này không tự thực thi; người dùng vẫn quyết định.']}
                        source="ai_inbox"
                        confidence={0.7}
                      />
                    )}
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                  {/* CTA row */}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => handleAction(item, 'done')}
                      className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 active:scale-95 transition-all"
                    >
                      {hasRoute ? <ArrowRight className="h-3.5 w-3.5" /> : <CheckCheck className="h-3.5 w-3.5" />}
                      {ctaLabel}
                    </button>
                    <button
                      onClick={() => handleAction(item, 'dismissed')}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50 active:scale-95 transition-all"
                      title="Bỏ qua"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
