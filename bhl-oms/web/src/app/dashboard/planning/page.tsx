'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, getUser } from '@/lib/api'

// ─── OSRM routing helper ─────────────────────────────
async function fetchOSRMRoute(points: [number, number][]): Promise<{ geometry: [number, number][]; legs: { distance_km: number; duration_min: number }[]; total_km: number; total_min: number } | null> {
  if (points.length < 2) return null
  const coords = points.map(p => `${p[1]},${p[0]}`).join(';')
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes?.[0]) return null
    const route = data.routes[0]
    const geometry: [number, number][] = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]])
    const legs = route.legs.map((leg: any) => ({
      distance_km: Math.round(leg.distance / 100) / 10,
      duration_min: Math.round(leg.duration / 60)
    }))
    return { geometry, legs, total_km: Math.round(route.distance / 100) / 10, total_min: Math.round(route.duration / 60) }
  } catch { return null }
}

// ─── Trip Detail Modal with Map ──────────────────────
function TripDetailModal({ trip, tripIdx, vehicles, warehouse, onClose }: {
  trip: VRPTrip; tripIdx: number; vehicles: Vehicle[]; warehouse: { lat: number; lng: number; name: string } | null; onClose: () => void
}) {
  const mapRef = useRef<any>(null)
  const mapElRef = useRef<HTMLDivElement>(null)
  const [legDistances, setLegDistances] = useState<{ distance_km: number; duration_min: number }[]>([])
  const [routeTotals, setRouteTotals] = useState<{ total_km: number; total_min: number; return_km: number } | null>(null)
  const [routeLoading, setRouteLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const vehicle = vehicles.find(v => v.id === trip.vehicle_id)
  const cap = vehicle?.capacity_kg || 15000
  const pct = (trip.total_weight_kg / cap * 100).toFixed(0)

  // Shipment weight per stop (not cumulative)
  const stopsWithWeight = trip.stops.map((s, i) => ({
    ...s,
    weight_kg: i === 0 ? s.cumulative_load_kg : s.cumulative_load_kg - trip.stops[i - 1].cumulative_load_kg
  }))

  useEffect(() => {
    if (typeof window === 'undefined' || !mapElRef.current) return
    let cancelled = false

    const init = async () => {
      const L = (await import('leaflet')).default

      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

      const map = L.map(mapElRef.current!, { zoomControl: true, scrollWheelZoom: true })
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap',
      }).addTo(map)
      mapRef.current = map

      const waypoints: [number, number][] = []
      const validStops = trip.stops.filter(s => s.latitude && s.longitude)

      // Offset co-located stops so markers don't overlap
      const usedCoords = new Map<string, number>()
      const offsetStops = validStops.map(s => {
        const key = `${s.latitude.toFixed(5)},${s.longitude.toFixed(5)}`
        const count = usedCoords.get(key) || 0
        usedCoords.set(key, count + 1)
        if (count === 0) return { ...s }
        const angle = (count * 60) * (Math.PI / 180)
        const offset = 0.0003 * count
        return { ...s, latitude: s.latitude + offset * Math.cos(angle), longitude: s.longitude + offset * Math.sin(angle) }
      })

      // Depot as first waypoint
      if (warehouse) {
        const depotIcon = L.divIcon({
          html: `<div style="background:#1e40af;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">🏭</div>`,
          className: '', iconSize: [28, 28], iconAnchor: [14, 14]
        })
        L.marker([warehouse.lat, warehouse.lng], { icon: depotIcon })
          .addTo(map).bindPopup(`<b>${warehouse.name}</b><br/>Điểm xuất phát`)
        waypoints.push([warehouse.lat, warehouse.lng])
      }

      // Stop markers (using offset coordinates for co-located stops)
      offsetStops.forEach((stop, i) => {
        const icon = L.divIcon({
          html: `<div style="background:#dc2626;color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">${i + 1}</div>`,
          className: '', iconSize: [24, 24], iconAnchor: [12, 12]
        })
        L.marker([stop.latitude, stop.longitude], { icon })
          .addTo(map)
          .bindPopup(`<b>#${i + 1} ${stop.customer_name}</b><br/>${stop.customer_address || ''}<br/>Tải tích lũy: ${stop.cumulative_load_kg?.toFixed(0)} kg`)
        waypoints.push([stop.latitude, stop.longitude])
      })

      // Return to depot
      if (warehouse) waypoints.push([warehouse.lat, warehouse.lng])

      // Fetch actual road route from OSRM
      setRouteLoading(true)
      const osrm = await fetchOSRMRoute(waypoints)

      if (cancelled) return

      if (osrm) {
        // Draw real road geometry
        L.polyline(osrm.geometry, { color: '#2563eb', weight: 4, opacity: 0.8 }).addTo(map)

        // Set leg distances (legs include depot→stop1, stop1→stop2, ..., lastStop→depot)
        setLegDistances(osrm.legs)
        const returnLeg = osrm.legs.length > 0 ? osrm.legs[osrm.legs.length - 1] : null
        const deliveryKm = osrm.legs.slice(0, -1).reduce((s, l) => s + l.distance_km, 0) + (osrm.legs[0]?.distance_km || 0)
        setRouteTotals({
          total_km: osrm.total_km,
          total_min: osrm.total_min,
          return_km: returnLeg?.distance_km || 0
        })

        // Fit to route geometry
        if (osrm.geometry.length > 0) {
          map.fitBounds(L.latLngBounds(osrm.geometry.map(p => L.latLng(p[0], p[1]))), { padding: [40, 40] })
        }
      } else {
        // Fallback: straight lines if OSRM fails
        if (waypoints.length > 1) {
          L.polyline(waypoints, { color: '#dc2626', weight: 3, opacity: 0.7, dashArray: '8 4' }).addTo(map)
        }
        if (waypoints.length > 0) {
          map.fitBounds(L.latLngBounds(waypoints.map(p => L.latLng(p[0], p[1]))), { padding: [40, 40] })
        }
      }
      setRouteLoading(false)
    }
    init()

    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [trip, warehouse])

  // Invalidate map size when toggling fullscreen
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 100)
    }
  }, [isFullscreen])

  // Leg label helper: "Kho → #1", "#1 → #2", "#N → Kho"
  const legLabel = (legIdx: number) => {
    const numStops = trip.stops.filter(s => s.latitude && s.longitude).length
    if (legIdx === 0) return `Kho → #1`
    if (legIdx <= numStops - 1) return `#${legIdx} → #${legIdx + 1}`
    return `#${numStops} → Kho`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
        isFullscreen ? 'w-full h-full max-w-none max-h-none rounded-none' : 'w-full max-w-5xl max-h-[90vh]'
      }`}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">
              Chuyến {tripIdx + 1}: {trip.plate_number || trip.vehicle_id.slice(0, 8)}
              {vehicle?.vehicle_type && <span className="opacity-75 ml-2 text-sm">({vehicle.vehicle_type})</span>}
            </h2>
            <div className="flex gap-4 text-sm opacity-90 mt-1">
              <span>📦 {trip.stops.length} điểm giao</span>
              <span>📏 {routeTotals ? `${routeTotals.total_km} km` : `${trip.total_distance_km?.toFixed(1)} km`}</span>
              <span>⚖️ {trip.total_weight_kg?.toFixed(0)}/{cap} kg ({pct}%)</span>
              {routeTotals && <span>⏱ ~{routeTotals.total_min} phút</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? 'Thu nhỏ' : 'Phóng to'}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-lg">
              {isFullscreen ? '⊡' : '⊞'}
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-lg">✕</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row min-h-0">
          {/* Map */}
          <div className={`relative ${isFullscreen ? 'lg:w-2/3 h-[400px] lg:h-auto' : 'lg:w-1/2 h-[350px] lg:h-auto'}`}>
            <div ref={mapElRef} className="absolute inset-0" />
            {routeLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
                <div className="text-sm text-gray-600 animate-pulse">🗺️ Đang tải lộ trình...</div>
              </div>
            )}
          </div>

          {/* Shipment details + leg distances */}
          <div className={`overflow-y-auto border-l ${isFullscreen ? 'lg:w-1/3' : 'lg:w-1/2'}`}>
            <div className="px-4 py-3 bg-gray-50 border-b sticky top-0 z-10">
              <h3 className="font-semibold text-gray-700 text-sm">Lộ trình giao hàng ({trip.stops.length} điểm)</h3>
            </div>
            <div className="divide-y">
              {stopsWithWeight.map((stop, i) => (
                <div key={stop.shipment_id}>
                  {/* Leg distance: from previous point to this stop */}
                  {legDistances.length > 0 && i <= legDistances.length - 1 && (
                    <div className="px-4 py-1.5 bg-blue-50 flex items-center gap-2 text-xs text-blue-700">
                      <span className="font-mono">↓</span>
                      <span className="font-medium">{legLabel(i)}: {legDistances[i]?.distance_km} km</span>
                      <span className="text-blue-400">~{legDistances[i]?.duration_min} phút</span>
                    </div>
                  )}
                  <div className="px-4 py-3 hover:bg-blue-50 transition">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{stop.customer_name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{stop.customer_address || 'Chưa có địa chỉ'}</div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                          <span className="text-gray-600">
                            ⚖️ <strong>{stop.weight_kg?.toFixed(1)} kg</strong>
                          </span>
                          <span className="text-gray-400">
                            Tích lũy: {stop.cumulative_load_kg?.toFixed(0)} kg
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Return leg to depot */}
              {legDistances.length > stopsWithWeight.length && (
                <div className="px-4 py-1.5 bg-green-50 flex items-center gap-2 text-xs text-green-700">
                  <span className="font-mono">↓</span>
                  <span className="font-medium">{legLabel(stopsWithWeight.length)}: {legDistances[stopsWithWeight.length]?.distance_km} km</span>
                  <span className="text-green-500">~{legDistances[stopsWithWeight.length]?.duration_min} phút (về kho)</span>
                </div>
              )}
            </div>

            {/* Trip summary footer */}
            <div className="px-4 py-3 bg-gray-50 border-t sticky bottom-0 z-10">
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <div className="font-bold text-gray-700">{trip.total_weight_kg?.toFixed(0)} kg</div>
                  <div className="text-gray-400">Tổng tải</div>
                </div>
                <div>
                  <div className="font-bold text-gray-700">{routeTotals ? `${routeTotals.total_km}` : trip.total_distance_km?.toFixed(1)} km</div>
                  <div className="text-gray-400">Tổng quãng đường</div>
                </div>
                <div>
                  <div className="font-bold text-orange-600">{routeTotals ? `${routeTotals.return_km}` : '?'} km</div>
                  <div className="text-gray-400">Về kho</div>
                </div>
                <div>
                  <div className={`font-bold ${Number(pct) > 90 ? 'text-red-600' : 'text-green-600'}`}>{pct}%</div>
                  <div className="text-gray-400">Tải trọng</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Vehicle Status Modal ───────────────────────────
function VehicleStatusModal({ vehicles, onClose }: { vehicles: Vehicle[]; onClose: () => void }) {
  const statusGroups: Record<string, { label: string; color: string; icon: string }> = {
    active: { label: 'Hoạt động', color: 'bg-green-100 text-green-800', icon: '🟢' },
    maintenance: { label: 'Bảo trì', color: 'bg-yellow-100 text-yellow-800', icon: '🟡' },
    broken: { label: 'Hỏng', color: 'bg-red-100 text-red-800', icon: '🔴' },
    impounded: { label: 'Tạm giữ', color: 'bg-gray-100 text-gray-800', icon: '⚫' },
  }
  const grouped = vehicles.reduce<Record<string, Vehicle[]>>((acc, v) => {
    const key = v.status || 'active'
    if (!acc[key]) acc[key] = []
    acc[key].push(v)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">🚛 Trạng thái xe ({vehicles.length} xe)</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-lg">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.entries(grouped).map(([status, vs]) => {
            const info = statusGroups[status] || { label: status, color: 'bg-gray-100 text-gray-700', icon: '⚪' }
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-2">
                  <span>{info.icon}</span>
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded ${info.color}`}>{info.label} ({vs.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {vs.map(v => (
                    <div key={v.id} className="border rounded-lg p-3 text-sm hover:bg-gray-50">
                      <div className="font-medium">{v.plate_number}</div>
                      <div className="text-xs text-gray-500">{v.vehicle_type} · {v.capacity_kg.toLocaleString()}kg / {v.capacity_m3}m³</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Driver Status Modal ────────────────────────────
function DriverStatusModal({ drivers, checkins, onClose }: { drivers: Driver[]; checkins: any[]; onClose: () => void }) {
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const checkinMap = new Map(checkins.map(c => [c.driver_id || c.id, c]))

  const statusGroups: Record<string, { label: string; color: string; icon: string }> = {
    available: { label: 'Sẵn sàng', color: 'bg-green-100 text-green-800', icon: '🟢' },
    on_trip: { label: 'Đang chạy', color: 'bg-blue-100 text-blue-800', icon: '🔵' },
    off_duty: { label: 'Nghỉ', color: 'bg-red-100 text-red-800', icon: '🔴' },
    not_checked_in: { label: 'Chưa check-in', color: 'bg-yellow-100 text-yellow-800', icon: '🟡' },
  }

  // Use checkins as primary data source (already filtered by warehouse)
  // Only fall back to drivers list if no checkins data
  const driverWithStatus: Array<{ id: string; full_name: string; phone: string; license_number: string; status: string; warehouse_id?: string; checkin_status: string; reason?: string }> = checkins.length > 0
    ? checkins.map((c: any) => ({
        id: c.driver_id || c.id,
        full_name: c.full_name || drivers.find(d => d.id === (c.driver_id || c.id))?.full_name || 'N/A',
        phone: c.phone || drivers.find(d => d.id === (c.driver_id || c.id))?.phone || '',
        license_number: c.license_number || drivers.find(d => d.id === (c.driver_id || c.id))?.license_number || '',
        status: c.driver_status || c.status || 'active',
        warehouse_id: c.warehouse_id,
        checkin_status: c.checkin_status || c.status || 'not_checked_in',
        reason: c.reason,
      }))
    : drivers.map(d => {
        const checkin = checkinMap.get(d.id)
        const checkinStatus = checkin?.checkin_status || checkin?.status || 'not_checked_in'
        return { ...d, checkin_status: checkinStatus, reason: checkin?.reason }
      })

  const grouped = driverWithStatus.reduce<Record<string, typeof driverWithStatus>>((acc, d: any) => {
    if (!acc[d.checkin_status]) acc[d.checkin_status] = []
    acc[d.checkin_status].push(d)
    return acc
  }, {})

  if (selectedDriver) {
    const checkin = checkinMap.get(selectedDriver.id)
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">👤 {selectedDriver.full_name}</h2>
            <button onClick={() => setSelectedDriver(null)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-lg">←</button>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-2xl">👤</div>
              <div>
                <div className="text-lg font-bold">{selectedDriver.full_name}</div>
                <div className="text-sm text-gray-500">{selectedDriver.license_number || 'Chưa có GPLX'}</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm border-b py-2">
                <span className="text-gray-500">Điện thoại</span>
                <a href={`tel:${selectedDriver.phone}`} className="text-blue-600 font-medium hover:underline">📞 {selectedDriver.phone}</a>
              </div>
              <div className="flex justify-between text-sm border-b py-2">
                <span className="text-gray-500">GPLX</span>
                <span className="font-medium">{selectedDriver.license_number || '—'}</span>
              </div>
              <div className="flex justify-between text-sm border-b py-2">
                <span className="text-gray-500">Trạng thái</span>
                <span className="font-medium">{selectedDriver.status}</span>
              </div>
              {checkin && (
                <>
                  <div className="flex justify-between text-sm border-b py-2">
                    <span className="text-gray-500">Check-in</span>
                    <span className="font-medium">{checkin.checkin_status || checkin.status}</span>
                  </div>
                  {checkin.reason && (
                    <div className="flex justify-between text-sm border-b py-2">
                      <span className="text-gray-500">Lý do</span>
                      <span className="font-medium">{checkin.reason}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <a href={`tel:${selectedDriver.phone}`}
              className="block w-full text-center py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium">
              📞 Gọi điện cho tài xế
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">👥 Tài xế ({drivers.length} người)</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-lg">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.entries(grouped).map(([status, ds]) => {
            const info = statusGroups[status] || { label: status, color: 'bg-gray-100 text-gray-700', icon: '⚪' }
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-2">
                  <span>{info.icon}</span>
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded ${info.color}`}>{info.label} ({ds.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {ds.map(d => (
                    <div key={d.id} onClick={() => setSelectedDriver(d)}
                      className="border rounded-lg p-3 text-sm hover:bg-green-50 cursor-pointer transition">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{d.full_name}</div>
                          <div className="text-xs text-gray-500">📞 {d.phone}</div>
                        </div>
                        <span className="text-gray-400 text-xs">▸</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Types ───────────────────────────────────────────────
interface Shipment {
  id: string; shipment_number: string; customer_name: string; customer_address?: string
  total_weight_kg: number; total_volume_m3: number; status: string
  is_urgent: boolean; created_at?: string; order_created_at?: string; order_confirmed_at?: string
}
interface Vehicle {
  id: string; plate_number: string; vehicle_type: string
  capacity_kg: number; capacity_m3: number; status: string; warehouse_id?: string
}
interface Driver {
  id: string; full_name: string; phone: string; license_number: string; status: string; warehouse_id?: string
}
interface PendingDate {
  delivery_date: string; shipment_count: number; total_weight_kg: number
}
interface VRPStop {
  stop_order: number; shipment_id: string; customer_name: string
  customer_id: string; customer_address: string; latitude: number; longitude: number; cumulative_load_kg: number
}
interface VRPTrip {
  vehicle_id: string; plate_number?: string; vehicle_type?: string
  stops: VRPStop[]
  total_distance_km: number; total_weight_kg: number; total_duration_min: number
}
interface VRPSummary {
  total_trips: number; total_vehicles: number; total_shipments_assigned: number
  total_unassigned: number; total_distance_km: number; total_duration_min: number
  total_weight_kg: number; avg_capacity_util_pct: number; avg_stops_per_trip: number
  solve_time_ms: number
}
interface VRPResult {
  job_id: string; status: string; solve_time_ms: number
  trips: VRPTrip[]; unassigned_shipments: any[]; summary: VRPSummary
}

const STEPS = ['Tổng quan', 'Chọn xe', 'Xem đơn hàng', 'Tạo kế hoạch giao hàng', 'Duyệt & Tạo chuyến']
const STEP_ICONS = ['📊', '🚛', '📦', '🗺️', '✅']

export default function PlanningPage() {
  const user = getUser()
  const router = useRouter()

  // Role check — only admin and dispatcher can access planning
  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'dispatcher') {
      router.replace('/dashboard')
    }
  }, [user, router])

  // ─── State ──────────────────────────────────────────
  const [step, setStep] = useState(0)
  const [warehouseId, setWarehouseId] = useState(user?.warehouse_ids?.[0] || '')
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [deliveryDate, setDeliveryDate] = useState('')
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [pendingDates, setPendingDates] = useState<PendingDate[]>([])
  const [driverCheckins, setDriverCheckins] = useState<any[]>([])

  // All vehicles (all statuses) for status modal
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([])
  const [allDrivers, setAllDrivers] = useState<Driver[]>([])

  // Step 2: vehicle selection
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<Set<string>>(new Set())

  // Step 3: shipment exclusion
  const [excludedShipmentIds, setExcludedShipmentIds] = useState<Set<string>>(new Set())

  // Step 4: VRP
  const [jobId, setJobId] = useState('')
  const [vrpResult, setVrpResult] = useState<VRPResult | null>(null)
  const [running, setRunning] = useState(false)
  const [solveProgress, setSolveProgress] = useState(0)

  // Step 5: driver assignment & approval
  const [driverAssign, setDriverAssign] = useState<Record<string, string>>({})
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(false)

  const [error, setError] = useState('')
  const pollRef = useRef<any>(null)
  const progressRef = useRef<any>(null)

  // Trip detail modal
  const [selectedTripIdx, setSelectedTripIdx] = useState<number | null>(null)

  // Status detail modals
  const [showVehicleStatusModal, setShowVehicleStatusModal] = useState(false)
  const [showDriverStatusModal, setShowDriverStatusModal] = useState(false)

  // ─── Init ──────────────────────────────────────────
  useEffect(() => {
    apiFetch<any>('/warehouses').then(r => setWarehouses(r.data || [])).catch(console.error)
  }, [])

  // Auto-detect delivery date from pending shipments
  useEffect(() => {
    if (!warehouseId) return
    apiFetch<any>(`/shipments/pending-dates?warehouse_id=${warehouseId}`)
      .then(r => {
        const dates: PendingDate[] = r.data || []
        setPendingDates(dates)
        if (dates.length > 0 && !deliveryDate) {
          setDeliveryDate(dates[0].delivery_date)
        } else if (dates.length > 0 && !dates.find(d => d.delivery_date === deliveryDate)) {
          // Current date has no data — auto-switch to first date with data
          setDeliveryDate(dates[0].delivery_date)
        }
      })
      .catch(console.error)
  }, [warehouseId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = useCallback(async () => {
    if (!warehouseId || !deliveryDate) return
    setError('')
    try {
      const [s, v, d, dc, av, ad] = await Promise.all([
        apiFetch<any>(`/shipments/pending?warehouse_id=${warehouseId}&delivery_date=${deliveryDate}`),
        apiFetch<any>(`/vehicles/available?warehouse_id=${warehouseId}&date=${deliveryDate}`),
        apiFetch<any>(`/drivers/available?warehouse_id=${warehouseId}&date=${deliveryDate}`),
        apiFetch<any>(`/drivers/checkins?warehouse_id=${warehouseId}&date=${deliveryDate}`).catch(() => ({ data: [] })),
        apiFetch<any>(`/vehicles`).catch(() => ({ data: [] })),
        apiFetch<any>(`/drivers`).catch(() => ({ data: [] })),
      ])
      setShipments(s.data || [])
      setVehicles(v.data || [])
      setDrivers(d.data || [])
      setDriverCheckins(dc.data || [])
      // All vehicles/drivers filtered to this warehouse
      const warehouseVehicles = (av.data || []).filter((x: Vehicle) => x.warehouse_id === warehouseId || true)
      setAllVehicles(warehouseVehicles)
      setAllDrivers(ad.data || [])
      // Default: select all vehicles
      setSelectedVehicleIds(new Set((v.data || []).map((x: Vehicle) => x.id)))
      setExcludedShipmentIds(new Set())
      // Reset VRP
      setVrpResult(null)
      setApproved(false)
    } catch (err: any) {
      setError(err.message)
    }
  }, [warehouseId, deliveryDate])

  useEffect(() => { loadData() }, [loadData])

  // ─── Computed values ──────────────────────────────
  const selectedVehicles = vehicles.filter(v => selectedVehicleIds.has(v.id))
  const activeShipments = shipments.filter(s => !excludedShipmentIds.has(s.id))
  const totalDemandKg = activeShipments.reduce((sum, s) => sum + (s.total_weight_kg || 0), 0)
  const totalCapacityKg = selectedVehicles.reduce((sum, v) => sum + (v.capacity_kg || 0), 0)
  const capacityRatio = totalCapacityKg > 0 ? (totalDemandKg / totalCapacityKg * 100) : 0
  const estimatedTrips = totalCapacityKg > 0 && selectedVehicles.length > 0
    ? Math.ceil(totalDemandKg / (totalCapacityKg / selectedVehicles.length))
    : 0
  const avgStopsPerTrip = selectedVehicles.length > 0 ? Math.round(activeShipments.length / selectedVehicles.length) : 0

  // Vehicle type grouping
  const vehiclesByType = vehicles.reduce<Record<string, Vehicle[]>>((acc, v) => {
    const type = v.vehicle_type || 'Khác'
    if (!acc[type]) acc[type] = []
    acc[type].push(v)
    return acc
  }, {})

  // Selected warehouse info for map depot
  const selectedWarehouse = warehouses.find((w: any) => w.id === warehouseId)
  const warehouseMapInfo = selectedWarehouse ? {
    lat: selectedWarehouse.latitude || 20.9534,
    lng: selectedWarehouse.longitude || 107.0676,
    name: selectedWarehouse.name || 'Kho'
  } : null

  // ─── VRP Logic ──────────────────────────────────────
  const runVRP = async () => {
    // Pre-validate
    if (!warehouseId) {
      setError('Vui lòng chọn kho xuất trước khi tạo kế hoạch.')
      return
    }
    if (!deliveryDate) {
      setError('Vui lòng chọn ngày giao trước khi tạo kế hoạch.')
      return
    }
    if (activeShipments.length === 0) {
      setError('Không có đơn hàng nào để lập kế hoạch. Kiểm tra lại kho xuất và ngày giao.')
      return
    }
    if (selectedVehicleIds.size === 0) {
      setError('Vui lòng chọn ít nhất 1 xe ở bước 2.')
      return
    }

    setRunning(true)
    setError('')
    setVrpResult(null)
    setSolveProgress(0)

    // Fake progress animation
    progressRef.current = setInterval(() => {
      setSolveProgress(prev => Math.min(prev + 2, 90))
    }, 600)

    try {
      // Auto-limit: if more vehicles than available drivers, only send enough vehicles for drivers
      let vehicleIdsToSend = Array.from(selectedVehicleIds)
      const availableDriverCount = driverCheckins.filter((d: any) => d.checkin_status === 'available' || d.status === 'available').length || drivers.length
      if (vehicleIdsToSend.length > availableDriverCount && availableDriverCount > 0) {
        vehicleIdsToSend = vehicleIdsToSend.slice(0, availableDriverCount)
      }

      const res: any = await apiFetch('/planning/run-vrp', {
        method: 'POST',
        body: {
          warehouse_id: warehouseId,
          delivery_date: deliveryDate,
          vehicle_ids: vehicleIdsToSend,
        },
      })
      const jid = res.data?.job_id
      setJobId(jid)

      // Poll for result
      pollRef.current = setInterval(async () => {
        try {
          const r: any = await apiFetch(`/planning/jobs/${jid}`)
          if (r.data?.status === 'completed' || r.data?.status === 'failed') {
            clearInterval(pollRef.current)
            clearInterval(progressRef.current)
            setSolveProgress(100)
            setVrpResult(r.data)
            setRunning(false)

            // Init driver assignment (auto-assign by order)
            if (r.data?.trips) {
              const init: Record<string, string> = {}
              r.data.trips.forEach((t: VRPTrip, i: number) => {
                if (drivers[i]) init[t.vehicle_id] = drivers[i].id
              })
              setDriverAssign(init)
            }
          }
        } catch { /* keep polling */ }
      }, 2000)
    } catch (err: any) {
      clearInterval(progressRef.current)
      setError(err.message)
      setRunning(false)
    }
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (progressRef.current) clearInterval(progressRef.current)
    }
  }, [])

  // ─── Drag & Drop helpers ────────────────────────────
  const recalcTrips = useCallback((trips: VRPTrip[]) => {
    return trips.map(trip => {
      let cum = 0
      const newStops = trip.stops.map((s, i) => {
        const prevCum = i > 0 ? trip.stops[i - 1].cumulative_load_kg : 0
        const weight = s.cumulative_load_kg - prevCum
        cum += weight
        return { ...s, stop_order: i + 1, cumulative_load_kg: cum }
      })
      return { ...trip, stops: newStops, total_weight_kg: cum }
    })
  }, [])

  const handleMoveStop = useCallback((srcTrip: number, srcStop: number, dstTrip: number, dstStop: number) => {
    if (!vrpResult?.trips) return
    if (srcTrip === dstTrip && srcStop === dstStop) return
    const trips = vrpResult.trips.map(t => ({ ...t, stops: [...t.stops] }))
    if (srcTrip === dstTrip) {
      const [moved] = trips[srcTrip].stops.splice(srcStop, 1)
      trips[srcTrip].stops.splice(dstStop, 0, moved)
    } else {
      const [moved] = trips[srcTrip].stops.splice(srcStop, 1)
      trips[dstTrip].stops.splice(dstStop, 0, moved)
    }
    const filtered = trips.filter(t => t.stops.length > 0)
    setVrpResult({ ...vrpResult, trips: recalcTrips(filtered) })
  }, [vrpResult, recalcTrips])

  // ─── Approve ────────────────────────────────────────
  const approvePlan = async () => {
    if (!vrpResult?.trips) return
    setApproving(true)
    setError('')
    try {
      const assignments = vrpResult.trips.map(t => ({
        vehicle_id: t.vehicle_id,
        driver_id: driverAssign[t.vehicle_id] || undefined,
        shipment_ids: t.stops.map(s => s.shipment_id),
      }))
      await apiFetch('/planning/approve', {
        method: 'POST',
        body: { job_id: jobId, warehouse_id: warehouseId, delivery_date: deliveryDate, assignments },
      })
      setApproved(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setApproving(false)
    }
  }

  // ─── Vehicle toggle ─────────────────────────────────
  const toggleVehicle = (id: string) => {
    setSelectedVehicleIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleAllVehiclesOfType = (type: string) => {
    const typeVehicles = vehiclesByType[type] || []
    const allSelected = typeVehicles.every(v => selectedVehicleIds.has(v.id))
    setSelectedVehicleIds(prev => {
      const next = new Set(prev)
      typeVehicles.forEach(v => { allSelected ? next.delete(v.id) : next.add(v.id) })
      return next
    })
  }

  // ─── Shipment toggle ──────────────────────────────
  const toggleShipment = (id: string) => {
    setExcludedShipmentIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleUrgent = async (id: string, current: boolean) => {
    try {
      await apiFetch(`/shipments/${id}/urgent`, { method: 'PUT', body: JSON.stringify({ is_urgent: !current }) })
      setShipments(prev => prev.map(s => s.id === id ? { ...s, is_urgent: !current } : s))
    } catch { /* ignore */ }
  }

  const fmtTime = (iso?: string) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  // ─── Can navigate? ─────────────────────────────────
  const canGoNext = () => {
    if (step === 0) return shipments.length > 0
    if (step === 1) return selectedVehicleIds.size > 0
    if (step === 2) return activeShipments.length > 0
    if (step === 3) return vrpResult !== null && !running
    return true
  }

  // ────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────
  return (
    <div className="max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Lập kế hoạch giao hàng</h1>
      <p className="text-sm text-gray-500 mb-6">Lập kế hoạch và tối ưu tuyến đường giao hàng — 5 bước</p>

      {/* ─── TOP CONTROLS ─── */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex gap-4 items-end flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Kho xuất</label>
          <select value={warehouseId} onChange={e => { setWarehouseId(e.target.value); setStep(0) }}
            className="px-3 py-2 border rounded-lg text-sm min-w-[200px]">
            <option value="">-- Chọn kho --</option>
            {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Ngày giao</label>
          <input type="date" value={deliveryDate} onChange={e => { setDeliveryDate(e.target.value); setStep(0) }}
            className="px-3 py-2 border rounded-lg text-sm" />
        </div>
        {pendingDates.length > 0 && (
          <div className="flex gap-2 items-center">
            <span className="text-xs text-gray-500">Ngày có đơn:</span>
            {pendingDates.map(pd => (
              <button key={pd.delivery_date} onClick={() => { setDeliveryDate(pd.delivery_date); setStep(0) }}
                className={`px-2 py-1 text-xs rounded border transition ${
                  pd.delivery_date === deliveryDate 
                    ? 'bg-amber-100 border-amber-400 text-amber-800 font-medium' 
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}>
                {pd.delivery_date} ({pd.shipment_count})
              </button>
            ))}
          </div>
        )}
        <button onClick={loadData} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm">
          🔄 Tải lại dữ liệu
        </button>
      </div>

      {/* ─── STEP INDICATOR ─── */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center flex-1">
              <button
                onClick={() => { if (i <= step || (i === step + 1 && canGoNext())) setStep(i) }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${i === step ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400' :
                    i < step ? 'bg-green-50 text-green-700 cursor-pointer hover:bg-green-100' :
                    'bg-gray-50 text-gray-400'}`}
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm
                  ${i === step ? 'bg-amber-500 text-white' :
                    i < step ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {i < step ? '✓' : STEP_ICONS[i]}
                </span>
                <span className="hidden lg:inline">{label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── ERROR ─── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          STEP 0: TỔNG QUAN NGUỒN LỰC
         ═══════════════════════════════════════════════ */}
      {step === 0 && (
        <div className="space-y-6">
          {/* Resource cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-amber-500">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Đơn hàng chờ giao</div>
              <div className="text-3xl font-bold text-amber-700">{shipments.length}</div>
              <div className="text-sm text-gray-500 mt-1">
                Tổng tải: <strong>{(totalDemandKg / 1000).toFixed(1)}T</strong>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-blue-500 cursor-pointer hover:shadow-md transition"
              onClick={() => setShowVehicleStatusModal(true)}>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Xe khả dụng</div>
              <div className="text-3xl font-bold text-blue-700">{vehicles.length}
                {allVehicles.length > vehicles.length && <span className="text-sm font-normal text-gray-400 ml-1">/ {allVehicles.length} tổng</span>}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Tổng tải: <strong>{(totalCapacityKg / 1000).toFixed(1)}T</strong>
                {Object.entries(vehiclesByType).map(([type, vs]) => (
                  <span key={type} className="ml-2 text-xs bg-blue-50 px-1.5 py-0.5 rounded">{type}: {vs.length}</span>
                ))}
              </div>
              <div className="text-xs text-blue-500 mt-2">Bấm để xem chi tiết trạng thái xe →</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-500 cursor-pointer hover:shadow-md transition"
              onClick={() => setShowDriverStatusModal(true)}>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tài xế khả dụng</div>
              <div className="text-3xl font-bold text-green-700">{drivers.length}</div>
              <div className="text-sm text-gray-500 mt-1">
                {drivers.length >= vehicles.length
                  ? <span className="text-green-600">✓ Đủ tài xế cho tất cả xe</span>
                  : <span className="text-red-600">⚠ Thiếu {vehicles.length - drivers.length} tài xế</span>}
              </div>
              {driverCheckins.length > 0 && (() => {
                const available = driverCheckins.filter((d: any) => d.checkin_status === 'available').length
                const onTrip = driverCheckins.filter((d: any) => d.checkin_status === 'on_trip').length
                const offDuty = driverCheckins.filter((d: any) => d.checkin_status === 'off_duty').length
                const notCheckedIn = driverCheckins.filter((d: any) => d.checkin_status === 'not_checked_in').length
                return (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {available > 0 && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">🟢 Sẵn sàng: {available}</span>}
                    {onTrip > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">🔵 Đang chạy: {onTrip}</span>}
                    {offDuty > 0 && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">🔴 Nghỉ: {offDuty}</span>}
                    {notCheckedIn > 0 && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">🟡 Chưa check-in: {notCheckedIn}</span>}
                  </div>
                )
              })()}
              <div className="text-xs text-green-500 mt-2">Bấm để xem chi tiết tài xế →</div>
            </div>
          </div>

          {/* Capacity comparison bar */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-3">So sánh Cung — Cầu</h3>
            <div className="space-y-3">
              {/* Demand bar */}
              <div className="flex items-center gap-3">
                <span className="w-24 text-sm text-gray-500">Hàng cần giao</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${Math.min(capacityRatio, 100)}%` }} />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                    {(totalDemandKg / 1000).toFixed(1)}T ({capacityRatio.toFixed(0)}% tải xe)
                  </span>
                </div>
              </div>
              {/* Capacity bar */}
              <div className="flex items-center gap-3">
                <span className="w-24 text-sm text-gray-500">Tải trọng xe</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: '100%' }} />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                    {(totalCapacityKg / 1000).toFixed(1)}T (100%)
                  </span>
                </div>
              </div>
            </div>

            {/* Quick estimates */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-gray-700">~{estimatedTrips}</div>
                <div className="text-xs text-gray-500">Chuyến ước tính</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-gray-700">~{avgStopsPerTrip}</div>
                <div className="text-xs text-gray-500">Điểm/chuyến TB</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className={`text-lg font-bold ${capacityRatio > 100 ? 'text-red-600' : capacityRatio > 80 ? 'text-amber-600' : 'text-green-600'}`}>
                  {capacityRatio > 100 ? '⚠ Quá tải' : capacityRatio > 80 ? '⚡ Gần đầy' : '✓ OK'}
                </div>
                <div className="text-xs text-gray-500">Trạng thái tải</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-gray-700">{deliveryDate}</div>
                <div className="text-xs text-gray-500">Ngày giao</div>
              </div>
            </div>

            {/* Warnings */}
            {shipments.length === 0 && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
                ⚠️ Không có đơn hàng nào chờ giao cho ngày {deliveryDate}. Kiểm tra lại kho xuất và ngày giao.
              </div>
            )}
            {capacityRatio > 100 && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                ⚠️ Tổng hàng ({(totalDemandKg / 1000).toFixed(1)}T) vượt quá tổng tải xe ({(totalCapacityKg / 1000).toFixed(1)}T).
                Một số đơn sẽ không được xếp. Hãy thêm xe ở bước tiếp theo hoặc loại bớt đơn hàng.
              </div>
            )}
            {(() => {
              const checkedInAvailable = driverCheckins.filter((d: any) => d.checkin_status === 'available').length
              const notCheckedIn = driverCheckins.filter((d: any) => d.checkin_status === 'not_checked_in').length
              const showWarning = vehicles.length > 0 && checkedInAvailable < vehicles.length && notCheckedIn > 0
              return showWarning ? (
                <div className="mt-4 bg-orange-50 border border-orange-300 text-orange-800 px-4 py-3 rounded-lg text-sm">
                  <div className="font-semibold mb-1">⚠️ Chênh lệch xe — tài xế sẵn sàng</div>
                  <div>Có <strong>{vehicles.length} xe</strong> khả dụng nhưng chỉ <strong>{checkedInAvailable} tài xế</strong> đã check-in sẵn sàng.
                  Còn <strong>{notCheckedIn} tài xế chưa check-in</strong>.</div>
                  <div className="mt-2 text-xs text-orange-600">
                    💡 Hãy nhắc tài xế check-in trước khi lập kế hoạch để hệ thống phân bổ hiệu quả hơn.
                    Nếu không đủ tài xế sẵn sàng, hệ thống sẽ bị giới hạn số xe sử dụng.
                  </div>
                </div>
              ) : null
            })()}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          STEP 1: CHỌN XE THAM GIA
         ═══════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Selection summary */}
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm">
              Đã chọn <strong className="text-blue-700">{selectedVehicleIds.size}/{vehicles.length}</strong> xe
              — Tải trọng: <strong>{(selectedVehicles.reduce((s, v) => s + v.capacity_kg, 0) / 1000).toFixed(1)}T</strong>
              — Hàng cần giao: <strong className="text-amber-700">{(totalDemandKg / 1000).toFixed(1)}T</strong>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelectedVehicleIds(new Set(vehicles.map(v => v.id)))}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded text-sm hover:bg-blue-100">Chọn tất cả</button>
              <button onClick={() => setSelectedVehicleIds(new Set())}
                className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded text-sm hover:bg-gray-100">Bỏ chọn tất cả</button>
            </div>
          </div>

          {/* Driver availability warning */}
          {selectedVehicleIds.size > drivers.length && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl text-sm">
              ⚠️ Bạn chọn <strong>{selectedVehicleIds.size} xe</strong> nhưng chỉ có <strong>{drivers.length} tài xế</strong> khả dụng.
              Hệ thống sẽ tối ưu với tất cả xe đã chọn, nhưng ở bước gán tài xế sẽ có {selectedVehicleIds.size - drivers.length} chuyến chưa có tài xế.
              <br />
              <span className="text-xs text-yellow-600 mt-1 block">
                💡 Gợi ý: Chọn tối đa {drivers.length} xe để đảm bảo đủ tài xế cho mỗi chuyến.
              </span>
            </div>
          )}

          {/* Vehicle groups by type */}
          {Object.entries(vehiclesByType).map(([type, typeVehicles]) => {
            const allTypeSelected = typeVehicles.every(v => selectedVehicleIds.has(v.id))
            const someTypeSelected = typeVehicles.some(v => selectedVehicleIds.has(v.id))
            const typeCapacity = typeVehicles.reduce((s, v) => s + v.capacity_kg, 0)

            return (
              <div key={type} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-b">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={allTypeSelected}
                      className="w-4 h-4 accent-blue-600"
                      ref={el => { if (el) el.indeterminate = someTypeSelected && !allTypeSelected }}
                      onChange={() => toggleAllVehiclesOfType(type)} />
                    <span className="font-semibold text-gray-700">
                      🚛 {type}
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({typeVehicles.length} xe — Tổng tải: {(typeCapacity / 1000).toFixed(1)}T)
                      </span>
                    </span>
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-100">
                  {typeVehicles.map(v => (
                    <label key={v.id}
                      className={`flex items-center gap-3 p-3 cursor-pointer transition
                        ${selectedVehicleIds.has(v.id) ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={selectedVehicleIds.has(v.id)} onChange={() => toggleVehicle(v.id)}
                        className="w-4 h-4 accent-blue-600" />
                      <div>
                        <div className="font-medium text-sm">{v.plate_number}</div>
                        <div className="text-xs text-gray-500">{v.capacity_kg.toLocaleString()}kg / {v.capacity_m3}m³</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Capacity check after selection */}
          {selectedVehicleIds.size > 0 && (
            <div className={`rounded-xl p-4 text-sm ${
              capacityRatio > 100 ? 'bg-red-50 border border-red-200 text-red-700' :
              capacityRatio > 80 ? 'bg-amber-50 border border-amber-200 text-amber-700' :
              'bg-green-50 border border-green-200 text-green-700'
            }`}>
              {capacityRatio > 100
                ? `⚠ Tổng hàng (${(totalDemandKg / 1000).toFixed(1)}T) > Tổng tải xe đã chọn (${(totalCapacityKg / 1000).toFixed(1)}T). Cần thêm xe hoặc bớt đơn ở bước 3.`
                : capacityRatio > 80
                ? `⚡ Sử dụng ${capacityRatio.toFixed(0)}% tải trọng. Hệ thống sẽ tối ưu phân bổ ở bước 4.`
                : `✓ Tải trọng đủ. Dư ${(100 - capacityRatio).toFixed(0)}% — hệ thống sẽ tối ưu số xe cần dùng.`}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          STEP 2: XEM & LỌC ĐƠN HÀNG
         ═══════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm">
              <strong className="text-amber-700">{activeShipments.length}</strong> đơn sẽ được lập kế hoạch
              {excludedShipmentIds.size > 0 && (
                <span className="ml-2 text-gray-500">({excludedShipmentIds.size} đã loại bỏ)</span>
              )}
              — Tổng tải: <strong>{(activeShipments.reduce((s, x) => s + (x.total_weight_kg || 0), 0) / 1000).toFixed(1)}T</strong>
              {shipments.filter(s => s.is_urgent).length > 0 && (
                <span className="ml-2 text-red-600 font-semibold">⚡ {shipments.filter(s => s.is_urgent).length} đơn gấp</span>
              )}
            </div>
            {excludedShipmentIds.size > 0 && (
              <button onClick={() => setExcludedShipmentIds(new Set())}
                className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded text-sm hover:bg-gray-100">
                Bỏ tất cả loại trừ
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="w-10 py-2.5 px-2 text-center">#</th>
                  <th className="w-10 py-2.5 px-2 text-center">⚡</th>
                  <th className="py-2.5 px-2 text-left">Mã đơn</th>
                  <th className="py-2.5 px-2 text-left">Khách hàng</th>
                  <th className="py-2.5 px-2 text-right">Tải (kg)</th>
                  <th className="py-2.5 px-2 text-center">Đặt hàng</th>
                  <th className="py-2.5 px-2 text-center">Xác nhận</th>
                  <th className="w-20 py-2.5 px-2 text-center">Loại bỏ</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s, i) => {
                  const excluded = excludedShipmentIds.has(s.id)
                  return (
                    <tr key={s.id} className={`border-t ${s.is_urgent ? 'bg-red-50' : ''} ${excluded ? 'bg-gray-50 opacity-50' : 'hover:bg-blue-50'}`}>
                      <td className="py-1.5 px-2 text-center text-gray-400">{i + 1}</td>
                      <td className="py-1.5 px-2 text-center">
                        <button onClick={() => toggleUrgent(s.id, s.is_urgent)}
                          title={s.is_urgent ? 'Bỏ ưu tiên gấp' : 'Đánh dấu giao gấp'}
                          className={`text-lg leading-none ${s.is_urgent ? 'grayscale-0' : 'grayscale opacity-30 hover:opacity-60'}`}>
                          ⚡
                        </button>
                      </td>
                      <td className="py-1.5 px-2 font-mono text-xs">{s.shipment_number}</td>
                      <td className="py-1.5 px-2 truncate max-w-[180px]" title={s.customer_name}>{s.customer_name}</td>
                      <td className="py-1.5 px-2 text-right">{s.total_weight_kg?.toFixed(1)}</td>
                      <td className="py-1.5 px-2 text-center text-xs text-gray-500">{fmtTime(s.order_created_at)}</td>
                      <td className="py-1.5 px-2 text-center text-xs text-gray-500">{fmtTime(s.order_confirmed_at)}</td>
                      <td className="py-1.5 px-2 text-center">
                        <button onClick={() => toggleShipment(s.id)}
                          className={`text-xs px-2 py-0.5 rounded ${excluded ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
                          {excluded ? '+ Lại' : '✕ Bỏ'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          STEP 3: TẠO KẾ HOẠCH GIAO HÀNG
         ═══════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Pre-run info */}
          {!vrpResult && !running && (
            <div className="bg-white rounded-xl shadow-sm p-6 text-center">
              <div className="text-5xl mb-4">🗺️</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Sẵn sàng tối ưu tuyến đường</h2>
              <p className="text-gray-500 mb-6 max-w-lg mx-auto">
                Hệ thống sẽ sử dụng thuật toán tối ưu để phân bổ
                <strong className="text-amber-700"> {activeShipments.length} đơn hàng</strong> vào
                <strong className="text-blue-700"> {selectedVehicleIds.size} xe</strong>,
                tối ưu quãng đường và tải trọng.
              </p>

              {/* VRP Optimization Criteria */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left max-w-lg mx-auto">
                <h3 className="font-semibold text-gray-700 text-sm mb-3">⚙️ Tiêu chí tối ưu tuyến đường</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg">
                    <span className="text-amber-500">📏</span>
                    <div><div className="font-medium text-gray-700">Tối thiểu quãng đường</div><div className="text-gray-400">Giảm tổng km di chuyển</div></div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg">
                    <span className="text-blue-500">⚖️</span>
                    <div><div className="font-medium text-gray-700">Tải trọng tối đa</div><div className="text-gray-400">Không vượt capacity xe</div></div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg">
                    <span className="text-green-500">⏱</span>
                    <div><div className="font-medium text-gray-700">Giới hạn 8h/chuyến</div><div className="text-gray-400">Thời gian lái + giao hàng</div></div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg">
                    <span className="text-purple-500">🔄</span>
                    <div><div className="font-medium text-gray-700">Khứ hồi về kho</div><div className="text-gray-400">Kho → điểm giao → về kho</div></div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg">
                    <span className="text-red-500">🚛</span>
                    <div><div className="font-medium text-gray-700">Tối thiểu số xe</div><div className="text-gray-400">Dùng ít xe nhất có thể</div></div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg">
                    <span className="text-teal-500">📍</span>
                    <div><div className="font-medium text-gray-700">Gom nhóm theo vùng</div><div className="text-gray-400">Gom điểm gần nhau cùng xe</div></div>
                  </div>
                </div>
                {(() => {
                  const availDrivers = driverCheckins.filter((d: any) => d.checkin_status === 'available' || d.status === 'available').length || drivers.length
                  const effectiveVehicles = Math.min(selectedVehicleIds.size, availDrivers > 0 ? availDrivers : selectedVehicleIds.size)
                  return selectedVehicleIds.size > availDrivers && availDrivers > 0 ? (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
                      ⚠️ Đã chọn {selectedVehicleIds.size} xe nhưng chỉ có {availDrivers} tài xế sẵn sàng.
                      Hệ thống sẽ chỉ sử dụng <strong>{effectiveVehicles} xe</strong> (= số tài xế khả dụng).
                    </div>
                  ) : null
                })()}
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-6 text-sm">
                <div className="bg-amber-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-amber-700">{activeShipments.length}</div>
                  <div className="text-xs text-gray-500">Đơn hàng</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-blue-700">{(() => {
                    const availDrivers = driverCheckins.filter((d: any) => d.checkin_status === 'available' || d.status === 'available').length || drivers.length
                    return Math.min(selectedVehicleIds.size, availDrivers > 0 ? availDrivers : selectedVehicleIds.size)
                  })()}</div>
                  <div className="text-xs text-gray-500">Xe tham gia</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-green-700">~{estimatedTrips}</div>
                  <div className="text-xs text-gray-500">Chuyến ước tính</div>
                </div>
              </div>
              <button onClick={runVRP}
                className="px-8 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition font-medium text-lg shadow-lg shadow-amber-200">
                🗺️ Tạo kế hoạch giao hàng
              </button>
              <p className="text-xs text-gray-400 mt-3">Thời gian giải tùy thuộc số lượng đơn, có thể mất 10-60 giây</p>
            </div>
          )}

          {/* Running animation */}
          {running && (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <div className="text-5xl mb-4 animate-bounce">⚙️</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Đang tối ưu tuyến đường...</h2>
              <p className="text-gray-500 mb-6">Đang tính toán phân bổ tối ưu cho {activeShipments.length} đơn hàng</p>
              <div className="max-w-md mx-auto mb-4">
                <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${solveProgress}%` }} />
                </div>
                <div className="text-sm text-gray-500 mt-2">{solveProgress}% — Đang xử lý...</div>
              </div>
            </div>
          )}

          {/* VRP Results */}
          {vrpResult && !running && (
            <>
              {/* Summary KPI */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-green-800 text-lg">✅ Kết quả tối ưu tuyến đường</h2>
                  <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">
                    Giải trong {vrpResult.summary?.solve_time_ms || vrpResult.solve_time_ms}ms
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                  <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                    <div className="text-2xl font-bold text-amber-700">{vrpResult.trips.length}</div>
                    <div className="text-xs text-gray-500">Chuyến xe</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                    <div className="text-2xl font-bold text-blue-700">{vrpResult.summary?.total_shipments_assigned}</div>
                    <div className="text-xs text-gray-500">Điểm giao</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                    <div className="text-2xl font-bold text-indigo-700">{vrpResult.summary?.total_distance_km?.toFixed(1)}</div>
                    <div className="text-xs text-gray-500">Tổng km</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                    <div className="text-2xl font-bold text-purple-700">{vrpResult.summary?.total_duration_min || '—'}</div>
                    <div className="text-xs text-gray-500">Tổng phút</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                    <div className="text-2xl font-bold text-green-700">{vrpResult.summary?.avg_capacity_util_pct?.toFixed(0) || '—'}%</div>
                    <div className="text-xs text-gray-500">Sử dụng tải TB</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                    <div className="text-2xl font-bold text-teal-700">{vrpResult.summary?.avg_stops_per_trip?.toFixed(1) || '—'}</div>
                    <div className="text-xs text-gray-500">Điểm/chuyến TB</div>
                  </div>
                </div>

                {/* Capacity bars */}
                <details open className="mt-2">
                  <summary className="text-xs font-semibold text-gray-600 uppercase tracking-wide cursor-pointer hover:text-gray-800">
                    Tải trọng từng xe ({vrpResult.trips.length} chuyến) ▾
                  </summary>
                  <div className="space-y-2 mt-2 max-h-[300px] overflow-y-auto">
                    {vrpResult.trips.map((trip, idx) => {
                      const vehicle = vehicles.find(v => v.id === trip.vehicle_id)
                      const cap = vehicle?.capacity_kg || 15000
                      const pct = Math.min((trip.total_weight_kg / cap) * 100, 100)
                      const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-green-500'
                      return (
                        <div key={idx} className="flex items-center gap-3 text-xs cursor-pointer hover:bg-white/80 rounded p-0.5 transition"
                          onClick={() => setSelectedTripIdx(idx)} title="Bấm để xem chi tiết chuyến">
                          <span className="w-28 truncate font-medium">{trip.plate_number || `Xe ${idx + 1}`}</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-4 relative overflow-hidden">
                            <div className={`${barColor} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">
                              {trip.total_weight_kg?.toFixed(0)} / {cap?.toFixed(0)} kg ({pct.toFixed(0)}%)
                            </span>
                          </div>
                          <span className="w-24 text-right text-gray-500">{trip.stops.length} điểm · {trip.total_distance_km?.toFixed(1)}km</span>
                          <span className="text-blue-500 hover:text-blue-700">🗺️ ▸</span>
                        </div>
                      )
                    })}
                  </div>
                </details>

                {vrpResult.unassigned_shipments?.length > 0 && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-bold text-red-700">
                        ⚠️ Không xếp được: {vrpResult.unassigned_shipments.length} đơn hàng
                      </div>
                    </div>
                    <div className="text-xs text-red-600 mb-3">
                      Các đơn hàng này không thể xếp vào xe do vượt tải trọng hoặc giới hạn thời gian.
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <button onClick={() => { setStep(1); }}
                        className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 transition">
                        🚛 Quay bước 2 — Thêm xe
                      </button>
                      <button onClick={() => { setStep(2); }}
                        className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 transition">
                        📦 Quay bước 3 — Bớt đơn hàng
                      </button>
                      <button onClick={() => { setVrpResult(null); setJobId(''); runVRP() }}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition">
                        🔄 Tối ưu lại
                      </button>
                    </div>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-red-500 hover:text-red-700 font-medium">
                        Xem danh sách đơn không xếp được ({vrpResult.unassigned_shipments.length})
                      </summary>
                      <div className="mt-2 max-h-[200px] overflow-y-auto space-y-1">
                        {vrpResult.unassigned_shipments.map((s: any, i: number) => {
                          // unassigned_shipments may be bare UUIDs — enrich from shipments list
                          const sid = typeof s === 'string' ? s : (s.shipment_id || s.id || s)
                          const shipment = shipments.find(sh => sh.id === sid)
                          return (
                            <div key={i} className="flex items-center justify-between p-2 bg-white rounded border">
                              <span className="font-medium">{shipment?.shipment_number || (typeof sid === 'string' ? sid.slice(0, 8) : '?')}</span>
                              <span className="text-gray-500 truncate max-w-[200px]">{shipment?.customer_name || '—'}</span>
                              <span className="font-medium whitespace-nowrap">{shipment?.total_weight_kg?.toFixed(0) || '?'} kg</span>
                            </div>
                          )
                        })}
                      </div>
                    </details>
                  </div>
                )}
              </div>

              {/* Adjustment guide */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-blue-800 text-sm mb-2">🔧 Hướng dẫn điều chỉnh</h3>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• <strong>Kéo thả</strong> điểm giao giữa các chuyến xe để di chuyển shipment</li>
                  <li>• Dùng nút <strong>↑ ↓</strong> để thay đổi thứ tự giao trong chuyến</li>
                  <li>• Tải trọng sẽ tự động tính lại sau khi điều chỉnh</li>
                  <li>• Bấm <strong>&quot;Tối ưu lại từ đầu&quot;</strong> nếu muốn hệ thống tối ưu lại từ đầu</li>
                  <li>• Khi hài lòng với kết quả, bấm <strong>&quot;Tiếp theo&quot;</strong> để gán tài xế và duyệt</li>
                </ul>
              </div>

              {/* Trip cards with drag & drop */}
              {vrpResult.trips.map((trip, tripIdx) => {
                const vehicle = vehicles.find(v => v.id === trip.vehicle_id)
                const cap = vehicle?.capacity_kg || 15000
                const overloaded = trip.total_weight_kg > cap

                return (
                  <div key={tripIdx} className={`bg-white rounded-xl shadow-sm p-5 ${overloaded ? 'ring-2 ring-red-400' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">
                        Chuyến {tripIdx + 1}:&nbsp;
                        <span className="text-blue-600">{trip.plate_number || trip.vehicle_id.slice(0, 8)}</span>
                        {trip.vehicle_type && <span className="text-gray-400 text-sm ml-2">({trip.vehicle_type})</span>}
                        {overloaded && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">⚠ Quá tải!</span>}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span>{trip.total_distance_km?.toFixed(1)} km</span>
                        <span className={overloaded ? 'text-red-600 font-bold' : ''}>
                          {trip.total_weight_kg?.toFixed(0)}/{cap?.toFixed(0)} kg
                        </span>
                        <span>{trip.stops.length} điểm</span>
                        {trip.total_duration_min > 0 && <span>~{trip.total_duration_min} phút</span>}
                        <button onClick={() => setSelectedTripIdx(tripIdx)}
                          className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-xs font-medium">
                          🗺️ Xem bản đồ
                        </button>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-center py-1.5 px-2 w-10">#</th>
                          <th className="text-left py-1.5 px-2">Khách hàng</th>
                          <th className="text-left py-1.5 px-2">Địa chỉ</th>
                          <th className="text-right py-1.5 px-2">Tải tích lũy (kg)</th>
                          <th className="text-center py-1.5 px-2 w-16">Sắp xếp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trip.stops.map((stop, stopIdx) => (
                          <tr key={stop.shipment_id}
                            className="border-t hover:bg-blue-50 cursor-move group"
                            draggable
                            onDragStart={e => {
                              e.dataTransfer.setData('text/plain', JSON.stringify({ tripIdx, stopIdx }))
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bg-blue-100') }}
                            onDragLeave={e => { e.currentTarget.classList.remove('bg-blue-100') }}
                            onDrop={e => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('bg-blue-100')
                              try {
                                const src = JSON.parse(e.dataTransfer.getData('text/plain'))
                                handleMoveStop(src.tripIdx, src.stopIdx, tripIdx, stopIdx)
                              } catch { /* ignore */ }
                            }}
                          >
                            <td className="py-1 px-2 text-center text-gray-400">{stop.stop_order}</td>
                            <td className="py-1 px-2">{stop.customer_name}</td>
                            <td className="py-1 px-2 text-gray-500 text-xs truncate max-w-[200px]">{stop.customer_address || '—'}</td>
                            <td className="py-1 px-2 text-right">{stop.cumulative_load_kg?.toFixed(0)}</td>
                            <td className="py-1 px-2 text-center">
                              <div className="opacity-0 group-hover:opacity-100 flex gap-1 justify-center">
                                <button title="Lên" disabled={stopIdx === 0}
                                  onClick={() => handleMoveStop(tripIdx, stopIdx, tripIdx, stopIdx - 1)}
                                  className="w-5 h-5 text-xs bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-30">↑</button>
                                <button title="Xuống" disabled={stopIdx === trip.stops.length - 1}
                                  onClick={() => handleMoveStop(tripIdx, stopIdx, tripIdx, stopIdx + 1)}
                                  className="w-5 h-5 text-xs bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-30">↓</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}

              {/* Re-run VRP */}
              <div className="flex justify-center">
                <button onClick={() => { setVrpResult(null); setJobId(''); runVRP() }}
                  className="px-6 py-2.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition font-medium">
                  🔄 Tối ưu lại từ đầu
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          STEP 4: GÁN TÀI XẾ & DUYỆT
         ═══════════════════════════════════════════════ */}
      {step === 4 && vrpResult && (
        <div className="space-y-6">
          {approved ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-xl font-bold text-green-800 mb-2">Kế hoạch đã được duyệt!</h2>
              <p className="text-green-600 mb-4">
                Đã tạo thành công <strong>{vrpResult.trips.length} chuyến xe</strong> cho ngày {deliveryDate}.
              </p>
              <a href="/dashboard/trips" className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">
                📋 Xem danh sách chuyến xe
              </a>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="font-bold text-gray-800 mb-4">Gán tài xế cho từng chuyến xe</h2>
                {(() => {
                  const availableDrivers = driverCheckins.filter((c: any) => c.checkin_status === 'available')
                  const notCheckedIn = driverCheckins.filter((c: any) => c.checkin_status === 'not_checked_in').length
                  return (
                    <>
                      <p className="text-sm text-gray-500 mb-2">
                        Chọn tài xế cho mỗi chuyến. Tài xế đã được gán sẽ hiển thị màu xanh.
                        Còn <strong className="text-green-700">{availableDrivers.length}</strong> tài xế sẵn sàng
                        cho <strong className="text-amber-700">{vrpResult.trips.length}</strong> chuyến.
                      </p>
                      {notCheckedIn > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs px-3 py-2 rounded-lg mb-4">
                          ⚠️ Còn {notCheckedIn} tài xế chưa check-in. Chỉ tài xế đã check-in sẵn sàng mới hiển thị trong danh sách chọn.
                        </div>
                      )}
                    </>
                  )
                })()}

                <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                  {vrpResult.trips.map((trip, idx) => {
                    const vehicle = vehicles.find(v => v.id === trip.vehicle_id)
                    const assignedDriverId = driverAssign[trip.vehicle_id]
                    const assignedDriver = drivers.find(d => d.id === assignedDriverId)
                    const usedDriverIds = new Set(Object.values(driverAssign).filter(Boolean))

                    return (
                      <div key={idx} className={`flex items-center gap-4 p-3 rounded-lg border ${assignedDriverId ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">
                            {trip.plate_number || trip.vehicle_id.slice(0, 8)}
                            {vehicle?.vehicle_type && <span className="text-gray-400 ml-1">({vehicle.vehicle_type})</span>}
                          </div>
                          <div className="text-xs text-gray-500">
                            {trip.stops.length} điểm · {trip.total_distance_km?.toFixed(1)}km · {trip.total_weight_kg?.toFixed(0)}kg
                          </div>
                        </div>
                        <select
                          value={assignedDriverId || ''}
                          onChange={e => setDriverAssign({ ...driverAssign, [trip.vehicle_id]: e.target.value })}
                          className={`px-3 py-2 border rounded-lg text-sm min-w-[220px] ${assignedDriverId ? 'border-green-300 bg-white' : 'border-yellow-300 bg-white'}`}
                        >
                          <option value="">-- Chọn tài xế --</option>
                          {(() => {
                            // Only show drivers with 'available' check-in status
                            const availableCheckinIds = new Set(driverCheckins.filter((c: any) => c.checkin_status === 'available').map((c: any) => c.driver_id || c.id))
                            return [...drivers]
                              .filter(d => availableCheckinIds.has(d.id) || d.id === assignedDriverId)
                              .sort((a, b) => {
                                const aUsed = usedDriverIds.has(a.id) && a.id !== assignedDriverId
                                const bUsed = usedDriverIds.has(b.id) && b.id !== assignedDriverId
                                if (aUsed && !bUsed) return 1
                                if (!aUsed && bUsed) return -1
                                return a.full_name.localeCompare(b.full_name)
                              })
                              .map(d => {
                                const isUsedElsewhere = usedDriverIds.has(d.id) && d.id !== assignedDriverId
                                return (
                                  <option key={d.id} value={d.id} disabled={isUsedElsewhere}>
                                    {d.full_name} ({d.phone}){isUsedElsewhere ? ' — đã gán' : ''}
                                  </option>
                                )
                              })
                          })()}
                        </select>
                        {assignedDriver && (
                          <span className="text-green-600 text-sm">✓</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Summary & approve */}
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="font-semibold text-gray-700 mb-3">Tổng kết kế hoạch</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold">{vrpResult.trips.length}</div>
                    <div className="text-xs text-gray-500">Chuyến xe</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold">{vrpResult.summary?.total_shipments_assigned}</div>
                    <div className="text-xs text-gray-500">Đơn được giao</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold">{Object.values(driverAssign).filter(Boolean).length}/{vrpResult.trips.length}</div>
                    <div className="text-xs text-gray-500">Đã gán tài xế</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold">{vrpResult.unassigned_shipments?.length || 0}</div>
                    <div className="text-xs text-gray-500">Chưa xếp được</div>
                  </div>
                </div>

                {Object.values(driverAssign).filter(Boolean).length < vrpResult.trips.length && (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm px-4 py-3 rounded-lg mb-4">
                    ⚠️ Còn {vrpResult.trips.length - Object.values(driverAssign).filter(Boolean).length} chuyến chưa gán tài xế. Bạn vẫn có thể duyệt và gán sau.
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={approvePlan} disabled={approving}
                    className="px-8 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-medium text-lg shadow-lg shadow-green-200 disabled:opacity-50">
                    {approving ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        Đang tạo chuyến...
                      </span>
                    ) : '✅ Duyệt kế hoạch & Tạo chuyến xe'}
                  </button>
                  <button onClick={() => setStep(3)}
                    className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition font-medium">
                    ← Quay lại điều chỉnh
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── TRIP DETAIL MODAL ─── */}
      {selectedTripIdx !== null && vrpResult?.trips[selectedTripIdx] && (
        <TripDetailModal
          trip={vrpResult.trips[selectedTripIdx]}
          tripIdx={selectedTripIdx}
          vehicles={vehicles}
          warehouse={warehouseMapInfo}
          onClose={() => setSelectedTripIdx(null)}
        />
      )}

      {/* ─── VEHICLE STATUS MODAL ─── */}
      {showVehicleStatusModal && (
        <VehicleStatusModal vehicles={allVehicles.length > 0 ? allVehicles : vehicles} onClose={() => setShowVehicleStatusModal(false)} />
      )}

      {/* ─── DRIVER STATUS MODAL ─── */}
      {showDriverStatusModal && (
        <DriverStatusModal drivers={allDrivers.length > 0 ? allDrivers : drivers} checkins={driverCheckins} onClose={() => setShowDriverStatusModal(false)} />
      )}

      {/* ─── NAVIGATION BUTTONS ─── */}
      {!approved && (
        <div className="flex justify-between mt-8 mb-4">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
            className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed">
            ← Quay lại
          </button>
          {step < 4 && (
            <button onClick={() => setStep(step + 1)} disabled={!canGoNext()}
              className="px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium disabled:opacity-30 disabled:cursor-not-allowed">
              Tiếp theo →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
