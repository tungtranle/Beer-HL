'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

interface Event {
  at: string
  kind: string
  title: string
  subtitle?: string
  amount_vnd?: number
  meta?: Record<string, any>
}
interface Util {
  total_km: number
  active_days: number
  total_trips: number
  avg_km_per_day: number
  first_trip_at: string | null
  last_trip_at: string | null
  last_service_at: string | null
}
interface Vehicle {
  id: string
  plate_number: string
  vehicle_type?: string
  capacity_kg?: number
  year_of_manufacture?: number
  fuel_type?: string
  health_score?: number
  current_km?: number
  status?: string
}

const fmtVND = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ'
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('vi-VN') : '—'
const fmtDateShort = (s: string) => { const d = new Date(s); return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}` }
const fmtDateTime = (s: string | null) => s ? new Date(s).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
function daysUntil(s: string): number { return Math.ceil((new Date(s).getTime() - Date.now()) / 86400000) }

function docStatus(days: number) {
  if (days < 0)  return { color: 'text-red-700',    bg: 'bg-red-50 border-red-300',    badge: 'bg-red-600 text-white',    icon: '🚨' }
  if (days <= 30) return { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-300', badge: 'bg-amber-500 text-white', icon: '⚠️' }
  return             { color: 'text-green-700',   bg: 'bg-green-50 border-green-200',  badge: 'bg-green-600 text-white',  icon: '✅' }
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:      { label: 'Đang hoạt động', color: 'bg-green-100 text-green-800 border-green-300' },
  maintenance: { label: 'Đang bảo trì',   color: 'bg-amber-100 text-amber-800 border-amber-300' },
  broken:      { label: 'Hỏng hóc',       color: 'bg-red-100 text-red-700 border-red-300' },
  impounded:   { label: 'Đang bị giữ',    color: 'bg-gray-200 text-gray-700 border-gray-400' },
}

const KIND_BADGE: Record<string, { label: string; cls: string; dot: string }> = {
  workorder:       { label: 'Bảo dưỡng',        cls: 'bg-amber-100 text-amber-800 border-amber-300',       dot: 'bg-amber-400' },
  fuel:            { label: 'Đổ dầu',            cls: 'bg-sky-100 text-sky-800 border-sky-300',             dot: 'bg-sky-400' },
  'trip.start':    { label: 'Xuất phát',         cls: 'bg-blue-100 text-blue-800 border-blue-300',          dot: 'bg-blue-500' },
  'trip.complete': { label: 'Hoàn thành chuyến', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500' },
  'doc.expiry':    { label: 'Hạn giấy tờ',       cls: 'bg-red-100 text-red-700 border-red-300',             dot: 'bg-red-500' },
}

function HealthArc({ score }: { score: number }) {
  const r = 36; const cx = 44; const cy = 44
  const circ = Math.PI * r
  const fill = Math.max(0, Math.min(100, score))
  const dash = (fill / 100) * circ
  const color = fill >= 80 ? '#16a34a' : fill >= 60 ? '#f59e0b' : '#dc2626'
  return (
    <svg viewBox="0 0 88 56" className="w-24 h-16">
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="#e5e7eb" strokeWidth="8" strokeLinecap="round"/>
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}/>
      <text x={cx} y={cy-4} textAnchor="middle" fill={color} style={{fontSize:'14px',fontWeight:700}}>{score}</text>
      <text x={cx} y={cy+10} textAnchor="middle" fill="#9ca3af" style={{fontSize:'9px'}}>/100</text>
    </svg>
  )
}

export default function VehicleProfilePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [util, setUtil] = useState<Util | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      apiFetch<any>(`/tms/vehicles/${id}`).then(r => r.data).catch(() => null),
      apiFetch<any>(`/vehicles/${id}/utilization`).then(r => r.data).catch(() => null),
      apiFetch<any>(`/vehicles/${id}/timeline`).then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
    ]).then(([v, u, e]) => { setVehicle(v); setUtil(u); setEvents(e) }).finally(() => setLoading(false))
  }, [id])

  const docEvents = useMemo(() => {
    const docs: Record<string, { date: string }> = {}
    events.filter(e => e.kind === 'doc.expiry' || e.kind === 'doc_expiry').forEach(e => {
      const match = e.title?.match(/:\s*(\w+)/i)
      const key = match ? match[1].toLowerCase() : 'document'
      if (!docs[key] || new Date(e.at) > new Date(docs[key].date)) docs[key] = { date: e.at }
    })
    const DOC_LABEL: Record<string, string> = { registration: 'Đăng ký xe', insurance: 'Bảo hiểm', inspection: 'Đăng kiểm' }
    return Object.entries(docs).map(([key, { date }]) => ({ key, date, label: DOC_LABEL[key] || key, days: daysUntil(date) })).sort((a,b) => a.days - b.days)
  }, [events])

  const totalFuelCost = useMemo(() => events.filter(e => e.kind === 'fuel').reduce((s, e) => s + (e.amount_vnd || 0), 0), [events])
  const costPerKm = util && util.total_km > 0 && totalFuelCost > 0 ? totalFuelCost / util.total_km : null
  const SERVICE_INTERVAL = 10000
  const nextServiceKm = vehicle?.current_km ? Math.ceil((vehicle.current_km + 1) / SERVICE_INTERVAL) * SERVICE_INTERVAL : null
  const kmToService = nextServiceKm && vehicle?.current_km ? nextServiceKm - vehicle.current_km : null
  const serviceProgressPct = vehicle?.current_km ? ((vehicle.current_km % SERVICE_INTERVAL) / SERVICE_INTERVAL) * 100 : null
  const statusInfo = STATUS_LABEL[vehicle?.status || 'active'] || STATUS_LABEL.active
  const hasDocAlerts = docEvents.some(d => d.days < 0)
  const hasDocWarnings = !hasDocAlerts && docEvents.some(d => d.days <= 30)

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-stone-400">
      <div className="animate-spin w-6 h-6 border-4 border-stone-300 border-t-stone-600 rounded-full mr-3"/>
      Đang tải hồ sơ tài sản...
    </div>
  )

  return (
    <div className="bg-stone-50 min-h-screen -mx-6 -my-6 px-6 md:px-8 py-8">
      <div className="max-w-3xl mx-auto space-y-4">

        <button onClick={() => router.back()} className="text-sm text-stone-500 hover:text-stone-800">← Quay lại</button>

        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          {(hasDocAlerts || hasDocWarnings) && (
            <div className={`px-5 py-2 text-sm font-semibold flex items-center gap-2 ${hasDocAlerts ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
              {hasDocAlerts ? '🚨 Có giấy tờ hết hạn — cần xử lý ngay!' : '⚠️ Có giấy tờ sắp hết hạn'}
            </div>
          )}
          <div className="p-6 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">Hồ sơ phương tiện</p>
              <h1 className="text-5xl passport-serif font-bold text-stone-900 leading-none">{vehicle?.plate_number || '—'}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
                {vehicle?.vehicle_type && <span className="text-xs px-2 py-1 bg-stone-100 rounded-full text-stone-600">{vehicle.vehicle_type}</span>}
                {vehicle?.capacity_kg && <span className="text-xs px-2 py-1 bg-stone-100 rounded-full text-stone-600">⚖️ {(vehicle.capacity_kg/1000).toFixed(1)}T</span>}
                {vehicle?.fuel_type && <span className="text-xs px-2 py-1 bg-stone-100 rounded-full text-stone-600">⛽ {vehicle.fuel_type}</span>}
                {vehicle?.year_of_manufacture && <span className="text-xs px-2 py-1 bg-stone-100 rounded-full text-stone-600">Năm {vehicle.year_of_manufacture}</span>}
              </div>
            </div>
            {vehicle?.health_score !== undefined && (
              <div className="flex flex-col items-center flex-shrink-0">
                <HealthArc score={vehicle.health_score}/>
                <p className="text-[10px] text-stone-400 -mt-1">Điểm sức khỏe</p>
              </div>
            )}
          </div>
        </div>

        {/* KPIs */}
        {util && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon="🛣️" label="Tổng km đã chạy" value={`${util.total_km.toLocaleString('vi-VN')} km`}/>
            <KPICard icon="📦" label="Số chuyến" value={String(util.total_trips)}/>
            <KPICard icon="📅" label="Ngày hoạt động" value={String(util.active_days)}/>
            <KPICard icon="📊" label="TB km/ngày" value={`${util.avg_km_per_day.toFixed(0)} km`}/>
          </div>
        )}

        {/* Documents + Maintenance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-700 mb-3">📋 Trạng thái giấy tờ</h2>
            {docEvents.length === 0 ? (
              <p className="text-sm text-stone-400 italic py-4 text-center">Chưa có dữ liệu giấy tờ</p>
            ) : (
              <div className="space-y-2">
                {docEvents.map(d => {
                  const s = docStatus(d.days)
                  return (
                    <div key={d.key} className={`flex items-center justify-between p-2.5 rounded-lg border ${s.bg}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{s.icon}</span>
                        <div>
                          <div className={`text-sm font-medium ${s.color}`}>{d.label}</div>
                          <div className="text-xs text-stone-400">{fmtDateShort(d.date)}</div>
                        </div>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.badge}`}>
                        {d.days < 0 ? `Quá ${Math.abs(d.days)}d` : d.days === 0 ? 'Hôm nay!' : `${d.days} ngày`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-700 mb-3">🔧 Bảo dưỡng & Chi phí</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-500">Bảo dưỡng cuối</span>
                <span className="text-sm font-medium text-stone-700">{fmtDate(util?.last_service_at || null)}</span>
              </div>
              {serviceProgressPct !== null && kmToService !== null && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stone-500">Đến BH tiếp (~{SERVICE_INTERVAL/1000}K km)</span>
                    <span className={`font-semibold ${kmToService <= 1000 ? 'text-red-600' : kmToService <= 2500 ? 'text-amber-600' : 'text-stone-600'}`}>
                      còn {kmToService.toLocaleString('vi-VN')} km
                    </span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${serviceProgressPct >= 90 ? 'bg-red-500' : serviceProgressPct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{width:`${serviceProgressPct}%`}}/>
                  </div>
                </div>
              )}
              {costPerKm && (
                <div className="flex justify-between items-center border-t border-stone-100 pt-2">
                  <span className="text-xs text-stone-500">Chi phí NL/km</span>
                  <span className="text-sm font-semibold text-emerald-700">{fmtVND(costPerKm)}/km</span>
                </div>
              )}
              {totalFuelCost > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-stone-500">Tổng NL ghi nhận</span>
                  <span className="text-sm font-medium text-stone-600">{fmtVND(totalFuelCost)}</span>
                </div>
              )}
              <div className="border-t border-stone-100 pt-2 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500">Chuyến đầu</span>
                  <span className="text-stone-700">{fmtDate(util?.first_trip_at || null)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500">Chuyến gần nhất</span>
                  <span className="text-stone-700">{fmtDate(util?.last_trip_at || null)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-5">
          <h2 className="text-xl passport-serif font-bold text-stone-900 mb-4">Nhật ký vận hành</h2>
          {events.length === 0 ? (
            <div className="text-stone-400 italic py-8 text-center border border-dashed border-stone-200 rounded-lg">
              Chưa có sự kiện nào được ghi nhận
            </div>
          ) : (
            <ol className="space-y-2 border-l-2 border-stone-200 pl-6 ml-2">
              {events.map((e, i) => {
                const badge = KIND_BADGE[e.kind] || { label: e.kind, cls: 'bg-stone-100 text-stone-600 border-stone-300', dot: 'bg-stone-400' }
                return (
                  <li key={i} className="relative">
                    <span className={`absolute -left-[31px] top-3.5 w-3 h-3 rounded-full border-2 border-white ${badge.dot}`}/>
                    <div className="bg-stone-50 hover:bg-white border border-stone-100 rounded-lg px-4 py-3 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                        <span className="text-xs text-stone-400 font-mono">{fmtDateTime(e.at)}</span>
                      </div>
                      <div className="font-medium text-stone-800 text-sm">{e.title}</div>
                      {e.subtitle && <div className="text-xs text-stone-500 mt-0.5">{e.subtitle}</div>}
                      {(e.amount_vnd !== undefined && e.amount_vnd !== 0) && (
                        <div className="text-sm font-mono text-emerald-700 mt-1">{fmtVND(e.amount_vnd)}</div>
                      )}
                      {e.meta && Object.keys(e.meta).length > 0 && (
                        <div className="text-xs text-stone-500 mt-1 font-mono">
                          {Object.entries(e.meta).map(([k,v]) => `${k}: ${typeof v==='number' ? v.toLocaleString('vi-VN') : v}`).join(' · ')}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

      </div>
    </div>
  )
}

function KPICard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4">
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-2xl font-bold passport-serif text-stone-900">{value}</div>
      <div className="text-xs text-stone-400 mt-1">{label}</div>
    </div>
  )
}
