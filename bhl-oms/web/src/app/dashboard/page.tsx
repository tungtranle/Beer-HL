'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, getUser } from '@/lib/api'

interface Stats {
  total_orders: number
  pending_shipments: number
  active_trips: number
  total_products: number
  total_customers: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const router = useRouter()

  useEffect(() => {
    const user = getUser()
    if (user?.role === 'driver') {
      router.replace('/dashboard/driver')
      return
    }
    apiFetch<any>('/dashboard/stats')
      .then((res) => setStats(res.data))
      .catch(console.error)
  }, [router])

  const cards = [
    { label: 'Tổng đơn hàng', value: stats?.total_orders ?? '-', icon: '📋', color: 'bg-blue-500' },
    { label: 'Shipments chờ', value: stats?.pending_shipments ?? '-', icon: '📦', color: 'bg-amber-500' },
    { label: 'Trips đang chạy', value: stats?.active_trips ?? '-', icon: '🚛', color: 'bg-green-500' },
    { label: 'Sản phẩm', value: stats?.total_products ?? '-', icon: '🍺', color: 'bg-purple-500' },
    { label: 'Khách hàng (NPP)', value: stats?.total_customers ?? '-', icon: '🏪', color: 'bg-indigo-500' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
              </div>
              <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center text-xl`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Demo Flow</h2>
        <div className="flex items-center gap-3 text-sm">
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">1. Tạo đơn hàng</span>
          <span className="text-gray-400">→</span>
          <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full">2. Kiểm tra ATP</span>
          <span className="text-gray-400">→</span>
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">3. Chạy VRP</span>
          <span className="text-gray-400">→</span>
          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">4. Xem Trips + Bản đồ</span>
        </div>
      </div>
    </div>
  )
}
