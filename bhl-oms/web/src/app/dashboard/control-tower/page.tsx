'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { apiFetch, getUser } from '@/lib/api'
import { toast } from '@/lib/useToast'
import { useRouter } from 'next/navigation'
import { useDataRefresh } from '@/lib/notifications'

// ─── Types ───────────────────────────────────────────

interface ControlTowerStats {
  total_trips_today: number
  in_transit: number
  completed: number
  planned: number
  total_stops_today: number
  stops_delivered: number
  stops_failed: number
  stops_pending: number
  active_vehicles: number
  idle_vehicles: number
  exception_count: number
  on_time_rate: number
  total_weight_kg: number
  total_distance_km: number
}

interface TripException {
  id: string
  trip_id: string
  trip_number: string
  type: string               // late_eta | idle_vehicle | failed_stop | no_checkin
  priority: string           // P0 | P1
  title: string
  description: string
  vehicle_plate: string
  driver_name: string
  stop_id?: string
  customer_name: string
  created_at: string
}

interface Trip {
  id: string; trip_number: string; vehicle_plate: string; driver_name: string
  status: string; total_distance_km: number; total_weight_kg: number
  total_stops: number; planned_date: string
}

interface GPSVehicle {
  vehicle_id: string
  vehicle_plate: string
  driver_name: string
  trip_status: string
  lat: number
  lng: number
  speed: number
  heading: number
  timestamp: string
}

interface TripStop {
  id: string
  stop_order: number
  customer_name: string
  status: string
}

// ─── Constants ───────────────────────────────────────

const metricColor = (type: 'ok' | 'warn' | 'err' | 'default') => ({
  ok: 'bg-green-50 text-green-700',
  warn: 'bg-amber-50 text-amber-700',
  err: 'bg-red-50 text-red-700',
  default: 'bg-gray-50 text-gray-900',
}[type])

const tripStatusDot: Record<string, string> = {
  in_transit: 'bg-green-500',
  assigned: 'bg-amber-500',
  ready: 'bg-amber-500',
  planned: 'bg-gray-400',
  completed: 'bg-blue-400',
}

const tripStatusLabel: Record<string, string> = {
  planned: 'Đã lên KH', assigned: 'Phân công', ready: 'Sẵn sàng',
  in_transit: 'Đang giao', completed: 'Hoàn thành', cancelled: 'Đã hủy',
}

const exceptionTypeLabel: Record<string, string> = {
  late_eta: 'Trễ ETA', idle_vehicle: 'Xe chưa xuất bến',
  failed_stop: 'Giao thất bại', no_checkin: 'Chưa check-in',
}

const exceptionTypeDescription: Record<string, string> = {
  late_eta: 'Xe dự kiến giao trễ hơn thời gian cam kết. Cần liên hệ tài xế để nắm tình hình.',
  idle_vehicle: 'Xe được phân công nhưng chưa xuất phát. Kiểm tra tài xế đã nhận chuyến chưa.',
  failed_stop: 'Giao hàng thất bại tại điểm giao. Cần xem xét giao lại hoặc hủy.',
  no_checkin: 'Tài xế chưa check-in tại điểm giao sau thời gian dự kiến. Liên hệ xác nhận vị trí.',
}

const emptyStateText: Record<string, string> = {
  dispatcher: 'Không có cảnh báo — tốt lắm! 🎉',
  admin: 'Không có cảnh báo — tốt lắm! 🎉',
}

// ─── Main Page ───────────────────────────────────────

