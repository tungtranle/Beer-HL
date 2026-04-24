'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiFetch, getUser } from '@/lib/api'
import { handleError } from '@/lib/handleError'
import { toast } from '@/lib/useToast'
import { useGpsTracker } from '@/lib/useGpsTracker'
import { useOfflineSync } from '@/lib/useOfflineSync'
import { useOnlineStatus } from '@/lib/useOnlineStatus'
import {
  Truck, MapPin, Clock, ChevronRight, CheckCircle2,
  Coffee, AlertCircle, Wifi, WifiOff, Download, Navigation,
  CalendarDays, History, Sparkles, TrendingUp, Award, Lock,
} from 'lucide-react'

interface Trip {
  id: string
  trip_number: string
  status: string
  planned_date: string
  total_stops: number
  total_weight_kg: number
  total_distance_km: number
  total_duration_min: number
  vehicle_plate: string
  started_at: string | null
  completed_at: string | null
  completed_stops?: number
  next_stop_customer?: string
  next_stop_address?: string
}

const statusMeta: Record<string, { label: string; chip: string }> = {
  draft: { label: 'Nháp', chip: 'bg-slate-100 text-slate-700' },
  planned: { label: 'Đã lập KH', chip: 'bg-sky-100 text-sky-700' },
  assigned: { label: 'Đã phân công', chip: 'bg-blue-100 text-blue-700' },
  pre_check: { label: 'Kiểm tra xe', chip: 'bg-purple-100 text-purple-700' },
  ready: { label: 'Sẵn sàng', chip: 'bg-indigo-100 text-indigo-700' },
  in_transit: { label: 'Đang giao', chip: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Hoàn thành', chip: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Đã hủy', chip: 'bg-rose-100 text-rose-700' },
  returning: { label: 'Đang về kho', chip: 'bg-violet-100 text-violet-700' },
  reconciled: { label: 'Đã đối soát', chip: 'bg-teal-100 text-teal-700' },
}

