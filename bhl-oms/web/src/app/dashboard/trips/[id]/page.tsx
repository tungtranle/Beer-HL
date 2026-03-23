'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { toast } from '@/lib/useToast'

interface TripStop {
  id: string; stop_order: number; shipment_id: string
  customer_name: string; customer_address: string
  latitude: number; longitude: number; status: string
  estimated_arrival: string; estimated_departure: string
  cumulative_load_kg: number
}

interface TripDetail {
  id: string; trip_number: string; vehicle_plate: string; driver_name: string
  driver_phone: string; warehouse_name: string; warehouse_lat: number; warehouse_lng: number
  status: string; total_distance_km: number; total_weight_kg: number
  planned_date: string; created_at: string; total_stops: number
  stops: TripStop[]
}

const statusLabels: Record<string, string> = {
  planned: 'Đã lên kế hoạch', assigned: 'Đã phân công', ready: 'Sẵn sàng',
  in_transit: 'Đang giao', completed: 'Hoàn thành', cancelled: 'Đã hủy',
}

const stopStatusLabels: Record<string, string> = {
  pending: 'Chờ', arrived: 'Đã đến', delivering: 'Đang giao',
  delivered: 'Đã giao', failed: 'Thất bại', skipped: 'Bỏ qua',
}

const tripActions: Record<string, { label: string; next: string; color: string }[]> = {
  planned:   [{ label: 'Bắt đầu giao', next: 'in_transit', color: 'bg-yellow-500 hover:bg-yellow-600' },
              { label: 'Hủy chuyến', next: 'cancelled', color: 'bg-red-500 hover:bg-red-600' }],
  assigned:  [{ label: 'Bắt đầu giao', next: 'in_transit', color: 'bg-yellow-500 hover:bg-yellow-600' },
              { label: 'Hủy chuyến', next: 'cancelled', color: 'bg-red-500 hover:bg-red-600' }],
  ready:     [{ label: 'Bắt đầu giao', next: 'in_transit', color: 'bg-yellow-500 hover:bg-yellow-600' },
              { label: 'Hủy chuyến', next: 'cancelled', color: 'bg-red-500 hover:bg-red-600' }],
  in_transit:[{ label: 'Hoàn thành chuyến', next: 'completed', color: 'bg-green-500 hover:bg-green-600' },
              { label: 'Hủy chuyến', next: 'cancelled', color: 'bg-red-500 hover:bg-red-600' }],
}

const stopActions: Record<string, { label: string; action: string; color: string }[]> = {
  pending:  [{ label: 'Đã đến', action: 'arrive', color: 'text-blue-600 hover:text-blue-800' },
             { label: 'Bỏ qua', action: 'skip', color: 'text-gray-500 hover:text-gray-700' }],
  arrived:  [{ label: 'Đã giao', action: 'deliver', color: 'text-green-600 hover:text-green-800' },
             { label: 'Thất bại', action: 'fail', color: 'text-red-600 hover:text-red-800' }],
}

