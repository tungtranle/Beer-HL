'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch, getUser } from '@/lib/api'

interface Stop {
  id: string
  customer_name: string
  customer_address: string
  stop_order: number
  status: string
  order_number: string
  order_amount: number
  order_items: { product_name: string; quantity: number; unit_price: number }[]
  actual_arrival: string | null
  actual_departure: string | null
}

interface Checklist {
  id: string
  tires_ok: boolean
  brakes_ok: boolean
  lights_ok: boolean
  mirrors_ok: boolean
  horn_ok: boolean
  coolant_ok: boolean
  oil_ok: boolean
  fuel_level: number
  fire_extinguisher_ok: boolean
  first_aid_ok: boolean
  documents_ok: boolean
  cargo_secured: boolean
  is_passed: boolean
  notes: string | null
}

interface TripDetail {
  id: string
  trip_number: string
  status: string
  planned_date: string
  vehicle_plate: string
  warehouse_name: string
  total_stops: number
  total_weight_kg: number
  total_distance_km: number
  total_duration_min: number
  started_at: string | null
  completed_at: string | null
  stops: Stop[]
  checklist: Checklist | null
}

const statusColors: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700',
  assigned: 'bg-blue-100 text-blue-700',
  pre_check: 'bg-purple-100 text-purple-700',
  ready: 'bg-indigo-100 text-indigo-700',
  in_transit: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  planned: 'Đã lập kế hoạch', assigned: 'Đã phân công', pre_check: 'Kiểm tra xe',
  ready: 'Sẵn sàng', in_transit: 'Đang giao hàng', completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

const stopStatusLabels: Record<string, string> = {
  pending: 'Chờ giao', arrived: 'Đã đến', delivering: 'Đang giao',
  delivered: 'Đã giao', partially_delivered: 'Giao một phần', failed: 'Thất bại', skipped: 'Bỏ qua',
}

const stopStatusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700', arrived: 'bg-blue-100 text-blue-700',
  delivering: 'bg-amber-100 text-amber-700', delivered: 'bg-green-100 text-green-700',
  partially_delivered: 'bg-yellow-100 text-yellow-700', failed: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-500',
}