function ProgressRing({ percent, size = 64, stroke = 6 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (percent / 100) * c
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={stroke} fill="none" className="text-amber-100" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="currentColor" strokeWidth={stroke} fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        className="text-amber-500 transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  )
}

function greetingByHour(): { hi: string; emoji: string } {
  const h = new Date().getHours()
  if (h < 11) return { hi: 'Chào buổi sáng', emoji: '☀️' }
  if (h < 14) return { hi: 'Chào buổi trưa', emoji: '🌤️' }
  if (h < 18) return { hi: 'Chào buổi chiều', emoji: '🌅' }
  return { hi: 'Chào buổi tối', emoji: '🌙' }
}

export default function DriverPage() {
  const user = getUser()
  const router = useRouter()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [checkinStatus, setCheckinStatus] = useState<string>('loading')
  const [checkinLoading, setCheckinLoading] = useState(false)
  const [monthlyStats, setMonthlyStats] = useState<any>(null)
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null)

  useGpsTracker()
  useOfflineSync()
  const isOnline = useOnlineStatus()

  const [installPrompt, setInstallPrompt] = useState<any>(null)
  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const loadTrips = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/driver/my-trips')
      setTrips(res.data || [])
    } catch (err) {
      handleError(err, { userMessage: 'Không tải được danh sách chuyến' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTrips() }, [])

  useEffect(() => {
    apiFetch<any>('/driver/checkin')
      .then((r: any) => setCheckinStatus(r.data?.status || 'not_checked_in'))
      .catch(() => setCheckinStatus('not_checked_in'))
  }, [])

  useEffect(() => {
    // F6: Driver monthly performance stats (graceful fail — data available after go-live)
    apiFetch<any>('/driver/monthly-stats')
      .then((r: any) => {
        setMonthlyStats(r.data)
        setConsentGiven(r.data?.consent_given ?? true)
      })
      .catch(() => setConsentGiven(false))
  }, [])

  const handleCheckin = async (status: string, reason?: string) => {
    setCheckinLoading(true)
    try {
      const body: any = { status }
      if (reason) body.reason = reason
      await apiFetch('/driver/checkin', { method: 'POST', body })
      setCheckinStatus(status)
      toast.success(status === 'available' ? 'Đã check-in sẵn sàng' : 'Đã báo nghỉ')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setCheckinLoading(false)
    }
  }

  const { activeTrips, completedTrips, todayKpi } = useMemo(() => {
    const active = trips.filter(t => ['in_transit', 'planned', 'assigned', 'ready', 'pre_check'].includes(t.status))
    const done = trips.filter(t => ['completed', 'cancelled', 'returning', 'reconciled'].includes(t.status))
    const totalStops = trips.reduce((s, t) => s + (t.total_stops || 0), 0)
    const completedStops = trips.reduce((s, t) => s + (t.completed_stops || 0), 0)
    const totalKm = trips.reduce((s, t) => s + (t.total_distance_km || 0), 0)
    return {
      activeTrips: active,
      completedTrips: done,
      todayKpi: { trips: trips.length, completedStops, totalStops, totalKm },
    }
  }, [trips])

  const greeting = greetingByHour()
  const initials = (user?.full_name || '?').split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Hero header — gradient brand */}
      <div className="-mx-4 -mt-4 px-4 pt-6 pb-20 bg-gradient-to-br from-brand-500 via-orange-500 to-amber-500 text-white relative overflow-hidden rounded-b-[28px]">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute top-20 -left-16 w-40 h-40 rounded-full bg-yellow-300/20 blur-2xl" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-lg ring-2 ring-white/30 shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-white/80 leading-none">{greeting.hi} {greeting.emoji}</p>
              <h1 className="text-lg font-bold truncate mt-0.5">{user?.full_name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs">
            {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>

        <div className="relative mt-4 flex items-center gap-1.5 text-xs text-white/80">
          <CalendarDays size={13} />
          <span>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
        </div>
      </div>

      {/* KPI cards — overlap hero */}
      <div className="-mt-16 px-1 grid grid-cols-3 gap-2.5">
        <KpiTile label="Chuyến" value={todayKpi.trips} icon={Truck} accent="text-brand-600" />
        <KpiTile label="Điểm giao" value={`${todayKpi.completedStops}/${todayKpi.totalStops}`} icon={MapPin} accent="text-emerald-600" />
        <KpiTile label="Quãng đường" value={`${todayKpi.totalKm.toFixed(0)}km`} icon={Navigation} accent="text-sky-600" />
      </div>

      {installPrompt && (
        <div className="bg-gradient-to-r from-brand-50 to-orange-50 border border-brand-200/60 rounded-2xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-brand-600 shadow-sm">
            <Download size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand-700 leading-tight">Cài đặt ứng dụng</p>
            <p className="text-[11px] text-brand-500 mt-0.5">Truy cập nhanh + dùng offline</p>
          </div>
          <button onClick={() => { installPrompt.prompt(); setInstallPrompt(null) }}
            className="px-3 h-9 bg-brand-500 text-white text-xs rounded-lg font-semibold hover:bg-brand-600 active:scale-95 transition">
            Cài
          </button>
        </div>
      )}

      {/* F6: Monthly Performance Card (BHL WorldClass Strategy) */}
      <MonthlyPerfCard stats={monthlyStats} consentGiven={consentGiven} onEnableConsent={() => router.push('/dashboard/driver/profile')} />

      <CheckinCard
        status={checkinStatus}
        loading={checkinLoading}
        onAvailable={() => handleCheckin('available')}
        onOff={() => handleCheckin('off_duty', 'personal')}
      />

      {activeTrips.length > 0 ? (
        <section>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Sparkles size={15} className="text-amber-500" />
              Đang hoạt động
            </h2>
            <span className="text-[11px] text-gray-500">{activeTrips.length} chuyến</span>
          </div>
          <div className="space-y-3">
            {activeTrips.map(trip => <ActiveTripCard key={trip.id} trip={trip} />)}
          </div>
        </section>
      ) : (
        <EmptyState />
      )}

      {completedTrips.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2 px-1 mt-2">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <History size={15} className="text-gray-400" />
              Lịch sử hôm nay
            </h2>
            <span className="text-[11px] text-gray-500">{completedTrips.length} chuyến</span>
          </div>
          <div className="space-y-2">
            {completedTrips.map(trip => (
              <Link key={trip.id} href={`/dashboard/driver/${trip.id}`}
                className="block bg-white rounded-2xl border border-gray-100 px-4 py-3 active:scale-[0.99] transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-800 truncate">{trip.trip_number}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusMeta[trip.status]?.chip || 'bg-gray-100 text-gray-700'}`}>
                        {statusMeta[trip.status]?.label || trip.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                      {trip.vehicle_plate} · {trip.total_stops} điểm · {trip.total_distance_km.toFixed(1)} km
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function KpiTile({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: any; accent: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] px-3 py-3 border border-gray-100/60">
      <div className={`w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center ${accent}`}>
        <Icon size={15} strokeWidth={2.2} />
      </div>
      <p className="text-[10px] text-gray-500 mt-2 leading-none uppercase tracking-wide font-medium">{label}</p>
      <p className="text-base font-bold text-gray-900 mt-1 leading-none">{value}</p>
    </div>
  )
}

function CheckinCard({ status, loading, onAvailable, onOff }: {
  status: string; loading: boolean; onAvailable: () => void; onOff: () => void
}) {
  if (status === 'loading') return <div className="bg-white h-24 rounded-2xl animate-pulse" />

  if (status === 'not_checked_in') {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center">
            <AlertCircle size={16} className="text-amber-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900 leading-none">Chưa check-in hôm nay</p>
            <p className="text-[11px] text-amber-700 mt-1">Vui lòng báo trạng thái để nhận chuyến</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onAvailable} disabled={loading}
            className="h-12 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 transition shadow-sm shadow-emerald-600/30">
            <CheckCircle2 size={16} /> Sẵn sàng
          </button>
          <button onClick={onOff} disabled={loading}
            className="h-12 bg-white border border-rose-200 text-rose-600 active:scale-95 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 transition">
            <Coffee size={16} /> Hôm nay nghỉ
          </button>
        </div>
      </div>
    )
  }

  if (status === 'available') {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/40">
          <CheckCircle2 size={20} strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-emerald-900 leading-none">Đã sẵn sàng nhận chuyến</p>
          <p className="text-[11px] text-emerald-700 mt-1">{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} hôm nay</p>
        </div>
        <button onClick={onOff} disabled={loading}
          className="px-3 h-9 text-xs bg-white border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-50 active:scale-95 disabled:opacity-50 transition font-medium">
          Báo nghỉ
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-rose-50 to-red-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
        <Coffee size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-rose-900 leading-none">Đang nghỉ hôm nay</p>
        <p className="text-[11px] text-rose-700 mt-1">Bạn không nhận chuyến mới</p>
      </div>
      <button onClick={onAvailable} disabled={loading}
        className="px-3 h-9 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition font-semibold">
        Quay lại
      </button>
    </div>
  )
}

function ActiveTripCard({ trip }: { trip: Trip }) {
  const meta = statusMeta[trip.status] || { label: trip.status, chip: 'bg-gray-100 text-gray-700' }
  const completed = trip.completed_stops ?? 0
  const total = trip.total_stops || 0
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  const isInTransit = trip.status === 'in_transit'

  return (
    <Link href={`/dashboard/driver/${trip.id}`}
      className="block bg-white rounded-2xl shadow-[0_4px_16px_-6px_rgba(0,0,0,0.08)] border border-gray-100/80 overflow-hidden active:scale-[0.99] transition">
      <div className={`h-1.5 ${isInTransit ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-blue-400 to-indigo-500'}`} />

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="relative w-16 h-16 shrink-0">
            <ProgressRing percent={percent} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-bold text-gray-900 leading-none">{percent}%</span>
              <span className="text-[9px] text-gray-500 mt-0.5">{completed}/{total}</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-base font-bold text-gray-900 truncate">{trip.trip_number}</p>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <Truck size={12} /> {trip.vehicle_plate}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${meta.chip}`}>
                {meta.label}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 mt-3 text-[11px]">
              <Stat icon={MapPin} value={`${total} điểm`} />
              <Stat icon={Navigation} value={`${trip.total_distance_km.toFixed(0)} km`} />
              <Stat icon={Clock} value={`~${trip.total_duration_min}p`} />
            </div>
          </div>
        </div>

        {isInTransit && trip.next_stop_customer && (
          <div className="mt-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/40">
              <MapPin size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-blue-600 font-semibold leading-none">Điểm tiếp theo</p>
              <p className="text-xs font-semibold text-blue-900 truncate mt-1">{trip.next_stop_customer}</p>
              {trip.next_stop_address && <p className="text-[10px] text-blue-600/80 truncate">{trip.next_stop_address}</p>}
            </div>
          </div>
        )}

        <div className={`mt-3 h-11 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm ${
          isInTransit
            ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/40'
            : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm shadow-blue-500/30'
        }`}>
          {isInTransit ? 'Tiếp tục giao hàng' : 'Bắt đầu chuyến'}
          <ChevronRight size={16} />
        </div>
      </div>
    </Link>
  )
}

function Stat({ icon: Icon, value }: { icon: any; value: string }) {
  return (
    <div className="flex items-center gap-1 text-gray-600">
      <Icon size={11} className="text-gray-400 shrink-0" />
      <span className="truncate">{value}</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white shadow-sm mx-auto flex items-center justify-center mb-3">
        <CheckCircle2 size={28} className="text-emerald-500" />
      </div>
      <p className="text-sm font-bold text-emerald-800">Chưa có chuyến hôm nay</p>
      <p className="text-[11px] text-emerald-700 mt-1 max-w-[260px] mx-auto leading-relaxed">
        Liên hệ điều phối viên nếu bạn được phân công nhưng chưa thấy chuyến trong danh sách.
      </p>
    </div>
  )
}

// F6: Driver Performance Dashboard (BHL WorldClass Strategy)
// NĐ13/2023: GPS data for individual KPI requires explicit consent (EC-06)
function MonthlyPerfCard({
  stats,
  consentGiven,
  onEnableConsent,
}: {
  stats: any
  consentGiven: boolean | null
  onEnableConsent: () => void
}) {
  const now = new Date()
  const monthLabel = now.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
            <TrendingUp size={14} className="text-amber-600" />
          </div>
          <span className="text-sm font-bold text-gray-800">Hiệu suất tháng này</span>
        </div>
        <span className="text-[11px] text-gray-400">{monthLabel}</span>
      </div>

      <div className="p-4">
        {stats ? (
          <>
            {/* Core metrics — always visible (aggregate, not GPS-personal) */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-brand-600 leading-none">{stats.trips_count ?? '—'}</div>
                <div className="text-[11px] text-gray-500 mt-1">Chuyến</div>
              </div>
              <div className="text-center border-x border-gray-100">
                <div className="text-2xl font-bold text-sky-600 leading-none">
                  {stats.total_km != null ? Math.round(stats.total_km) : '—'}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">km tổng</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600 leading-none">
                  {stats.on_time_rate != null ? `${Math.round(stats.on_time_rate)}%` : '—'}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">Đúng giờ</div>
              </div>
            </div>

            {/* Streak */}
            {stats.streak_days > 0 && (
              <div className="mb-3 flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2">
                <span className="text-lg">🔥</span>
                <p className="text-xs text-orange-700 font-semibold">{stats.streak_days} ngày liên tiếp hoàn thành đúng giờ!</p>
              </div>
            )}

            {/* Rank — requires NĐ13 GPS consent */}
            {consentGiven ? (
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-400/40">
                  <Award size={18} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wide leading-none">Xếp hạng đội xe</p>
                  <p className="text-sm font-bold text-amber-900 mt-0.5">
                    #{stats.rank ?? '?'} / {stats.total_drivers ?? '?'} tài xế
                  </p>
                </div>
                <div className="text-right text-xs text-amber-700 font-medium">
                  {stats.efficiency_score != null && (
                    <span className="text-base font-bold">{stats.efficiency_score}<span className="text-[10px] font-normal">/100</span></span>
                  )}
                  {/* Note: rank normalized by route difficulty per strategy */}
                </div>
              </div>
            ) : (
              <button
                onClick={onEnableConsent}
                className="w-full flex items-center gap-2.5 bg-gray-50 border border-dashed border-gray-200 rounded-xl px-3 py-2.5 text-left active:scale-[0.99] transition"
              >
                <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                  <Lock size={15} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 leading-none">Xem xếp hạng & điểm thưởng</p>
                  <p className="text-[10px] text-gray-400 mt-1">Cần bật chia sẻ GPS (NĐ13 — tùy chọn)</p>
                </div>
                <span className="text-xs text-brand-500 font-semibold shrink-0">Bật →</span>
              </button>
            )}
          </>
        ) : (
          <div className="py-6 text-center text-gray-400">
            <div className="text-3xl mb-2">📊</div>
            <p className="text-xs font-medium text-gray-500">Đang tổng hợp dữ liệu tháng này</p>
            <p className="text-[11px] text-gray-400 mt-1">Sẽ hiển thị sau khi hệ thống live</p>
          </div>
        )}
      </div>
    </div>
  )
}
