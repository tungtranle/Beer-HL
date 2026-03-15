'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch, getUser } from '@/lib/api'

interface Trip {
  id: string; trip_number: string; vehicle_plate: string; driver_name: string
  status: string; total_distance_km: number; total_weight_kg: number
  total_stops: number; planned_date: string; created_at: string
}

const statusLabels: Record<string, string> = {
  planned: 'Đã lên kế hoạch', assigned: 'Đã phân công', in_transit: 'Đang giao',
  completed: 'Hoàn thành', cancelled: 'Đã hủy',
}

const statusColors: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700', assigned: 'bg-indigo-100 text-indigo-700',
  in_transit: 'bg-yellow-100 text-yellow-700', completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (filter) params.set('status', filter)

    apiFetch<any>(`/trips?${params}`)
      .then((r) => setTrips(r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filter])

  const filters = [
    { label: 'Tất cả', value: '' },
    { label: 'Đã lên KH', value: 'planned' },
    { label: 'Đã phân công', value: 'assigned' },
    { label: 'Đang giao', value: 'in_transit' },
    { label: 'Hoàn thành', value: 'completed' },
  ]

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600"></div></div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Quản lý Chuyến xe</h1>

      <div className="flex gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              filter === f.value ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {trips.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400">
          Chưa có chuyến xe. Tạo chuyến từ trang <Link href="/dashboard/planning" className="text-amber-600 underline">Lập kế hoạch</Link>.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4">Mã chuyến</th>
                <th className="text-left py-3 px-4">Xe</th>
                <th className="text-left py-3 px-4">Tài xế</th>
                <th className="text-center py-3 px-4">Điểm giao</th>
                <th className="text-right py-3 px-4">Quãng đường</th>
                <th className="text-right py-3 px-4">Tải trọng</th>
                <th className="text-center py-3 px-4">Trạng thái</th>
                <th className="text-center py-3 px-4">Ngày giao</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.id} className="border-t hover:bg-gray-50 transition">
                  <td className="py-2.5 px-4 font-mono font-medium">{t.trip_number}</td>
                  <td className="py-2.5 px-4">{t.vehicle_plate}</td>
                  <td className="py-2.5 px-4">{t.driver_name || '-'}</td>
                  <td className="py-2.5 px-4 text-center">{t.total_stops}</td>
                  <td className="py-2.5 px-4 text-right">{t.total_distance_km?.toFixed(1)} km</td>
                  <td className="py-2.5 px-4 text-right">{t.total_weight_kg?.toFixed(0)} kg</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[t.status] || 'bg-gray-100'}`}>
                      {statusLabels[t.status] || t.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-center text-gray-500">
                    {new Date(t.planned_date).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="py-2.5 px-4">
                    <Link href={`/dashboard/trips/${t.id}`} className="text-amber-600 hover:underline text-sm">
                      Chi tiết →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