export default function DriverTripDetailPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.id as string
  const [trip, setTrip] = useState<TripDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const user = getUser()

  const loadTrip = async () => {
    try {
      const res: any = await apiFetch(`/trips/${tripId}`)
      setTrip(res.data)
    } catch { /* empty */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTrip() }, [tripId])

  const handleStartTrip = async () => {
    setActionLoading(true)
    try {
      await apiFetch(`/driver/trips/${tripId}/start`, { method: 'PUT' })
      await loadTrip()
    } catch (err) { console.error(err) }
    finally { setActionLoading(false) }
  }

  const handleCompleteTrip = async () => {
    setActionLoading(true)
    try {
      await apiFetch(`/driver/trips/${tripId}/complete`, { method: 'PUT' })
      await loadTrip()
    } catch (err) { console.error(err) }
    finally { setActionLoading(false) }
  }

  const handleUpdateStop = async (stopId: string, status: string) => {
    setActionLoading(true)
    try {
      await apiFetch(`/driver/trips/${tripId}/stops/${stopId}/update`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      await loadTrip()
    } catch (err) { console.error(err) }
    finally { setActionLoading(false) }
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
  }

  if (!trip) {
    return <div className="p-6 text-center text-red-500">Không tìm thấy chuyến xe</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/driver" className="text-2xl">←</Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{trip.trip_number}</h1>
          <p className="text-sm text-gray-500">{trip.vehicle_plate} · {trip.planned_date}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[trip.status] || 'bg-gray-100'}`}>
          {statusLabels[trip.status] || trip.status}
        </span>
      </div>

      {/* Trip Summary */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="text-lg font-bold text-blue-600">{trip.total_stops}</div>
          <div className="text-xs text-gray-500">Điểm giao</div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="text-lg font-bold text-orange-600">{trip.total_distance_km?.toFixed(1)}</div>
          <div className="text-xs text-gray-500">km</div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="text-lg font-bold text-purple-600">{trip.total_weight_kg?.toFixed(0)}</div>
          <div className="text-xs text-gray-500">kg</div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="text-lg font-bold text-green-600">{trip.total_duration_min}</div>
          <div className="text-xs text-gray-500">phút</div>
        </div>
      </div>

      {/* Action Buttons */}
      {(trip.status === 'assigned' || trip.status === 'ready') && (
        <button onClick={handleStartTrip} disabled={actionLoading}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
          {actionLoading ? 'Đang xử lý...' : '🚀 Bắt đầu chuyến xe'}
        </button>
      )}

      {trip.status === 'in_transit' && trip.stops?.every(s => s.status === 'delivered' || s.status === 'failed' || s.status === 'skipped') && (
        <button onClick={handleCompleteTrip} disabled={actionLoading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
          {actionLoading ? 'Đang xử lý...' : '✅ Hoàn thành chuyến xe'}
        </button>
      )}

      {/* Stops List */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Danh sách điểm giao ({trip.stops?.length || 0})</h2>
        <div className="space-y-3">
          {trip.stops?.sort((a, b) => a.stop_order - b.stop_order).map((stop) => (
            <div key={stop.id} className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                      {stop.stop_order}
                    </span>
                    <span className="font-medium">{stop.customer_name}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 ml-8">{stop.customer_address}</p>
                  {stop.order_number && (
                    <p className="text-sm text-gray-400 mt-1 ml-8">
                      Đơn: {stop.order_number} · {stop.order_amount?.toLocaleString('vi-VN')}đ
                    </p>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${stopStatusColors[stop.status] || 'bg-gray-100'}`}>
                  {stopStatusLabels[stop.status] || stop.status}
                </span>
              </div>

              {/* Order Items */}
              {stop.order_items && stop.order_items.length > 0 && (
                <div className="mt-2 ml-8 text-sm text-gray-600">
                  {stop.order_items.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{item.product_name}</span>
                      <span>×{item.quantity}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Stop Actions */}
              {trip.status === 'in_transit' && stop.status === 'pending' && (
                <div className="mt-3 ml-8 flex gap-2">
                  <button onClick={() => handleUpdateStop(stop.id, 'arrived')} disabled={actionLoading}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
                    📍 Đã đến
                  </button>
                </div>
              )}
              {trip.status === 'in_transit' && stop.status === 'arrived' && (
                <div className="mt-3 ml-8 flex gap-2">
                  <button onClick={() => handleUpdateStop(stop.id, 'delivered')} disabled={actionLoading}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50">
                    ✅ Đã giao
                  </button>
                  <button onClick={() => handleUpdateStop(stop.id, 'failed')} disabled={actionLoading}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50">
                    ❌ Thất bại
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Checklist Summary (if exists) */}
      {trip.checklist && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-2">Checklist xe</h2>
          <div className={`text-sm font-medium ${trip.checklist.is_passed ? 'text-green-600' : 'text-red-600'}`}>
            {trip.checklist.is_passed ? '✅ Đã kiểm tra - ĐẠT' : '❌ Kiểm tra - KHÔNG ĐẠT'}
          </div>
          <div className="grid grid-cols-2 gap-1 mt-2 text-sm text-gray-600">
            <div>{trip.checklist.tires_ok ? '✓' : '✗'} Lốp xe</div>
            <div>{trip.checklist.brakes_ok ? '✓' : '✗'} Phanh</div>
            <div>{trip.checklist.lights_ok ? '✓' : '✗'} Đèn</div>
            <div>{trip.checklist.mirrors_ok ? '✓' : '✗'} Gương</div>
            <div>{trip.checklist.horn_ok ? '✓' : '✗'} Còi</div>
            <div>{trip.checklist.documents_ok ? '✓' : '✗'} Giấy tờ</div>
            <div>{trip.checklist.cargo_secured ? '✓' : '✗'} Hàng hóa</div>
            <div>⛽ {trip.checklist.fuel_level}%</div>
          </div>
        </div>
      )}
    </div>
  )
}
