'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

interface Event {
  at: string
  kind: 'trip' | 'score' | 'leave' | 'badge' | string
  title: string
  subtitle?: string
  score?: number
  meta?: Record<string, any>
}
interface Stats {
  full_name: string
  hire_date: string | null
  years_active: number
  total_trips: number
  total_km: number
  current_score: number
  avg_score_90d: number
  badge_count: number
  first_trip_at: string | null
  last_trip_at: string | null
}

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('vi-VN') : '—'
const fmtDateTime = (s: string | null) => s ? new Date(s).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

const KIND_BADGE: Record<string, { label: string; cls: string }> = {
  trip:  { label: 'Chuyến',     cls: 'bg-sky-100 text-sky-800 border-sky-300' },
  score: { label: 'Điểm',       cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  leave: { label: 'Nghỉ phép',  cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  badge: { label: 'Huy hiệu',   cls: 'bg-violet-100 text-violet-800 border-violet-300' },
}

export default function DriverProfilePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id
  const [stats, setStats] = useState<Stats | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      apiFetch<any>(`/drivers/${id}/career-stats`).then(r => r.data).catch(() => null),
      apiFetch<any>(`/drivers/${id}/timeline`).then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
    ]).then(([s, e]) => {
      setStats(s)
      setEvents(e)
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64 text-stone-400">Đang tải hồ sơ tài xế...</div>

  return (
    <div className="bg-stone-50 min-h-screen -mx-6 -my-6 px-8 py-10">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => router.back()} className="text-sm text-stone-500 hover:text-stone-800 mb-4">← Quay lại</button>

        <header className="border-b border-stone-300 pb-6 mb-8">
          <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">Hồ sơ tài xế</p>
          <h1 className="text-5xl passport-serif font-bold text-stone-900 leading-tight">
            {stats?.full_name || '—'}
          </h1>
          <p className="text-stone-600 mt-2 text-base">
            Vào nghề: {fmtDate(stats?.hire_date || null)}
            {stats && stats.years_active > 0 ? ` · ${stats.years_active.toFixed(1)} năm` : ''}
          </p>
        </header>

        {stats && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
            <KPI label="Tổng chuyến" value={String(stats.total_trips)} />
            <KPI label="Tổng km" value={`${stats.total_km.toFixed(0)} km`} />
            <KPI label="Điểm hiện tại" value={`${stats.current_score.toFixed(0)}/100`} />
            <KPI label="Điểm TB 90 ngày" value={`${stats.avg_score_90d.toFixed(1)}`} />
            <KPI label="Huy hiệu" value={String(stats.badge_count)} subtle />
            <KPI label="Chuyến đầu" value={fmtDate(stats.first_trip_at)} subtle />
            <KPI label="Chuyến gần nhất" value={fmtDate(stats.last_trip_at)} subtle />
          </section>
        )}

        <section>
          <h2 className="text-2xl passport-serif font-bold text-stone-900 mb-4">Hành trình nghề nghiệp</h2>
          {events.length === 0 ? (
            <div className="text-stone-400 italic py-8 text-center border border-dashed border-stone-300 rounded">
              Chưa có sự kiện nào được ghi nhận
            </div>
          ) : (
            <ol className="space-y-3 border-l-2 border-stone-300 pl-6 ml-2">
              {events.map((e, i) => {
                const badge = KIND_BADGE[e.kind] || { label: e.kind, cls: 'bg-stone-100 text-stone-700 border-stone-300' }
                return (
                  <li key={i} className="relative">
                    <span className="absolute -left-[31px] top-2 w-3 h-3 rounded-full bg-stone-400 border-2 border-stone-50" />
                    <div className="bg-white border border-stone-200 rounded-lg px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-stone-500 font-mono">{fmtDateTime(e.at)}</span>
                      </div>
                      <div className="font-medium text-stone-900">{e.title}</div>
                      {e.subtitle && <div className="text-sm text-stone-600 mt-0.5">{e.subtitle}</div>}
                      {e.score !== undefined && (
                        <div className="text-sm font-mono text-emerald-700 mt-1">Điểm: {e.score}</div>
                      )}
                      {e.meta && Object.keys(e.meta).length > 0 && (
                        <div className="text-xs text-stone-500 mt-1 font-mono">
                          {Object.entries(e.meta).map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toLocaleString('vi-VN') : v}`).join(' · ')}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}

function KPI({ label, value, subtle }: { label: string; value: string; subtle?: boolean }) {
  return (
    <div className={subtle ? 'opacity-80' : ''}>
      <div className="text-xs uppercase tracking-wider text-stone-500 mb-1">{label}</div>
      <div className={`passport-serif text-stone-900 ${subtle ? 'text-xl' : 'text-3xl font-bold'}`}>{value}</div>
    </div>
  )
}
