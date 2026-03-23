'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, getUser } from '@/lib/api'
import { formatVND } from '@/lib/status-config'

interface Stats {
  total_orders: number
  orders_today: number
  orders_confirmed: number
  pending_shipments: number
  active_trips: number
  completed_trips_today: number
  delivery_rate: number
  revenue_today: number
  pending_discrepancies: number
  pending_approvals: number
  total_products: number
  total_customers: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const router = useRouter()
  const [role, setRole] = useState<string>('')

  useEffect(() => {
    const user = getUser()
    if (user?.role === 'driver') {
      router.replace('/dashboard/driver')
      return
    }
    setRole(user?.role || '')
    apiFetch<any>('/dashboard/stats')
      .then((res) => setStats(res.data))
      .catch(console.error)
  }, [router])

  // formatVND imported from status-config (single source of truth)

  // Role-specific cards
  const getCards = () => {
    const base = [
      { label: 'Tổng đơn hàng', value: stats?.total_orders ?? '-', icon: '📋', color: 'bg-blue-500', href: '/dashboard/orders' },
    ]

    if (['admin', 'dispatcher'].includes(role)) {
      return [
        ...base,
        { label: 'Đơn chờ giao', value: stats?.pending_shipments ?? '-', icon: '📦', color: 'bg-amber-500', href: '/dashboard/orders?status=confirmed' },
        { label: 'Chuyến đang chạy', value: stats?.active_trips ?? '-', icon: '🚛', color: 'bg-green-500', href: '/dashboard/trips' },
        { label: 'Sản phẩm', value: stats?.total_products ?? '-', icon: '🍺', color: 'bg-purple-500', href: '/dashboard/products' },
        { label: 'Khách hàng (NPP)', value: stats?.total_customers ?? '-', icon: '🏪', color: 'bg-indigo-500', href: '/dashboard/customers' },
      ]
    }
    if (role === 'accountant') {
      return [
        ...base,
        { label: 'Đơn chờ duyệt', value: stats?.pending_approvals ?? '-', icon: '⏳', color: 'bg-orange-500', href: '/dashboard/approvals' },
        { label: 'Chuyến đang chạy', value: stats?.active_trips ?? '-', icon: '🚛', color: 'bg-green-500', href: '/dashboard/trips' },
        { label: 'Sai lệch chưa xử lý', value: stats?.pending_discrepancies ?? '-', icon: '⚠️', color: 'bg-red-500', href: '/dashboard/reconciliation' },
        { label: 'Doanh thu hôm nay', value: stats?.revenue_today ? formatVND(stats.revenue_today) : '0 ₫', icon: '💰', color: 'bg-emerald-500', href: '/dashboard/reconciliation/daily-close' },
      ]
    }
    if (role === 'dvkh') {
      return [
        ...base,
        { label: 'Đơn chờ giao', value: stats?.pending_shipments ?? '-', icon: '📦', color: 'bg-amber-500', href: '/dashboard/orders?status=confirmed' },
        { label: 'Sản phẩm', value: stats?.total_products ?? '-', icon: '🍺', color: 'bg-purple-500', href: '/dashboard/products' },
        { label: 'Khách hàng (NPP)', value: stats?.total_customers ?? '-', icon: '🏪', color: 'bg-indigo-500', href: '/dashboard/customers' },
      ]
    }
    if (role === 'management') {
      return [
        ...base,
        { label: 'Chuyến đang chạy', value: stats?.active_trips ?? '-', icon: '🚛', color: 'bg-green-500', href: '/dashboard/trips' },
        { label: 'Tỷ lệ giao', value: stats?.delivery_rate ? `${stats.delivery_rate.toFixed(1)}%` : '-', icon: '📊', color: 'bg-teal-500', href: '/dashboard/kpi' },
        { label: 'Sai lệch chưa xử lý', value: stats?.pending_discrepancies ?? '-', icon: '⚠️', color: 'bg-red-500', href: '/dashboard/reconciliation' },
        { label: 'Khách hàng (NPP)', value: stats?.total_customers ?? '-', icon: '🏪', color: 'bg-indigo-500', href: '/dashboard/customers' },
      ]
    }
    // Default (admin)
    return [
      ...base,
      { label: 'Đơn chờ giao', value: stats?.pending_shipments ?? '-', icon: '📦', color: 'bg-amber-500', href: '/dashboard/orders?status=confirmed' },
      { label: 'Chuyến đang chạy', value: stats?.active_trips ?? '-', icon: '🚛', color: 'bg-green-500', href: '/dashboard/trips' },
      { label: 'Sản phẩm', value: stats?.total_products ?? '-', icon: '🍺', color: 'bg-purple-500', href: '/dashboard/products' },
      { label: 'Khách hàng (NPP)', value: stats?.total_customers ?? '-', icon: '🏪', color: 'bg-indigo-500', href: '/dashboard/customers' },
    ]
  }

  const cards = getCards()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Tổng quan</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label}
            onClick={() => router.push(card.href)}
            className="bg-white rounded-xl shadow-sm p-5 cursor-pointer hover:shadow-md hover:ring-2 hover:ring-brand-200 transition">
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
        <h2 className="text-lg font-semibold mb-4">Quy trình nghiệp vụ</h2>
        <div className="flex items-center gap-3 text-sm">
          <span onClick={() => router.push('/dashboard/orders/new')}
            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full cursor-pointer hover:bg-blue-200 transition">1. Tạo đơn hàng</span>
          <span className="text-gray-400">→</span>
          <span onClick={() => router.push('/dashboard/orders/new')}
            className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full cursor-pointer hover:bg-amber-200 transition">2. Kiểm tra ATP</span>
          <span className="text-gray-400">→</span>
          <span onClick={() => router.push('/dashboard/planning')}
            className="px-3 py-1 bg-green-100 text-green-700 rounded-full cursor-pointer hover:bg-green-200 transition">3. Lập kế hoạch giao hàng</span>
          <span className="text-gray-400">→</span>
          <span onClick={() => router.push('/dashboard/trips')}
            className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full cursor-pointer hover:bg-purple-200 transition">4. Xem chuyến xe + Bản đồ</span>
        </div>
      </div>
    </div>
  )
}