export default function ControlTowerPage() {
  const router = useRouter()
  const user = getUser()
  const [stats, setStats] = useState<ControlTowerStats | null>(null)
  const [exceptions, setExceptions] = useState<TripException[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [vehicles, setVehicles] = useState<GPSVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [mapFilter, setMapFilter] = useState<string>('')
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  // Modal states
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [tripStops, setTripStops] = useState<TripStop[]>([])
  const [moveStopModal, setMoveStopModal] = useState<{ stopId: string; fromTripId: string } | null>(null)
  const [bulkMoveStops, setBulkMoveStops] = useState<Set<string>>(new Set())
  const [bulkMoveModal, setBulkMoveModal] = useState(false)
  const [moveTargetTrip, setMoveTargetTrip] = useState('')
  const [cancelConfirm, setCancelConfirm] = useState<Trip | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [driverModal, setDriverModal] = useState<GPSVehicle | null>(null)
  const [leftView, setLeftView] = useState<'trips' | 'fleet'>('trips')
  useEffect(() => {
    if (!user || !['admin', 'dispatcher', 'management'].includes(user.role)) {
      router.replace('/dashboard')
      return
    }
    loadAll()
    const interval = setInterval(loadAll, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadAll = useCallback(async () => {
    try {
      const [statsRes, exceptionsRes, tripsRes]: any[] = await Promise.all([
        apiFetch('/trips/control-tower/stats'),
        apiFetch('/trips/exceptions'),
        apiFetch('/trips?limit=50'),
      ])
      setStats(statsRes.data)
      setExceptions(exceptionsRes.data || [])
      setTrips(tripsRes.data || [])
    } catch (err) {
      console.error('Control tower load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Also refresh instantly via WebSocket when order/trip changes
  useDataRefresh(['order', 'trip'], loadAll)

  // GPS WebSocket
  useEffect(() => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('bhl_token')
    if (!token) return

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/api/gps/ws?token=${token}`)
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'position') {
          setVehicles(prev => {
            const idx = prev.findIndex(v => v.vehicle_id === data.vehicle_id)
            const entry: GPSVehicle = data
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = entry
              return next
            }
            return [...prev, entry]
          })
        }
      } catch { /* ignore */ }
    }
    return () => ws.close()
  }, [])

  // Initialize Leaflet map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return
    let cancelled = false

    const initMap = async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      if (cancelled || leafletMapRef.current) return

      const map = L.map(mapRef.current!, { zoomControl: true }).setView([20.86, 106.68], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)
      leafletMapRef.current = map
    }
    initMap()
    return () => { cancelled = true }
  }, [])

  // Update markers when vehicles change
  useEffect(() => {
    if (!leafletMapRef.current || typeof window === 'undefined') return
    import('leaflet').then(({ default: L }) => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      const filtered = mapFilter ? vehicles.filter(v => v.trip_status === mapFilter) : vehicles
      const anomalyPlates = new Set(exceptions.map(e => e.vehicle_plate))

      filtered.forEach(v => {
        const isAnomaly = anomalyPlates.has(v.vehicle_plate)
        const color = isAnomaly ? '#ef4444' : v.speed > 5 ? '#22c55e' : v.speed >= 0 ? '#f59e0b' : '#9ca3af'
        const pulseHtml = isAnomaly
          ? `<div style="position:relative"><div style="position:absolute;top:-6px;left:-6px;width:24px;height:24px;border-radius:50%;background:rgba(239,68,68,.3);animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite"></div><div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3);position:relative;z-index:1"></div></div>`
          : `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>`
        const icon = L.divIcon({
          className: '',
          html: pulseHtml,
          iconSize: [12, 12],
        })
        const marker = L.marker([v.lat, v.lng], { icon })
          .addTo(leafletMapRef.current)
          .bindPopup(`<b>${v.vehicle_plate}</b><br>${v.driver_name}<br>${v.speed} km/h${isAnomaly ? '<br><b style="color:red">⚠ Cảnh báo</b>' : ''}`)
        marker.on('click', () => setDriverModal(v))
        markersRef.current.push(marker)
      })
    })
  }, [vehicles, mapFilter])

  // Load stops for a trip (for move stop)
  const loadTripStops = async (tripId: string) => {
    try {
      const res: any = await apiFetch(`/trips/${tripId}`)
      setTripStops(res.data?.stops || [])
    } catch { setTripStops([]) }
  }

  const handleTripClick = (t: Trip) => {
    setSelectedTrip(t)
    loadTripStops(t.id)
  }

  const handleMoveStop = async () => {
    if (!moveStopModal || !moveTargetTrip) return
    setActionLoading(true)
    try {
      await apiFetch(`/trips/${moveStopModal.fromTripId}/stops/${moveStopModal.stopId}/move`, {
        method: 'POST',
        body: { target_trip_id: moveTargetTrip },
      })
      setMoveStopModal(null)
      setMoveTargetTrip('')
      setSelectedTrip(null)
      loadAll()
    } catch (err: any) {
      toast.error(err.message || 'Lỗi chuyển điểm')
    } finally { setActionLoading(false) }
  }

  const handleBulkMoveStops = async () => {
    if (!selectedTrip || !moveTargetTrip || bulkMoveStops.size === 0) return
    setActionLoading(true)
    try {
      const stopIds = Array.from(bulkMoveStops)
      for (const stopId of stopIds) {
        await apiFetch(`/trips/${selectedTrip.id}/stops/${stopId}/move`, {
          method: 'POST',
          body: { target_trip_id: moveTargetTrip },
        })
      }
      setBulkMoveModal(false)
      setBulkMoveStops(new Set())
      setMoveTargetTrip('')
      setSelectedTrip(null)
      loadAll()
    } catch (err: any) {
      toast.error(err.message || 'Lỗi chuyển điểm')
    } finally { setActionLoading(false) }
  }

  const toggleBulkStop = (stopId: string) => {
    setBulkMoveStops(prev => {
      const next = new Set(prev)
      if (next.has(stopId)) next.delete(stopId)
      else next.add(stopId)
      return next
    })
  }

  const handleCancelTrip = async () => {
    if (!cancelConfirm) return
    setActionLoading(true)
    try {
      await apiFetch(`/trips/${cancelConfirm.id}/cancel`, {
        method: 'POST',
        body: { reason: cancelReason || 'Dispatcher hủy từ Control Tower' },
      })
      setCancelConfirm(null)
      setCancelReason('')
      setSelectedTrip(null)
      loadAll()
    } catch (err: any) {
      toast.error(err.message || 'Lỗi hủy chuyến')
    } finally { setActionLoading(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const activeTrips = trips.filter(t => ['in_transit', 'assigned', 'ready'].includes(t.status))

  return (
    <>
    <div className="flex h-full gap-0 overflow-hidden">
      <style>{`@keyframes ping{75%,100%{transform:scale(2);opacity:0}}`}</style>
      {/* ═══ LEFT COLUMN (25%) — Metrics + Trip List + VRP ═══ */}
      <div className="w-[25%] min-w-[280px] border-r bg-white flex flex-col overflow-hidden">
        {/* Metric Cards */}
        <div className="p-3 border-b space-y-2">
          <h2 className="text-sm font-bold text-gray-800 mb-2">📊 Hôm nay</h2>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Chuyến" value={stats?.total_trips_today ?? 0} type="default" />
            <MetricCard label="Đang giao" value={stats?.in_transit ?? 0} type={stats?.in_transit ? 'ok' : 'default'} />
            <MetricCard label="Hoàn thành" value={stats?.completed ?? 0} type="ok" />
            <MetricCard label="Chờ xuất" value={stats?.planned ?? 0} type={stats?.planned ? 'warn' : 'default'} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Điểm giao" value={`${stats?.stops_delivered ?? 0}/${stats?.total_stops_today ?? 0}`} type="default" />
            <MetricCard label="Thất bại" value={stats?.stops_failed ?? 0} type={stats?.stops_failed ? 'err' : 'ok'} />
            <MetricCard label="Xe đang chạy" value={stats?.active_vehicles ?? 0} type="ok" />
            <MetricCard label="Cảnh báo" value={exceptions.length} type={exceptions.length > 0 ? 'err' : 'ok'} />
          </div>
        </div>

        {/* Trip/Fleet Toggle (Task 6.17) */}
        <div className="flex border-b">
          <button onClick={() => setLeftView('trips')}
            className={`flex-1 text-xs py-2 font-medium transition ${leftView === 'trips' ? 'text-brand-600 border-b-2 border-brand-500' : 'text-gray-400 hover:text-gray-600'}`}>
            🚛 Chuyến ({activeTrips.length})
          </button>
          <button onClick={() => setLeftView('fleet')}
            className={`flex-1 text-xs py-2 font-medium transition ${leftView === 'fleet' ? 'text-brand-600 border-b-2 border-brand-500' : 'text-gray-400 hover:text-gray-600'}`}>
            🚚 Đội xe ({vehicles.length})
          </button>
        </div>

        {/* Trip List */}
        {leftView === 'trips' && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 pb-1">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chuyến xe hôm nay</h3>
          </div>
          {activeTrips.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-gray-400">
              {emptyStateText[user?.role || 'dispatcher'] || 'Không có chuyến nào'}
            </div>
          ) : (
            <>
            <div className="space-y-0.5 px-2 pb-2">
              {activeTrips.map(t => (
                <div key={t.id}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer text-sm ${selectedTrip?.id === t.id ? 'bg-brand-50 ring-1 ring-brand-300' : ''}`}
                  onClick={() => handleTripClick(t)}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tripStatusDot[t.status] || 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">{t.trip_number}</div>
                    <div className="text-xs text-gray-400 truncate">{t.vehicle_plate} — {t.driver_name}</div>
                  </div>
                  <span className="text-xs text-gray-500">{t.total_stops} stops</span>
                </div>
              ))}
            </div>

            {/* Trip detail panel */}
            {selectedTrip && (
              <div className="border-t px-3 py-2 space-y-2 bg-gray-50">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-700">{selectedTrip.trip_number}</span>
                  <button onClick={() => setSelectedTrip(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <div className="text-xs text-gray-500">
                  {selectedTrip.vehicle_plate} · {selectedTrip.driver_name} · {selectedTrip.total_stops} điểm
                </div>

                {/* Stops list with move action */}
                {tripStops.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">Điểm giao chờ</span>
                      {bulkMoveStops.size > 0 && (
                        <button
                          onClick={() => setBulkMoveModal(true)}
                          className="text-xs bg-brand-500 text-white px-2 py-1 rounded font-medium"
                        >
                          Chuyển {bulkMoveStops.size} điểm →
                        </button>
                      )}
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {tripStops.filter(s => s.status === 'pending').map(s => (
                        <div key={s.id} className="flex items-center gap-1 text-xs bg-white rounded px-2 py-1">
                          <input
                            type="checkbox"
                            checked={bulkMoveStops.has(s.id)}
                            onChange={() => toggleBulkStop(s.id)}
                            className="w-3 h-3 rounded border-gray-300 text-brand-500"
                          />
                          <span className="text-gray-400">#{s.stop_order}</span>
                          <span className="flex-1 truncate">{s.customer_name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setMoveStopModal({ stopId: s.id, fromTripId: selectedTrip.id }) }}
                            className="text-brand-500 hover:text-brand-700 font-medium"
                            title="Chuyển sang chuyến khác"
                          >↗</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trip actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/dashboard/trips`)}
                    className="flex-1 text-xs bg-white border border-gray-200 py-1.5 rounded-lg hover:bg-gray-50"
                  >Chi tiết</button>
                  {['planned', 'assigned', 'ready'].includes(selectedTrip.status) && (
                    <button
                      onClick={() => setCancelConfirm(selectedTrip)}
                      className="text-xs bg-red-50 text-red-600 border border-red-200 py-1.5 px-3 rounded-lg hover:bg-red-100"
                    >Hủy chuyến</button>
                  )}
                </div>
              </div>
            )}
          </>
          )}
        </div>
        )}

        {/* Fleet View (Task 6.17) */}
        {leftView === 'fleet' && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 pb-1">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Đội xe đang hoạt động</h3>
          </div>
          {vehicles.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-gray-400">Chưa có xe nào online</div>
          ) : (
            <div className="space-y-0.5 px-2 pb-2">
              {vehicles.map(v => (
                <div key={v.vehicle_id}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer text-sm"
                  onClick={() => setDriverModal(v)}>
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${v.speed > 5 ? 'bg-green-500' : v.speed >= 0 ? 'bg-amber-500' : 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800">{v.vehicle_plate}</div>
                    <div className="text-xs text-gray-400 truncate">{v.driver_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium text-gray-600">{v.speed} km/h</div>
                    <div className={`text-xs ${v.trip_status === 'in_transit' ? 'text-green-600' : 'text-amber-600'}`}>
                      {tripStatusLabel[v.trip_status] || v.trip_status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* VRP Action Bar */}
        <div className="flex gap-2 px-3 pb-3 pt-2 border-t">
          <button
            onClick={() => router.push('/dashboard/planning')}
            className="flex-1 bg-brand-500 text-white text-xs py-2 rounded-lg font-medium hover:bg-brand-600"
          >
            Chạy VRP
          </button>
          <button
            onClick={() => router.push('/dashboard/trips')}
            className="text-xs border border-gray-200 py-2 px-3 rounded-lg hover:bg-gray-50"
          >
            DS Chuyến
          </button>
        </div>
      </div>

      {/* ═══ CENTER COLUMN (50%) — GPS Map ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Map filter chips */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white border-b text-xs">
          <span className="text-gray-500">Lọc:</span>
          {[
            { label: 'Tất cả', value: '' },
            { label: '🟢 Đang chạy', value: 'in_transit' },
            { label: '🟡 Chờ', value: 'assigned' },
            { label: '⚫ Offline', value: 'offline' },
          ].map(f => (
            <button key={f.value}
              onClick={() => setMapFilter(f.value)}
              className={`px-2 py-1 rounded-full transition ${mapFilter === f.value ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-gray-400">{vehicles.length} xe online</span>
        </div>
        {/* Map container */}
        <div ref={mapRef} className="flex-1" />
      </div>

      {/* ═══ RIGHT COLUMN (25%) — Alerts + Exceptions ═══ */}
      <div className="w-[25%] min-w-[280px] border-l bg-white flex flex-col overflow-hidden">
        <div className="p-3 border-b">
          <h2 className="text-sm font-bold text-gray-800">⚠️ Cảnh báo ({exceptions.length})</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {exceptions.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-gray-400">
              {emptyStateText[user?.role || 'dispatcher']}
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {exceptions.map(exc => (
                <AlertItem key={exc.id} exception={exc} onAction={loadAll} />
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats Footer */}
        <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>OTD Rate</span>
            <span className={`font-medium ${(stats?.on_time_rate ?? 0) >= 90 ? 'text-green-600' : 'text-amber-600'}`}>
              {(stats?.on_time_rate ?? 0).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span>Tổng tải</span>
            <span className="font-medium">{((stats?.total_weight_kg ?? 0) / 1000).toFixed(1)}T</span>
          </div>
          <div className="flex justify-between">
            <span>Tổng quãng đường</span>
            <span className="font-medium">{(stats?.total_distance_km ?? 0).toFixed(0)} km</span>
          </div>
        </div>
      </div>
    </div>

    {/* ═══ MOVE STOP MODAL ═══ */}
    {moveStopModal && (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setMoveStopModal(null)}>
        <div className="bg-white rounded-xl shadow-xl w-96 p-5" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-bold mb-3">↗ Chuyển điểm giao</h3>
          <p className="text-sm text-gray-500 mb-3">Chọn chuyến đích để chuyển điểm giao này sang:</p>
          <select
            value={moveTargetTrip}
            onChange={e => setMoveTargetTrip(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
          >
            <option value="">-- Chọn chuyến đích --</option>
            {activeTrips.filter(t => t.id !== moveStopModal.fromTripId).map(t => (
              <option key={t.id} value={t.id}>{t.trip_number} — {t.vehicle_plate} ({t.total_stops} stops)</option>
            ))}
          </select>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setMoveStopModal(null)} className="text-sm px-4 py-2 rounded-lg border hover:bg-gray-50">Hủy</button>
            <button
              onClick={handleMoveStop}
              disabled={!moveTargetTrip || actionLoading}
              className="text-sm px-4 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
            >{actionLoading ? 'Đang xử lý...' : 'Chuyển'}</button>
          </div>
        </div>
      </div>
    )}

    {/* ═══ CANCEL TRIP CONFIRM ═══ */}
    {cancelConfirm && (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setCancelConfirm(null)}>
        <div className="bg-white rounded-xl shadow-xl w-96 p-5" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-bold text-red-600 mb-3">🚫 Hủy chuyến {cancelConfirm.trip_number}?</h3>
          <p className="text-sm text-gray-500 mb-2">Tất cả điểm giao chưa hoàn thành sẽ chuyển sang trạng thái &quot;Bỏ qua&quot;.</p>
          <textarea
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            placeholder="Lý do hủy (tùy chọn)..."
            className="w-full border rounded-lg px-3 py-2 text-sm mb-4 h-20 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCancelConfirm(null)} className="text-sm px-4 py-2 rounded-lg border hover:bg-gray-50">Đóng</button>
            <button
              onClick={handleCancelTrip}
              disabled={actionLoading}
              className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >{actionLoading ? 'Đang xử lý...' : 'Xác nhận hủy'}</button>
          </div>
        </div>
      </div>
    )}

    {/* ═══ BULK MOVE STOPS MODAL ═══ */}
    {bulkMoveModal && selectedTrip && (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setBulkMoveModal(false)}>
        <div className="bg-white rounded-xl shadow-xl w-96 p-5" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-bold mb-3">↗ Chuyển {bulkMoveStops.size} điểm giao</h3>
          <p className="text-sm text-gray-500 mb-3">Chọn chuyến đích để chuyển các điểm giao đã chọn:</p>
          <select
            value={moveTargetTrip}
            onChange={e => setMoveTargetTrip(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
          >
            <option value="">-- Chọn chuyến đích --</option>
            {activeTrips.filter(t => t.id !== selectedTrip.id).map(t => (
              <option key={t.id} value={t.id}>{t.trip_number} — {t.vehicle_plate} ({t.total_stops} stops)</option>
            ))}
          </select>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setBulkMoveModal(false)} className="text-sm px-4 py-2 rounded-lg border hover:bg-gray-50">Hủy</button>
            <button
              onClick={handleBulkMoveStops}
              disabled={!moveTargetTrip || actionLoading}
              className="text-sm px-4 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
            >{actionLoading ? 'Đang xử lý...' : `Chuyển ${bulkMoveStops.size} điểm`}</button>
          </div>
        </div>
      </div>
    )}

    {/* ═══ DRIVER/VEHICLE INFO MODAL ═══ */}
    {driverModal && (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setDriverModal(null)}>
        <div className="bg-white rounded-xl shadow-xl w-80 p-5" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold">🚛 {driverModal.vehicle_plate}</h3>
            <button onClick={() => setDriverModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Tài xế</span><span className="font-medium">{driverModal.driver_name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Trạng thái</span><span className={`font-medium ${driverModal.trip_status === 'in_transit' ? 'text-green-600' : 'text-amber-600'}`}>{tripStatusLabel[driverModal.trip_status] || driverModal.trip_status}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tốc độ</span><span className="font-medium">{driverModal.speed} km/h</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Cập nhật</span><span className="font-medium">{new Date(driverModal.timestamp).toLocaleTimeString('vi-VN')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tọa độ</span><span className="font-medium text-xs">{driverModal.lat.toFixed(5)}, {driverModal.lng.toFixed(5)}</span></div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

// ─── Subcomponents ───────────────────────────────────

function MetricCard({ label, value, type }: { label: string; value: number | string; type: 'ok' | 'warn' | 'err' | 'default' }) {
  return (
    <div className={`rounded-lg p-2 ${metricColor(type)}`}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs opacity-70">{label}</div>
    </div>
  )
}

function AlertItem({ exception, onAction }: { exception: TripException; onAction: () => void }) {
  const isP0 = exception.priority === 'P0'
  const borderClass = isP0 ? 'border-l-2 border-red-500 bg-red-50' : 'border-l-2 border-amber-500 bg-amber-50'
  const titleClass = isP0 ? 'text-red-700' : 'text-amber-700'
  const subtitleClass = isP0 ? 'text-red-600' : 'text-amber-600'

  const handleUpdateStop = async () => {
    if (!exception.stop_id) return
    try {
      await apiFetch(`/trips/${exception.trip_id}/stops/${exception.stop_id}/status`, {
        method: 'PUT',
        body: { status: 're_delivery' },
      })
      onAction()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div className={`${borderClass} p-3 rounded-r-lg`}>
      <div className="flex items-start gap-1.5">
        <span className="text-xs font-bold bg-white/60 px-1 rounded">
          {exception.priority}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${titleClass}`}>{exception.title}</p>
          <p className={`text-xs mt-0.5 ${subtitleClass}`}>{exception.description}</p>
          <p className="text-xs mt-1 text-gray-500 italic">
            {exceptionTypeDescription[exception.type] || ''}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        {exception.type === 'failed_stop' && (
          <button onClick={handleUpdateStop}
            className={`text-xs ${isP0 ? 'bg-red-600 text-white' : 'bg-brand-500 text-white'} px-3 py-1.5 rounded font-medium`}
          >
            Giao lại
          </button>
        )}
        {exception.type === 'idle_vehicle' && (
          <button onClick={() => toast.info(`Liên hệ tài xế chuyến ${exception.trip_number}`)}
            className="text-xs bg-brand-500 text-white px-3 py-1.5 rounded font-medium"
          >
            Liên hệ TX
          </button>
        )}
        <button className="text-xs border border-gray-200 px-3 py-1.5 rounded hover:bg-white">
          {exceptionTypeLabel[exception.type] || exception.type}
        </button>
      </div>
    </div>
  )
}
