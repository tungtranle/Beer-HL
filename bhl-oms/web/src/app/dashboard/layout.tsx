'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getToken, getUser, clearAuth } from '@/lib/api'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'dispatcher', 'dvkh', 'accountant'] },
  { href: '/dashboard/orders', label: 'Đơn hàng', icon: '📋', roles: ['admin', 'dispatcher', 'dvkh', 'accountant'] },
  { href: '/dashboard/orders/new', label: 'Tạo đơn hàng', icon: '➕', roles: ['admin', 'dispatcher', 'dvkh'] },
  { href: '/dashboard/planning', label: 'Lập kế hoạch', icon: '🗺️', roles: ['admin', 'dispatcher'] },
  { href: '/dashboard/trips', label: 'Chuyến xe', icon: '🚛', roles: ['admin', 'dispatcher'] },
  { href: '/dashboard/map', label: 'Bản đồ GPS', icon: '🗺️', roles: ['admin', 'dispatcher'] },
  { href: '/dashboard/driver', label: 'Chuyến xe của tôi', icon: '🚚', roles: ['driver'] },
  { href: '/dashboard/products', label: 'Sản phẩm', icon: '📦', roles: ['admin', 'dispatcher', 'dvkh'] },
  { href: '/dashboard/customers', label: 'Khách hàng', icon: '🏪', roles: ['admin', 'dispatcher', 'dvkh'] },
  { href: '/dashboard/vehicles', label: 'Phương tiện', icon: '🚗', roles: ['admin', 'dispatcher'] },
  { href: '/dashboard/drivers-list', label: 'Tài xế', icon: '👤', roles: ['admin', 'dispatcher'] },
  { href: '/dashboard/pda-scanner', label: 'Quét barcode', icon: '📱', roles: ['admin', 'dispatcher', 'warehouse'] },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login')
      return
    }
    setUser(getUser())
  }, [router])

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  const roleLabels: Record<string, string> = {
    admin: 'Quản trị viên',
    dvkh: 'Dịch vụ KH',
    dispatcher: 'Điều phối viên',
    accountant: 'Kế toán',
    driver: 'Tài xế',
  }

  if (!user) return null

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold text-amber-400">🍺 BHL System</h1>
          <p className="text-xs text-gray-400 mt-1">OMS - TMS - WMS</p>
        </div>

        <nav className="flex-1 py-4">
          {navItems
            .filter((item) => !item.roles || item.roles.includes(user?.role))
            .map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                  isActive
                    ? 'bg-amber-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <div className="text-sm">
            <p className="font-medium">{user.full_name}</p>
            <p className="text-xs text-gray-400">{roleLabels[user.role] || user.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full text-left text-sm text-gray-400 hover:text-red-400 transition"
          >
            🚪 Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