export default function TripDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [trip, setTrip] = useState<TripDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

  // Cancel trip modal state
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelNote, setCancelNote] = useState('')

  const cancelReasons = [
    'Khách hàng yêu cầu hủy',
    'Xe gặp sự cố kỹ thuật',
    'Tài xế không khả dụng',
    'Thời tiết xấu, không thể giao',
    'Đường bị tắc / không thể đi',
    'Lý do khác',
  ]

  const loadTrip = useCallback(() => {
    apiFetch<any>(`/trips/${params.id}`)
      .then((r) => setTrip(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [params.id])

  useEffect(() => { loadTrip() }, [loadTrip])

  const updateTripStatus = async (newStatus: string) => {
    if (!trip) return
    if (newStatus === 'cancelled') {
      setShowCancelModal(true)
      return
    }
    setUpdating(true)
    try {
      const r = await apiFetch<any>(`/trips/${trip.id}/status`, { method: 'PUT', body: { status: newStatus } })
      setTrip(r.data)
    } catch (e: any) {
      toast.error(e.message || 'Cập nhật thất bại')
    } finally {
      setUpdating(false)
    }
  }

  const confirmCancelTrip = async () => {
    if (!trip || !cancelReason) return
    setUpdating(true)
    setShowCancelModal(false)
    try {
      const reason = cancelReason === 'Lý do khác' && cancelNote ? cancelNote : cancelReason
      const r = await apiFetch<any>(`/trips/${trip.id}/status`, {
        method: 'PUT',
        body: { status: 'cancelled', reason }
      })
      setTrip(r.data)
    } catch (e: any) {
      toast.error(e.message || 'Hủy chuyến thất bại')
    } finally {
      setUpdating(false)
      setCancelReason('')
      setCancelNote('')
    }
  }

  const updateStopStatus = async (stopId: string, action: string) => {
    if (!trip) return
    setUpdating(true)
    try {
      const r = await apiFetch<any>(`/trips/${trip.id}/stops/${stopId}/status`, { method: 'PUT', body: { action } })
      setTrip(r.data)
    } catch (e: any) {
      toast.error(e.message || 'Cập nhật thất bại')
    } finally {
      setUpdating(false)
    }
  }

  // Initialize Leaflet map
  useEffect(() => {
    if (!trip || !mapRef.current) return
    let cancelled = false

    // Dynamic import Leaflet (client-side only)
    import('leaflet').then((L) => {
      if (cancelled || !mapRef.current) return

      // Cleanup any existing map on this container
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }

      // Fix default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current!, { zoomControl: true })
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map)

      const bounds: [number, number][] = []

      // Depot marker (warehouse)
      if (trip.warehouse_lat && trip.warehouse_lng) {
        const depotIcon = L.divIcon({
          html: '<div style="background:#d97706;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">🏭</div>',
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })
        L.marker([trip.warehouse_lat, trip.warehouse_lng], { icon: depotIcon })
          .addTo(map)
          .bindPopup(`<b>Kho: ${trip.warehouse_name}</b><br/>Điểm xuất phát`)
        bounds.push([trip.warehouse_lat, trip.warehouse_lng])
      }

      // Stop markers
      const routeCoords: [number, number][] = []
      if (trip.warehouse_lat && trip.warehouse_lng) {
        routeCoords.push([trip.warehouse_lat, trip.warehouse_lng])
      }

      trip.stops?.forEach((stop) => {
        if (!stop.latitude || !stop.longitude) return

        const stopIcon = L.divIcon({
          html: `<div style="background:#2563eb;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${stop.stop_order}</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        })

        L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
          .addTo(map)
          .bindPopup(
            `<b>#${stop.stop_order} ${stop.customer_name}</b><br/>${stop.customer_address}<br/>Tải: ${stop.cumulative_load_kg?.toFixed(0)} kg<br/>TT: ${stopStatusLabels[stop.status] || stop.status}`
          )

        bounds.push([stop.latitude, stop.longitude])
        routeCoords.push([stop.latitude, stop.longitude])
      })

      // Return to depot
      if (trip.warehouse_lat && trip.warehouse_lng) {
        routeCoords.push([trip.warehouse_lat, trip.warehouse_lng])
      }

      // Draw route using OSRM road routing
      if (routeCoords.length > 1) {
        const coords = routeCoords.map(([lat, lng]) => `${lng},${lat}`).join(';')
        fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`)
          .then(res => res.json())
          .then(data => {
            if (data.code === 'Ok' && data.routes?.[0]?.geometry) {
              const geoCoords = data.routes[0].geometry.coordinates.map(
                (c: [number, number]) => [c[1], c[0]] as [number, number]
              )
              L.polyline(geoCoords, {
                color: '#2563eb', weight: 4, opacity: 0.8,
              }).addTo(map)
            } else {
              // Fallback: straight dashed lines if OSRM fails
              L.polyline(routeCoords, {
                color: '#2563eb', weight: 3, opacity: 0.7, dashArray: '8, 8',
              }).addTo(map)
            }
          })
          .catch(() => {
            L.polyline(routeCoords, {
              color: '#2563eb', weight: 3, opacity: 0.7, dashArray: '8, 8',
            }).addTo(map)
          })
      }

      // Fit bounds
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40] })
      } else {
        map.setView([20.95, 107.05], 12) // Default: Quảng Ninh area
      }
    })

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [trip])

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div></div>
  if (!trip) return <div className="text-center py-20 text-gray-500">Không tìm thấy chuyến xe</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-1">
            ← Quay lại
          </button>
          <h1 className="text-2xl font-bold text-gray-800">{trip.trip_number}</h1>
        </div>
        <div className="flex items-center gap-3">
          {tripActions[trip.status]?.map((act) => (
            <button
              key={act.next}
              onClick={() => updateTripStatus(act.next)}
              disabled={updating}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition ${act.color} disabled:opacity-50`}
            >
              {updating ? '...' : act.label}
            </button>
          ))}
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            trip.status === 'completed' ? 'bg-green-100 text-green-700' :
            trip.status === 'in_transit' ? 'bg-yellow-100 text-yellow-700' :
            trip.status === 'cancelled' ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {statusLabels[trip.status] || trip.status}
          </span>
        </div>
      </div>

      {/* Trip info */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold mb-3">Thông tin chuyến</h2>
          <div className="space-y-2 text-sm">
            <div><span className="text-gray-500">Xe:</span> <strong>{trip.vehicle_plate}</strong></div>
            <div><span className="text-gray-500">Tài xế:</span> <strong>{trip.driver_name || '-'}</strong> {trip.driver_phone && <span className="text-gray-400">({trip.driver_phone})</span>}</div>
            <div><span className="text-gray-500">Kho xuất:</span> <strong>{trip.warehouse_name}</strong></div>
            <div><span className="text-gray-500">Ngày giao:</span> <strong>{new Date(trip.planned_date).toLocaleDateString('vi-VN')}</strong></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold mb-3">Tổng quan</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-amber-700">{trip.stops?.length || 0}</div>
              <div className="text-xs text-gray-500">Điểm giao</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-700">{trip.total_distance_km?.toFixed(1)}</div>
              <div className="text-xs text-gray-500">km</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-700">{trip.total_weight_kg?.toFixed(0)}</div>
              <div className="text-xs text-gray-500">kg</div>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <h2 className="font-semibold mb-3">Bản đồ tuyến đường</h2>
        <div ref={mapRef} className="w-full h-[450px] rounded-lg border" />
      </div>

      {/* Stops table */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold mb-3">Lịch trình điểm giao ({trip.stops?.length || 0} điểm)</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-center py-2 px-3 w-10">#</th>
              <th className="text-left py-2 px-3">Khách hàng</th>
              <th className="text-left py-2 px-3">Địa chỉ</th>
              <th className="text-right py-2 px-3">Tải (kg)</th>
              <th className="text-center py-2 px-3">Trạng thái</th>
              {trip.status === 'in_transit' && <th className="text-center py-2 px-3">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {trip.stops?.map((stop) => (
              <tr key={stop.id} className="border-t">
                <td className="py-2 px-3 text-center font-bold text-blue-600">{stop.stop_order}</td>
                <td className="py-2 px-3">
                  <div className="font-medium">{stop.customer_name}</div>
                </td>
                <td className="py-2 px-3 text-gray-500">{stop.customer_address}</td>
                <td className="py-2 px-3 text-right">{stop.cumulative_load_kg?.toFixed(0)}</td>
                <td className="py-2 px-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    stop.status === 'delivered' ? 'bg-green-100 text-green-700' :
                    stop.status === 'arrived' ? 'bg-blue-100 text-blue-700' :
                    stop.status === 'failed' ? 'bg-red-100 text-red-700' :
                    stop.status === 'skipped' ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {stopStatusLabels[stop.status] || stop.status}
                  </span>
                </td>
                {trip.status === 'in_transit' && (
                  <td className="py-2 px-3 text-center">
                    <div className="flex justify-center gap-2">
                      {stopActions[stop.status]?.map((act) => (
                        <button
                          key={act.action}
                          onClick={() => updateStopStatus(stop.id, act.action)}
                          disabled={updating}
                          className={`text-xs font-medium ${act.color} disabled:opacity-50`}
                        >
                          {act.label}
                        </button>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
