'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { apiFetch, getUser } from '@/lib/api'
import { toast } from '@/lib/useToast'
import { useGpsTracker } from '@/lib/useGpsTracker'
import { useOfflineSync } from '@/lib/useOfflineSync'
import { useOnlineStatus } from '@/lib/useOnlineStatus'

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

const statusColors: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700',
  assigned: 'bg-blue-100 text-blue-700',
  ready: 'bg-indigo-100 text-indigo-700',
  in_transit: 'bg-amber-100 text-amber-700',
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
  const [checkinStatus, setCheckinStatus] = useState<string>('loading')
  const [checkinLoading, setCheckinLoading] = useState(false)
  const checkinRef = useRef(false)
  const user = getUser()

  // Start GPS tracking for driver
  useGpsTracker()
  // Start offline sync worker
  useOfflineSync()
  const isOnline = useOnlineStatus()

  // PWA install prompt
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
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTrips() }, [])

  // Load check-in status
  useEffect(() => {
    apiFetch<any>('/driver/checkin')
      .then(r => setCheckinStatus(r.data?.status || 'not_checked_in'))
      .catch(() => setCheckinStatus('not_checked_in'))
  }, [])

  const handleCheckin = async (status: string, reason?: string) => {
    if (checkinRef.current) return
    checkinRef.current = true
    setCheckinLoading(true)
    try {
      const body: any = { status }
      if (reason) body.reason = reason
      await apiFetch('/driver/checkin', { method: 'POST', body })
      setCheckinStatus(status)
      toast.success(status === 'available' ? 'Đã check-in sẵn sàng' : 'Đã báo nghỉ')
    } catch (err: any) {
      checkinRef.current = false
      toast.error(err.message)
    } finally {
      setCheckinLoading(false)
      checkinRef.current = false
    }
  }

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
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-red-500 text-white text-center text-sm py-2 rounded-lg mb-4 sticky top-0 z-50">
          📡 Bạn đang offline — dữ liệu sẽ tự đồng bộ khi có mạng
        </div>
      )}

      {/* PWA Install Prompt */}
      {installPrompt && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 mb-4 flex items-center gap-3">
          <span className="text-2xl">📲</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-brand-700">Cài đặt ứng dụng BHL</p>
            <p className="text-xs text-brand-500">Truy cập nhanh hơn, hoạt động offline</p>
          </div>
          <button onClick={() => { installPrompt.prompt(); setInstallPrompt(null) }}
            className="px-3 py-1.5 bg-brand-500 text-white text-sm rounded-lg font-medium hover:bg-brand-600">
            Cài đặt
          </button>
          <button onClick={() => setInstallPrompt(null)} className="text-brand-400 hover:text-brand-600">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🚚 Chuyến xe của tôi</h1>
          <p className="text-gray-500 mt-1">Xin chào, {user?.full_name}</p>
        </div>
        <Link href="/dashboard/driver/profile" className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 hover:bg-blue-200 transition">
          👤
        </Link>
      </div>

      {/* Check-in Banner */}
      {checkinStatus !== 'loading' && (
        <div className={`rounded-xl p-4 mb-6 ${
          checkinStatus === 'available' ? 'bg-green-50 border-2 border-green-200' :
          checkinStatus === 'off_duty' ? 'bg-red-50 border-2 border-red-200' :
          'bg-yellow-50 border-2 border-yellow-300'
        }`}>
          {checkinStatus === 'not_checked_in' && (
            <div className="text-center">
              <p className="text-yellow-800 font-medium mb-3">🔔 Bạn chưa check-in hôm nay</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => handleCheckin('available')} disabled={checkinLoading}
                  className="px-6 h-14 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50">
                  ✅ Sẵn sàng nhận chuyến
                </button>
                <button onClick={() => handleCheckin('off_duty', 'personal')} disabled={checkinLoading}
                  className="px-6 h-12 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium disabled:opacity-50">
                  🔴 Hôm nay nghỉ
                </button>
              </div>
            </div>
          )}
          {checkinStatus === 'available' && (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-green-800 font-medium">✅ Đã check-in — Sẵn sàng nhận chuyến</span>
                <span className="text-green-600 text-sm ml-2">({new Date().toLocaleDateString('vi-VN')})</span>
              </div>
              <button onClick={() => handleCheckin('off_duty', 'personal')} disabled={checkinLoading}
                className="px-3 h-12 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50">
                Báo nghỉ
              </button>
            </div>
          )}
          {checkinStatus === 'off_duty' && (
            <div className="flex items-center justify-between">
              <span className="text-red-800 font-medium">🔴 Hôm nay nghỉ</span>
              <button onClick={() => handleCheckin('available')} disabled={checkinLoading}
                className="px-3 h-12 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50">
                Đổi sang sẵn sàng
              </button>
            </div>
          )}
        </div>
      )}

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
                  {/* Progress bar for in-transit trips */}
                  {trip.status === 'in_transit' && trip.completed_stops !== undefined && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Tiến độ: {trip.completed_stops}/{trip.total_stops} điểm</span>
                        <span>{trip.total_stops > 0 ? Math.round(trip.completed_stops / trip.total_stops * 100) : 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${trip.total_stops > 0 ? trip.completed_stops / trip.total_stops * 100 : 0}%` }} />
                      </div>
                    </div>
                  )}
                  {trip.status === 'in_transit' && trip.next_stop_customer && (
                    <div className="mt-2 bg-blue-50 rounded-lg p-2 text-xs text-blue-700">
                      <span className="font-medium">Điểm tiếp theo:</span> {trip.next_stop_customer}
                      {trip.next_stop_address && <span className="text-blue-500"> · {trip.next_stop_address}</span>}
                    </div>
                  )}
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
          <p className="text-green-700 font-medium">Chưa có chuyến hôm nay</p>
          <p className="text-green-600 text-sm mt-1">Liên hệ điều phối viên nếu bạn được phân công nhưng chưa thấy chuyến</p>
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
