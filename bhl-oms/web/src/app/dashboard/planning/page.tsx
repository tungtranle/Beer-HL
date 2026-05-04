'use client'

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch, getUser } from '@/lib/api'
// Self-hosted leaflet CSS — bundled locally (no cross-origin round-trip)
import 'leaflet/dist/leaflet.css'
import SearchableSelect from '@/lib/SearchableSelect'
import { useNotifications } from '@/lib/notifications'
import { handleError } from '@/lib/handleError'
import { AIContextStrip } from '@/components/ai'
import {
  BarChart3, Truck, Package, Map as MapIcon, CheckSquare2, Check, RefreshCw, AlertTriangle,
  MapPin, Scale, Save, ClipboardList, Clock, CalendarCheck, TriangleAlert,
  CheckCircle2, XCircle, Navigation2, Target, BarChart2, PartyPopper,
  Trophy, Lightbulb, ArrowRight, ChevronDown, ChevronUp,
  Zap, Wallet, Info, Cloud, CalendarDays, Maximize2, Sparkles, Eye,
  type LucideIcon,
} from 'lucide-react'

// ─── OSRM routing helper ─────────────────────────────
async function fetchOSRMRoute(points: [number, number][]): Promise<{ geometry: [number, number][]; legs: { distance_km: number; duration_min: number }[]; total_km: number; total_min: number } | null> {
  if (points.length < 2) return null
  const coords = points.map(p => `${p[1]},${p[0]}`).join(';')
  try {
    const res = await fetch(`/osrm/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`)
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

// Phase B — render small chips for VRP constraints next to a stop
type CustomerVRPConstraints = {
  max_vehicle_weight_kg: number
  delivery_windows: { start: string; end: string }[]
  forbidden_windows: { start: string; end: string; reason?: string }[]
  access_notes: string | null
}
function VRPConstraintChips({ c }: { c: CustomerVRPConstraints | undefined }) {
  if (!c) return null
  const chips: { key: string; label: string; cls: string; title?: string }[] = []
  if (c.max_vehicle_weight_kg > 0) {
    chips.push({
      key: 'wt', label: `≤${(c.max_vehicle_weight_kg / 1000).toFixed(1)}T`,
      cls: 'bg-amber-100 text-amber-800 border-amber-300',
      title: `Chỉ xe ≤ ${c.max_vehicle_weight_kg.toLocaleString('vi-VN')} kg được vào`,
    })
  }
  if (c.delivery_windows.length > 0) {
    const w0 = c.delivery_windows[0]
    const more = c.delivery_windows.length > 1 ? ` +${c.delivery_windows.length - 1}` : ''
    chips.push({
      key: 'dw', label: `▸ ${w0.start}-${w0.end}${more}`,
      cls: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      title: c.delivery_windows.map(w => `${w.start}-${w.end}`).join(', '),
    })
  }
  if (c.forbidden_windows.length > 0) {
    const w0 = c.forbidden_windows[0]
    chips.push({
      key: 'fw', label: `⊘ ${w0.start}-${w0.end}`,
      cls: 'bg-red-100 text-red-800 border-red-300',
      title: c.forbidden_windows.map(w => `${w.start}-${w.end}${w.reason ? ' — ' + w.reason : ''}`).join('; '),
    })
  }
  if (c.access_notes) {
    chips.push({
      key: 'an', label: 'Ghi chú',
      cls: 'bg-slate-100 text-slate-700 border-slate-300',
      title: c.access_notes,
    })
  }
  if (chips.length === 0) return null
  return (
    <span className="inline-flex flex-wrap gap-1 ml-1">
      {chips.map(ch => (
        <span key={ch.key} title={ch.title}
          className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold ${ch.cls}`}>
          {ch.label}
        </span>
      ))}
    </span>
  )
}

// ─── Trip Detail Modal with Map ──────────────────────
function TripDetailModal({ trip, tripIdx, vehicles, warehouse, vrpConstraintsMap, onClose }: {
  trip: VRPTrip; tripIdx: number; vehicles: Vehicle[]; warehouse: { lat: number; lng: number; name: string } | null;
  vrpConstraintsMap?: Record<string, CustomerVRPConstraints>;
  onClose: () => void
}) {
  const mapRef = useRef<any>(null)
  const mapElRef = useRef<HTMLDivElement>(null)
  const [legDistances, setLegDistances] = useState<{ distance_km: number; duration_min: number }[]>([])
  const [routeTotals, setRouteTotals] = useState<{ total_km: number; total_min: number; return_km: number } | null>(null)
  const [routeLoading, setRouteLoading] = useState(true)
  const [osrmFailed, setOsrmFailed] = useState(false)
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
      const usedCoords: Record<string, number> = {}
      const offsetStops = validStops.map(s => {
        const key = `${s.latitude.toFixed(5)},${s.longitude.toFixed(5)}`
        const count = usedCoords[key] || 0
        usedCoords[key] = count + 1
        if (count === 0) return { ...s }
        const angle = (count * 60) * (Math.PI / 180)
        const offset = 0.0003 * count
        return { ...s, latitude: s.latitude + offset * Math.cos(angle), longitude: s.longitude + offset * Math.sin(angle) }
      })

      // Depot as first waypoint
      if (warehouse) {
        const depotIcon = L.divIcon({
          html: `<div style="background:#1e40af;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">KHO</div>`,
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
          .bindPopup(`<b>#${i + 1} ${stop.customer_name}</b>${(stop.consolidated_ids?.length ?? 0) > 1 ? ` <span style="background:#f3e8ff;color:#7e22ce;padding:1px 4px;border-radius:3px;font-size:10px">×${stop.consolidated_ids!.length}</span>` : ''}${stop.is_split ? ` <span style="background:#fff7ed;color:#c2410c;padding:1px 4px;border-radius:3px;font-size:10px">P${stop.split_part}/${stop.split_total}</span>` : ''}<br/>${stop.customer_address || ''}<br/>${stop.weight_kg ? `KL: ${stop.weight_kg.toFixed(1)} kg` : ''} Tích lũy: ${stop.cumulative_load_kg?.toFixed(0)} kg`)
        waypoints.push([stop.latitude, stop.longitude])
      })

      // Return to depot
      if (warehouse) waypoints.push([warehouse.lat, warehouse.lng])

          // Toll station markers
      if (trip.tolls_passed?.length) {
        const seen: Record<string, boolean> = {}
        trip.tolls_passed.forEach((tp: any) => {
          if (!tp.latitude || !tp.longitude) return
          const key = `${tp.latitude.toFixed(4)},${tp.longitude.toFixed(4)}`
          if (seen[key]) return
          seen[key] = true
          const isExpressway = tp.toll_type === 'expressway'
          const bgColor = isExpressway ? '#3b82f6' : '#f97316'
          const markerLabel = isExpressway ? 'CT' : 'TT'
          const tollIcon = L.divIcon({
            html: `<div style="background:${bgColor};color:white;width:22px;height:22px;border-radius:4px;transform:rotate(45deg);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"><span style="transform:rotate(-45deg)">${markerLabel}</span></div>`,
            className: '', iconSize: [22, 22], iconAnchor: [11, 11]
          })
          const distInfo = tp.distance_km ? `<br/>Đoạn: ${tp.distance_km.toFixed(1)}km` : ''
          const typeLabel = isExpressway ? 'Cao tốc kín' : 'Trạm hở'
          L.marker([tp.latitude, tp.longitude], { icon: tollIcon })
            .addTo(map)
            .bindPopup(`<b>${tp.station_name}</b><br/>Phí: ${(tp.fee_vnd / 1000).toFixed(0)}K VND${distInfo}<br/><i style="color:#888">${typeLabel}</i>`)
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
        // OSRM unavailable — draw dashed straight-line fallback
        if (waypoints.length >= 2) {
          L.polyline(waypoints, { color: '#9ca3af', weight: 2, opacity: 0.7, dashArray: '8 5' }).addTo(map)
        }
        setOsrmFailed(true)
        setLegDistances([])
        setRouteTotals(null)
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
        html: `<div style="background:${bgColor};opacity:${opacity};color:white;width:18px;height:18px;border-radius:3px;transform:rotate(45deg);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;border:1.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,.2)"><span style="transform:rotate(-45deg)">TT</span></div>`,
        className: '', iconSize: [18, 18], iconAnchor: [9, 9]
      })
      const feeLine = `L2: ${((ts.fee_l2 || 0)/1000).toFixed(0)}K | L3: ${((ts.fee_l3 || 0)/1000).toFixed(0)}K | L4: ${((ts.fee_l4 || 0)/1000).toFixed(0)}K`
      L.marker([ts.latitude, ts.longitude], { icon })
        .addTo(layerGroup)
        .bindPopup(`<b>${ts.station_name}</b><br/>${ts.road_name || ''}<br/>${feeLine}<br/><i style="color:#888">Trạm hở${isPassed ? ' — Đi qua' : ''}</i>`)
    })

    // Cổng cao tốc
    allExpressways.forEach((ew: any) => {
      (ew.gates || []).forEach((g: any) => {
        if (!g.latitude || !g.longitude) return
        const icon = L.divIcon({
          html: `<div style="background:#3b82f6;opacity:0.6;color:white;width:18px;height:18px;border-radius:3px;transform:rotate(45deg);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;border:1.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,.2)"><span style="transform:rotate(-45deg)">CT</span></div>`,
          className: '', iconSize: [18, 18], iconAnchor: [9, 9]
        })
        const rateLine = `L2: ${((ew.rate_per_km_l2 || 0)).toFixed(0)}đ/km | L3: ${((ew.rate_per_km_l3 || 0)).toFixed(0)}đ/km`
        L.marker([g.latitude, g.longitude], { icon })
          .addTo(layerGroup)
          .bindPopup(`<b>${g.gate_name}</b><br/>${ew.expressway_name}<br/>Km: ${g.km_marker}<br/>${rateLine}<br/><i style="color:#888">Cao tốc kín</i>`)
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
              <span><Package className="w-3.5 h-3.5 inline mr-0.5" /> {trip.stops.length} điểm</span>
              <span>📏 {routeTotals ? `${routeTotals.total_km} km` : `${trip.total_distance_km?.toFixed(1)} km`}</span>
              <span>KL: {trip.total_weight_kg?.toFixed(0)}/{cap} kg ({pct}%)</span>
              {routeTotals && <span>⏱ ~{routeTotals.total_min} phút</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAllTolls(!showAllTolls)} title={showAllTolls ? 'Ẩn trạm thu phí' : 'Hiện tất cả trạm thu phí'}
              className={`w-8 h-8 rounded-full flex items-center justify-center ${showAllTolls ? 'bg-orange-400/80 hover:bg-orange-500/80' : 'bg-white/20 hover:bg-white/30'}`}>
              <MapPin className="w-4 h-4" />
            </button>
            <button onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? 'Thu nhỏ' : 'Phóng to'}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-lg">
              {isFullscreen ? <CheckSquare2 className='w-4 h-4' /> : <MapIcon className='w-4 h-4' />}
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"><XCircle className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row min-h-0">
          {/* Map */}
          <div className={`relative ${isFullscreen ? 'lg:w-2/3 h-[400px] lg:h-auto' : 'lg:w-1/2 h-[350px] lg:h-auto'}`}>
            <div ref={mapElRef} className="absolute inset-0" />
            {routeLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
                <div className="text-sm text-gray-600 animate-pulse">Đang tải lộ trình...</div>
              </div>
            )}
            {!routeLoading && osrmFailed && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[900] flex items-center gap-1.5 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-medium px-3 py-1.5 rounded-full shadow pointer-events-none whitespace-nowrap">
                <span>⚠</span><span>OSRM chưa chạy — đường nét đứt là tạm thời. Chạy <strong>START_OSRM_ONLY.bat</strong>.</span>
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
                        <div className="font-medium text-sm flex items-center gap-1.5 flex-wrap">
                          {stop.customer_name}
                          {stop.consolidated_ids && stop.consolidated_ids.length > 1 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700" title={`Ghép ${stop.consolidated_ids.length} đơn cùng NPP`}>×{stop.consolidated_ids.length}</span>
                          )}
                          {stop.is_split && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700" title={`Tách đơn: phần ${stop.split_part}/${stop.split_total}`}>P{stop.split_part}/{stop.split_total}</span>
                          )}
                          <VRPConstraintChips c={vrpConstraintsMap?.[stop.customer_id]} />
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{stop.customer_address || 'Chưa có địa chỉ'}</div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                          <span className="text-gray-600">
                            KL: <strong>{stop.weight_kg?.toFixed(1) || '—'} kg</strong>
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
                    <div className="text-gray-400">Tổng CP</div>
                  </div>
                  <div>
                    <div className="font-bold text-orange-600">{((trip.fuel_cost_vnd || 0) / 1000).toFixed(0)}K</div>
                    <div className="text-gray-400">Xăng/dầu</div>
                  </div>
                  <div>
                    <div className="font-bold text-red-600">{((trip.toll_cost_vnd || 0) / 1000).toFixed(0)}K</div>
                    <div className="text-gray-400">Cầu đường</div>
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
                  <div className="text-[10px] text-gray-500 mb-1">Trạm đi qua:</div>
                  {trip.tolls_passed.map((tp: any, i: number) => (
                    <div key={i} className="flex justify-between text-[10px] text-gray-600">
                      <span>{tp.toll_type === 'expressway' ? '[CT]' : '[TT]'} {tp.station_name}</span>
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
  const statusGroups: Record<string, { label: string; color: string; dot: string }> = {
    active: { label: 'Hoạt động', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
    maintenance: { label: 'Bảo trì', color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-400' },
    broken: { label: 'Hỏng', color: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
    impounded: { label: 'Tạm giữ', color: 'bg-gray-100 text-gray-800', dot: 'bg-gray-500' },
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
          <h2 className="text-lg font-bold flex items-center gap-2"><Truck className="w-5 h-5" /> Trạng thái xe ({vehicles.length} xe)</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.entries(grouped).map(([status, vs]) => {
            const info = statusGroups[status] || { label: status, color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' }
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${info.dot}`} />
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
  const checkinMap: Record<string, any> = checkins.reduce((acc: Record<string, any>, c: any) => { acc[c.driver_id || c.id] = c; return acc }, {})

  const statusGroups: Record<string, { label: string; color: string; dot: string }> = {
    available: { label: 'Sẵn sàng', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
    on_trip: { label: 'Đang chạy', color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
    off_duty: { label: 'Nghỉ', color: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
    not_checked_in: { label: 'Chưa check-in', color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-400' },
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
        const checkin = checkinMap[d.id]
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
            <h2 className="text-lg font-bold">{selectedDriver.full_name}</h2>
            <button onClick={() => setSelectedDriver(null)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-lg">←</button>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <Navigation2 className="w-7 h-7 text-green-600" />
                </div>
              <div>
                <div className="text-lg font-bold">{selectedDriver.full_name}</div>
                <div className="text-sm text-gray-500">{selectedDriver.license_number || 'Chưa có GPLX'}</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm border-b py-2">
                <span className="text-gray-500">Điện thoại</span>
                <a href={`tel:${selectedDriver.phone}`} className="text-blue-600 font-medium hover:underline">{selectedDriver.phone}</a>
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
              Gọi điện cho tài xế
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
          <h2 className="text-lg font-bold flex items-center gap-2"><Navigation2 className="w-5 h-5" /> Tài xế ({drivers.length} người)</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.entries(grouped).map(([status, ds]) => {
            const info = statusGroups[status] || { label: status, color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' }
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${info.dot}`} />
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded ${info.color}`}>{info.label} ({ds.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {ds.map(d => (
                    <div key={d.id} onClick={() => setSelectedDriver(d)}
                      className="border rounded-lg p-3 text-sm hover:bg-green-50 cursor-pointer transition">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{d.full_name}</div>
                          <div className="text-xs text-gray-500">{d.phone}</div>
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
  total_weight_kg: number; total_volume_m3: number; status: string; delivery_date?: string
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

const deliveredShipmentSet = (result: VRPResult | null): Set<string> => {
  const delivered = new Set<string>()
  if (!result?.trips) return delivered
  for (const trip of result.trips) {
    for (const stop of trip.stops || []) {
      if (stop.shipment_id) delivered.add(stop.shipment_id)
      for (const cid of (stop.consolidated_ids || [])) delivered.add(cid)
    }
  }
  return delivered
}

const sameShipmentSet = (a: Set<string>, b: Set<string>): boolean => {
  if (a.size !== b.size) return false
  return Array.from(a).every(id => b.has(id))
}

// ─── Compare-modal helpers (world-class hero+drawer pattern) ──────────
// Shows winner KPI cards with delta vs alternative. Tone "good" = green up arrow,
// "bad" = red down arrow, "neutral" = gray. Single source of truth for the
// recommended phương án presentation.
function KPICard({ icon, label, value, sub, tone }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  tone: 'good' | 'bad' | 'neutral'
}) {
  const subColor = tone === 'good' ? 'text-emerald-700 bg-emerald-100' : tone === 'bad' ? 'text-red-700 bg-red-100' : 'text-gray-600 bg-gray-100'
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
        <span className="text-gray-400">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-lg font-bold text-gray-800 leading-tight">{value}</div>
      {sub && <div className={`inline-block mt-1 text-[11px] px-1.5 py-0.5 rounded font-medium ${subColor}`}>{sub}</div>}
    </div>
  )
}

function CompareRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? 'text-xs' : ''}`}>
      <span className={muted ? 'text-gray-400' : 'text-gray-600'}>{label}</span>
      <span className={muted ? 'text-gray-500' : 'font-medium text-gray-800'}>{value}</span>
    </div>
  )
}

// Format delta vs alternative. Negative = winner is lower (good for cost/time/km).
// Returns "-12.5M (-23%)" or "+27h (+22%)" with explicit sign.
function deltaText(delta: number, pct: number, _lowerIsBetter: boolean, fmt: (v: number) => string): string {
  if (delta === 0) return '= phương án còn lại'
  const sign = delta < 0 ? '−' : '+'
  return `${sign}${fmt(Math.abs(delta))} (${pct >= 0 ? '+' : ''}${pct}%) vs alt`
}

function buildVRPReviewHighlights(result: VRPResult, vehicles: Vehicle[]) {
  const highlights: { label: string; value: string; impact: 'positive' | 'neutral' | 'negative' | 'warning'; reason: string }[] = []
  const unassignedCount = result.unassigned_shipments?.length || result.summary?.total_unassigned || 0
  if (unassignedCount > 0) {
    highlights.push({ label: 'Đơn chưa xếp được', value: `${unassignedCount}`, impact: 'negative', reason: `${unassignedCount} shipment chưa vào chuyến; cần thêm xe hoặc tách đơn trước khi duyệt.` })
  }

  const highLoadTrips = result.trips.filter((trip) => {
    const vehicle = vehicles.find((entry) => entry.id === trip.vehicle_id)
    const capacity = vehicle?.capacity_kg || 15000
    return capacity > 0 && trip.total_weight_kg / capacity >= 0.9
  })
  if (highLoadTrips.length > 0) {
    highlights.push({ label: 'Xe tải cao', value: `${highLoadTrips.length} chuyến`, impact: 'warning', reason: `${highLoadTrips.length} chuyến đạt từ 90% tải trọng; kiểm tra bốc dỡ và không thêm stop vào các chuyến này.` })
  }

  const longTrips = result.trips.filter((trip) => (trip.total_duration_min || 0) > 480)
  if (longTrips.length > 0) {
    highlights.push({ label: 'Chuyến dài quá 8h', value: `${longTrips.length}`, impact: 'warning', reason: `${longTrips.length} chuyến vượt 8 giờ; cân nhắc tách tuyến hoặc đổi objective.` })
  }

  const tollRatio = result.summary?.toll_cost_ratio_pct || 0
  if (tollRatio >= 35) {
    highlights.push({ label: 'Cầu đường cao', value: `${tollRatio.toFixed(0)}%`, impact: 'warning', reason: `Chi phí cầu đường chiếm ${tollRatio.toFixed(0)}% tổng chi phí; nên so lại phương án tránh BOT nếu còn thời gian.` })
  }

  const missingDrivers = result.trips.filter((trip) => !trip.vehicle_id).length
  if (missingDrivers > 0) {
    highlights.push({ label: 'Thiếu xe/tài xế', value: `${missingDrivers}`, impact: 'negative', reason: `${missingDrivers} chuyến thiếu thông tin xe; không nên duyệt khi chưa bổ sung.` })
  }

  if (highlights.length === 0) {
    highlights.push({ label: 'Không có điểm chặn lớn', value: 'OK', impact: 'positive', reason: 'Kế hoạch không có shipment chưa xếp, chuyến quá tải hoặc chuyến vượt 8 giờ theo rule hiện tại.' })
  }

  return highlights.slice(0, 5)
}

// ─── Decision Support Panel — sticky context advisor ─────────────────
// Computes context (day-of-week, urgent count, capacity gap, weather)
// and produces a rule-based recommendation. Always visible while compareResult
// is open so the operator can verify whether the auto-recommended winner
// matches today's operating conditions.
function DecisionSupportPanel({
  deliveryDate, urgentCount, totalShipments, unassignedCount, totalWeightShortKg,
  recommendedKey, onAlignWithRecommendation,
}: {
  deliveryDate: string
  urgentCount: number
  totalShipments: number
  unassignedCount: number
  totalWeightShortKg: number
  recommendedKey: 'cost' | 'time'
  onAlignWithRecommendation: (k: 'cost' | 'time') => void
}) {
  const dow = useMemo(() => {
    if (!deliveryDate) return { idx: -1, label: '—', isWeekend: false }
    const d = new Date(deliveryDate + 'T00:00:00')
    const idx = d.getDay() // 0=CN
    const labels = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
    return { idx, label: labels[idx], isWeekend: idx === 0 || idx === 6 }
  }, [deliveryDate])

  const urgencyLevel = urgentCount > 0 || dow.isWeekend ? 'time' : 'cost'
  const matchesRecommended = urgencyLevel === recommendedKey
  const reason = urgentCount > 0
    ? `Có ${urgentCount} đơn gấp — ưu tiên giao đúng deadline`
    : dow.isWeekend
      ? `${dow.label} — đường có thể đông, chọn nhanh để tránh kẹt`
      : 'Ngày bình thường, không có đơn ép giờ — ưu tiên tiết kiệm chi phí'

  const advisedLabel = urgencyLevel === 'cost' ? 'TIẾT KIỆM (Tối ưu chi phí)' : 'GIAO NHANH'

  // Inline horizontal strip — no overlay, no content blocking
  const contextChips = [
    {
      icon: <CalendarDays className="w-3.5 h-3.5" />,
      label: dow.label + (dow.isWeekend ? ' (cuối tuần)' : ''),
      color: dow.isWeekend ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-gray-50 text-gray-600 border-gray-200',
    },
    {
      icon: <AlertTriangle className={`w-3.5 h-3.5 ${urgentCount > 0 ? 'text-red-500' : 'text-gray-400'}`} />,
      label: urgentCount > 0 ? `${urgentCount} đơn gấp` : 'Không có đơn gấp',
      color: urgentCount > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-500 border-gray-200',
    },
    {
      icon: <Package className={`w-3.5 h-3.5 ${unassignedCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />,
      label: unassignedCount > 0 ? `Thiếu tải ${(totalWeightShortKg / 1000).toFixed(0)}T` : 'Capacity đủ',
      color: unassignedCount > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
  ]

  return (
    <div className="flex items-center gap-2 flex-wrap" aria-label="Decision Support">
      {/* Context chips */}
      {contextChips.map((c, i) => (
        <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${c.color}`}>
          {c.icon}{c.label}
        </span>
      ))}

      {/* Divider */}
      <span className="text-gray-300 select-none">→</span>

      {/* Recommendation pill */}
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border-2 ${
        matchesRecommended
          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
          : 'bg-amber-50 text-amber-800 border-amber-300'
      }`}>
        <Sparkles className="w-3.5 h-3.5" />
        Nên chọn: {advisedLabel}
        {matchesRecommended
          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          : (
            <button
              onClick={() => onAlignWithRecommendation(urgencyLevel)}
              className="ml-1 underline underline-offset-2 hover:no-underline"
            >
              Đổi →
            </button>
          )
        }
      </span>
    </div>
  )
}

// ─── Compare Deep-Dive Modal — Tier 3 split-view map ─────────────────
// Two leaflet maps side-by-side, one per phương án.
// Shipments that change vehicle assignment between plans are highlighted
// with an orange pulsing ring. Click them → popup with reasoning text.
type MovedShip = {
  shipmentId: string; customerName: string; weightKg: number
  lat: number; lng: number
  winnerVehicle: string; winnerVehiclePlate: string; winnerCapPct: number
  altVehicle: string;    altVehiclePlate: string;    altCapPct: number
}

function CompareDeepDiveModal({
  winnerRes, altRes, winnerLabel, altLabel,
  vehicles, warehouse, movedShipments, onClose,
}: {
  winnerRes: VRPResult; altRes: VRPResult
  winnerLabel: string; altLabel: string
  vehicles: Vehicle[]
  warehouse: { lat: number; lng: number; name: string } | null
  movedShipments: MovedShip[]
  onClose: () => void
}) {
  const leftMapRef = useRef<any>(null)
  const rightMapRef = useRef<any>(null)
  const leftElRef = useRef<HTMLDivElement>(null)
  const rightElRef = useRef<HTMLDivElement>(null)
  const [selectedMoved, setSelectedMoved] = useState<MovedShip | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false

    const tripColors = ['#2563eb', '#dc2626', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#ca8a04', '#db2777', '#65a30d', '#7c3aed']

    const renderMap = async (
      el: HTMLDivElement, ref: React.MutableRefObject<any>, res: VRPResult,
    ) => {
      const L = (await import('leaflet')).default
      if (cancelled) return
      if (ref.current) { ref.current.remove(); ref.current = null }
      const map = L.map(el, { zoomControl: true, scrollWheelZoom: true })
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM' }).addTo(map)
      ref.current = map

      const allPoints: [number, number][] = []
      const movedSet = new Set(movedShipments.map(m => m.shipmentId))

      // Depot
      if (warehouse) {
        const depotIcon = L.divIcon({
          html: `<div style="background:#1e40af;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4)">KHO</div>`,
          className: '', iconSize: [30, 30], iconAnchor: [15, 15],
        })
        L.marker([warehouse.lat, warehouse.lng], { icon: depotIcon }).addTo(map).bindPopup(`<b>${warehouse.name}</b>`)
        allPoints.push([warehouse.lat, warehouse.lng])
      }

      // Per-trip rendering
      ;(res.trips || []).forEach((trip, ti) => {
        const color = tripColors[ti % tripColors.length]
        const veh = vehicles.find(v => v.id === trip.vehicle_id)
        const plate = veh?.plate_number || trip.plate_number || trip.vehicle_id.slice(0, 6)

        // Draw actual OSRM road geometry. The deep-dive is used for operational review;
        // straight depot→stop lines are misleading because km/fuel/toll are road-based.
        const linePts: [number, number][] = []
        if (warehouse) linePts.push([warehouse.lat, warehouse.lng])
        for (const s of trip.stops || []) {
          if (s.latitude && s.longitude) linePts.push([s.latitude, s.longitude])
        }
        if (warehouse) linePts.push([warehouse.lat, warehouse.lng])
        if (linePts.length >= 2) {
          fetchOSRMRoute(linePts).then(route => {
            if (cancelled || !ref.current) return
            L.polyline(route?.geometry?.length ? route.geometry : linePts, {
              color,
              weight: 3,
              opacity: route?.geometry?.length ? 0.65 : 0.35,
              dashArray: route?.geometry?.length ? undefined : '8 5',
            }).addTo(ref.current)
            const boundsPts = route?.geometry?.length ? route.geometry : linePts
            boundsPts.forEach(p => allPoints.push(p))
            if (allPoints.length > 0 && ref.current) {
              ref.current.fitBounds(L.latLngBounds(allPoints.map(p => L.latLng(p[0], p[1]))), { padding: [30, 30] })
            }
          })
        }

        // Stop markers
        ;(trip.stops || []).forEach((stop, si) => {
          if (!stop.latitude || !stop.longitude) return
          allPoints.push([stop.latitude, stop.longitude])
          const sid = stop.shipment_id || ''
          const isMoved = movedSet.has(sid) || (stop.consolidated_ids || []).some(id => movedSet.has(id))
          if (isMoved) {
            // Highlighted pulsing orange marker
            const movedIcon = L.divIcon({
              html: `<div class="bhl-pulse-ring" style="position:relative;width:26px;height:26px"><div style="position:absolute;inset:0;background:#f97316;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700">${si + 1}</div></div>`,
              className: '', iconSize: [26, 26], iconAnchor: [13, 13],
            })
            const moved = movedShipments.find(m => m.shipmentId === sid || (stop.consolidated_ids || []).includes(m.shipmentId))
            const marker = L.marker([stop.latitude, stop.longitude], { icon: movedIcon, zIndexOffset: 1000 }).addTo(map)
            marker.bindPopup(`<b>${stop.customer_name}</b><br/>Xe: <b style="color:${color}">${plate}</b><br/><i style="color:#ea580c">↻ Đơn này được gán xe khác ở phương án còn lại</i><br/><span style="font-size:11px;color:#666">Click để xem chi tiết bên ngoài</span>`)
            marker.on('click', () => { if (moved) setSelectedMoved(moved) })
          } else {
            const icon = L.divIcon({
              html: `<div style="background:${color};color:white;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;border:1.5px solid white;opacity:.85">${si + 1}</div>`,
              className: '', iconSize: [18, 18], iconAnchor: [9, 9],
            })
            L.marker([stop.latitude, stop.longitude], { icon }).addTo(map)
              .bindPopup(`<b>${stop.customer_name}</b><br/>Xe: <b style="color:${color}">${plate}</b>`)
          }
        })
      })

      // Fit to known stop/depot bounds immediately; OSRM geometry will expand bounds when loaded.
      if (allPoints.length > 0) {
        map.fitBounds(L.latLngBounds(allPoints.map(p => L.latLng(p[0], p[1]))), { padding: [30, 30] })
      }
    }

    if (leftElRef.current) renderMap(leftElRef.current, leftMapRef, winnerRes)
    if (rightElRef.current) renderMap(rightElRef.current, rightMapRef, altRes)

    return () => {
      cancelled = true
      if (leftMapRef.current) { leftMapRef.current.remove(); leftMapRef.current = null }
      if (rightMapRef.current) { rightMapRef.current.remove(); rightMapRef.current = null }
    }
  }, [winnerRes, altRes, vehicles, warehouse, movedShipments])

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full h-full max-w-[1600px] max-h-[92vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-800">Soi sâu khác biệt — {movedShipments.length} đơn đổi xe</h2>
          </div>
          <div className="flex-1" />
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded-full bg-blue-700 border-2 border-white"></span> Kho
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-gray-400 border border-white"></span> Đơn cố định (cùng xe)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded-full bg-orange-500 border-2 border-white animate-pulse"></span> Đơn đổi xe (click)
            </span>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">Đóng</button>
        </div>

        {/* Two-pane maps */}
        <div className="flex-1 grid grid-cols-2 gap-2 p-2 min-h-0">
          <div className="relative rounded-xl overflow-hidden border-2 border-emerald-300">
            <div className="absolute top-2 left-2 z-[400] bg-white/95 px-3 py-1.5 rounded-lg shadow text-sm">
              <span className="font-bold text-emerald-700">{winnerLabel}</span>
              <span className="text-xs text-amber-700 ml-2">★ ĐỀ XUẤT</span>
              <div className="text-[11px] text-gray-500">{winnerRes.trips?.length || 0} chuyến · {(winnerRes.summary?.total_distance_km || 0).toFixed(0)} km</div>
            </div>
            <div ref={leftElRef} className="w-full h-full" />
          </div>
          <div className="relative rounded-xl overflow-hidden border-2 border-blue-300">
            <div className="absolute top-2 left-2 z-[400] bg-white/95 px-3 py-1.5 rounded-lg shadow text-sm">
              <span className="font-bold text-blue-700">{altLabel}</span>
              <div className="text-[11px] text-gray-500">{altRes.trips?.length || 0} chuyến · {(altRes.summary?.total_distance_km || 0).toFixed(0)} km</div>
            </div>
            <div ref={rightElRef} className="w-full h-full" />
          </div>
        </div>

        {/* Selected moved-shipment detail strip */}
        <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 min-h-[80px] flex items-center">
          {selectedMoved ? (
            <div className="w-full flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-800 text-sm mb-1">
                  {selectedMoved.customerName} <span className="text-gray-500 font-normal">— {selectedMoved.weightKg.toFixed(0)} kg</span>
                </div>
                <div className="text-sm text-gray-700">
                  <span className="text-emerald-700 font-semibold">{winnerLabel}:</span> gán xe <b>{selectedMoved.winnerVehiclePlate}</b> (đầy {selectedMoved.winnerCapPct.toFixed(0)}%)
                  <span className="mx-2 text-gray-400">·</span>
                  <span className="text-blue-700 font-semibold">{altLabel}:</span> gán xe <b>{selectedMoved.altVehiclePlate}</b> (đầy {selectedMoved.altCapPct.toFixed(0)}%)
                </div>
                <div className="text-xs text-gray-500 mt-1 italic">
                  Solver chọn xe khác để tối ưu mục tiêu của từng phương án (chi phí vs thời gian)
                </div>
              </div>
              <button onClick={() => setSelectedMoved(null)} className="text-xs text-gray-400 hover:text-gray-600">×</button>
            </div>
          ) : (
            <div className="text-sm text-gray-400 italic w-full text-center">
              Click vào điểm cam nhấp nháy trên một trong 2 bản đồ để xem chi tiết đơn đổi xe
            </div>
          )}
        </div>
      </div>
      {/* pulse animation */}
      <style jsx global>{`
        .bhl-pulse-ring::before {
          content: '';
          position: absolute;
          inset: -6px;
          border: 3px solid #f97316;
          border-radius: 50%;
          opacity: 0.7;
          animation: bhl-pulse-ring 1.4s ease-out infinite;
        }
        @keyframes bhl-pulse-ring {
          0%   { transform: scale(0.8); opacity: 0.7; }
          80%  { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

const STEPS = ['Tổng quan', 'Chọn xe', 'Xem đơn hàng', 'Tạo kế hoạch giao hàng', 'Duyệt & Tạo chuyến']
const STEP_ICON_COMPONENTS: LucideIcon[] = [BarChart3, Truck, Package, MapIcon, CheckSquare2]

export default function PlanningPage() {
  const user = getUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  // URL params from test portal deep-link: /dashboard/planning?date=2026-04-30&warehouse=WH-HL
  const _urlDate = searchParams?.get('date') || ''
  const urlWarehouse = searchParams?.get('warehouse') || ''

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
  // todayDate: ngày xuất phát (cố định = hôm nay) — dùng để query xe và tài xế
  const todayDate = useMemo(() => new Date().toISOString().split('T')[0], [])
  // includeOverdue: gồm cả đơn trễ hẹn (delivery_date < deliveryDate) vào danh sách đặt hàng
  const [includeOverdue, setIncludeOverdue] = useState(true)
  // pendingSummary: tổng hợp đơn tồn đọng theo nhóm
  const [pendingSummary, setPendingSummary] = useState<{
    overdue_count: number; overdue_weight_kg: number
    today_count: number; today_weight_kg: number
    future_count: number; future_weight_kg: number
    total_count: number; total_weight_kg: number
  } | null>(null)
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

  // Phase B — VRP customer constraints (chips on stop cards)
  const [vrpConstraintsMap, setVrpConstraintsMap] = useState<Record<string, {
    max_vehicle_weight_kg: number
    delivery_windows: { start: string; end: string }[]
    forbidden_windows: { start: string; end: string; reason?: string }[]
    access_notes: string | null
  }>>({})

  useEffect(() => {
    if (!vrpResult?.trips) return
    const idsMap: Record<string, boolean> = {}
    vrpResult.trips.forEach(t => t.stops.forEach(s => { if (s.customer_id) idsMap[s.customer_id] = true }))
    const missing = Object.keys(idsMap).filter(id => !(id in vrpConstraintsMap))
    if (missing.length === 0) return
    Promise.all(missing.map(id =>
      apiFetch<any>(`/customers/${id}/vrp-constraints`).then(r => ({ id, data: r.data })).catch(() => null)
    )).then(results => {
      const next = { ...vrpConstraintsMap }
      for (const r of results) {
        if (r && r.data) next[r.id] = {
          max_vehicle_weight_kg: r.data.max_vehicle_weight_kg ?? 0,
          delivery_windows: Array.isArray(r.data.delivery_windows) ? r.data.delivery_windows : [],
          forbidden_windows: Array.isArray(r.data.forbidden_windows) ? r.data.forbidden_windows : [],
          access_notes: r.data.access_notes ?? null,
        }
      }
      setVrpConstraintsMap(next)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vrpResult])

  // Real-time VRP progress (from WebSocket vrp_progress messages)
  const VRP_STAGES = [
    { key: 'matrix',      icon: '●', label: 'Tính ma trận khoảng cách' },
    { key: 'toll',        icon: '→', label: 'Phân tích trạm BOT' },
    { key: 'toll_matrix', icon: '⊘', label: 'Ma trận tránh BOT' },
    { key: 'solving',     icon: '⚙️', label: 'Phân bổ xe & điểm giao' },
    { key: 'routes',      icon: '▸', label: 'Tính lộ trình chi tiết' },
    { key: 'done',        icon: '✓', label: 'Hoàn tất' },
  ]
  const STAGE_ORDER: Record<string, number> = { '': -1, matrix: 0, toll: 1, toll_matrix: 2, solving: 3, routes: 4, done: 5, error: 6 }
  const [singleProgress, setSingleProgress] = useState({ pct: 0, stage: '', detail: '' })
  const [compareProgress, setCompareProgress] = useState({
    cost:     { pct: 0, stage: '', detail: '' },
    time:     { pct: 0, stage: '', detail: '' },
  })
  const [compareTrace, setCompareTrace] = useState<string[]>([])
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
    { key: 'max_capacity', icon: '=', color: 'text-blue-500', label: 'Tải trọng tối đa', desc: 'Không vượt capacity xe', enabled: true },
    { key: 'min_vehicles', icon: '▶', color: 'text-red-500', label: 'Tối thiểu số xe', desc: 'Dùng ít xe nhất có thể', enabled: true },
    { key: 'cluster_region', icon: '●', color: 'text-teal-500', label: 'Gom nhóm theo vùng', desc: 'Gom điểm gần nhau cùng xe', enabled: true },
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
  const [compareResult, setCompareResult] = useState<{ cost: VRPResult | null; time: VRPResult | null; costFellBackToTime?: boolean; rawCost?: VRPResult | null } | null>(null)
  const [comparing, setComparing] = useState(false)
  const [showAltDetail, setShowAltDetail] = useState(false)
  const [showDeepDive, setShowDeepDive] = useState(false)

  const { subscribeVRPProgress } = useNotifications()

  // ─── Init ──────────────────────────────────────────
  useEffect(() => {
    apiFetch<any>('/warehouses').then(r => {
      const ws = r.data || []
      setWarehouses(ws)
      // Áp dụng warehouse từ URL param (e.g. "WH-HL") nếu có
      if (urlWarehouse) {
        const match = ws.find((w: any) => w.code === urlWarehouse || w.name?.includes(urlWarehouse))
        if (match) setWarehouseId(match.id)
      }
    }).catch(err => handleError(err))
    apiFetch<any>('/planning/cost-readiness').then(r => {
      setCostReadiness(r.data || null)
      if (r.data?.ready) setCostOptimize(true)
    }).catch(err => handleError(err))
  }, [])

  // Auto-detect: khi warehouse thay đổi → load pending-dates + pending-summary
  // deliveryDate mặc định = hôm nay (todayDate)
  useEffect(() => {
    if (!warehouseId) return
    // Set default = today nếu chưa có
    if (!deliveryDate) {
      setDeliveryDate(todayDate)
    }
    // Fetch danh sách ngày có đơn (có is_overdue flag)
    apiFetch<any>(`/shipments/pending-dates?warehouse_id=${warehouseId}`)
      .then(r => {
        const dates: PendingDate[] = r.data || []
        setPendingDates(dates)
      })
      .catch(err => handleError(err))
    // Fetch tổng hợp backlog hôm nay
    apiFetch<any>(`/shipments/pending-summary?warehouse_id=${warehouseId}&today=${todayDate}`)
      .then(r => setPendingSummary(r.data || null))
      .catch(() => {})
  }, [warehouseId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = useCallback(async () => {
    if (!warehouseId || !deliveryDate) return
    setError('')
    try {
      // Xe và tài xế: LUÔN dùng todayDate (ngày xuất phát thực tế)
      // Đơn hàng: dùng deliveryDate + includeOverdue flag
      const overdueParam = includeOverdue ? '&include_overdue=true' : ''
      const [s, v, d, dc, av, ad] = await Promise.all([
        apiFetch<any>(`/shipments/pending?warehouse_id=${warehouseId}&delivery_date=${deliveryDate}${overdueParam}`),
        apiFetch<any>(`/vehicles/available?warehouse_id=${warehouseId}&date=${todayDate}`),
        apiFetch<any>(`/drivers/available?warehouse_id=${warehouseId}&date=${todayDate}`),
        apiFetch<any>(`/drivers/checkins?warehouse_id=${warehouseId}&date=${todayDate}`).catch(() => ({ data: [] })),
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
      // Keep an existing solve/compare result visible during background reloads.
      // Results are explicitly cleared only when the user starts a new run or changes inputs.
    } catch (err: any) {
      setError(err.message)
    }
  }, [warehouseId, deliveryDate, includeOverdue, todayDate])

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
              const usedDrivers: Record<string, boolean> = {}
              // First pass: assign default drivers from vehicle mapping
              r.data.trips.forEach((t: VRPTrip) => {
                const vehicle = vehicles.find(v => v.id === t.vehicle_id)
                if (vehicle?.default_driver_id) {
                  const defaultDriver = drivers.find(d => d.id === vehicle.default_driver_id)
                  if (defaultDriver && defaultDriver.status === 'active') {
                    init[t.vehicle_id] = defaultDriver.id
                    usedDrivers[defaultDriver.id] = true
                  }
                }
              })
              // Second pass: fill remaining with available drivers by order
              let driverIdx = 0
              r.data.trips.forEach((t: VRPTrip) => {
                if (!init[t.vehicle_id]) {
                  while (driverIdx < drivers.length && usedDrivers[drivers[driverIdx].id]) driverIdx++
                  if (driverIdx < drivers.length) {
                    init[t.vehicle_id] = drivers[driverIdx].id
                    usedDrivers[drivers[driverIdx].id] = true
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
    setCompareTrace([])

    const traceCompare = (message: string) => {
      const ts = new Date().toLocaleTimeString('vi-VN', { hour12: false })
      setCompareTrace(prev => [...prev, `${ts} ${message}`].slice(-12))
    }

    const vehicleIdsToSend = Array.from(selectedVehicleIds)
    const shipmentIdsToSend = activeShipments.map(s => s.id)
    const critMap: Record<string, number> = {}
    criteriaOrder.forEach((c, idx) => { critMap[c.key] = c.enabled ? idx + 1 : 0 })

    const buildBody = (mode: string, forcedIds?: string[]) => ({
      warehouse_id: warehouseId,
      delivery_date: deliveryDate,
      shipment_ids: forcedIds && forcedIds.length > 0 ? forcedIds : shipmentIdsToSend,
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
      // When provided, solver strongly pins these shipments. The compare flow
      // still verifies the returned delivered set before rendering, because
      // capacity/time-window constraints can make a hard apples-to-apples result
      // impossible for a particular selection.
      ...(forcedIds && forcedIds.length > 0 ? { force_delivery_shipment_ids: forcedIds } : {}),
    })

    const pollJob = (jid: string, mode: 'cost' | 'time'): Promise<VRPResult | null> => {
      traceCompare(`${mode.toUpperCase()}: bắt đầu poll job ${jid || '(missing)'}`)
      return new Promise((resolve, reject) => {
        if (!jid) {
          reject(new Error(`${mode.toUpperCase()}: backend không trả job_id`))
          return
        }
        let consecutivePollErrors = 0
        const poll = setInterval(async () => {
          try {
            const r: any = await apiFetch(`/planning/jobs/${jid}`)
            consecutivePollErrors = 0
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
              traceCompare(`${mode.toUpperCase()}: job ${jid} kết thúc status=${r.data?.status}`)
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
          } catch (err: any) {
            consecutivePollErrors += 1
            const message = err?.message || 'unknown error'
            traceCompare(`${mode.toUpperCase()}: lỗi poll job ${jid}: ${message}`)
            if (message.includes('Job không tồn tại') || message.includes('404')) {
              clearInterval(poll)
              reject(new Error(`${mode.toUpperCase()}: job ${jid} không còn trong bộ nhớ backend. Backend có thể vừa khởi động lại; vui lòng chạy lại so sánh.`))
              return
            }
            if (consecutivePollErrors >= 10) {
              clearInterval(poll)
              reject(new Error(`${mode.toUpperCase()}: mất kết nối backend khi đang chờ job ${jid}. Backend có thể vừa dừng/khởi động lại; vui lòng chạy lại so sánh sau khi health OK.`))
            }
          }
        }, 2000)
        setTimeout(() => {
          clearInterval(poll)
          reject(new Error(`${mode.toUpperCase()}: quá 360 giây chưa có kết quả từ VRP job ${jid}. Job có thể vẫn đang tính route OSRM; vui lòng thử giảm số đơn hoặc chạy lại sau khi solver rảnh.`))
        }, 360000)
      })
    }

    try {
      // Sequential, not parallel: COST first to determine the maximally-deliverable
      // subset under fuel/toll optimization, then TIME mode forced to deliver the
      // SAME subset. This guarantees both columns evaluate the same shipments so
      // metrics (cost, time, km) are directly comparable. Without this, each mode
      // drops a different subset under capacity pressure → user sees nonsensical
      // results like "TIME mode is cheaper than COST mode".
      const startMode = async (mode: 'cost' | 'time', forcedIds?: string[]) => {
        traceCompare(`${mode.toUpperCase()}: gửi yêu cầu chạy VRP${forcedIds?.length ? ` với ${forcedIds.length} đơn đã pin` : ''}`)
        const res: any = await apiFetch('/planning/run-vrp', { method: 'POST', body: buildBody(mode, forcedIds) })
        const jid = res?.data?.job_id
        if (jid) vrpJobMapRef.current[jid] = mode
        traceCompare(`${mode.toUpperCase()}: backend tạo job ${jid || '(missing)'}`)
        return { res, jid }
      }

      // ── Phase 1: COST mode (free choice of subset) ─────────────────
      const a = await startMode('cost')
      if (a.jid) setCompareProgress(prev => ({ ...prev, cost: { ...prev.cost, stage: 'matrix', detail: 'Đã tạo job' } }))
      const resultA = await pollJob(a.res.data?.job_id, 'cost')
      if (a.res.data?.job_id) delete vrpJobMapRef.current[a.res.data.job_id]
      if (!resultA || resultA.status !== 'completed') {
        throw new Error(resultA?.error || `COST: job ${a.res.data?.job_id || ''} chưa hoàn tất thành công, không thể lấy danh sách đơn để chạy TIME.`)
      }

      // Extract delivered shipment IDs from COST result to pin TIME mode.
      const costDeliveredSet = deliveredShipmentSet(resultA)
      const forcedShipmentIds = Array.from(costDeliveredSet)
      traceCompare(`COST: giao được ${forcedShipmentIds.length} đơn, chuyển danh sách này sang TIME`)
      if (forcedShipmentIds.length === 0) {
        throw new Error('Phương án tối ưu chi phí không giao được đơn nào, không thể so sánh trade-off.')
      }

      // ── Phase 2: TIME mode (forced to same subset) ─────────────────
      const b = await startMode('time', forcedShipmentIds)
      if (b.jid) setCompareProgress(prev => ({ ...prev, time: { ...prev.time, stage: 'matrix', detail: 'Đã tạo job' } }))
      const resultB = await pollJob(b.res.data?.job_id, 'time')
      if (b.res.data?.job_id) delete vrpJobMapRef.current[b.res.data.job_id]
      if (!resultB || resultB.status !== 'completed') {
        throw new Error(resultB?.error || `TIME: job ${b.res.data?.job_id || ''} chưa hoàn tất thành công, không thể so sánh.`)
      }

      const timeDeliveredSet = deliveredShipmentSet(resultB)
      traceCompare(`TIME: trả về ${timeDeliveredSet.size} đơn, kiểm tra cùng tập với COST`)
      if (!sameShipmentSet(costDeliveredSet, timeDeliveredSet)) {
        const missingInTime = forcedShipmentIds.filter(id => !timeDeliveredSet.has(id)).length
        const extraInTime = Array.from(timeDeliveredSet).filter(id => !costDeliveredSet.has(id)).length
        throw new Error(`Không thể so sánh apples-to-apples: Giao nhanh không giữ đúng tập ${forcedShipmentIds.length} đơn của Tối ưu chi phí (thiếu ${missingInTime}, thừa ${extraInTime}). Hãy giảm số đơn/xe hoặc chạy lại với thêm năng lực.`)
      }

      clearInterval(progressRef.current)
      setSolveProgress(100)

      // ── Definitive invariant guard ────────────────────────────────────
      // The COST-mode solver minimises a per-arc fuel+toll proxy matrix, but the
      // reported total_cost_vnd is recomputed from the full OSRM route geometry
      // (post-solve). On some datasets the two layers disagree and COST returns
      // a plan that is provably more expensive than TIME on the same shipments.
      // Math: cost(COST_plan) > cost(TIME_plan) on identical shipment set ⇒
      // COST mode has no cost-optimal claim. Fall back to TIME plan as the
      // cost-recommended plan; both cards will then show the same numbers and
      // the UI naturally collapses to a single coherent recommendation.
      const reportedCostA = resultA.summary?.total_cost_vnd || 0
      const reportedCostB = resultB.summary?.total_cost_vnd || 0
      const costFellBack = reportedCostA > reportedCostB && reportedCostB > 0
      // Diagnostic: log raw summaries so we can tell whether identical numbers
      // come from solver convergence vs fallback substitution.
      console.log('[VRP compare] raw cost summary:', resultA.summary)
      console.log('[VRP compare] raw time summary:', resultB.summary)
      console.log('[VRP compare] reported cost A vs B:', reportedCostA, reportedCostB, 'fellBack=', costFellBack)
      if (costFellBack) {
        traceCompare(`COST proxy đắt hơn TIME thực tế (${(reportedCostA/1e6).toFixed(1)}M > ${(reportedCostB/1e6).toFixed(1)}M) — hiển thị kết quả thực từng mode, có banner cảnh báo`)
      } else if (reportedCostA === reportedCostB) {
        traceCompare(`Hai mode hội tụ cùng chi phí ${(reportedCostA/1e6).toFixed(1)}M — kiểm tra xem có phải cùng plan không`)
      }
      // Always show actual results from each mode so user sees genuine route differences.
      // costFellBackToTime=true triggers an informational banner explaining the proxy/OSRM discrepancy,
      // but does NOT replace COST result with TIME result — showing identical panels is more misleading
      // than showing honest trade-offs where COST routes differ from TIME routes.
      setCompareResult({ cost: resultA, time: resultB, costFellBackToTime: costFellBack, rawCost: costFellBack ? resultA : undefined })
      traceCompare('DONE: đã có kết quả so sánh cùng tập đơn')
    } catch (err: any) {
      clearInterval(progressRef.current)
      setError(err.message)
      traceCompare(`ERROR: ${err.message}`)
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
          const usedDrivers: Record<string, boolean> = {}
          result.trips.forEach((t: VRPTrip) => {
            const vehicle = vehicles.find(v => v.id === t.vehicle_id)
            if (vehicle?.default_driver_id) {
              const dd = drivers.find(d => d.id === vehicle.default_driver_id)
              if (dd && dd.status === 'active') { init[t.vehicle_id] = dd.id; usedDrivers[dd.id] = true }
            }
          })
          let di = 0
          result.trips.forEach((t: VRPTrip) => {
            if (!init[t.vehicle_id]) {
              while (di < drivers.length && usedDrivers[drivers[di].id]) di++
              if (di < drivers.length) { init[t.vehicle_id] = drivers[di].id; usedDrivers[drivers[di].id] = true; di++ }
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
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        {/* Row 1: Warehouse + Ngày xuất phát + Reload */}
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Kho xuất</label>
            <select value={warehouseId} onChange={e => { setWarehouseId(e.target.value); setStep(0) }}
              className="px-3 py-2 border rounded-lg text-sm min-w-[200px]">
              <option value="">-- Chọn kho --</option>
              {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Ngày xuất phát
              <span className="ml-1 text-gray-400 font-normal">(xe &amp; tài xế theo ngày này)</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 font-medium flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4 text-brand-500" />
                {todayDate === new Date().toISOString().split('T')[0]
                  ? `${new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })} (hôm nay)`
                  : todayDate}
              </div>
            </div>
          </div>
          <button onClick={loadData} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4" /> Tải lại dữ liệu
          </button>
        </div>

        {/* Row 2: Backlog summary + include-overdue toggle */}
        {pendingSummary && (pendingSummary.overdue_count > 0 || pendingSummary.today_count > 0 || pendingSummary.future_count > 0) && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">Tồn đơn tại kho:</span>

            {/* Trễ hẹn */}
            {pendingSummary.overdue_count > 0 && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
                includeOverdue
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500 line-through'
              }`}
                onClick={() => { setIncludeOverdue(!includeOverdue); setStep(0) }}
                title={includeOverdue ? 'Bấm để loại trừ đơn trễ hẹn' : 'Bấm để gộp đơn trễ hẹn vào kế hoạch'}
              >
                <TriangleAlert className="w-3.5 h-3.5" />
                <span>Trễ hẹn: <strong>{pendingSummary.overdue_count}</strong> đơn</span>
                <span className="text-red-400">· {(pendingSummary.overdue_weight_kg / 1000).toFixed(1)}T</span>
                <span className={`ml-1 px-1 py-0.5 rounded text-[10px] ${includeOverdue ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-600'}`}>
                  {includeOverdue ? '✓ gồm' : '✗ bỏ'}
                </span>
              </div>
            )}

            {/* Hôm nay */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
              deliveryDate === todayDate
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-gray-50 border-gray-200 text-gray-600 cursor-pointer hover:bg-amber-50 hover:border-amber-200'
            }`}
              onClick={() => { setDeliveryDate(todayDate); setStep(0) }}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Hôm nay: <strong>{pendingSummary.today_count}</strong> đơn</span>
              <span className="text-amber-500">· {(pendingSummary.today_weight_kg / 1000).toFixed(1)}T</span>
            </div>

            {/* Ngày mai+ */}
            {pendingSummary.future_count > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-gray-50 border-gray-200 text-gray-500 text-xs font-medium"
                title="Đơn giao ngày mai trở đi — sẽ hiện sau khi đến ngày">
                <Package className="w-3.5 h-3.5" />
                <span>Tới: <strong>{pendingSummary.future_count}</strong> đơn</span>
              </div>
            )}

            {/* Tổng cộng nếu có overdue */}
            {includeOverdue && pendingSummary.overdue_count > 0 && (
              <div className="ml-2 flex items-center gap-1 text-xs text-gray-500 border-l pl-3">
                <span>Tổng lập kế hoạch:</span>
                <strong className="text-gray-800">{pendingSummary.total_count} đơn</strong>
                <span>·</span>
                <strong className="text-gray-800">{(pendingSummary.total_weight_kg / 1000).toFixed(1)}T</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── STEP INDICATOR ─── */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
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
                  {i < step ? <Check className="w-4 h-4" /> : React.createElement(STEP_ICON_COMPONENTS[i], { className: 'w-4 h-4' })}
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
          <span><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          STEP 0: TỔNG QUAN NGUỒN LỰC
         ═══════════════════════════════════════════════ */}
      {step === 0 && (
        <div className="space-y-6">
          {/* Resource cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ── Card 1: Đơn hàng ── */}
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-amber-500">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Đơn hàng cần giao hôm nay</div>
              <div className="text-3xl font-bold text-amber-700">{shipments.length}</div>
              <div className="text-sm text-gray-500 mt-1">
                Tổng tải: <strong>{(totalDemandKg / 1000).toFixed(1)}T</strong>
              </div>
              {/* Breakdown trễ hẹn vs hôm nay */}
              {(() => {
                const overdueShipments = shipments.filter(s => s.delivery_date && s.delivery_date < todayDate)
                const todayShipments = shipments.filter(s => !s.delivery_date || s.delivery_date >= todayDate)
                if (overdueShipments.length === 0) return null
                return (
                  <div className="mt-2 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                      <TriangleAlert className="w-3.5 h-3.5" />
                      <span>Trễ hẹn: {overdueShipments.length} đơn ({(overdueShipments.reduce((s,x) => s + x.total_weight_kg, 0)/1000).toFixed(1)}T)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-amber-700">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Hôm nay: {todayShipments.length} đơn</span>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* ── Card 2: Xe ── */}
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-blue-500 cursor-pointer hover:shadow-md transition"
              onClick={() => setShowVehicleStatusModal(true)}>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Xe khả dụng hôm nay</div>
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

            {/* ── Card 3: Tài xế — dùng check-in thực tế ── */}
            <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-500 cursor-pointer hover:shadow-md transition"
              onClick={() => setShowDriverStatusModal(true)}>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tài xế có mặt hôm nay</div>
              {(() => {
                const checkedInAvailable = driverCheckins.filter((d: any) => d.checkin_status === 'available').length
                const onTrip = driverCheckins.filter((d: any) => d.checkin_status === 'on_trip').length
                const notCheckedIn = driverCheckins.filter((d: any) => d.checkin_status === 'not_checked_in').length
                const offDuty = driverCheckins.filter((d: any) => d.checkin_status === 'off_duty').length
                // Số đang sẵn sàng = chỉ dùng check-in thực tế
                const readyCount = driverCheckins.length > 0 ? checkedInAvailable : drivers.length
                const readyLabel = driverCheckins.length > 0 ? 'đã check-in, sẵn sàng' : 'tài xế active'
                return (
                  <>
                    <div className="flex items-baseline gap-2">
                      <div className="text-3xl font-bold text-green-700">{readyCount}</div>
                      {driverCheckins.length > 0 && drivers.length > readyCount && (
                        <span className="text-sm text-gray-400">/ {drivers.length} active</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {readyCount >= vehicles.length
                        ? <span className="text-green-600">Đủ tài xế cho tất cả xe</span>
                        : <span className="text-red-600">Thiếu {vehicles.length - readyCount} tài xế</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{readyLabel}</div>
                    {driverCheckins.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {checkedInAvailable > 0 && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Sẵn sàng: {checkedInAvailable}</span>}
                        {onTrip > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Đang chạy: {onTrip}</span>}
                        {offDuty > 0 && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Nghỉ: {offDuty}</span>}
                        {notCheckedIn > 0 && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Chưa check-in: {notCheckedIn}</span>}
                      </div>
                    )}
                  </>
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
                  {capacityRatio > 100 ? 'Quá tải' : capacityRatio > 80 ? 'Gần đầy' : 'OK'}
                </div>
                <div className="text-xs text-gray-500">Trạng thái tải</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-gray-700">
                  {new Date(todayDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                </div>
                <div className="text-xs text-gray-500">Ngày xuất phát</div>
              </div>
            </div>

            {/* Warnings */}
            {shipments.length === 0 && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
                Không có đơn hàng nào chờ giao cho ngày {deliveryDate}. Kiểm tra lại kho xuất và ngày giao.
              </div>
            )}
            {capacityRatio > 100 && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                Tổng hàng ({(totalDemandKg / 1000).toFixed(1)}T) vượt quá tổng tải xe ({(totalCapacityKg / 1000).toFixed(1)}T).
                Một số đơn sẽ không được xếp. Hãy thêm xe ở bước tiếp theo hoặc loại bớt đơn hàng.
              </div>
            )}
            {(() => {
              const checkedInAvailable = driverCheckins.filter((d: any) => d.checkin_status === 'available').length
              const notCheckedIn = driverCheckins.filter((d: any) => d.checkin_status === 'not_checked_in').length
              const showWarning = vehicles.length > 0 && checkedInAvailable < vehicles.length && notCheckedIn > 0
              return showWarning ? (
                <div className="mt-4 bg-orange-50 border border-orange-300 text-orange-800 px-4 py-3 rounded-lg text-sm">
                  <div className="font-semibold mb-1">Chênh lệch xe — tài xế sẵn sàng</div>
                  <div>Có <strong>{vehicles.length} xe</strong> khả dụng nhưng chỉ <strong>{checkedInAvailable} tài xế</strong> đã check-in sẵn sàng.
                  Còn <strong>{notCheckedIn} tài xế chưa check-in</strong>.</div>
                  <div className="mt-2 text-xs text-orange-600">
                     Hãy nhắc tài xế check-in trước khi lập kế hoạch để hệ thống phân bổ hiệu quả hơn.
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
              Lưu ý: Bạn chọn <strong>{selectedVehicleIds.size} xe</strong> nhưng chỉ có <strong>{drivers.length} tài xế</strong> khả dụng.
              Hệ thống sẽ tối ưu với tất cả xe đã chọn, nhưng ở bước gán tài xế sẽ có {selectedVehicleIds.size - drivers.length} chuyến chưa có tài xế.
              <br />
              <span className="text-xs text-yellow-600 mt-1 block">
                 Gợi ý: Chọn tối đa {drivers.length} xe để đảm bảo đủ tài xế cho mỗi chuyến.
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
                      <Truck className="w-3.5 h-3.5 inline mr-0.5" /> {type}
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
                ? ` Sử dụng ${capacityRatio.toFixed(0)}% tải trọng. Hệ thống sẽ tối ưu phân bổ ở bước 4.`
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
                <span className="ml-2 text-red-600 font-semibold"> {shipments.filter(s => s.is_urgent).length} đơn gấp</span>
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
                  <th className="w-10 py-2.5 px-2 text-center"></th>
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
                   VRP Tự động
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
                     Tự gán đều
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
                    <Package className="w-4 h-4 inline mr-1" /> Đơn hàng chưa xếp ({manualUnassigned.length})
                  </h3>
                  {/* Sort tools */}
                  <div className="flex flex-wrap gap-1 mb-3 sticky top-8 bg-white pb-2 z-10">
                    {([
                      ['default', 'Mặc định'],
                      ['region', 'Khu vực'],
                      ['weight-desc', '⬇️ Nặng trước'],
                      ['weight-asc', '⬆️ Nhẹ trước'],
                      ['urgent', ' Gấp trước'],
                      ['customer', 'Khách hàng'],
                    ] as const).map(([key, label]) => (
                      <button key={key} onClick={() => setPoolSort(key as typeof poolSort)}
                        className={`px-2 py-1 rounded text-xs font-medium transition ${poolSort === key ? 'bg-[#F68634] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {manualUnassigned.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      Tất cả đơn đã được xếp vào xe
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
                                <MapPin className="w-3.5 h-3.5 inline mr-0.5" /> {extractDistrict(s.customer_address)}
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
                                <div className="text-xs text-blue-500 truncate mt-0.5"><MapPin className="w-3.5 h-3.5 inline mr-0.5" /> {s.customer_address}</div>
                              )}
                              {s.is_urgent && <span className="text-xs text-red-600 font-semibold"> Gấp</span>}
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
                            <Truck className="w-3.5 h-3.5 inline mr-0.5" /> {vehicle?.plate_number || vehicleId.slice(0, 8)}
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
                                    className="w-5 h-5 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"><XCircle className="w-4 h-4" /></button>
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
                      Đã xếp {Object.values(manualAssign).flat().length}/{activeShipments.length} đơn vào {Object.values(manualAssign).filter(ids => ids.length > 0).length} chuyến
                    </span>
                    {manualUnassigned.length > 0 && (
                      <span className="text-amber-700 text-xs"><AlertTriangle className="w-4 h-4 inline mr-1" /> Còn {manualUnassigned.length} đơn chưa xếp</span>
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
              <div className="flex items-center justify-center mb-4">{costReadiness?.ready ? <CheckCircle2 className="w-12 h-12 text-green-500" /> : <MapIcon className="w-12 h-12 text-gray-400" />}</div>
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
                    <Target className="w-4 h-4 text-amber-500" />
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
                      <div className="text-xs font-bold text-green-700">Tối ưu chi phí</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">Tránh BOT · Tối ưu xăng + phí</div>
                    </button>
                    <button type="button"
                      onClick={() => setOptimizeFor('time')}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        optimizeFor === 'time'
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-gray-200 bg-white hover:border-blue-300'
                      }`}>
                      <div className="text-xs font-bold text-blue-700"> Giao nhanh</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">Đường nhanh nhất · Có thể qua BOT</div>
                    </button>
                  </div>
                </div>

                {(() => {
                  const availDrivers = driverCheckins.filter((d: any) => d.checkin_status === 'available' || d.status === 'available').length || drivers.length
                  const effectiveVehicles = Math.min(selectedVehicleIds.size, availDrivers > 0 ? availDrivers : selectedVehicleIds.size)
                  return selectedVehicleIds.size > availDrivers && availDrivers > 0 ? (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
                      Lưu ý: Đã chọn {selectedVehicleIds.size} xe nhưng chỉ có {availDrivers} tài xế sẵn sàng.
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
                      {costReadiness?.ready ? 'Dữ liệu chi phí đầy đủ' : 'Chưa có dữ liệu chi phí'}
                    </h3>
                    <p className={`text-[11px] mt-0.5 ${costReadiness?.ready ? 'text-green-600' : 'text-amber-600'}`}>
                      {costReadiness?.ready
                        ? 'Solver sẽ tự động tối ưu chi phí (xăng + cầu đường) · Kết quả hiển thị cả VND và km'
                        : 'Solver sẽ tối ưu quãng đường. Thêm dữ liệu chi phí để mở khóa tối ưu VND'
                      }
                    </p>
                  </div>
                  <span className={`text-2xl ${costReadiness?.ready ? '' : 'opacity-50'}`}>
                    {costReadiness?.ready ? <CheckCircle2 className='w-5 h-5 text-green-500' /> : <Scale className='w-5 h-5 text-gray-400' />}
                  </span>
                </div>
                {costReadiness && (
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className={`px-2 py-0.5 rounded-full ${costReadiness.toll_station_count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      🚏 {costReadiness.toll_station_count} trạm BOT
                    </span>
                    <span className={`px-2 py-0.5 rounded-full ${costReadiness.expressway_count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      [CT] {costReadiness.expressway_count} tuyến thu phí
                    </span>
                    <span className={`px-2 py-0.5 rounded-full ${costReadiness.vehicle_default_count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      <Truck className="w-3.5 h-3.5 inline mr-0.5" /> {costReadiness.vehicle_default_count} loại xe
                    </span>
                    <span className={`px-2 py-0.5 rounded-full ${costReadiness.driver_rate_count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {costReadiness.driver_rate_count} bảng lương
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
                  {optimizeFor === 'cost' ? 'Tạo kế hoạch tối ưu chi phí' : 'Tạo kế hoạch giao nhanh'}
                </button>
                {costReadiness?.ready && (
                  <button onClick={compareStrategies}
                    className="px-6 py-3 bg-white text-orange-600 border-2 border-orange-300 rounded-xl hover:bg-orange-50 transition font-medium text-sm shadow">
                    <Scale className="w-4 h-4 inline mr-1" /> So sánh 2 phương án
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
                  {optimizeFor === 'cost' ? 'Đang tối ưu chi phí vận chuyển...' : 'Đang tính toán giao nhanh nhất...'}
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
                      <span className="w-6 text-center">{done ? <Check className='w-4 h-4' /> : active ? <span className='text-xs'>{s.icon}</span> : '○'}</span>
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

          {/* Comparing animation — sequential two-phase Vietnamese stage progress */}
          {comparing && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-center mb-5">
                <h2 className="text-xl font-bold text-gray-800">Đang so sánh 2 phương án tuần tự v2...</h2>
                <p className="text-sm text-gray-400 mt-1">Phase 1 chốt danh sách đơn bằng tối ưu chi phí, Phase 2 giao nhanh dùng đúng danh sách đó</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {([
                  { key: 'cost'     as const, icon: '$', label: 'Tối ưu chi phí', phase: '(Phase 1: chạy trước)', border: 'border-green-200',  activeCls: 'bg-green-50 text-green-800',  bar: 'bg-green-500' },
                  { key: 'time'     as const, icon: '', label: 'Giao nhanh',      phase: '(Phase 2: chạy sau)',  border: 'border-blue-200',   activeCls: 'bg-blue-50 text-blue-800',    bar: 'bg-blue-500' },
                ]).map(mode => {
                  const prog = compareProgress[mode.key]
                  const isDone = prog.stage === 'done'
                  return (
                    <div key={mode.key} className={`border ${mode.border} rounded-xl p-4 ${isDone ? 'opacity-75' : ''}`}>
                      <div className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <span>{mode.icon}</span>
                        <span>{mode.label}</span>
                        <span className="text-xs text-gray-400 font-normal">{mode.phase}</span>
                        {isDone && <span className="ml-auto text-green-600 text-xs">Xong</span>}
                      </div>
                      <div className="space-y-1.5">
                        {VRP_STAGES.map(s => {
                          const done = STAGE_ORDER[prog.stage] > STAGE_ORDER[s.key]
                          const active = prog.stage === s.key
                          return (
                            <div key={s.key} className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                              done ? 'text-gray-400' : active ? `${mode.activeCls} font-medium` : 'text-gray-300'
                            }`}>
                              <span>{done ? <Check className='w-4 h-4' /> : active ? <span className='text-xs'>{s.icon}</span> : '○'}</span>
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
              <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3 text-left">
                <div className="text-xs font-semibold text-gray-600 mb-2">Nhật ký chạy VRP compare</div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {compareTrace.length > 0 ? compareTrace.map((line, idx) => (
                    <div key={idx} className="text-[11px] text-gray-500 font-mono leading-snug">{line}</div>
                  )) : (
                    <>
                      <div className="text-[11px] text-gray-500 font-mono leading-snug">1. COST: chạy trước để chốt tập đơn khả thi.</div>
                      <div className="text-[11px] text-gray-500 font-mono leading-snug">2. TIME: chỉ chạy sau khi COST xong và dùng đúng tập đơn đó.</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Comparison Result — World-class hero+drawer pattern.
              Both modes deliver the SAME shipment subset (enforced by force_delivery_shipment_ids
              in compareStrategies), so metrics are directly comparable (no apples-vs-oranges). */}
          {compareResult && !comparing && (() => {
            const cost = compareResult.cost
            const time = compareResult.time
            if (!cost?.summary && !time?.summary) {
              return (
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6 text-center">
                  <XCircle className="w-8 h-8 text-red-500 inline mr-2" />
                  <p className="text-red-600 inline">Không thể so sánh — cả 2 phương án đều lỗi</p>
                  <button onClick={() => setCompareResult(null)} className="ml-4 text-sm text-gray-500 hover:text-gray-700">Đóng</button>
                </div>
              )
            }
            // Winner policy: recommend the dominated winner if one mode is both cheaper
            // and faster on the verified same shipment set. If there is a real trade-off,
            // default to cost because FMCG distribution usually optimizes VND first.
            let recommended: 'cost' | 'time' = cost?.summary ? 'cost' : 'time'
            if (cost?.summary && time?.summary) {
              const costCheaperOrEqual = (cost.summary.total_cost_vnd || 0) <= (time.summary.total_cost_vnd || 0)
              const costFasterOrEqual = (cost.summary.total_duration_min || 0) <= (time.summary.total_duration_min || 0)
              const timeCheaperOrEqual = (time.summary.total_cost_vnd || 0) <= (cost.summary.total_cost_vnd || 0)
              const timeFasterOrEqual = (time.summary.total_duration_min || 0) <= (cost.summary.total_duration_min || 0)
              if (timeCheaperOrEqual && timeFasterOrEqual && (!costCheaperOrEqual || !costFasterOrEqual)) recommended = 'time'
              if (costCheaperOrEqual && costFasterOrEqual && (!timeCheaperOrEqual || !timeFasterOrEqual)) recommended = 'cost'
            }
            const winnerRes = recommended === 'cost' ? cost : time
            const altRes = recommended === 'cost' ? time : cost
            const costFellBack = !!compareResult.costFellBackToTime
            const rawCostSummary = compareResult.rawCost?.summary
            const costModeLostReportedCost = false  // handled at compareStrategies(); see costFellBack
            const winnerLabel = recommended === 'cost' ? 'Tối ưu chi phí' : 'Giao nhanh'
            const altLabel = recommended === 'cost' ? 'Giao nhanh' : 'Tối ưu chi phí'
            const winnerColor = recommended === 'cost' ? 'green' : 'blue'

            // Detect plan-level identity (not just totals): hash trip→stops→shipment_id sequence.
            // If hashes match, COST and TIME truly converged on the SAME assignment+order — common
            // on tight-capacity datasets where fuel and time are both monotone in distance and there
            // are no toll-vs-distance trade-offs available. We tell the user explicitly.
            const planFingerprint = (r: VRPResult | null): string => {
              if (!r?.trips) return ''
              return r.trips
                .map(t => `${t.vehicle_id}:${(t.stops||[]).map(s => s.shipment_id || `${s.latitude},${s.longitude}`).join('>')}`)
                .sort()
                .join('|')
            }
            const samePlanByFingerprint = !!cost && !!time && planFingerprint(cost) === planFingerprint(time) && planFingerprint(cost) !== ''

            const ws = winnerRes!.summary
            const as = altRes?.summary
            const totalShipments = (ws.total_shipments_assigned || 0) + (ws.total_unassigned || 0)
            const deliveryPct = totalShipments > 0 ? Math.round(100 * (ws.total_shipments_assigned || 0) / totalShipments) : 0

            // Delta helpers — value of WINNER minus value of ALT.
            // For cost/time/km lower-is-better, winner having lower value = win (negative delta).
            const fmtMoney = (v: number) => `${(v / 1_000_000).toFixed(1)}M`
            const fmtHrs = (m: number) => `${Math.floor(m / 60)}h${m % 60}p`
            const fmtKm = (km: number) => `${Math.round(km).toLocaleString()} km`
            const deltaPct = (a: number, b: number) => b > 0 ? Math.round(100 * (a - b) / b) : 0

            const dCost = as ? (ws.total_cost_vnd || 0) - (as.total_cost_vnd || 0) : 0
            const dTime = as ? (ws.total_duration_min || 0) - (as.total_duration_min || 0) : 0
            const dKm = as ? (ws.total_distance_km || 0) - (as.total_distance_km || 0) : 0
            const dCostPct = as ? deltaPct(ws.total_cost_vnd || 0, as.total_cost_vnd || 0) : 0
            const dTimePct = as ? deltaPct(ws.total_duration_min || 0, as.total_duration_min || 0) : 0

            // Diff at action-level: shipment-to-vehicle assignment diff between winner & alt.
            // Both have the same set of shipments (pinned), so a "moved" shipment changed vehicle.
            // Also collect coordinates + customer + capacity context for Tier-3 deep-dive modal.
            type AssignInfo = { vehicle: string; lat: number; lng: number; customer: string; weight: number }
            const buildAssignment = (r: VRPResult | null): Map<string, AssignInfo> => {
              const m = new Map<string, AssignInfo>()
              if (!r?.trips) return m
              for (const trip of r.trips) {
                for (const stop of trip.stops || []) {
                  const w = stop.weight_kg ?? stop.cumulative_load_kg ?? 0
                  const info: AssignInfo = {
                    vehicle: trip.vehicle_id, lat: stop.latitude, lng: stop.longitude,
                    customer: stop.customer_name, weight: w,
                  }
                  if (stop.shipment_id) m.set(stop.shipment_id, info)
                  for (const cid of (stop.consolidated_ids || [])) m.set(cid, info)
                }
              }
              return m
            }
            const winnerAssign = buildAssignment(winnerRes)
            const altAssign = buildAssignment(altRes)

            // Build per-trip capacity util map for richer popup info
            const tripCapPct = (r: VRPResult | null, vehicleId: string): number => {
              if (!r?.trips) return 0
              const t = r.trips.find(tr => tr.vehicle_id === vehicleId)
              if (!t) return 0
              const veh = vehicles.find(v => v.id === vehicleId)
              const cap = veh?.capacity_kg || 15000
              return cap > 0 ? (t.total_weight_kg / cap) * 100 : 0
            }
            const plateOf = (vid: string) => {
              const v = vehicles.find(x => x.id === vid)
              return v?.plate_number || vid.slice(0, 6)
            }

            const movedShipments: MovedShip[] = []
            winnerAssign.forEach((winInfo, sid) => {
              const altInfo = altAssign.get(sid)
              if (altInfo && altInfo.vehicle !== winInfo.vehicle) {
                movedShipments.push({
                  shipmentId: sid,
                  customerName: winInfo.customer,
                  weightKg: winInfo.weight,
                  lat: winInfo.lat, lng: winInfo.lng,
                  winnerVehicle: winInfo.vehicle,
                  winnerVehiclePlate: plateOf(winInfo.vehicle),
                  winnerCapPct: tripCapPct(winnerRes, winInfo.vehicle),
                  altVehicle: altInfo.vehicle,
                  altVehiclePlate: plateOf(altInfo.vehicle),
                  altCapPct: tripCapPct(altRes, altInfo.vehicle),
                })
              }
            })
            const movedCount = movedShipments.length
            const winnerVehicles = new Set(Array.from(winnerAssign.values()).map(a => a.vehicle))
            const altVehicles = new Set(Array.from(altAssign.values()).map(a => a.vehicle))
            const sameSetVerified = sameShipmentSet(deliveredShipmentSet(cost), deliveredShipmentSet(time))
            const tripsDiff = (winnerRes!.trips?.length || 0) - (altRes?.trips?.length || 0)
            const vehiclesDiff = winnerVehicles.size - altVehicles.size

            const choseCost = recommended === 'cost'
            const altIsCheaper = dCost > 0  // winner is more expensive than alt
            const altIsFaster = dTime > 0   // winner takes more time than alt

            const winnerBg = choseCost ? 'from-emerald-50 to-green-50 border-emerald-300' : 'from-sky-50 to-blue-50 border-blue-300'
            const winnerAccent = choseCost ? 'text-emerald-700' : 'text-blue-700'
            const winnerBtn = choseCost ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
            const altBtnLight = choseCost ? 'border-blue-300 text-blue-700 hover:bg-blue-50' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'

            // Decision aid — when to pick alt
            const altReasons = choseCost
              ? ['Có deadline gấp (sự kiện, đám tiệc)', 'Đường có nguy cơ tắc (mưa, lễ)', 'Khách VIP cần giao trước trưa']
              : costModeLostReportedCost
                ? ['Không nên đổi chỉ vì nhãn “Tối ưu chi phí”: phương án này đang đắt hơn trên chi phí OSRM thực tế', 'Chỉ dùng để điều tra vì sao solver cost-proxy lệch với route cost report', 'Cần sửa solver objective trước khi coi đây là phương án tiết kiệm']
                : ['Ngày bình thường, không có đơn gấp', 'Muốn tiết kiệm chi phí xăng + cầu đường', 'Tài xế có thời gian linh hoạt']

            return (
              <div className="space-y-4 mb-6">
                {costFellBack && !samePlanByFingerprint && (
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-bold text-amber-900 mb-1">
                        Chi phí báo cáo của Tối ưu chi phí cao hơn Giao nhanh — các tuyến đường vẫn khác nhau
                      </div>
                      <div className="text-sm text-amber-800">
                        Solver chi phí tối ưu proxy fuel+toll trả về tuyến đường khác, nhưng khi tính lại total_cost_vnd theo OSRM thực tế,
                        phương án này tốn <span className="font-semibold">{rawCostSummary ? `${((rawCostSummary.total_cost_vnd || 0) / 1e6).toFixed(1)}M ₫` : `${((cost?.summary?.total_cost_vnd || 0) / 1e6).toFixed(1)}M ₫`}</span>{' '}
                        so với Giao nhanh <span className="font-semibold">{((time?.summary?.total_cost_vnd || 0) / 1e6).toFixed(1)}M ₫</span>.
                        Hai cột vẫn hiển thị kết quả thực từng mode — hãy xem phân công xe để thấy sự khác biệt.
                      </div>
                      <div className="text-xs text-amber-700 mt-2">
                        Nguyên nhân: ma trận chi phí pre-solve dùng leg OSRM riêng lẻ, còn total_cost_vnd tính trên tuyến chạy thật sau khi nối các leg — hai lớp có thể lệch nhau.
                      </div>
                    </div>
                  </div>
                )}

                {samePlanByFingerprint && (
                  <div className="bg-sky-50 border-2 border-sky-300 rounded-xl p-4 flex items-start gap-3">
                    <Info className="w-5 h-5 text-sky-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-bold text-sky-900 mb-1">
                        Hai mục tiêu hội tụ về cùng 1 phương án — không có trade-off để chọn
                      </div>
                      <div className="text-sm text-sky-800">
                        Solver chạy độc lập 2 lần với 2 mục tiêu (chi phí nhiên liệu + phí cầu vs tổng thời gian),
                        nhưng với <span className="font-semibold">{(cost?.trips?.length || 0)} chuyến · {Math.round(cost?.summary?.total_distance_km || 0).toLocaleString()} km</span>{' '}
                        trên cùng tập đơn cố định, cả 2 đều chọn đúng cùng cách phân xe và cùng thứ tự dừng.
                      </div>
                      <div className="text-xs text-sky-700 mt-2">
                        Lý do: trên dataset này nhiên liệu ≈ k₁ × km và thời gian ≈ k₂ × km (tốc độ đường tương đồng,
                        không có lựa chọn cao tốc kín có thể đánh đổi km lấy thời gian), nên hai objective biến đổi
                        đơn điệu của cùng đại lượng → cùng lời giải tối ưu. Đây là kết quả đúng về toán, không phải lỗi.
                      </div>
                    </div>
                  </div>
                )}

                {/* Capacity warning banner — surfaces the physical limit BEFORE user looks at metrics */}
                {(ws.total_unassigned || 0) > 0 && (
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-bold text-amber-900 mb-1">
                        Thiếu năng lực — {ws.total_unassigned} đơn không thể giao hôm nay
                      </div>
                      <div className="text-sm text-amber-800">
                        Cả 2 phương án đều giao được tối đa <span className="font-bold">{ws.total_shipments_assigned}/{totalShipments}</span> đơn
                        ({deliveryPct}%). Phần còn lại vượt quá khả năng đội xe hiện tại.
                      </div>
                      <div className="text-xs text-amber-700 mt-2">
                        Gợi ý: thêm xe/tài xế · tách kế hoạch sang ngày mai · giảm đơn ưu tiên thấp
                      </div>
                    </div>
                  </div>
                )}

                {costModeLostReportedCost && (
                  <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-bold text-rose-900 mb-1">
                        Kết quả bất thường: Giao nhanh rẻ hơn Tối ưu chi phí trên chi phí OSRM thực tế
                      </div>
                      <div className="text-sm text-rose-800">
                        Hai phương án đã cùng tập đơn, nhưng mode chi phí đang tối ưu trên ma trận xấp xỉ trước solve,
                        còn số hiển thị được tính lại bằng tuyến OSRM thực tế sau solve. Khi hai lớp tính này lệch,
                        nhãn &ldquo;Tối ưu chi phí&rdquo; không còn là phương án rẻ nhất theo báo cáo cuối.
                      </div>
                    </div>
                  </div>
                )}

                {/* HERO — Winner card */}
                <div className={`bg-gradient-to-br ${winnerBg} border-2 rounded-2xl p-6 shadow-sm`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full bg-white flex items-center justify-center ${winnerAccent}`}>
                        <Trophy className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Khuyến nghị</div>
                        <div className={`text-xl font-bold ${winnerAccent}`}>{winnerLabel}</div>
                      </div>
                    </div>
                    <button onClick={() => setCompareResult(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
                  </div>

                  {/* One-line summary — the trade-off in plain Vietnamese */}
                  {as && (
                    <div className="bg-white/70 rounded-lg px-4 py-3 mb-4 text-sm text-gray-700">
                      <Lightbulb className="w-4 h-4 inline text-amber-500 mr-1.5 -mt-0.5" />
                      Giao <span className="font-bold">{ws.total_shipments_assigned} đơn</span> với{' '}
                      <span className="font-bold">{winnerRes!.trips?.length || 0} chuyến</span>.
                      {altIsCheaper && altIsFaster ? (
                        <> Phương án &ldquo;{altLabel}&rdquo; vừa nhanh hơn vừa rẻ hơn — nên dùng nó.</>
                      ) : altIsCheaper ? (
                        <> Phương án &ldquo;{altLabel}&rdquo; rẻ hơn <span className="font-bold text-emerald-700">{fmtMoney(Math.abs(dCost))} ₫</span> nhưng chậm hơn <span className="font-bold text-amber-700">{fmtHrs(Math.abs(dTime))}</span>.</>
                      ) : altIsFaster ? (
                        <> Đổi sang &ldquo;{altLabel}&rdquo; sẽ nhanh hơn <span className="font-bold text-blue-700">{fmtHrs(Math.abs(dTime))}</span> nhưng tốn thêm <span className="font-bold text-red-600">{fmtMoney(Math.abs(dCost))} ₫</span>.</>
                      ) : (
                        <> Phương án này tối ưu cả chi phí lẫn thời gian.</>
                      )}
                    </div>
                  )}

                  {/* 4 KPI cards with delta vs alt */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    <KPICard
                      icon={<Package className="w-4 h-4" />}
                      label="Đơn giao"
                      value={`${ws.total_shipments_assigned}/${totalShipments}`}
                      sub={`${deliveryPct}%`}
                      tone="neutral"
                    />
                    <KPICard
                      icon={<Wallet className="w-4 h-4" />}
                      label="Tổng chi phí"
                      value={`${fmtMoney(ws.total_cost_vnd || 0)} ₫`}
                      sub={as ? deltaText(dCost, dCostPct, true, fmtMoney) : undefined}
                      tone={as ? (dCost <= 0 ? 'good' : 'bad') : 'neutral'}
                    />
                    <KPICard
                      icon={<Clock className="w-4 h-4" />}
                      label="Tổng thời gian"
                      value={fmtHrs(ws.total_duration_min || 0)}
                      sub={as ? deltaText(dTime, dTimePct, true, (m) => fmtHrs(Math.abs(m as number))) : undefined}
                      tone={as ? (dTime <= 0 ? 'good' : 'bad') : 'neutral'}
                    />
                    <KPICard
                      icon={<Navigation2 className="w-4 h-4" />}
                      label="Quãng đường"
                      value={fmtKm(ws.total_distance_km || 0)}
                      sub={as ? `${dKm >= 0 ? '+' : ''}${Math.round(dKm).toLocaleString()} km` : undefined}
                      tone={as ? (dKm <= 0 ? 'good' : 'bad') : 'neutral'}
                    />
                  </div>

                  {/* Action row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => { setVrpResult(winnerRes); setOptimizeFor(recommended); setCompareResult(null); setShowAltDetail(false); }}
                      className={`px-6 py-3 ${winnerBtn} text-white rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2`}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Áp dụng phương án này
                    </button>
                    {as && (
                      <button
                        onClick={() => setShowAltDetail((v) => !v)}
                        className={`px-5 py-3 bg-white border-2 ${altBtnLight} rounded-lg text-sm font-medium flex items-center gap-2 transition`}
                      >
                        Xem &ldquo;{altLabel}&rdquo;
                        {showAltDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* DRAWER — alt mode detail (collapsible) */}
                {showAltDetail && as && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Scale className="w-5 h-5 text-gray-600" />
                        <h3 className="font-bold text-gray-800">So sánh trade-off — cùng {ws.total_shipments_assigned} đơn</h3>
                      </div>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        <Info className="w-3 h-3 inline mr-1" />
                        {sameSetVerified ? 'Đã kiểm chứng 2 phương án cùng tập đơn' : 'Không hiển thị nếu lệch tập đơn'}
                      </span>
                    </div>
                    {/* Decision context chips — inline, no overlay */}
                    <div className="mb-4 pb-4 border-b border-gray-100">
                      <DecisionSupportPanel
                        deliveryDate={deliveryDate}
                        urgentCount={activeShipments.filter(s => s.is_urgent).length}
                        totalShipments={activeShipments.length}
                        unassignedCount={ws.total_unassigned || 0}
                        totalWeightShortKg={(activeShipments.reduce((sum, s) => sum + (s.total_weight_kg || 0), 0)) - (ws.total_weight_kg || 0)}
                        recommendedKey={recommended}
                        onAlignWithRecommendation={(target) => {
                          if (target === recommended) return
                          const targetRes = target === 'cost' ? cost : time
                          if (targetRes) {
                            setVrpResult(targetRes); setOptimizeFor(target)
                            setCompareResult(null); setShowAltDetail(false); setShowDeepDive(false)
                          }
                        }}
                      />
                    </div>
                    {costModeLostReportedCost && (
                      <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                        <AlertTriangle className="w-4 h-4 inline mr-1 -mt-0.5" />
                        Cost solver proxy đang thua số đo OSRM thực tế: Giao nhanh rẻ hơn {(Math.abs((cost?.summary?.total_cost_vnd || 0) - (time?.summary?.total_cost_vnd || 0)) / 1_000_000).toFixed(1)}M đ và nhanh hơn {fmtHrs(Math.abs((cost?.summary?.total_duration_min || 0) - (time?.summary?.total_duration_min || 0)))}. Không dùng phương án proxy này như “tối ưu chi phí”.
                      </div>
                    )}

                    {/* Side-by-side */}
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      {[
                        { key: recommended, label: winnerLabel, res: winnerRes, isWinner: true, color: winnerColor },
                        { key: recommended === 'cost' ? 'time' : 'cost', label: altLabel, res: altRes, isWinner: false, color: recommended === 'cost' ? 'blue' : 'green' },
                      ].map(m => {
                        const s = m.res!.summary
                        const displayLabel = m.key === 'cost' && costModeLostReportedCost ? 'Tối ưu chi phí proxy' : m.label
                        return (
                          <div key={m.key} className={`rounded-xl p-4 border-2 ${m.isWinner ? (m.color === 'green' ? 'border-emerald-300 bg-emerald-50/40' : 'border-blue-300 bg-blue-50/40') : 'border-gray-200 bg-gray-50/40'}`}>
                            <div className="flex items-center justify-between mb-3">
                              <span className={`font-bold text-sm ${m.color === 'green' ? 'text-emerald-700' : 'text-blue-700'}`}>{displayLabel}</span>
                              {m.isWinner && <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">★ ĐỀ XUẤT</span>}
                              {!m.isWinner && m.key === 'cost' && costModeLostReportedCost && <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">proxy lệch</span>}
                            </div>
                            <dl className="space-y-1.5 text-sm">
                              <CompareRow label="Chi phí" value={`${fmtMoney(s.total_cost_vnd || 0)} ₫`} />
                              <CompareRow label="┗ Xăng/dầu" value={`${fmtMoney(s.total_fuel_cost_vnd || 0)} ₫`} muted />
                              <CompareRow label="┗ Cầu đường" value={`${fmtMoney(s.total_toll_cost_vnd || 0)} ₫`} muted />
                              <CompareRow label="Tổng giờ" value={fmtHrs(s.total_duration_min || 0)} />
                              <CompareRow label="Quãng đường" value={fmtKm(s.total_distance_km || 0)} />
                              <CompareRow label="Số chuyến" value={`${s.total_trips}`} />
                              <CompareRow label="Số xe dùng" value={`${m.isWinner ? winnerVehicles.size : altVehicles.size}`} />
                              <CompareRow label="TB tải trọng" value={`${(s.avg_capacity_util_pct || 0).toFixed(0)}%`} />
                            </dl>
                          </div>
                        )
                      })}
                    </div>

                    {/* Diff at action-level — what actually changes operationally */}
                    <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-4 mb-5">
                      <div className="font-semibold text-amber-900 text-sm mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Khác biệt thực tế (không chỉ là con số)
                      </div>
                      <ul className="space-y-1.5 text-sm text-amber-900">
                        {movedCount > 0 && (
                          <li>
                            <button
                              type="button"
                              onClick={() => setShowDeepDive(true)}
                              className="w-full text-left flex items-start gap-2 px-2 py-1.5 -mx-2 rounded hover:bg-amber-100 transition group"
                              title="Click để mở deep-dive map split-view"
                            >
                              <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              <span className="flex-1">
                                <b>{movedCount}</b> đơn được gán sang xe khác giữa 2 phương án
                              </span>
                              <span className="text-xs text-purple-700 font-semibold flex items-center gap-1 group-hover:underline">
                                <Eye className="w-3.5 h-3.5" /> Soi sâu trên map
                              </span>
                            </button>
                          </li>
                        )}
                        {tripsDiff !== 0 && (
                          <li className="flex items-start gap-2">
                            <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>
                              Số chuyến: <b>{winnerRes!.trips?.length || 0}</b> ({winnerLabel}) vs <b>{altRes?.trips?.length || 0}</b> ({altLabel}) —
                              chênh {Math.abs(tripsDiff)} chuyến
                            </span>
                          </li>
                        )}
                        {vehiclesDiff !== 0 && (
                          <li className="flex items-start gap-2">
                            <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>Số xe sử dụng chênh <b>{Math.abs(vehiclesDiff)}</b> xe</span>
                          </li>
                        )}
                        {Math.abs(dKm) >= 1 && (
                          <li className="flex items-start gap-2">
                            <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>Quãng đường chênh <b>{Math.abs(Math.round(dKm)).toLocaleString()} km</b> — {dKm < 0 ? `${winnerLabel} đi đường ngắn hơn` : `${altLabel} đi đường ngắn hơn`}</span>
                          </li>
                        )}
                        {((ws.total_toll_cost_vnd || 0) !== (as?.total_toll_cost_vnd || 0)) && (
                          <li className="flex items-start gap-2">
                            <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>Phí cầu đường chênh <b>{fmtMoney(Math.abs((ws.total_toll_cost_vnd || 0) - (as?.total_toll_cost_vnd || 0)))} ₫</b></span>
                          </li>
                        )}
                        {movedCount === 0 && tripsDiff === 0 && vehiclesDiff === 0 && Math.abs(dKm) < 1 && (
                          <li className="text-amber-800 text-xs italic">Hai phương án gần như giống nhau về vận hành — chọn cái nào cũng được.</li>
                        )}
                      </ul>
                    </div>

                    {/* Decision aid */}
                    <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-4 mb-5">
                      <div className="font-semibold text-blue-900 text-sm mb-2 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4" />
                        Khi nào nên đổi sang &ldquo;{altLabel}&rdquo;?
                      </div>
                      {costModeLostReportedCost && recommended === 'time' && (
                        <div className="mb-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                          <AlertTriangle className="w-4 h-4 inline mr-1 -mt-0.5" />
                          Không khuyến nghị đổi: phương án &ldquo;Tối ưu chi phí&rdquo; đang đắt hơn &ldquo;Giao nhanh&rdquo; theo chi phí OSRM thực tế.
                        </div>
                      )}
                      <ul className="space-y-1 text-sm text-blue-900">
                        {altReasons.map((r, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Switch action */}
                    <div className="flex items-center gap-3 justify-end">
                      <button onClick={() => setShowAltDetail(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                        Quay lại đề xuất
                      </button>
                      <button
                        onClick={() => {
                          const altKey: 'cost' | 'time' = recommended === 'cost' ? 'time' : 'cost'
                          setVrpResult(altRes); setOptimizeFor(altKey); setCompareResult(null); setShowAltDetail(false)
                        }}
                        className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                      >
                        Chuyển sang &ldquo;{altLabel}&rdquo; <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Tier 3 — Deep-dive split-view modal (mounted only when opened) */}
                {showDeepDive && altRes && movedShipments.length > 0 && (
                  <CompareDeepDiveModal
                    winnerRes={winnerRes!}
                    altRes={altRes}
                    winnerLabel={winnerLabel}
                    altLabel={altLabel}
                    vehicles={vehicles}
                    warehouse={warehouseMapInfo}
                    movedShipments={movedShipments}
                    onClose={() => setShowDeepDive(false)}
                  />
                )}
              </div>
            )
          })()}

          {/* VRP Failed */}
          {vrpResult && (!vrpResult.trips || vrpResult.trips.length === 0) && !running && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
              <p className="text-red-700 font-medium text-lg mb-2">Không tạo được kế hoạch</p>
              <p className="text-red-600 text-sm mb-4">{vrpResult.error || 'VRP solver không tìm được phương án phù hợp. Hãy thử điều chỉnh xe hoặc đơn hàng.'}</p>
              {vrpResult.distance_source === 'mock' && (
                <p className="text-amber-600 text-xs mb-3">VRP solver không khả dụng — đang dùng kết quả mock</p>
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
              {(() => {
                const highlights = buildVRPReviewHighlights(vrpResult, vehicles)
                const hasBlockingIssue = highlights.some((item) => item.impact === 'negative')
                const hasWarning = highlights.some((item) => item.impact === 'warning')
                return (
                  <AIContextStrip
                    title="Điểm cần xem trước khi duyệt"
                    tone={hasBlockingIssue ? 'danger' : hasWarning ? 'warning' : 'success'}
                    message={highlights.map((item) => item.reason).join(' ')}
                    confidence={0.86}
                    source="rules + VRP result"
                    sampleSize={vrpResult.trips.length}
                    factors={highlights.map((item) => ({ label: item.label, value: item.value, impact: item.impact, source: 'VRP snapshot' }))}
                    reasons={highlights.map((item) => item.reason)}
                    dismissKey={`vrp-review:${vrpResult.job_id || 'manual'}`}
                  />
                )
              })()}

              {/* Summary KPI */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-green-800 text-lg">Kết quả tối ưu</h2>
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
                  {costReadiness?.ready && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 border border-green-200 text-xs text-green-700">Tối ưu chi phí (fuel+toll)</span>}
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs text-blue-700">Chuyến về kho</span>
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
                    <div className="text-xs text-green-600 font-medium">Tổng chi phí (VND)</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center shadow-sm border border-orange-200">
                    <div className="text-xl font-bold text-orange-700">{(vrpResult.summary?.total_fuel_cost_vnd || 0) > 0 ? `${((vrpResult.summary?.total_fuel_cost_vnd || 0) / 1000000).toFixed(1)}M` : '—'}</div>
                    <div className="text-xs text-orange-600">Xăng/dầu</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center shadow-sm border border-red-200">
                    <div className="text-xl font-bold text-red-700">{(vrpResult.summary?.total_toll_cost_vnd || 0) > 0 ? `${((vrpResult.summary?.total_toll_cost_vnd || 0) / 1000000).toFixed(1)}M` : '—'}</div>
                    <div className="text-xs text-red-600">🚏 Cầu đường</div>
                  </div>
                  <div className="bg-violet-50 rounded-lg p-3 text-center shadow-sm border border-violet-200">
                    <div className="text-xl font-bold text-violet-700">{(vrpResult.summary?.total_driver_cost_vnd || 0) > 0 ? `${((vrpResult.summary?.total_driver_cost_vnd || 0) / 1000000).toFixed(1)}M` : '—'}</div>
                    <div className="text-xs text-violet-600">Tài xế</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center shadow-sm border border-blue-200">
                    <div className="text-xl font-bold text-blue-700">{(vrpResult.summary?.avg_cost_per_ton_vnd || 0) > 0 ? `${((vrpResult.summary?.avg_cost_per_ton_vnd || 0) / 1000).toFixed(0)}K` : '—'}</div>
                    <div className="text-xs text-blue-600">VND/tấn</div>
                  </div>
                  <div className="bg-cyan-50 rounded-lg p-3 text-center shadow-sm border border-cyan-200">
                    <div className="text-xl font-bold text-cyan-700">{(vrpResult.summary?.avg_cost_per_km_vnd || 0) > 0 ? (vrpResult.summary?.avg_cost_per_km_vnd || 0).toFixed(0) : '—'}</div>
                    <div className="text-xs text-cyan-600">VND/km</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center shadow-sm border border-amber-200">
                    <div className="text-xl font-bold text-amber-700">{(vrpResult.summary?.avg_cost_per_shipment_vnd || 0) > 0 ? `${((vrpResult.summary?.avg_cost_per_shipment_vnd || 0) / 1000).toFixed(0)}K` : '—'}</div>
                    <div className="text-xs text-amber-600">VND/đơn</div>
                  </div>
                </div>

                {/* Toll road impact explainer */}
                {(vrpResult.summary?.total_toll_cost_vnd || 0) > 0 && (() => {
                  const tollVnd = vrpResult.summary?.total_toll_cost_vnd || 0
                  const totalVnd = vrpResult.summary?.total_cost_vnd || 0
                  const tollPct = totalVnd > 0 ? (tollVnd / totalVnd * 100) : 0
                  return (
                    <div className={`mb-3 rounded-lg border px-4 py-3 text-xs ${tollPct >= 35 ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      <span className="font-semibold">🚏 Chi phí cầu đường:</span>{' '}
                      {((tollVnd)/1000).toFixed(0)}K đ ({tollPct.toFixed(0)}% tổng chi phí).{' '}
                      {tollPct >= 35
                        ? 'Tỷ lệ cầu đường cao — dùng phương án "Tối ưu chi phí" để VRP tránh BOT và tiết kiệm thêm.'
                        : 'Hệ thống đã chọn tuyến cân bằng tốc độ và phí BOT.'}
                      {' '}
                      <button onClick={() => {
                        const el = document.querySelector('[data-compare-btn]') as HTMLButtonElement | null
                        if (el) el.click()
                      }} className="underline font-medium ml-1"><Scale className="w-4 h-4 inline mr-1" /> So sánh 2 phương án</button>
                    </div>
                  )
                })()}

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
                          <span className="text-blue-500 hover:text-blue-700">▸</span>
                        </div>
                      )
                    })}
                  </div>
                </details>

                {/* VRP Quality Assessment */}
                <details className="mt-4 bg-white rounded-xl shadow-sm border border-blue-200" open>
                  <summary className="text-sm font-bold text-blue-700 bg-blue-50 rounded-t-xl px-4 py-3 cursor-pointer hover:bg-blue-100 transition list-none flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 inline mr-1" /> Đánh giá chất lượng VRP
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
                              <div className="text-xs font-semibold text-gray-600 mb-2">Phân tích chi phí</div>
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
                                <Package className="w-5 h-5 text-gray-400" />
                                <div>
                                  <div className="text-xs font-semibold text-purple-700">Ghép đơn: {vrpResult.summary.consolidated_stops} điểm</div>
                                  <div className="text-[10px] text-purple-500">Cùng NPP nhiều đơn → gộp 1 điểm giao</div>
                                </div>
                              </div>
                            )}
                            {(vrpResult.summary?.split_deliveries || 0) > 0 && (
                              <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                                <span className="text-sm font-bold text-orange-600">✄</span>
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
                            <div className="text-xs font-semibold text-amber-800 mb-1.5"> Gợi ý cải thiện</div>
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
                        <AlertTriangle className="w-4 h-4 inline mr-1" /> Không xếp được: {vrpResult.unassigned_shipments.length} đơn hàng
                      </div>
                    </div>
                    {/* Explainer — why are there unassigned shipments? */}
                    {(() => {
                      const assignedKg = vrpResult.trips.reduce((s, t) => s + (t.total_weight_kg || 0), 0)
                      const unassignedKg = vrpResult.unassigned_shipments.reduce((s: number, sh: any) => {
                        const sid = typeof sh === 'string' ? sh : (sh.shipment_id || sh.id)
                        const found = shipments.find(x => x.id === sid)
                        return s + (found?.total_weight_kg || 0)
                      }, 0)
                      const fleetCapKg = selectedVehicles.reduce((s, v) => s + (v.capacity_kg || 0), 0)
                      const shortfallKg = Math.max(0, (assignedKg + unassignedKg) - fleetCapKg)
                      const reasons: string[] = []
                      if (shortfallKg > 0) reasons.push(`Tải đội xe (${(fleetCapKg/1000).toFixed(1)}T) < tổng đơn (${((assignedKg+unassignedKg)/1000).toFixed(1)}T) — thiếu ~${(shortfallKg/1000).toFixed(1)}T`)
                      reasons.push('Ràng buộc thời gian giao (time window) khiến không xếp thêm được vào chuyến đang chạy')
                      reasons.push('Một số đơn có khối lượng đơn lẻ vượt tải tối đa 1 xe')
                      return (
                        <div className="mb-3 bg-white border border-red-100 rounded-lg p-3">
                          <div className="text-xs font-semibold text-red-700 mb-1.5">❓ Tại sao có đơn chưa giao được?</div>
                          <ul className="text-xs text-red-600 space-y-1">
                            {reasons.map((r, i) => <li key={i}>• {r}</li>)}
                          </ul>
                          <div className="mt-2 text-xs text-gray-500">
                            👉 <strong>Giải pháp:</strong> Thêm xe ở Bước 2, bớt/tách đơn ở Bước 3, hoặc dời sang ngày khác.
                          </div>
                        </div>
                      )
                    })()}
                    <div className="text-xs text-red-600 mb-3">
                      Các đơn hàng này không thể xếp vào xe do vượt tải trọng hoặc giới hạn thời gian.
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <button onClick={() => { setStep(1); }}
                        className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 transition">
                        <Truck className="w-4 h-4 inline mr-1" /> Quay bước 2 — Thêm xe
                      </button>
                      <button onClick={() => { setStep(2); }}
                        className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 transition">
                        <Package className="w-4 h-4 inline mr-1" /> Quay bước 3 — Bớt đơn hàng
                      </button>
                      <button onClick={() => { setVrpResult(null); setJobId(''); setSavedJobId('') }}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition">
                        <RefreshCw className="w-4 h-4 inline mr-1" /> Tối ưu lại
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
                <h3 className="font-semibold text-blue-800 text-sm mb-2"> Hướng dẫn điều chỉnh</h3>
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
                  <h3 className="font-semibold text-gray-800 text-sm"><Save className="w-4 h-4 inline mr-1" /> Lưu & So sánh phương án</h3>
                  <button onClick={() => setShowScenarios(!showScenarios)}
                    className="text-xs text-blue-600 hover:text-blue-800">
                    {showScenarios ? 'Ẩn lịch sử' : `Xem lịch sử (${savedScenarios.length})`}
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
                    {savingScenario ? 'Đang lưu...' : savedJobId === jobId ? 'Đã lưu' : '<Save className="w-4 h-4 inline mr-1" /> Lưu phương án'}
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
                        <h4 className="text-xs font-semibold text-gray-600 mb-3">Biểu đồ Pareto: Chi phí ↔ Mức phục vụ</h4>
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
                          <strong> Gợi ý:</strong>
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
                            {((trip.total_cost_vnd ?? 0) / 1000).toFixed(0)}K
                            <span className="text-[10px] text-green-500 font-normal">
                              (fuel: ${((trip.fuel_cost_vnd ?? 0)/1000).toFixed(0)}K + BOT: ${((trip.toll_cost_vnd ?? 0)/1000).toFixed(0)}K)
                            </span>
                          </span>
                        )}
                        <button onClick={() => setSelectedTripIdx(tripIdx)}
                          className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-xs font-medium">
                          <MapIcon className="w-4 h-4 inline mr-1" /> Xem bản đồ
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
                              <span className="flex items-center gap-1 flex-wrap">
                                {stop.customer_name}
                                {stop.consolidated_ids && stop.consolidated_ids.length > 1 && (
                                  <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-purple-100 text-purple-700">×{stop.consolidated_ids.length}</span>
                                )}
                                {stop.is_split && (
                                  <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-orange-100 text-orange-700">P{stop.split_part}/{stop.split_total}</span>
                                )}
                                <VRPConstraintChips c={vrpConstraintsMap[stop.customer_id]} />
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
                  <RefreshCw className="w-4 h-4 inline mr-1" /> Tối ưu lại từ đầu
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
              <div className="flex items-center justify-center mb-4"><PartyPopper className="w-12 h-12 text-amber-500" /></div>
              <h2 className="text-xl font-bold text-green-800 mb-2">Kế hoạch đã được duyệt!</h2>
              <p className="text-green-600 mb-4">
                Đã tạo thành công <strong>{vrpResult.trips.length} chuyến xe</strong> cho ngày {deliveryDate}.
              </p>
              <a href="/dashboard/trips" className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">
                <ClipboardList className="w-4 h-4 inline mr-1" /> Xem danh sách chuyến xe
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
                          <AlertTriangle className="w-4 h-4 inline mr-1" /> Còn {notCheckedIn} tài xế chưa check-in. Tài xế đã check-in sẽ hiện ưu tiên đầu danh sách.
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
                                label: checkedInIds.has(d.id) ? `${d.full_name}` : d.full_name,
                                sublabel: d.phone || ''
                              }))
                          })()}
                          value={assignedDriverId || ''}
                          onChange={val => setDriverAssign({ ...driverAssign, [trip.vehicle_id]: val })}
                          placeholder=" Chọn tài xế..."
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
                    <AlertTriangle className="w-4 h-4 inline mr-1" /> Còn {vrpResult.trips.length - Object.values(driverAssign).filter(Boolean).length} chuyến chưa gán tài xế. Bạn vẫn có thể duyệt và gán sau.
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
                    ) : 'Duyệt kế hoạch & Tạo chuyến xe'}
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
          vrpConstraintsMap={vrpConstraintsMap}
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
                  const usedDrivers: Record<string, boolean> = {}
                  result.trips.forEach((t) => {
                    const vehicle = vehicles.find(v => v.id === t.vehicle_id)
                    if (vehicle?.default_driver_id) {
                      const dd = drivers.find(d => d.id === vehicle.default_driver_id)
                      if (dd && dd.status === 'active') { init[t.vehicle_id] = dd.id; usedDrivers[dd.id] = true }
                    }
                  })
                  let di = 0
                  result.trips.forEach((t) => {
                    if (!init[t.vehicle_id]) {
                      while (di < drivers.length && usedDrivers[drivers[di].id]) di++
                      if (di < drivers.length) { init[t.vehicle_id] = drivers[di].id; usedDrivers[drivers[di].id] = true; di++ }
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
