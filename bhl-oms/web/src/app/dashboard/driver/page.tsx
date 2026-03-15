'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch, getUser } from '@/lib/api'

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
}

const statusColors: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700',
  assigned: 'bg-blue-100 text-blue-700',
  ready: 'bg-indigo-100 text-indigo-700',
  in_transit: 'bg-amber-100 text-amber-700 animate-pulse',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  draft: 'Nháp',
  planned: 'Đã lập kế hoạch',
  assigned: 'Đã phân công',
  ready: 'Sẵn sàng',
  in_transit: 'Đang giao hàng',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

export default function DriverPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const user = getUser()

  const loadTrips = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/driver/my-trips')
      setTrips(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTrips() }, [])

  const activeTrips = trips.filter(t => t.status === 'in_transit' || t.status === 'planned' || t.status === 'assigned' || t.status === 'ready')
  const completedTrips = trips.filter(t => t.status === 'completed' || t.status === 'cancelled')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-lg">Đang tải...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🚚 Chuyến xe của tôi</h1>
        <p className="text-gray-500 mt-1">Xin chào, {user?.full_name}</p>
      </div>

      {/* Active Trips */}
      {activeTrips.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">📍 Đang hoạt động</h2>
          <div className="space-y-3">
            {activeTrips.map(trip => (
              <Link key={trip.id} href={`/dashboard/driver/${trip.id}`}>
                <div className="bg-white rounded-xl shadow-sm border-2 border-amber-200 p-4 hover:shadow-md transition cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-900">{trip.trip_number}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[trip.status] || 'bg-gray-100'}`}>
                      {statusLabels[trip.status] || trip.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>🚗 {trip.vehicle_plate}</div>
                    <div>📅 {trip.planned_date}</div>
                    <div>📍 {trip.total_stops} điểm giao</div>
                    <div>📏 {trip.total_distance_km.toFixed(1)} km</div>
                    <div>⚖️ {trip.total_weight_kg.toFixed(0)} kg</div>
                    <div>⏱️ ~{trip.total_duration_min} phút</div>
                  </div>
                  {trip.status === 'in_transit' && (
                    <div className="mt-3 bg-amber-50 text-amber-700 text-center py-2 rounded-lg text-sm font-medium">
                      Nhấn để tiếp tục giao hàng →
                    </div>
                  )}
                  {(trip.status === 'planned' || trip.status === 'assigned' || trip.status === 'ready') && (
                    <div className="mt-3 bg-blue-50 text-blue-700 text-center py-2 rounded-lg text-sm font-medium">
                      Nhấn để bắt đầu chuyến xe →
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {activeTrips.length === 0 && (
        <div className="bg-green-50 rounded-xl p-8 text-center mb-8">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-green-700 font-medium">Không có chuyến xe nào đang hoạt động</p>
          <p className="text-green-600 text-sm mt-1">Bạn đã hoàn thành tất cả chuyến xe được phân công</p>
        </div>
      )}

      {/* Completed Trips */}
      {completedTrips.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">✅ Đã hoàn thành ({completedTrips.length})</h2>
          <div className="space-y-2">
            {completedTrips.map(trip => (
              <Link key={trip.id} href={`/dashboard/driver/${trip.id}`}>
                <div className="bg-white rounded-lg shadow-sm border p-3 hover:shadow-md transition cursor-pointer opacity-75">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-700">{trip.trip_number}</span>
                      <span className="text-sm text-gray-400 ml-2">{trip.planned_date}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[trip.status] || 'bg-gray-100'}`}>
                      {statusLabels[trip.status] || trip.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {trip.total_stops} điểm · {trip.total_distance_km.toFixed(1)} km · {trip.vehicle_plate}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
