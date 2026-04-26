'use client'

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, getUser } from '@/lib/api'
import SearchableSelect from '@/lib/SearchableSelect'
import { useNotifications } from '@/lib/notifications'
import { handleError } from '@/lib/handleError'

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
  const [showAllTolls, setShowAllTolls] = useState(false)
  const [allTollStations, setAllTollStations] = useState<any[]>([])
  const [allExpressways, setAllExpressways] = useState<any[]>([])
  const tollLayerRef = useRef<any>(null)
  const vehicle = vehicles.find(v => v.id === trip.vehicle_id)
  const cap = vehicle?.capacity_kg || 15000
  const pct = (trip.total_weight_kg / cap * 100).toFixed(0)

  // Load tất cả trạm thu phí từ API
  useEffect(() => {
    Promise.all([
      apiFetch<any>('/cost/toll-stations').catch(() => ({ data: [] })),
      apiFetch<any>('/cost/toll-expressways').catch(() => ({ data: [] })),
    ]).then(([s, e]) => {
      setAllTollStations(s.data || [])
      setAllExpressways(e.data || [])
    })
  }, [])

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
          .bindPopup(`<b>#${i + 1} ${stop.customer_name}</b>${(stop.consolidated_ids?.length ?? 0) > 1 ? ` <span style="background:#f3e8ff;color:#7e22ce;padding:1px 4px;border-radius:3px;font-size:10px">📦×${stop.consolidated_ids!.length}</span>` : ''}${stop.is_split ? ` <span style="background:#fff7ed;color:#c2410c;padding:1px 4px;border-radius:3px;font-size:10px">✂️${stop.split_part}/${stop.split_total}</span>` : ''}<br/>${stop.customer_address || ''}<br/>${stop.weight_kg ? `⚖️ ${stop.weight_kg.toFixed(1)} kg` : ''} Tích lũy: ${stop.cumulative_load_kg?.toFixed(0)} kg`)
        waypoints.push([stop.latitude, stop.longitude])
      })

      // Return to depot
      if (warehouse) waypoints.push([warehouse.lat, warehouse.lng])

      // Toll station markers — phân biệt trạm hở (🟠) và cao tốc kín (🔵)
      if (trip.tolls_passed?.length) {
        const seen = new Set<string>()
        trip.tolls_passed.forEach((tp: any) => {
          if (!tp.latitude || !tp.longitude) return
          const key = `${tp.latitude.toFixed(4)},${tp.longitude.toFixed(4)}`
          if (seen.has(key)) return
          seen.add(key)
          const isExpressway = tp.toll_type === 'expressway'
          const bgColor = isExpressway ? '#3b82f6' : '#f97316'
          const emoji = isExpressway ? '🛣️' : '🚏'
          const tollIcon = L.divIcon({
            html: `<div style="background:${bgColor};color:white;width:22px;height:22px;border-radius:4px;transform:rotate(45deg);display:flex;align-items:center;justify-content:center;font-size:11px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"><span style="transform:rotate(-45deg)">${emoji}</span></div>`,
            className: '', iconSize: [22, 22], iconAnchor: [11, 11]
          })
          const distInfo = tp.distance_km ? `<br/>Đoạn: ${tp.distance_km.toFixed(1)}km` : ''
          const typeLabel = isExpressway ? 'Cao tốc kín' : 'Trạm hở'
          L.marker([tp.latitude, tp.longitude], { icon: tollIcon })
            .addTo(map)
            .bindPopup(`<b>${emoji} ${tp.station_name}</b><br/>Phí: ${(tp.fee_vnd / 1000).toFixed(0)}K VND${distInfo}<br/><i style="color:#888">${typeLabel}</i>`)
        })
      }

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
        const _deliveryKm = osrm.legs.slice(0, -1).reduce((s, l) => s + l.distance_km, 0) + (osrm.legs[0]?.distance_km || 0)
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

  // Toggle hiển thị tất cả trạm thu phí trên map
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    const L = (window as any).L
    if (!L) return

    // Xóa layer cũ
    if (tollLayerRef.current) {
      map.removeLayer(tollLayerRef.current)
      tollLayerRef.current = null
    }

    if (!showAllTolls) return

    const layerGroup = L.layerGroup()

    // Danh sách trạm đã đi qua (để highlight)
    const passedNames = new Set((trip.tolls_passed || []).map((tp: any) => tp.station_name))

    // Trạm hở
    allTollStations.forEach((ts: any) => {
      if (!ts.latitude || !ts.longitude) return
      const isPassed = passedNames.has(ts.station_name)
      const bgColor = isPassed ? '#f97316' : '#9ca3af'
      const opacity = isPassed ? 1 : 0.6
      const icon = L.divIcon({
        html: `<div style="background:${bgColor};opacity:${opacity};color:white;width:18px;height:18px;border-radius:3px;transform:rotate(45deg);display:flex;align-items:center;justify-content:center;font-size:9px;border:1.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,.2)"><span style="transform:rotate(-45deg)">🚏</span></div>`,
        className: '', iconSize: [18, 18], iconAnchor: [9, 9]
      })
      const feeLine = `L2: ${((ts.fee_l2 || 0)/1000).toFixed(0)}K | L3: ${((ts.fee_l3 || 0)/1000).toFixed(0)}K | L4: ${((ts.fee_l4 || 0)/1000).toFixed(0)}K`
      L.marker([ts.latitude, ts.longitude], { icon })
        .addTo(layerGroup)
        .bindPopup(`<b>🚏 ${ts.station_name}</b><br/>${ts.road_name || ''}<br/>${feeLine}<br/><i style="color:#888">Trạm hở${isPassed ? ' — ✅ Đi qua' : ''}</i>`)
    })

    // Cổng cao tốc
    allExpressways.forEach((ew: any) => {
      (ew.gates || []).forEach((g: any) => {
        if (!g.latitude || !g.longitude) return
        const icon = L.divIcon({
          html: `<div style="background:#3b82f6;opacity:0.6;color:white;width:18px;height:18px;border-radius:3px;transform:rotate(45deg);display:flex;align-items:center;justify-content:center;font-size:9px;border:1.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,.2)"><span style="transform:rotate(-45deg)">🛣️</span></div>`,
          className: '', iconSize: [18, 18], iconAnchor: [9, 9]
        })
        const rateLine = `L2: ${((ew.rate_per_km_l2 || 0)).toFixed(0)}đ/km | L3: ${((ew.rate_per_km_l3 || 0)).toFixed(0)}đ/km`
        L.marker([g.latitude, g.longitude], { icon })
          .addTo(layerGroup)
          .bindPopup(`<b>🛣️ ${g.gate_name}</b><br/>${ew.expressway_name}<br/>Km: ${g.km_marker}<br/>${rateLine}<br/><i style="color:#888">Cao tốc kín</i>`)
      })
    })

    layerGroup.addTo(map)
    tollLayerRef.current = layerGroup
  }, [showAllTolls, allTollStations, allExpressways, trip.tolls_passed])

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
        <div className="bg-gradient-to-r from-brand-500 to-brand-600 text-white px-6 py-4 flex items-center justify-between">
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
            <button onClick={() => setShowAllTolls(!showAllTolls)} title={showAllTolls ? 'Ẩn trạm thu phí' : 'Hiện tất cả trạm thu phí'}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${showAllTolls ? 'bg-orange-400/80 hover:bg-orange-500/80' : 'bg-white/20 hover:bg-white/30'}`}>
              🚏
            </button>
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
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          {stop.customer_name}
                          {stop.consolidated_ids && stop.consolidated_ids.length > 1 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700" title={`Ghép ${stop.consolidated_ids.length} đơn cùng NPP`}>📦×{stop.consolidated_ids.length}</span>
                          )}
                          {stop.is_split && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700" title={`Tách đơn: phần ${stop.split_part}/${stop.split_total}`}>✂️ {stop.split_part}/{stop.split_total}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{stop.customer_address || 'Chưa có địa chỉ'}</div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                          <span className="text-gray-600">
                            ⚖️ <strong>{stop.weight_kg?.toFixed(1) || '—'} kg</strong>
                            {stop.is_split && stop.original_weight_kg ? <span className="text-gray-400 ml-1">(gốc: {stop.original_weight_kg.toFixed(0)} kg)</span> : null}
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
              {/* Cost breakdown row */}
              {((trip.total_cost_vnd ?? 0) > 0 || (trip.fuel_cost_vnd ?? 0) > 0) && (
                <div className="grid grid-cols-4 gap-2 text-center text-xs mt-2 pt-2 border-t border-gray-200">
                  <div>
                    <div className="font-bold text-green-700">{((trip.total_cost_vnd || 0) / 1000).toFixed(0)}K</div>
                    <div className="text-gray-400">💰 Tổng CP</div>
                  </div>
                  <div>
                    <div className="font-bold text-orange-600">{((trip.fuel_cost_vnd || 0) / 1000).toFixed(0)}K</div>
                    <div className="text-gray-400">⛽ Xăng/dầu</div>
                  </div>
                  <div>
                    <div className="font-bold text-red-600">{((trip.toll_cost_vnd || 0) / 1000).toFixed(0)}K</div>
                    <div className="text-gray-400">🚏 Cầu đường</div>
                  </div>
                  <div>
                    <div className="font-bold text-blue-600">{((trip.cost_per_ton_vnd || 0) / 1000).toFixed(0)}K</div>
                    <div className="text-gray-400">VND/tấn</div>
                  </div>
                </div>
              )}
              {/* Tolls passed detail */}
              {trip.tolls_passed && trip.tolls_passed.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="text-[10px] text-gray-500 mb-1">🚏 Trạm đi qua:</div>
                  {trip.tolls_passed.map((tp: any, i: number) => (
                    <div key={i} className="flex justify-between text-[10px] text-gray-600">
                      <span>{tp.toll_type === 'expressway' ? '🛣️' : '🚏'} {tp.station_name}</span>
                      <span className="font-medium">{(tp.fee_vnd / 1000).toFixed(0)}K</span>
                    </div>
                  ))}
                </div>
              )}
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
        <div className="bg-gradient-to-r from-brand-500 to-brand-600 text-white px-6 py-4 flex items-center justify-between">
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
  default_driver_id?: string | null; default_driver_name?: string
}
interface Driver {
  id: string; full_name: string; phone: string; license_number: string; status: string; warehouse_id?: string
  default_vehicle_id?: string | null
}
interface PendingDate {
  delivery_date: string; shipment_count: number; total_weight_kg: number
}
interface VRPStop {
  stop_order: number; shipment_id: string; customer_name: string
  customer_id: string; customer_address: string; latitude: number; longitude: number; cumulative_load_kg: number
  weight_kg?: number; consolidated_ids?: string[]; is_split?: boolean; split_part?: number; split_total?: number; original_weight_kg?: number
}
interface VRPTrip {
  vehicle_id: string; plate_number?: string; vehicle_type?: string
  stops: VRPStop[]
  total_distance_km: number; total_weight_kg: number; total_duration_min: number
  tolls_passed?: any[]; toll_cost?: number; fuel_cost?: number; total_cost?: number
  toll_detection?: string
  total_cost_vnd?: number; fuel_cost_vnd?: number; toll_cost_vnd?: number; cost_per_ton_vnd?: number
}
interface VRPSummary {
  total_trips: number; total_vehicles: number; total_shipments_assigned: number
  total_unassigned: number; total_distance_km: number; total_duration_min: number
  total_weight_kg: number; avg_capacity_util_pct: number; avg_stops_per_trip: number
  solve_time_ms: number; consolidated_stops?: number; split_deliveries?: number
  total_cost_vnd?: number; total_fuel_cost_vnd?: number; total_toll_cost_vnd?: number
  total_driver_cost_vnd?: number; avg_cost_per_ton_vnd?: number; avg_cost_per_km_vnd?: number; avg_cost_per_shipment_vnd?: number
  toll_cost_ratio_pct?: number
  [key: string]: any
}
interface VRPResult {
  job_id: string; status: string; error?: string; solve_time_ms: number
  trips: VRPTrip[]; unassigned_shipments: any[]; summary: VRPSummary
  distance_source?: string; optimize_for?: string
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

  // Real-time VRP progress (from WebSocket vrp_progress messages)
  const VRP_STAGES = [
    { key: 'matrix',      icon: '📍', label: 'Tính ma trận khoảng cách' },
    { key: 'toll',        icon: '🛣️', label: 'Phân tích trạm BOT' },
    { key: 'toll_matrix', icon: '🚫', label: 'Ma trận tránh BOT' },
    { key: 'solving',     icon: '⚙️', label: 'Phân bổ xe & điểm giao' },
    { key: 'routes',      icon: '🗺️', label: 'Tính lộ trình chi tiết' },
    { key: 'done',        icon: '✅', label: 'Hoàn tất' },
  ]
  const STAGE_ORDER: Record<string, number> = { '': -1, matrix: 0, toll: 1, toll_matrix: 2, solving: 3, routes: 4, done: 5, error: 6 }
  const [singleProgress, setSingleProgress] = useState({ pct: 0, stage: '', detail: '' })
  const [compareProgress, setCompareProgress] = useState({
    cost:     { pct: 0, stage: '', detail: '' },
    time:     { pct: 0, stage: '', detail: '' },
  })
  const vrpJobMapRef = useRef<Record<string, 'cost' | 'time' | 'single'>>({})

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

  // Planning mode: VRP auto or manual
  const [planMode, setPlanMode] = useState<'vrp' | 'manual'>('vrp')
  const [manualAssign, setManualAssign] = useState<Record<string, string[]>>({}) // vehicleId → shipmentId[]
  const [poolSort, setPoolSort] = useState<'default' | 'region' | 'weight-desc' | 'weight-asc' | 'urgent' | 'customer'>('default')

  // VRP criteria with priority ordering (index = priority, lower = higher priority)
  const [criteriaOrder, setCriteriaOrder] = useState([
    { key: 'max_capacity', icon: '⚖️', color: 'text-blue-500', label: 'Tải trọng tối đa', desc: 'Không vượt capacity xe', enabled: true },
    { key: 'min_vehicles', icon: '🚛', color: 'text-red-500', label: 'Tối thiểu số xe', desc: 'Dùng ít xe nhất có thể', enabled: true },
    { key: 'cluster_region', icon: '📍', color: 'text-teal-500', label: 'Gom nhóm theo vùng', desc: 'Gom điểm gần nhau cùng xe', enabled: true },
    { key: 'time_limit', icon: '⏱', color: 'text-green-500', label: 'Giới hạn thời gian/chuyến', desc: 'Thời gian lái + giao hàng', enabled: true },
  ])
  const [maxTripHours, setMaxTripHours] = useState(8)
  const [_costOptimize, setCostOptimize] = useState(false)
  const [optimizeFor, setOptimizeFor] = useState<'cost' | 'time'>('cost')
  const [costReadiness, setCostReadiness] = useState<{
    ready: boolean; toll_station_count: number; expressway_count: number;
    vehicle_default_count: number; driver_rate_count: number;
  } | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [savedScenarios, setSavedScenarios] = useState<any[]>([])
  const [savingScenario, setSavingScenario] = useState(false)
  const [scenarioName, setScenarioName] = useState('')
  const [showScenarios, setShowScenarios] = useState(false)
  const [savedJobId, setSavedJobId] = useState('')
  const [compareResult, setCompareResult] = useState<{ cost: VRPResult | null; time: VRPResult | null } | null>(null)
  const [comparing, setComparing] = useState(false)

  const { subscribeVRPProgress } = useNotifications()

  // ─── Init ──────────────────────────────────────────
  useEffect(() => {
    apiFetch<any>('/warehouses').then(r => setWarehouses(r.data || [])).catch(err => handleError(err))
    apiFetch<any>('/planning/cost-readiness').then(r => {
      setCostReadiness(r.data || null)
      if (r.data?.ready) setCostOptimize(true)
    }).catch(err => handleError(err))
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
      .catch(err => handleError(err))
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
    setSavedJobId('')
    setSingleProgress({ pct: 0, stage: '', detail: '' })

    try {
      const vehicleIdsToSend = Array.from(selectedVehicleIds)

      // Build criteria priorities from ordered list
      const critMap: Record<string, number> = {}
      criteriaOrder.forEach((c, idx) => {
        critMap[c.key] = c.enabled ? idx + 1 : 0
      })

      const res: any = await apiFetch('/planning/run-vrp', {
        method: 'POST',
        body: {
          warehouse_id: warehouseId,
          delivery_date: deliveryDate,
          vehicle_ids: vehicleIdsToSend,
          criteria: {
            max_capacity: critMap['max_capacity'] || 0,
            min_vehicles: critMap['min_vehicles'] || 0,
            cluster_region: critMap['cluster_region'] || 0,
            min_distance: 1,
            round_trip: 1,
            time_limit: critMap['time_limit'] || 0,
            max_trip_minutes: maxTripHours * 60,
            cost_optimize: costReadiness?.ready || false,
            optimize_for: optimizeFor,
          },
        },
      })
      const jid = res.data?.job_id
      setJobId(jid)
      vrpJobMapRef.current[jid] = 'single'

      // Poll for result
      pollRef.current = setInterval(async () => {
        try {
          const r: any = await apiFetch(`/planning/jobs/${jid}`)
          if (r.data?.status === 'processing') {
            // Fallback progress source when WS messages are delayed/missed.
            if (typeof r.data.pct === 'number' || r.data.stage || r.data.detail) {
              setSingleProgress({
                pct: typeof r.data.pct === 'number' ? r.data.pct : 0,
                stage: r.data.stage || '',
                detail: r.data.detail || '',
              })
              if (typeof r.data.pct === 'number') setSolveProgress(r.data.pct)
            }
          }
          if (r.data?.status === 'completed' || r.data?.status === 'failed' || r.data?.status === 'no_solution') {
            clearInterval(pollRef.current)
            clearInterval(progressRef.current)
            setSolveProgress(100)
            setSingleProgress({ pct: 100, stage: 'done', detail: '' })
            delete vrpJobMapRef.current[jid]
            setVrpResult(r.data)
            setRunning(false)

            // Init driver assignment (auto-assign: prefer default driver, fallback by order)
            if (r.data?.trips) {
              const init: Record<string, string> = {}
              const usedDrivers = new Set<string>()
              // First pass: assign default drivers from vehicle mapping
              r.data.trips.forEach((t: VRPTrip) => {
                const vehicle = vehicles.find(v => v.id === t.vehicle_id)
                if (vehicle?.default_driver_id) {
                  const defaultDriver = drivers.find(d => d.id === vehicle.default_driver_id)
                  if (defaultDriver && defaultDriver.status === 'active') {
                    init[t.vehicle_id] = defaultDriver.id
                    usedDrivers.add(defaultDriver.id)
                  }
                }
              })
              // Second pass: fill remaining with available drivers by order
              let driverIdx = 0
              r.data.trips.forEach((t: VRPTrip) => {
                if (!init[t.vehicle_id]) {
                  while (driverIdx < drivers.length && usedDrivers.has(drivers[driverIdx].id)) driverIdx++
                  if (driverIdx < drivers.length) {
                    init[t.vehicle_id] = drivers[driverIdx].id
                    usedDrivers.add(drivers[driverIdx].id)
                    driverIdx++
                  }
                }
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

  // ─── Compare 3 optimization modes ──────────────────────────
  const compareStrategies = async () => {
    if (!warehouseId || !deliveryDate || activeShipments.length === 0 || selectedVehicleIds.size === 0) {
      setError('Vui lòng chọn kho, ngày giao, đơn hàng và xe trước.')
      return
    }
    setComparing(true)
    setError('')
    setCompareResult(null)
    setSolveProgress(0)
    setCompareProgress({
      cost:     { pct: 0, stage: '', detail: '' },
      time:     { pct: 0, stage: '', detail: '' },
    })

    const vehicleIdsToSend = Array.from(selectedVehicleIds)
    const critMap: Record<string, number> = {}
    criteriaOrder.forEach((c, idx) => { critMap[c.key] = c.enabled ? idx + 1 : 0 })

    const buildBody = (mode: string) => ({
      warehouse_id: warehouseId,
      delivery_date: deliveryDate,
      vehicle_ids: vehicleIdsToSend,
      criteria: {
        max_capacity: critMap['max_capacity'] || 0,
        min_vehicles: critMap['min_vehicles'] || 0,
        cluster_region: critMap['cluster_region'] || 0,
        min_distance: 1,
        round_trip: 1,
        time_limit: critMap['time_limit'] || 0,
        max_trip_minutes: maxTripHours * 60,
        cost_optimize: costReadiness?.ready || false,
        optimize_for: mode,
      },
    })

    const pollJob = (jid: string, mode: 'cost' | 'time'): Promise<VRPResult | null> => {
      return new Promise((resolve) => {
        const poll = setInterval(async () => {
          try {
            const r: any = await apiFetch(`/planning/jobs/${jid}`)
            if (r.data?.status === 'processing') {
              // Fallback progress source when WS messages are delayed/missed.
              setCompareProgress(prev => ({
                ...prev,
                [mode]: {
                  pct: typeof r.data?.pct === 'number' ? r.data.pct : prev[mode].pct,
                  stage: r.data?.stage || prev[mode].stage,
                  detail: r.data?.detail || prev[mode].detail,
                }
              }))
            }
            if (r.data?.status === 'completed' || r.data?.status === 'failed' || r.data?.status === 'no_solution') {
              clearInterval(poll)
              const doneStage = r.data?.status === 'completed' ? 'done' : 'error'
              setCompareProgress(prev => ({
                ...prev,
                [mode]: {
                  pct: 100,
                  stage: doneStage,
                  detail: doneStage === 'done' ? '' : (r.data?.error || 'Không thể giải phương án'),
                }
              }))
              resolve(r.data)
            }
          } catch { /* keep polling */ }
        }, 2000)
        setTimeout(() => { clearInterval(poll); resolve(null) }, 180000)
      })
    }

    try {
      // Launch all 3 modes in parallel and map job IDs as soon as each response arrives.
      const startMode = async (mode: 'cost' | 'time') => {
        const res: any = await apiFetch('/planning/run-vrp', { method: 'POST', body: buildBody(mode) })
        const jid = res?.data?.job_id
        if (jid) vrpJobMapRef.current[jid] = mode
        return { res, jid }
      }

      const [a, b] = await Promise.all([
        startMode('cost'),
        startMode('time'),
      ])

      const resA = a.res
      const resB = b.res

      // Seed UI to avoid all columns staying at 0% before first event.
      if (a.jid) setCompareProgress(prev => ({ ...prev, cost: { ...prev.cost, stage: 'matrix', detail: 'Đã tạo job' } }))
      if (b.jid) setCompareProgress(prev => ({ ...prev, time: { ...prev.time, stage: 'matrix', detail: 'Đã tạo job' } }))

      // Poll all 2 jobs in parallel
      const [resultA, resultB] = await Promise.all([
        pollJob(resA.data?.job_id, 'cost'),
        pollJob(resB.data?.job_id, 'time'),
      ])

      clearInterval(progressRef.current)
      setSolveProgress(100)
      // Cleanup job map
      if (resA.data?.job_id) delete vrpJobMapRef.current[resA.data.job_id]
      if (resB.data?.job_id) delete vrpJobMapRef.current[resB.data.job_id]
      setCompareResult({ cost: resultA, time: resultB })
    } catch (err: any) {
      clearInterval(progressRef.current)
      setError(err.message)
    }
    setComparing(false)
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (progressRef.current) clearInterval(progressRef.current)
    }
  }, [])

  // Subscribe to VRP progress events from WebSocket
  useEffect(() => {
    return subscribeVRPProgress(({ job_id, stage, pct, detail }) => {
      const mode = vrpJobMapRef.current[job_id]
      if (!mode) return
      if (mode === 'single') {
        setSingleProgress({ pct, stage, detail })
        setSolveProgress(pct)
      } else {
        setCompareProgress(prev => ({ ...prev, [mode]: { pct, stage, detail } }))
      }
    })
  }, [subscribeVRPProgress])

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

  // ─── Manual Planning helpers ────────────────────────
  const manualUnassignedRaw = activeShipments.filter(s => !Object.values(manualAssign).flat().includes(s.id))

  // Extract district/ward from Vietnamese address for region grouping
  const extractDistrict = useCallback((addr?: string): string => {
    if (!addr) return 'Không rõ'
    const m = addr.match(/(?:Quận|Huyện|Thành phố|Thị xã|TP\.?)\s+[^,]+/i)
    return m ? m[0].trim() : addr.split(',').slice(-2, -1)[0]?.trim() || 'Không rõ'
  }, [])

  const manualUnassigned = useMemo(() => {
    const list = [...manualUnassignedRaw]
    switch (poolSort) {
      case 'region':
        return list.sort((a, b) => extractDistrict(a.customer_address).localeCompare(extractDistrict(b.customer_address), 'vi'))
      case 'weight-desc':
        return list.sort((a, b) => (b.total_weight_kg || 0) - (a.total_weight_kg || 0))
      case 'weight-asc':
        return list.sort((a, b) => (a.total_weight_kg || 0) - (b.total_weight_kg || 0))
      case 'urgent':
        return list.sort((a, b) => (b.is_urgent ? 1 : 0) - (a.is_urgent ? 1 : 0))
      case 'customer':
        return list.sort((a, b) => (a.customer_name || '').localeCompare(b.customer_name || '', 'vi'))
      default:
        return list
    }
  }, [manualUnassignedRaw, poolSort, extractDistrict])

  const handleManualDrop = useCallback((vehicleId: string, shipmentId: string) => {
    setManualAssign(prev => {
      const next = { ...prev }
      // Remove from any existing vehicle
      for (const vid of Object.keys(next)) {
        next[vid] = next[vid].filter(sid => sid !== shipmentId)
      }
      // Add to target vehicle
      if (!next[vehicleId]) next[vehicleId] = []
      next[vehicleId] = [...next[vehicleId], shipmentId]
      return next
    })
  }, [])

  const handleManualRemove = useCallback((vehicleId: string, shipmentId: string) => {
    setManualAssign(prev => ({
      ...prev,
      [vehicleId]: (prev[vehicleId] || []).filter(sid => sid !== shipmentId),
    }))
  }, [])

  const handleManualReorder = useCallback((vehicleId: string, fromIdx: number, toIdx: number) => {
    setManualAssign(prev => {
      const list = [...(prev[vehicleId] || [])]
      const [moved] = list.splice(fromIdx, 1)
      list.splice(toIdx, 0, moved)
      return { ...prev, [vehicleId]: list }
    })
  }, [])

  const autoDistribute = useCallback(() => {
    const vIds = Array.from(selectedVehicleIds)
    if (vIds.length === 0) return
    const assign: Record<string, string[]> = {}
    vIds.forEach(vid => { assign[vid] = [] })
    // Round-robin distribution
    activeShipments.forEach((s, i) => {
      const vid = vIds[i % vIds.length]
      assign[vid].push(s.id)
    })
    setManualAssign(assign)
  }, [selectedVehicleIds, activeShipments])

  const buildManualVRPResult = useCallback((): VRPResult | null => {
    const trips: VRPTrip[] = []
    let totalAssigned = 0
    for (const [vehicleId, shipmentIds] of Object.entries(manualAssign)) {
      if (shipmentIds.length === 0) continue
      const vehicle = vehicles.find(v => v.id === vehicleId)
      let cumWeight = 0
      const stops: VRPStop[] = shipmentIds.map((sid, i) => {
        const s = shipments.find(sh => sh.id === sid)
        cumWeight += s?.total_weight_kg || 0
        return {
          stop_order: i + 1,
          shipment_id: sid,
          customer_name: s?.customer_name || '',
          customer_id: '',
          customer_address: s?.customer_address || '',
          latitude: 0,
          longitude: 0,
          cumulative_load_kg: cumWeight,
        }
      })
      totalAssigned += stops.length
      trips.push({
        vehicle_id: vehicleId,
        plate_number: vehicle?.plate_number || '',
        vehicle_type: vehicle?.vehicle_type || '',
        stops,
        total_distance_km: 0,
        total_weight_kg: cumWeight,
        total_duration_min: 0,
      })
    }
    const unassignedIds = activeShipments.filter(s => !Object.values(manualAssign).flat().includes(s.id)).map(s => s.id)
    return {
      job_id: 'manual',
      status: 'completed',
      solve_time_ms: 0,
      trips,
      unassigned_shipments: unassignedIds,
      summary: {
        total_trips: trips.length,
        total_vehicles: trips.length,
        total_shipments_assigned: totalAssigned,
        total_unassigned: unassignedIds.length,
        total_distance_km: 0,
        total_duration_min: 0,
        total_weight_kg: trips.reduce((s, t) => s + t.total_weight_kg, 0),
        avg_capacity_util_pct: 0,
        avg_stops_per_trip: totalAssigned / (trips.length || 1),
        solve_time_ms: 0,
      },
    }
  }, [manualAssign, vehicles, shipments, activeShipments])

  // ─── Scenarios ──────────────────────────────────────
  const loadScenarios = useCallback(async () => {
    if (!warehouseId || !deliveryDate) return
    try {
      const r = await apiFetch<any>(`/planning/scenarios?warehouse_id=${warehouseId}&delivery_date=${deliveryDate}`)
      setSavedScenarios(r.data || [])
    } catch { /* ignore */ }
  }, [warehouseId, deliveryDate])

  useEffect(() => { loadScenarios() }, [loadScenarios])

  const saveScenario = async () => {
    if (!vrpResult || !jobId) return
    setSavingScenario(true)
    try {
      const critMap: Record<string, number> = {}
      criteriaOrder.forEach((c, idx) => { critMap[c.key] = c.enabled ? idx + 1 : 0 })
      await apiFetch('/planning/scenarios', {
        method: 'POST',
        body: {
          warehouse_id: warehouseId,
          delivery_date: deliveryDate,
          job_id: jobId,
          scenario_name: scenarioName || `Phương án ${new Date().toLocaleTimeString('vi-VN')}`,
          criteria_json: critMap,
        },
      })
      setScenarioName('')
      setSavedJobId(jobId)
      await loadScenarios()
    } catch (err: any) {
      alert('Lưu thất bại: ' + err.message)
    } finally {
      setSavingScenario(false)
    }
  }

  const deleteScenario = async (id: string) => {
    if (!confirm('Xóa phương án này?')) return
    await apiFetch(`/planning/scenarios/${id}`, { method: 'DELETE' }).catch(() => {})
    await loadScenarios()
  }

  const loadScenarioResult = async (scenarioId: string) => {
    try {
      const r = await apiFetch<any>(`/planning/scenarios/${scenarioId}`)
      const scenario = r.data
      if (scenario?.result_json) {
        const result = typeof scenario.result_json === 'string'
          ? JSON.parse(scenario.result_json)
          : scenario.result_json
        setVrpResult(result)
        setJobId('')
        setSavedJobId('loaded')
        if (result?.trips) {
          const init: Record<string, string> = {}
          const usedDrivers = new Set<string>()
          result.trips.forEach((t: VRPTrip) => {
            const vehicle = vehicles.find(v => v.id === t.vehicle_id)
            if (vehicle?.default_driver_id) {
              const dd = drivers.find(d => d.id === vehicle.default_driver_id)
              if (dd && dd.status === 'active') { init[t.vehicle_id] = dd.id; usedDrivers.add(dd.id) }
            }
          })
          let di = 0
          result.trips.forEach((t: VRPTrip) => {
            if (!init[t.vehicle_id]) {
              while (di < drivers.length && usedDrivers.has(drivers[di].id)) di++
              if (di < drivers.length) { init[t.vehicle_id] = drivers[di].id; usedDrivers.add(drivers[di].id); di++ }
            }
          })
          setDriverAssign(init)
        }
      } else {
        alert('Phương án này không có dữ liệu kết quả chi tiết')
      }
    } catch (err: any) {
      alert('Không tải được phương án: ' + err.message)
    }
  }

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
      // Always include trips data so backend can work even if VRP job expired from memory
      const tripsPayload = vrpResult.trips.map(t => ({
        vehicle_id: t.vehicle_id,
        stops: t.stops.map(s => ({
          shipment_id: s.shipment_id,
          stop_order: s.stop_order,
          customer_name: s.customer_name || '',
          cumulative_load_kg: s.cumulative_load_kg || 0,
        })),
        total_weight_kg: t.total_weight_kg || 0,
        total_distance_km: t.total_distance_km || 0,
        total_duration_min: t.total_duration_min || 0,
      }))
      await apiFetch('/planning/approve', {
        method: 'POST',
        body: {
          job_id: planMode === 'manual' ? 'manual' : jobId,
          warehouse_id: warehouseId,
          delivery_date: deliveryDate,
          assignments,
          trips: tripsPayload,
        },
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
    if (step === 3) {
      if (planMode === 'manual') {
        return Object.values(manualAssign).some(ids => ids.length > 0)
      }
      return vrpResult !== null && !running
    }
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
          {/* Mode toggle */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Phương thức lập kế hoạch</h2>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button onClick={() => setPlanMode('vrp')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${planMode === 'vrp' ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>
                  🤖 VRP Tự động
                </button>
                <button onClick={() => setPlanMode('manual')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${planMode === 'manual' ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>
                  ✋ Lập thủ công
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {planMode === 'vrp'
                ? 'Hệ thống tự tối ưu phân bổ đơn hàng vào xe — phù hợp khi có nhiều đơn hàng'
                : 'Kéo thả đơn hàng vào từng xe — phù hợp khi ít đơn hoặc cần điều phối đặc biệt'}
            </p>
          </div>

          {/* ─── MANUAL PLANNING MODE ─── */}
          {planMode === 'manual' && (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-semibold text-amber-700">{manualUnassigned.length}</span> đơn chưa xếp
                  {' · '}
                  <span className="font-semibold text-blue-700">{selectedVehicleIds.size}</span> xe đã chọn
                </div>
                <div className="flex gap-2">
                  <button onClick={autoDistribute}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition">
                    ⚡ Tự gán đều
                  </button>
                  <button onClick={() => setManualAssign({})}
                    className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100 transition">
                    🗑️ Xóa tất cả
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: '60vh' }}>
                {/* LEFT: Shipment pool */}
                <div className="lg:col-span-1 bg-white rounded-xl shadow-sm p-4 overflow-y-auto" style={{ maxHeight: '70vh' }}>
                  <h3 className="font-semibold text-gray-700 mb-3 sticky top-0 bg-white pb-2 border-b text-sm">
                    📦 Đơn hàng chưa xếp ({manualUnassigned.length})
                  </h3>
                  {/* Sort tools */}
                  <div className="flex flex-wrap gap-1 mb-3 sticky top-8 bg-white pb-2 z-10">
                    {([
                      ['default', 'Mặc định'],
                      ['region', '🗺️ Khu vực'],
                      ['weight-desc', '⬇️ Nặng trước'],
                      ['weight-asc', '⬆️ Nhẹ trước'],
                      ['urgent', '⚡ Gấp trước'],
                      ['customer', '👤 Khách hàng'],
                    ] as const).map(([key, label]) => (
                      <button key={key} onClick={() => setPoolSort(key as typeof poolSort)}
                        className={`px-2 py-1 rounded text-xs font-medium transition ${poolSort === key ? 'bg-[#F68634] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {manualUnassigned.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      ✅ Tất cả đơn đã được xếp vào xe
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {manualUnassigned.map((s, idx) => {
                        // Show region group header when sorted by region
                        const showRegionHeader = poolSort === 'region' && (idx === 0 ||
                          extractDistrict(s.customer_address) !== extractDistrict(manualUnassigned[idx - 1]?.customer_address))
                        return (
                          <React.Fragment key={s.id}>
                            {showRegionHeader && (
                              <div className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-1.5 rounded mt-1">
                                🗺️ {extractDistrict(s.customer_address)}
                              </div>
                            )}
                            <div
                              draggable
                              onDragStart={e => {
                                e.dataTransfer.setData('application/shipment-id', s.id)
                                e.dataTransfer.effectAllowed = 'move'
                              }}
                              className={`p-3 rounded-lg border cursor-move hover:shadow-md transition ${s.is_urgent ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200 hover:border-amber-300'}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{s.shipment_number}</span>
                                <span className="text-xs font-semibold text-gray-500">{s.total_weight_kg?.toFixed(0)} kg</span>
                              </div>
                              <div className="text-xs text-gray-500 truncate mt-1">{s.customer_name}</div>
                              {poolSort === 'region' && s.customer_address && (
                                <div className="text-xs text-blue-500 truncate mt-0.5">📍 {s.customer_address}</div>
                              )}
                              {s.is_urgent && <span className="text-xs text-red-600 font-semibold">⚡ Gấp</span>}
                            </div>
                          </React.Fragment>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* RIGHT: Vehicle drop zones */}
                <div className="lg:col-span-2 space-y-4 overflow-y-auto" style={{ maxHeight: '70vh' }}>
                  {Array.from(selectedVehicleIds).map(vehicleId => {
                    const vehicle = vehicles.find(v => v.id === vehicleId)
                    const assignedIds = manualAssign[vehicleId] || []
                    const assignedShipments = assignedIds.map(sid => shipments.find(s => s.id === sid)).filter(Boolean) as Shipment[]
                    const totalWeight = assignedShipments.reduce((sum, s) => sum + (s.total_weight_kg || 0), 0)
                    const cap = vehicle?.capacity_kg || 15000
                    const pct = Math.min((totalWeight / cap) * 100, 100)
                    const overloaded = totalWeight > cap

                    return (
                      <div key={vehicleId}
                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-amber-400') }}
                        onDragLeave={e => { e.currentTarget.classList.remove('ring-2', 'ring-amber-400') }}
                        onDrop={e => {
                          e.preventDefault()
                          e.currentTarget.classList.remove('ring-2', 'ring-amber-400')
                          const sid = e.dataTransfer.getData('application/shipment-id')
                          if (sid) handleManualDrop(vehicleId, sid)
                        }}
                        className={`bg-white rounded-xl shadow-sm p-4 transition ${overloaded ? 'ring-2 ring-red-400' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-sm">
                            🚛 {vehicle?.plate_number || vehicleId.slice(0, 8)}
                            {vehicle?.vehicle_type && <span className="text-gray-400 ml-1">({vehicle.vehicle_type})</span>}
                            {overloaded && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">⚠ Quá tải!</span>}
                          </h4>
                          <div className="text-xs text-gray-500">
                            {assignedShipments.length} điểm · {totalWeight.toFixed(0)}/{cap.toFixed(0)} kg
                          </div>
                        </div>

                        {/* Capacity bar */}
                        <div className="bg-gray-200 rounded-full h-2.5 mb-3 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-300 ${overloaded ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                            style={{ width: `${pct}%` }} />
                        </div>

                        {assignedShipments.length === 0 ? (
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-400 text-sm">
                            Kéo đơn hàng thả vào đây
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {assignedShipments.map((s, idx) => (
                              <div key={s.id}
                                draggable
                                onDragStart={e => {
                                  e.dataTransfer.setData('application/shipment-id', s.id)
                                  e.dataTransfer.effectAllowed = 'move'
                                }}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm group ${s.is_urgent ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}
                              >
                                <span className="text-gray-400 text-xs w-5 text-center">{idx + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium">{s.shipment_number}</span>
                                  <span className="text-gray-400 ml-2 text-xs">{s.customer_name}</span>
                                </div>
                                <span className="text-xs text-gray-500 whitespace-nowrap">{s.total_weight_kg?.toFixed(0)} kg</span>
                                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                  <button title="Lên" disabled={idx === 0}
                                    onClick={() => handleManualReorder(vehicleId, idx, idx - 1)}
                                    className="w-5 h-5 text-xs bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-30">↑</button>
                                  <button title="Xuống" disabled={idx === assignedShipments.length - 1}
                                    onClick={() => handleManualReorder(vehicleId, idx, idx + 1)}
                                    className="w-5 h-5 text-xs bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-30">↓</button>
                                  <button title="Bỏ ra"
                                    onClick={() => handleManualRemove(vehicleId, s.id)}
                                    className="w-5 h-5 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">✕</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Manual summary */}
              {Object.values(manualAssign).some(ids => ids.length > 0) && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-green-800">
                      ✅ Đã xếp {Object.values(manualAssign).flat().length}/{activeShipments.length} đơn vào {Object.values(manualAssign).filter(ids => ids.length > 0).length} chuyến
                    </span>
                    {manualUnassigned.length > 0 && (
                      <span className="text-amber-700 text-xs">⚠️ Còn {manualUnassigned.length} đơn chưa xếp</span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─── VRP MODE ─── */}
          {planMode === 'vrp' && (<>
          {/* Pre-run info */}
          {!vrpResult && !running && (
            <div className="bg-white rounded-xl shadow-sm p-6 text-center">
              <div className="text-5xl mb-4">{costReadiness?.ready ? '💰' : '🗺️'}</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                {costReadiness?.ready ? 'Sẵn sàng tối ưu chi phí vận chuyển' : 'Sẵn sàng tối ưu tuyến đường'}
              </h2>
              <p className="text-gray-500 mb-6 max-w-lg mx-auto">
                Hệ thống sẽ phân bổ
                <strong className="text-amber-700"> {activeShipments.length} đơn hàng</strong> vào
                <strong className="text-blue-700"> {selectedVehicleIds.size} xe</strong>
                {costReadiness?.ready
                  ? <>, tối ưu <strong className="text-green-700">tổng chi phí (xăng + cầu đường)</strong> đồng thời đảm bảo quãng đường ngắn.</>
                  : <>, tối ưu quãng đường và tải trọng.</>
                }
              </p>

              {/* VRP Optimization Criteria — Drag to reorder priorities */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left max-w-lg mx-auto">
                <h3 className="font-semibold text-gray-700 text-sm mb-1">⚙️ Ràng buộc phân bổ</h3>
                <p className="text-[11px] text-gray-400 mb-3">Kéo ↕ để thay đổi thứ tự ưu tiên · Bấm để bật/tắt · Số 1 = ưu tiên cao nhất</p>
                <div className="space-y-1.5 text-xs">
                  {criteriaOrder.map((c, idx) => (
                    <div key={c.key}
                      draggable
                      onDragStart={() => setDragIdx(idx)}
                      onDragOver={(e) => { e.preventDefault() }}
                      onDrop={() => {
                        if (dragIdx === null || dragIdx === idx) return
                        setCriteriaOrder(prev => {
                          const next = [...prev]
                          const [moved] = next.splice(dragIdx, 1)
                          next.splice(idx, 0, moved)
                          return next
                        })
                        setDragIdx(null)
                      }}
                      onDragEnd={() => setDragIdx(null)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing select-none ${
                        c.enabled
                          ? 'bg-white border-amber-300 ring-1 ring-amber-200'
                          : 'bg-gray-100 border-gray-200 opacity-50'
                      } ${dragIdx === idx ? 'ring-2 ring-blue-400 shadow-lg scale-[1.02]' : ''}`}>
                      <span className="text-gray-300 text-lg">⠿</span>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        c.enabled ? 'bg-amber-500 text-white' : 'bg-gray-300 text-gray-500'
                      }`}>{c.enabled ? idx + 1 : '–'}</span>
                      <span className={c.color}>{c.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-700">{c.label}</div>
                        <div className="text-gray-400">{c.desc}</div>
                      </div>
                      {c.key === 'time_limit' && c.enabled && (
                        <div className="flex items-center gap-1 mr-1" onClick={e => e.stopPropagation()}>
                          <button type="button" className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 text-sm font-bold"
                            onClick={(e) => { e.stopPropagation(); setMaxTripHours(h => Math.max(2, h - 1)) }}>-</button>
                          <span className="font-bold text-blue-700 w-8 text-center">{maxTripHours}h</span>
                          <button type="button" className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 text-sm font-bold"
                            onClick={(e) => { e.stopPropagation(); setMaxTripHours(h => Math.min(24, h + 1)) }}>+</button>
                        </div>
                      )}
                      <button type="button"
                        onClick={() => setCriteriaOrder(prev => prev.map((cc, i) => i === idx ? { ...cc, enabled: !cc.enabled } : cc))}
                        className={`w-7 h-7 rounded flex items-center justify-center text-[11px] transition ${
                          c.enabled ? 'bg-green-500 text-white hover:bg-red-400' : 'bg-gray-200 text-gray-400 hover:bg-green-400 hover:text-white'
                        }`}>{c.enabled ? '✓' : '✗'}</button>
                    </div>
                  ))}
                </div>
                {/* Optimization Mode Selector */}
                <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">🎯</span>
                    <span className="text-xs font-semibold text-orange-800">Phương thức tối ưu</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button"
                      onClick={() => setOptimizeFor('cost')}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        optimizeFor === 'cost'
                          ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                          : 'border-gray-200 bg-white hover:border-green-300'
                      }`}>
                      <div className="text-xs font-bold text-green-700">💰 Tối ưu chi phí</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">Tránh BOT · Tối ưu xăng + phí</div>
                    </button>
                    <button type="button"
                      onClick={() => setOptimizeFor('time')}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        optimizeFor === 'time'
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-gray-200 bg-white hover:border-blue-300'
                      }`}>
                      <div className="text-xs font-bold text-blue-700">⚡ Giao nhanh</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">Đường nhanh nhất · Có thể qua BOT</div>
                    </button>
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

              {/* Cost Readiness Status */}
              <div className={`rounded-xl p-4 mb-6 text-left max-w-lg mx-auto border ${
                costReadiness?.ready
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                  : 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`font-semibold text-sm flex items-center gap-1.5 ${
                      costReadiness?.ready ? 'text-green-800' : 'text-amber-800'
                    }`}>
                      {costReadiness?.ready ? '✅ Dữ liệu chi phí đầy đủ' : '⚠️ Chưa có dữ liệu chi phí'}
                    </h3>
                    <p className={`text-[11px] mt-0.5 ${costReadiness?.ready ? 'text-green-600' : 'text-amber-600'}`}>
                      {costReadiness?.ready
                        ? 'Solver sẽ tự động tối ưu chi phí (xăng + cầu đường) · Kết quả hiển thị cả VND và km'
                        : 'Solver sẽ tối ưu quãng đường. Thêm dữ liệu chi phí để mở khóa tối ưu VND'
                      }
                    </p>
                  </div>
                  <span className={`text-2xl ${costReadiness?.ready ? '' : 'opacity-50'}`}>
                    {costReadiness?.ready ? '💰' : '📏'}
                  </span>
                </div>
                {costReadiness && (
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className={`px-2 py-0.5 rounded-full ${costReadiness.toll_station_count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      🚏 {costReadiness.toll_station_count} trạm BOT
                    </span>
                    <span className={`px-2 py-0.5 rounded-full ${costReadiness.expressway_count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      🛣️ {costReadiness.expressway_count} tuyến thu phí
                    </span>
                    <span className={`px-2 py-0.5 rounded-full ${costReadiness.vehicle_default_count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      🚛 {costReadiness.vehicle_default_count} loại xe
                    </span>
                    <span className={`px-2 py-0.5 rounded-full ${costReadiness.driver_rate_count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      👤 {costReadiness.driver_rate_count} bảng lương
                    </span>
                    {!costReadiness.ready && (
                      <a href="/dashboard/settings/transport-costs" className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition">
                        → Cài đặt chi phí
                      </a>
                    )}
                  </div>
                )}
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
              <div className="flex gap-3 items-center justify-center">
                <button onClick={runVRP}
                  className="px-8 py-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition font-medium text-lg shadow-lg shadow-brand-200">
                  {optimizeFor === 'cost' ? '💰 Tạo kế hoạch tối ưu chi phí' : '⚡ Tạo kế hoạch giao nhanh'}
                </button>
                {costReadiness?.ready && (
                  <button onClick={compareStrategies}
                    className="px-6 py-3 bg-white text-orange-600 border-2 border-orange-300 rounded-xl hover:bg-orange-50 transition font-medium text-sm shadow">
                    ⚖️ So sánh 2 phương án
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                {costReadiness?.ready
                  ? 'Solver tính xăng + cầu đường cho mỗi tuyến · Kết quả hiển thị VND và km'
                  : 'Thời gian giải tùy thuộc số lượng đơn, có thể mất 10-60 giây'}
              </p>
            </div>
          )}

          {/* Running animation — Vietnamese stage progress */}
          {running && (
            <div className="bg-white rounded-xl shadow-sm p-8">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">⚙️</div>
                <h2 className="text-xl font-bold text-gray-800">
                  {optimizeFor === 'cost' ? '💰 Đang tối ưu chi phí vận chuyển...' : '⚡ Đang tính toán giao nhanh nhất...'}
                </h2>
                <p className="text-sm text-gray-400">{activeShipments.length} shipments · {selectedVehicles.length} xe</p>
              </div>
              <div className="max-w-sm mx-auto space-y-2">
                {VRP_STAGES.map(s => {
                  const done = STAGE_ORDER[singleProgress.stage] > STAGE_ORDER[s.key]
                  const active = singleProgress.stage === s.key
                  return (
                    <div key={s.key} className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${
                      done ? 'text-gray-400' : active ? 'bg-amber-50 text-amber-800 font-medium' : 'text-gray-300'
                    }`}>
                      <span className="w-6 text-center">{done ? '✅' : active ? s.icon : '○'}</span>
                      <span>{s.label}</span>
                      {active && singleProgress.detail && <span className="text-xs text-amber-600 ml-auto">{singleProgress.detail}</span>}
                    </div>
                  )
                })}
              </div>
              <div className="max-w-sm mx-auto mt-4">
                <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${singleProgress.pct || solveProgress}%` }} />
                </div>
                <div className="text-xs text-gray-400 mt-1 text-center">{singleProgress.pct || solveProgress}%</div>
              </div>
            </div>
          )}

          {/* Comparing animation — 3-column Vietnamese stage progress */}
          {comparing && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-center mb-5">
                <h2 className="text-xl font-bold text-gray-800">⚖️ Đang so sánh 2 phương án song song...</h2>
                <p className="text-sm text-gray-400 mt-1">{activeShipments.length} đơn × 2 lần giải — VRP chạy đồng thời</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {([
                  { key: 'cost'     as const, icon: '💰', label: 'Tối ưu chi phí', border: 'border-green-200',  activeCls: 'bg-green-50 text-green-800',  bar: 'bg-green-500' },
                  { key: 'time'     as const, icon: '⚡', label: 'Giao nhanh',      border: 'border-blue-200',   activeCls: 'bg-blue-50 text-blue-800',    bar: 'bg-blue-500' },
                ]).map(mode => {
                  const prog = compareProgress[mode.key]
                  const isDone = prog.stage === 'done'
                  return (
                    <div key={mode.key} className={`border ${mode.border} rounded-xl p-4 ${isDone ? 'opacity-75' : ''}`}>
                      <div className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <span>{mode.icon}</span>
                        <span>{mode.label}</span>
                        {isDone && <span className="ml-auto text-green-600 text-xs">✅ Xong</span>}
                      </div>
                      <div className="space-y-1.5">
                        {VRP_STAGES.map(s => {
                          const done = STAGE_ORDER[prog.stage] > STAGE_ORDER[s.key]
                          const active = prog.stage === s.key
                          return (
                            <div key={s.key} className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                              done ? 'text-gray-400' : active ? `${mode.activeCls} font-medium` : 'text-gray-300'
                            }`}>
                              <span>{done ? '✅' : active ? s.icon : '○'}</span>
                              <span>{s.label}</span>
                            </div>
                          )
                        })}
                      </div>
                      <div className="mt-3">
                        <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div className={`${mode.bar} h-full rounded-full transition-all duration-500`}
                            style={{ width: `${prog.pct}%` }} />
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 text-right">{prog.pct}%</div>
                        {prog.detail && <div className="text-xs text-gray-500 truncate mt-1">{prog.detail}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="text-center mt-4 text-sm text-gray-500">
                Hoàn thành: {[compareProgress.cost, compareProgress.time].filter(p => p.stage === 'done').length}/2
              </div>
            </div>
          )}

          {/* Comparison Result */}
          {compareResult && !comparing && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">⚖️ So sánh 2 phương án tối ưu</h2>
                <button onClick={() => setCompareResult(null)}
                  className="text-gray-400 hover:text-gray-600 text-sm">✕ Đóng</button>
              </div>
              {(() => {
                const modeDescs: Record<string, string> = {
                  cost: 'Tránh đường có phí BOT, tối ưu xăng + cầu đường',
                  time: 'Ưu tiên đường nhanh nhất, cân bằng thời gian các xe',
                }
                const modes = [
                  { key: 'cost' as const, label: '💰 Tối ưu chi phí', color: 'green', result: compareResult.cost },
                  { key: 'time' as const, label: '⚡ Giao nhanh', color: 'blue', result: compareResult.time },
                ]
                const validModes = modes.filter(m => m.result?.summary)
                if (validModes.length === 0) return <p className="text-red-500">Không thể so sánh — tất cả phương án đều lỗi</p>
                const colorMap: Record<string, string> = { green: 'border-green-200 bg-green-50/50', blue: 'border-blue-200 bg-blue-50/50', purple: 'border-purple-200 bg-purple-50/50' }
                const textColorMap: Record<string, string> = { green: 'text-green-700', blue: 'text-blue-700', purple: 'text-purple-700' }
                const btnColorMap: Record<string, string> = { green: 'bg-green-600 hover:bg-green-700', blue: 'bg-blue-600 hover:bg-blue-700', purple: 'bg-purple-600 hover:bg-purple-700' }
                const bestCost = Math.min(...validModes.map(m => m.result!.summary.total_cost_vnd || Infinity))
                const bestTime = Math.min(...validModes.map(m => m.result!.summary.total_duration_min || Infinity))
                const bestDist = Math.min(...validModes.map(m => m.result!.summary.total_distance_km || Infinity))
                // Compute max single trip duration for each mode
                const getMaxTripMin = (r: VRPResult) => Math.max(...(r.trips || []).map(t => t.total_duration_min || 0), 0)
                const bestMaxTrip = Math.min(...validModes.map(m => getMaxTripMin(m.result!)))
                return (
                  <div>
                    <div className={`grid gap-4 mb-4`} style={{ gridTemplateColumns: `repeat(${validModes.length}, minmax(0, 1fr))` }}>
                      {validModes.map(m => {
                        const s = m.result!.summary
                        const isBestCost = (s.total_cost_vnd || 0) === bestCost
                        const isBestTime = (s.total_duration_min || 0) === bestTime
                        const isBestDist = (s.total_distance_km || 0) === bestDist
                        const maxTrip = getMaxTripMin(m.result!)
                        const isBestMaxTrip = maxTrip === bestMaxTrip
                        return (
                          <div key={m.key} className={`border-2 ${colorMap[m.color]} rounded-xl p-4`}>
                            <div className={`text-sm font-bold ${textColorMap[m.color]} mb-1`}>{m.label}</div>
                            <div className="text-[10px] text-gray-500 mb-3">{modeDescs[m.key]}</div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between"><span className="text-gray-600">Đơn giao</span><span className="font-bold">{s.total_shipments_assigned}/{s.total_shipments_assigned + (s.total_unassigned || 0)}</span></div>
                              {(s.total_unassigned || 0) > 0 && (
                                <div className="flex justify-between"><span className="text-red-500">⚠️ Chưa giao</span><span className="font-bold text-red-600">{s.total_unassigned}</span></div>
                              )}
                              <div className="flex justify-between"><span className="text-gray-600">Khối lượng</span><span>{((s.total_weight_kg || 0) / 1000).toFixed(1)} tấn</span></div>
                              <div className="flex justify-between"><span className="text-gray-600">Số chuyến</span><span>{s.total_trips}</span></div>
                              <div className="flex justify-between"><span className="text-gray-600">TB tải trọng</span><span>{(s.avg_capacity_util_pct || 0).toFixed(0)}%</span></div>
                              <div className="flex justify-between border-t pt-1"><span className="text-gray-600">Tổng chi phí</span><span className={`font-bold ${isBestCost ? 'text-green-600' : ''}`}>{((s.total_cost_vnd || 0) / 1_000_000).toFixed(1)}M đ {isBestCost ? '⭐' : ''}</span></div>
                              <div className="flex justify-between"><span className="text-gray-600">┗ Xăng/dầu</span><span className="text-orange-600">{((s.total_fuel_cost_vnd || 0) / 1_000_000).toFixed(1)}M</span></div>
                              <div className="flex justify-between"><span className="text-gray-600">┗ Cầu đường</span><span className="text-red-600">{((s.total_toll_cost_vnd || 0) / 1_000_000).toFixed(1)}M</span></div>
                              <div className="flex justify-between border-t pt-1"><span className="text-gray-600">Tổng thời gian</span><span className={`font-bold ${isBestTime ? 'text-blue-600' : ''}`}>{Math.round((s.total_duration_min || 0) / 60)}h{(s.total_duration_min || 0) % 60}p {isBestTime ? '⭐' : ''}</span></div>
                              <div className="flex justify-between"><span className="text-gray-600">Chuyến dài nhất</span><span className={`${isBestMaxTrip ? 'text-blue-600 font-bold' : ''}`}>{Math.floor(maxTrip / 60)}h{maxTrip % 60}p {isBestMaxTrip ? '⭐' : ''}</span></div>
                              <div className="flex justify-between"><span className="text-gray-600">Quãng đường</span><span className={isBestDist ? 'text-purple-600 font-bold' : ''}>{(s.total_distance_km || 0).toFixed(0)} km {isBestDist ? '⭐' : ''}</span></div>
                              <div className="flex justify-between"><span className="text-gray-600">VND/tấn</span><span>{((s.avg_cost_per_ton_vnd || 0) / 1000).toFixed(0)}K</span></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-3 justify-center flex-wrap">
                      {validModes.map(m => (
                        <button key={m.key} onClick={() => {
                          setVrpResult(m.result)
                          setOptimizeFor(m.key)
                          setCompareResult(null)
                        }} className={`px-5 py-2 ${btnColorMap[m.color]} text-white rounded-lg text-sm font-medium`}>
                          ✅ Chọn {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* VRP Failed */}
          {vrpResult && (!vrpResult.trips || vrpResult.trips.length === 0) && !running && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
              <p className="text-red-700 font-medium text-lg mb-2">❌ Không tạo được kế hoạch</p>
              <p className="text-red-600 text-sm mb-4">{vrpResult.error || 'VRP solver không tìm được phương án phù hợp. Hãy thử điều chỉnh xe hoặc đơn hàng.'}</p>
              {vrpResult.distance_source === 'mock' && (
                <p className="text-amber-600 text-xs mb-3">⚠️ VRP solver không khả dụng — đang dùng kết quả mock</p>
              )}
              <button onClick={() => { setVrpResult(null); setJobId(''); }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                ← Quay lại chỉnh sửa
              </button>
            </div>
          )}

          {/* VRP Results */}
          {vrpResult?.trips && !running && (
            <>
              {/* Summary KPI */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-green-800 text-lg">✅ Kết quả tối ưu</h2>
                  <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">
                    Giải trong {vrpResult.summary?.solve_time_ms || vrpResult.solve_time_ms}ms
                  </span>
                </div>

                {/* Tiêu chí đã sử dụng */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <span className="text-xs font-medium text-gray-500">Tiêu chí đã dùng:</span>
                  {criteriaOrder.filter(c => c.enabled).map((c, i) => (
                    <span key={c.key} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs text-amber-700">
                      <span className="font-bold">{i+1}</span> {c.icon} {c.label}
                    </span>
                  ))}
                  {costReadiness?.ready && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 border border-green-200 text-xs text-green-700">💰 Tối ưu chi phí (fuel+toll)</span>}
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs text-blue-700">🔄 Chuyến về kho</span>
                  {criteriaOrder.find(c => c.key === 'time_limit' && c.enabled) && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 border border-green-200 text-xs text-green-700">⏱ Tối đa {maxTripHours}h/chuyến</span>
                  )}
                </div>

                {/* Cost Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-3">
                  <div className="bg-green-50 rounded-lg p-3 text-center shadow-sm border border-green-200 col-span-2">
                    {(vrpResult.summary?.total_cost_vnd || 0) > 0 ? (
                      <div className="text-3xl font-bold text-green-700">{((vrpResult.summary?.total_cost_vnd || 0) / 1000000).toFixed(1)}M</div>
                    ) : (
                      <div className="text-xl font-bold text-gray-400">Chưa tính</div>
                    )}
                    <div className="text-xs text-green-600 font-medium">💰 Tổng chi phí (VND)</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center shadow-sm border border-orange-200">
                    <div className="text-xl font-bold text-orange-700">{(vrpResult.summary?.total_fuel_cost_vnd || 0) > 0 ? `${((vrpResult.summary?.total_fuel_cost_vnd || 0) / 1000000).toFixed(1)}M` : '—'}</div>
                    <div className="text-xs text-orange-600">⛽ Xăng/dầu</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center shadow-sm border border-red-200">
                    <div className="text-xl font-bold text-red-700">{(vrpResult.summary?.total_toll_cost_vnd || 0) > 0 ? `${((vrpResult.summary?.total_toll_cost_vnd || 0) / 1000000).toFixed(1)}M` : '—'}</div>
                    <div className="text-xs text-red-600">🚏 Cầu đường</div>
                  </div>
                  <div className="bg-violet-50 rounded-lg p-3 text-center shadow-sm border border-violet-200">
                    <div className="text-xl font-bold text-violet-700">{(vrpResult.summary?.total_driver_cost_vnd || 0) > 0 ? `${((vrpResult.summary?.total_driver_cost_vnd || 0) / 1000000).toFixed(1)}M` : '—'}</div>
                    <div className="text-xs text-violet-600">👤 Tài xế</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center shadow-sm border border-blue-200">
                    <div className="text-xl font-bold text-blue-700">{(vrpResult.summary?.avg_cost_per_ton_vnd || 0) > 0 ? `${((vrpResult.summary?.avg_cost_per_ton_vnd || 0) / 1000).toFixed(0)}K` : '—'}</div>
                    <div className="text-xs text-blue-600">📊 VND/tấn</div>
                  </div>
                  <div className="bg-cyan-50 rounded-lg p-3 text-center shadow-sm border border-cyan-200">
                    <div className="text-xl font-bold text-cyan-700">{(vrpResult.summary?.avg_cost_per_km_vnd || 0) > 0 ? (vrpResult.summary?.avg_cost_per_km_vnd || 0).toFixed(0) : '—'}</div>
                    <div className="text-xs text-cyan-600">🛣️ VND/km</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center shadow-sm border border-amber-200">
                    <div className="text-xl font-bold text-amber-700">{(vrpResult.summary?.avg_cost_per_shipment_vnd || 0) > 0 ? `${((vrpResult.summary?.avg_cost_per_shipment_vnd || 0) / 1000).toFixed(0)}K` : '—'}</div>
                    <div className="text-xs text-amber-600">📦 VND/đơn</div>
                  </div>
                </div>

                {/* Operational metrics — always visible */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
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
                      const overload = trip.total_weight_kg > cap
                      const barColor = overload ? 'bg-red-500' : pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-green-500'
                      return (
                        <div key={idx} className="flex items-center gap-3 text-xs cursor-pointer hover:bg-white/80 rounded p-0.5 transition"
                          onClick={() => setSelectedTripIdx(idx)} title="Bấm để xem chi tiết chuyến">
                          <span className="w-28 truncate font-medium">{trip.plate_number || `Xe ${idx + 1}`}</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-4 relative overflow-hidden">
                            <div className={`${barColor} h-full rounded-full transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">
                              {trip.total_weight_kg?.toFixed(0)} / {cap?.toFixed(0)} kg ({pct.toFixed(0)}%)
                            </span>
                          </div>
                          <span className="w-28 text-right text-gray-500">{trip.stops.length} điểm · {trip.total_distance_km?.toFixed(1)}km</span>
                          {(trip.total_cost_vnd ?? 0) > 0 && (
                            <span className="w-16 text-right text-green-600 font-medium">{((trip.total_cost_vnd ?? 0)/1000).toFixed(0)}K</span>
                          )}
                          <span className="text-blue-500 hover:text-blue-700">🗺️ ▸</span>
                        </div>
                      )
                    })}
                  </div>
                </details>

                {/* VRP Quality Assessment */}
                <details className="mt-4 bg-white rounded-xl shadow-sm border border-blue-200" open>
                  <summary className="text-sm font-bold text-blue-700 bg-blue-50 rounded-t-xl px-4 py-3 cursor-pointer hover:bg-blue-100 transition list-none flex items-center gap-2">
                    <span>📊</span> Đánh giá chất lượng VRP
                  </summary>
                  <div className="p-4 space-y-3 text-sm">
                    {(() => {
                      const trips = vrpResult.trips
                      const totalAssigned = vrpResult.summary?.total_shipments_assigned || trips.reduce((s, t) => s + t.stops.length, 0)
                      const totalUnassigned = vrpResult.unassigned_shipments?.length || 0
                      const assignRate = totalAssigned / (totalAssigned + totalUnassigned) * 100
                      const avgUtil = vrpResult.summary?.avg_capacity_util_pct || 0
                      const _avgStops = vrpResult.summary?.avg_stops_per_trip || 0
                      const totalDist = vrpResult.summary?.total_distance_km || 0
                      const distPerStop = totalAssigned > 0 ? totalDist / totalAssigned : 0
                      const overloadedTrips = trips.filter(t => {
                        const v = vehicles.find(vv => vv.id === t.vehicle_id)
                        return t.total_weight_kg > (v?.capacity_kg || 15000)
                      }).length
                      const underutilTrips = trips.filter(t => {
                        const v = vehicles.find(vv => vv.id === t.vehicle_id)
                        return t.total_weight_kg / (v?.capacity_kg || 15000) < 0.3
                      }).length
                      const tripsOver8h = trips.filter(t => t.total_duration_min > 480).length
                      const avgDistPerTrip = trips.length > 0 ? totalDist / trips.length : 0
                      const maxDistTrip = Math.max(...trips.map(t => t.total_distance_km || 0))

                      // Compute per-vehicle-type stats
                      const typeStats: Record<string, { count: number; totalWeight: number; totalCap: number; stops: number }> = {}
                      trips.forEach(t => {
                        const v = vehicles.find(vv => vv.id === t.vehicle_id)
                        const vtype = v?.vehicle_type || 'unknown'
                        if (!typeStats[vtype]) typeStats[vtype] = { count: 0, totalWeight: 0, totalCap: 0, stops: 0 }
                        typeStats[vtype].count++
                        typeStats[vtype].totalWeight += t.total_weight_kg
                        typeStats[vtype].totalCap += v?.capacity_kg || 15000
                        typeStats[vtype].stops += t.stops.length
                      })

                      // Score (0-100) — 5 dimensions incl. route quality
                      const scoreAssign = Math.min(assignRate, 100)
                      const scoreUtil = avgUtil > 95 ? 85 : avgUtil
                      const scoreOverload = overloadedTrips === 0 ? 100 : Math.max(0, 100 - overloadedTrips * 20)
                      const scoreUnderutil = underutilTrips === 0 ? 100 : Math.max(0, 100 - underutilTrips * 10)
                      const scoreRoute = tripsOver8h === 0 ? 100 : Math.max(0, 100 - tripsOver8h * 25)
                      const overall = Math.round(scoreAssign * 0.25 + scoreUtil * 0.25 + scoreOverload * 0.15 + scoreUnderutil * 0.15 + scoreRoute * 0.2)
                      const grade = overall >= 90 ? 'A' : overall >= 75 ? 'B' : overall >= 60 ? 'C' : 'D'
                      const gradeColor = grade === 'A' ? 'text-green-600' : grade === 'B' ? 'text-blue-600' : grade === 'C' ? 'text-amber-600' : 'text-red-600'

                      return (<>
                        {/* Overall grade */}
                        <div className="flex items-center gap-4 pb-3 border-b">
                          <div className={`text-4xl font-black ${gradeColor}`}>{grade}</div>
                          <div>
                            <div className="font-semibold text-gray-700">Đánh giá tổng thể: {overall}/100</div>
                            <div className="text-xs text-gray-500">
                              {overall >= 90 ? 'Xuất sắc — Phân bổ rất tối ưu' :
                               overall >= 75 ? 'Tốt — Có thể cải thiện nhỏ' :
                               overall >= 60 ? 'Trung bình — Nên xem xét điều chỉnh' :
                               'Cần cải thiện — Hãy thêm xe hoặc giảm đơn'}
                            </div>
                          </div>
                        </div>

                        {/* Metrics grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                          <div className="bg-gray-50 rounded-lg p-2.5">
                            <div className="text-xs text-gray-500 mb-1">Tỷ lệ xếp được</div>
                            <div className={`font-bold ${assignRate >= 95 ? 'text-green-600' : assignRate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                              {assignRate.toFixed(0)}%
                            </div>
                            <div className="text-[10px] text-gray-400">{totalAssigned}/{totalAssigned + totalUnassigned} đơn</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2.5">
                            <div className="text-xs text-gray-500 mb-1">Tải trọng TB</div>
                            <div className={`font-bold ${avgUtil >= 70 ? 'text-green-600' : avgUtil >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {avgUtil.toFixed(0)}%
                            </div>
                            <div className="text-[10px] text-gray-400">Lý tưởng: 70-95%</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2.5">
                            <div className="text-xs text-gray-500 mb-1">Quá tải</div>
                            <div className={`font-bold ${overloadedTrips === 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {overloadedTrips} chuyến
                            </div>
                            <div className="text-[10px] text-gray-400">{overloadedTrips === 0 ? '✓ Không xe nào quá tải' : '⚠ Cần điều chỉnh!'}</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2.5">
                            <div className="text-xs text-gray-500 mb-1">km/điểm giao TB</div>
                            <div className={`font-bold ${distPerStop <= 20 ? 'text-green-600' : distPerStop <= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                              {distPerStop.toFixed(1)} km
                            </div>
                            <div className="text-[10px] text-gray-400">Càng thấp càng tối ưu</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2.5">
                            <div className="text-xs text-gray-500 mb-1">Quá 8 giờ</div>
                            <div className={`font-bold ${tripsOver8h === 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {tripsOver8h} chuyến
                            </div>
                            <div className="text-[10px] text-gray-400">{tripsOver8h === 0 ? '✓ Trong giới hạn' : '⚠ Vượt 480 phút'}</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2.5">
                            <div className="text-xs text-gray-500 mb-1">km/chuyến TB</div>
                            <div className={`font-bold ${avgDistPerTrip <= 150 ? 'text-green-600' : avgDistPerTrip <= 300 ? 'text-amber-600' : 'text-red-600'}`}>
                              {avgDistPerTrip.toFixed(0)} km
                            </div>
                            <div className="text-[10px] text-gray-400">Giao trong ngày: &lt;200km</div>
                          </div>
                        </div>

                        {/* Cost metrics in quality assessment */}
                        {(vrpResult.summary?.total_cost_vnd || 0) > 0 && (() => {
                          const costPerTrip = vrpResult.trips.length > 0 ? (vrpResult.summary?.total_cost_vnd || 0) / vrpResult.trips.length : 0
                          const fuelPct = (vrpResult.summary?.total_cost_vnd || 0) > 0 ? ((vrpResult.summary?.total_fuel_cost_vnd || 0) / (vrpResult.summary?.total_cost_vnd || 1) * 100) : 0
                          const tollPct = vrpResult.summary?.toll_cost_ratio_pct || 0
                          return (
                            <div className="mt-3">
                              <div className="text-xs font-semibold text-gray-600 mb-2">💰 Phân tích chi phí</div>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                <div className="bg-green-50 rounded-lg p-2.5 border border-green-200">
                                  <div className="text-xs text-gray-500 mb-1">Tổng chi phí</div>
                                  <div className="font-bold text-green-700">{((vrpResult.summary?.total_cost_vnd || 0) / 1000000).toFixed(1)}M</div>
                                  <div className="text-[10px] text-gray-400">VND</div>
                                </div>
                                <div className="bg-orange-50 rounded-lg p-2.5 border border-orange-200">
                                  <div className="text-xs text-gray-500 mb-1">Xăng/dầu</div>
                                  <div className="font-bold text-orange-700">{fuelPct.toFixed(0)}%</div>
                                  <div className="text-[10px] text-gray-400">{((vrpResult.summary?.total_fuel_cost_vnd || 0) / 1000000).toFixed(1)}M</div>
                                </div>
                                <div className="bg-red-50 rounded-lg p-2.5 border border-red-200">
                                  <div className="text-xs text-gray-500 mb-1">Cầu đường</div>
                                  <div className="font-bold text-red-700">{tollPct.toFixed(0)}%</div>
                                  <div className="text-[10px] text-gray-400">{((vrpResult.summary?.total_toll_cost_vnd || 0) / 1000000).toFixed(1)}M</div>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-2.5 border border-blue-200">
                                  <div className="text-xs text-gray-500 mb-1">Chi phí/chuyến TB</div>
                                  <div className="font-bold text-blue-700">{(costPerTrip / 1000).toFixed(0)}K</div>
                                  <div className="text-[10px] text-gray-400">VND/chuyến</div>
                                </div>
                                <div className="bg-cyan-50 rounded-lg p-2.5 border border-cyan-200">
                                  <div className="text-xs text-gray-500 mb-1">VND/km</div>
                                  <div className="font-bold text-cyan-700">{(vrpResult.summary?.avg_cost_per_km_vnd || 0).toFixed(0)}</div>
                                  <div className="text-[10px] text-gray-400">Đơn giá vận chuyển</div>
                                </div>
                                <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-200">
                                  <div className="text-xs text-gray-500 mb-1">VND/tấn</div>
                                  <div className="font-bold text-amber-700">{((vrpResult.summary?.avg_cost_per_ton_vnd || 0) / 1000).toFixed(0)}K</div>
                                  <div className="text-[10px] text-gray-400">Chi phí/tấn hàng</div>
                                </div>
                              </div>
                            </div>
                          )
                        })()}

                        {/* Consolidation & Split stats */}
                        {((vrpResult.summary?.consolidated_stops || 0) > 0 || (vrpResult.summary?.split_deliveries || 0) > 0) && (
                          <div className="flex gap-3">
                            {(vrpResult.summary?.consolidated_stops || 0) > 0 && (
                              <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                                <span className="text-lg">📦</span>
                                <div>
                                  <div className="text-xs font-semibold text-purple-700">Ghép đơn: {vrpResult.summary.consolidated_stops} điểm</div>
                                  <div className="text-[10px] text-purple-500">Cùng NPP nhiều đơn → gộp 1 điểm giao</div>
                                </div>
                              </div>
                            )}
                            {(vrpResult.summary?.split_deliveries || 0) > 0 && (
                              <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                                <span className="text-lg">✂️</span>
                                <div>
                                  <div className="text-xs font-semibold text-orange-700">Tách đơn: {vrpResult.summary.split_deliveries} lần tách</div>
                                  <div className="text-[10px] text-orange-500">Đơn quá nặng → chia giao nhiều xe</div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Vehicle type breakdown */}
                        <div>
                          <div className="text-xs font-semibold text-gray-600 mb-2">Phân bổ theo loại xe</div>
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="py-1.5 px-2 text-left">Loại xe</th>
                                <th className="py-1.5 px-2 text-center">Số chuyến</th>
                                <th className="py-1.5 px-2 text-center">Tổng tải (T)</th>
                                <th className="py-1.5 px-2 text-center">Capacity (T)</th>
                                <th className="py-1.5 px-2 text-center">Util %</th>
                                <th className="py-1.5 px-2 text-center">Điểm/chuyến</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(typeStats).sort((a, b) => b[1].totalCap - a[1].totalCap).map(([vtype, st]) => {
                                const util = st.totalCap > 0 ? (st.totalWeight / st.totalCap * 100) : 0
                                return (
                                  <tr key={vtype} className="border-t">
                                    <td className="py-1.5 px-2 font-medium">{vtype}</td>
                                    <td className="py-1.5 px-2 text-center">{st.count}</td>
                                    <td className="py-1.5 px-2 text-center">{(st.totalWeight / 1000).toFixed(1)}</td>
                                    <td className="py-1.5 px-2 text-center">{(st.totalCap / 1000).toFixed(1)}</td>
                                    <td className={`py-1.5 px-2 text-center font-semibold ${util >= 70 ? 'text-green-600' : util >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                      {util.toFixed(0)}%
                                    </td>
                                    <td className="py-1.5 px-2 text-center">{(st.stops / st.count).toFixed(1)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Improvement suggestions */}
                        {(overloadedTrips > 0 || underutilTrips > 2 || totalUnassigned > 0 || avgUtil < 50 || tripsOver8h > 0 || maxDistTrip > 300) && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <div className="text-xs font-semibold text-amber-800 mb-1.5">💡 Gợi ý cải thiện</div>
                            <ul className="text-xs text-amber-700 space-y-1">
                              {overloadedTrips > 0 && <li>• {overloadedTrips} chuyến quá tải — thêm xe lớn hơn hoặc giảm đơn nặng</li>}
                              {totalUnassigned > 0 && <li>• {totalUnassigned} đơn không xếp được — cần thêm xe hoặc chia nhỏ đơn</li>}
                              {underutilTrips > 2 && <li>• {underutilTrips} chuyến dưới 30% tải — xem xét gộp vào chuyến khác để tiết kiệm xe</li>}
                              {avgUtil < 50 && <li>• Tải trọng TB chỉ {avgUtil.toFixed(0)}% — bớt xe để tăng hiệu suất sử dụng</li>}
                              {tripsOver8h > 0 && <li>• {tripsOver8h} chuyến vượt 8 giờ — cần chia nhỏ vùng giao hoặc giảm điểm giao/chuyến</li>}
                              {maxDistTrip > 300 && <li>• Chuyến xa nhất {maxDistTrip.toFixed(0)}km — xem xét gom theo vùng gần hơn</li>}
                            </ul>
                          </div>
                        )}
                      </>)
                    })()}
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
                      <button onClick={() => { setVrpResult(null); setJobId(''); setSavedJobId('') }}
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

              {/* ─── Save Scenario + Scenario History ─── */}
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800 text-sm">💾 Lưu & So sánh phương án</h3>
                  <button onClick={() => setShowScenarios(!showScenarios)}
                    className="text-xs text-blue-600 hover:text-blue-800">
                    {showScenarios ? 'Ẩn lịch sử' : `📋 Xem lịch sử (${savedScenarios.length})`}
                  </button>
                </div>

                {/* Save current result */}
                <div className="flex gap-2 mb-3">
                  <input type="text" placeholder="Tên phương án (vd: PA1 - Ưu tiên chi phí)"
                    value={scenarioName} onChange={e => setScenarioName(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
                  <button onClick={saveScenario} disabled={savingScenario || !jobId || savedJobId === jobId}
                    className={`px-4 py-2 rounded-lg disabled:opacity-50 text-sm font-medium whitespace-nowrap transition ${
                      savedJobId === jobId ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-brand-500 text-white hover:bg-brand-600'
                    }`}>
                    {savingScenario ? '⏳ Đang lưu...' : savedJobId === jobId ? '✅ Đã lưu' : '💾 Lưu phương án'}
                  </button>
                </div>

                {/* Scenario comparison table */}
                {showScenarios && savedScenarios.length > 0 && (
                  <div className="mt-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50 text-gray-600">
                            <th className="text-left p-2 font-medium">Phương án</th>
                            <th className="text-right p-2 font-medium">Chi phí</th>
                            <th className="text-right p-2 font-medium">Km</th>
                            <th className="text-right p-2 font-medium">Chuyến</th>
                            <th className="text-right p-2 font-medium">Tải TB</th>
                            <th className="text-right p-2 font-medium">Service %</th>
                            <th className="text-right p-2 font-medium">VND/tấn</th>
                            <th className="text-center p-2 font-medium">Thời gian</th>
                            <th className="text-center p-2 font-medium">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {savedScenarios.map((s, i) => {
                            // Pareto: check if any other scenario dominates this one
                            const isDominated = savedScenarios.some(other =>
                              other.id !== s.id &&
                              other.total_cost_vnd <= s.total_cost_vnd &&
                              other.service_level_pct >= s.service_level_pct &&
                              (other.total_cost_vnd < s.total_cost_vnd || other.service_level_pct > s.service_level_pct)
                            )
                            return (
                              <tr key={s.id} className={`border-t ${isDominated ? 'opacity-50 bg-gray-50' : 'bg-white'} ${s.is_approved ? 'ring-2 ring-green-300' : ''}`}>
                                <td className="p-2">
                                  <div className="font-medium text-gray-800">{s.scenario_name || `PA ${i + 1}`}</div>
                                  <div className="text-[10px] text-gray-400">{new Date(s.created_at).toLocaleString('vi-VN')}</div>
                                  {isDominated && <span className="text-[10px] text-red-400">⊘ Bị chi phối</span>}
                                  {!isDominated && s.total_cost_vnd > 0 && <span className="text-[10px] text-green-600">★ Pareto tối ưu</span>}
                                </td>
                                <td className="p-2 text-right font-medium text-green-700">
                                  {s.total_cost_vnd > 0 ? `${(s.total_cost_vnd / 1000000).toFixed(1)}M` : '—'}
                                </td>
                                <td className="p-2 text-right">{s.total_distance_km?.toFixed(0)}</td>
                                <td className="p-2 text-right">{s.total_trips}</td>
                                <td className="p-2 text-right">{s.avg_capacity_util_pct?.toFixed(0)}%</td>
                                <td className="p-2 text-right font-medium">{s.service_level_pct?.toFixed(0)}%</td>
                                <td className="p-2 text-right">{s.avg_cost_per_ton_vnd > 0 ? `${(s.avg_cost_per_ton_vnd / 1000).toFixed(0)}K` : '—'}</td>
                                <td className="p-2 text-center text-gray-400">{s.solve_time_ms}ms</td>
                                <td className="p-2 text-center">
                                  <div className="flex items-center gap-1.5 justify-center">
                                    <button onClick={() => loadScenarioResult(s.id)}
                                      className="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-xs font-medium" title="Tải phương án này vào xem">
                                      📥 Tải
                                    </button>
                                    <button onClick={() => deleteScenario(s.id)}
                                      className="text-red-400 hover:text-red-600 text-xs" title="Xóa">🗑️</button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pareto Chart (2-axis: Cost vs Service Level) */}
                    {savedScenarios.length >= 2 && savedScenarios.some(s => s.total_cost_vnd > 0) && (
                      <div className="mt-4 bg-gray-50 rounded-xl p-4">
                        <h4 className="text-xs font-semibold text-gray-600 mb-3">📊 Biểu đồ Pareto: Chi phí ↔ Mức phục vụ</h4>
                        <div className="relative h-48 border border-gray-200 bg-white rounded-lg p-2">
                          {/* Y axis label */}
                          <div className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-gray-400 whitespace-nowrap">
                            Mức phục vụ (%)
                          </div>
                          {/* X axis label */}
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] text-gray-400">
                            Tổng chi phí (triệu VND) →
                          </div>
                          {/* Plot area */}
                          <div className="relative w-full h-full">
                            {(() => {
                              const costs = savedScenarios.filter(s => s.total_cost_vnd > 0).map(s => s.total_cost_vnd)
                              const minC = Math.min(...costs) * 0.9
                              const maxC = Math.max(...costs) * 1.1
                              const rangeC = maxC - minC || 1
                              return savedScenarios.filter(s => s.total_cost_vnd > 0).map((s, i) => {
                                const x = ((s.total_cost_vnd - minC) / rangeC) * 85 + 5 // 5-90% horizontal
                                const y = 100 - ((s.service_level_pct - 80) / 20) * 85 - 5 // 80-100% → 5-90% vertical
                                const isDominated = savedScenarios.some(other =>
                                  other.id !== s.id &&
                                  other.total_cost_vnd <= s.total_cost_vnd &&
                                  other.service_level_pct >= s.service_level_pct &&
                                  (other.total_cost_vnd < s.total_cost_vnd || other.service_level_pct > s.service_level_pct)
                                )
                                return (
                                  <div key={s.id}
                                    className={`absolute w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 cursor-pointer transition-transform hover:scale-125 ${
                                      isDominated
                                        ? 'bg-gray-200 border-gray-300 text-gray-500'
                                        : 'bg-green-400 border-green-600 text-white shadow-lg'
                                    }`}
                                    style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                                    title={`${s.scenario_name || `PA ${i + 1}`}\nChi phí: ${(s.total_cost_vnd / 1000000).toFixed(1)}M\nPhục vụ: ${s.service_level_pct?.toFixed(0)}%\n${isDominated ? '⊘ Bị chi phối' : '★ Pareto tối ưu'}`}
                                  >
                                    {i + 1}
                                  </div>
                                )
                              })
                            })()}
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] text-gray-500">
                          <span className="inline-block w-3 h-3 bg-green-400 rounded-full mr-1 align-middle border border-green-600"></span> Pareto tối ưu (không bị chi phối)
                          <span className="ml-3 inline-block w-3 h-3 bg-gray-200 rounded-full mr-1 align-middle border border-gray-300"></span> Bị chi phối (có PA tốt hơn ở cả 2 trục)
                        </div>
                      </div>
                    )}

                    {/* Pareto recommendation */}
                    {savedScenarios.length >= 2 && (() => {
                      const pareto = savedScenarios.filter(s => s.total_cost_vnd > 0 && !savedScenarios.some(other =>
                        other.id !== s.id &&
                        other.total_cost_vnd <= s.total_cost_vnd &&
                        other.service_level_pct >= s.service_level_pct &&
                        (other.total_cost_vnd < s.total_cost_vnd || other.service_level_pct > s.service_level_pct)
                      ))
                      if (pareto.length === 0) return null
                      const cheapest = pareto.reduce((a, b) => a.total_cost_vnd < b.total_cost_vnd ? a : b)
                      const bestService = pareto.reduce((a, b) => a.service_level_pct > b.service_level_pct ? a : b)
                      return (
                        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                          <strong>💡 Gợi ý:</strong>
                          {cheapest.id === bestService.id
                            ? <> Phương án &quot;{cheapest.scenario_name}&quot; tối ưu nhất cả chi phí lẫn mức phục vụ.</>
                            : <> Nếu ưu tiên <strong>tiết kiệm</strong> → &quot;{cheapest.scenario_name}&quot; ({(cheapest.total_cost_vnd / 1000000).toFixed(1)}M).
                              Nếu ưu tiên <strong>phục vụ đầy đủ</strong> → &quot;{bestService.scenario_name}&quot; ({bestService.service_level_pct?.toFixed(0)}% đơn hàng).
                              Trade-off: +{((bestService.total_cost_vnd - cheapest.total_cost_vnd) / 1000000).toFixed(1)}M để phục vụ thêm {(bestService.service_level_pct - cheapest.service_level_pct).toFixed(0)}% đơn.</>
                          }
                        </div>
                      )
                    })()}
                  </div>
                )}

                {showScenarios && savedScenarios.length === 0 && (
                  <div className="text-center text-gray-400 text-xs py-4">
                    Chưa có phương án nào được lưu. Bấm &quot;Lưu phương án&quot; để bắt đầu so sánh.
                  </div>
                )}
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
                        {(trip.total_cost_vnd ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-green-700 font-medium bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                            💰 {((trip.total_cost_vnd ?? 0) / 1000).toFixed(0)}K
                            <span className="text-[10px] text-green-500 font-normal">
                              (⛽{((trip.fuel_cost_vnd ?? 0)/1000).toFixed(0)}K + 🚏{((trip.toll_cost_vnd ?? 0)/1000).toFixed(0)}K)
                            </span>
                          </span>
                        )}
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
                            <td className="py-1 px-2">
                              <span className="flex items-center gap-1">
                                {stop.customer_name}
                                {stop.consolidated_ids && stop.consolidated_ids.length > 1 && (
                                  <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-purple-100 text-purple-700">📦×{stop.consolidated_ids.length}</span>
                                )}
                                {stop.is_split && (
                                  <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-orange-100 text-orange-700">✂️{stop.split_part}/{stop.split_total}</span>
                                )}
                              </span>
                            </td>
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
                <button onClick={() => { setVrpResult(null); setJobId(''); setSavedJobId('') }}
                  className="px-6 py-2.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition font-medium">
                  🔄 Tối ưu lại từ đầu
                </button>
              </div>
            </>
          )}
          </>)}
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
                  const checkedInIds = new Set(driverCheckins.filter((c: any) => c.checkin_status === 'available').map((c: any) => c.driver_id || c.id))
                  const notCheckedIn = driverCheckins.filter((c: any) => c.checkin_status === 'not_checked_in').length
                  return (
                    <>
                      <p className="text-sm text-gray-500 mb-2">
                        Chọn tài xế cho mỗi chuyến. Tài xế đã được gán sẽ hiển thị màu xanh.
                        Có <strong className="text-green-700">{drivers.length}</strong> tài xế khả dụng
                        {checkedInIds.size > 0 && <> (<strong className="text-green-600">{checkedInIds.size}</strong> đã check-in)</>}
                        {' '}cho <strong className="text-amber-700">{vrpResult.trips.length}</strong> chuyến.
                      </p>
                      {notCheckedIn > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs px-3 py-2 rounded-lg mb-4">
                          ⚠️ Còn {notCheckedIn} tài xế chưa check-in. Tài xế đã check-in sẽ hiện ưu tiên đầu danh sách.
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
                        <div className="min-w-[220px]">
                        <SearchableSelect
                          options={(() => {
                            const checkedInIds = new Set(driverCheckins.filter((c: any) => c.checkin_status === 'available').map((c: any) => c.driver_id || c.id))
                            return [...drivers]
                              .filter(d => d.id === assignedDriverId || !usedDriverIds.has(d.id))
                              .sort((a, b) => {
                                const aChecked = checkedInIds.has(a.id) ? 0 : 1
                                const bChecked = checkedInIds.has(b.id) ? 0 : 1
                                return aChecked - bChecked || a.full_name.localeCompare(b.full_name)
                              })
                              .map(d => ({
                                value: d.id,
                                label: checkedInIds.has(d.id) ? `✅ ${d.full_name}` : d.full_name,
                                sublabel: d.phone || ''
                              }))
                          })()}
                          value={assignedDriverId || ''}
                          onChange={val => setDriverAssign({ ...driverAssign, [trip.vehicle_id]: val })}
                          placeholder="🔍 Chọn tài xế..."
                        />
                        </div>
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
            <button onClick={() => {
              // When going from step 3 → 4 in manual mode, build VRP result
              if (step === 3 && planMode === 'manual') {
                const result = buildManualVRPResult()
                if (result) {
                  setVrpResult(result)
                  setJobId('manual')
                  // Auto-assign drivers
                  // Auto-assign drivers (prefer default)
                  const init: Record<string, string> = {}
                  const usedDrivers = new Set<string>()
                  result.trips.forEach((t) => {
                    const vehicle = vehicles.find(v => v.id === t.vehicle_id)
                    if (vehicle?.default_driver_id) {
                      const dd = drivers.find(d => d.id === vehicle.default_driver_id)
                      if (dd && dd.status === 'active') { init[t.vehicle_id] = dd.id; usedDrivers.add(dd.id) }
                    }
                  })
                  let di = 0
                  result.trips.forEach((t) => {
                    if (!init[t.vehicle_id]) {
                      while (di < drivers.length && usedDrivers.has(drivers[di].id)) di++
                      if (di < drivers.length) { init[t.vehicle_id] = drivers[di].id; usedDrivers.add(drivers[di].id); di++ }
                    }
                  })
                  setDriverAssign(init)
                }
              }
              setStep(step + 1)
            }} disabled={!canGoNext()}
              className="px-6 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition font-medium disabled:opacity-30 disabled:cursor-not-allowed">
              Tiếp theo →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
