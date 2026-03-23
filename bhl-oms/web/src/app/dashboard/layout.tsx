'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getToken, getUser, clearAuth } from '@/lib/api'
import { NotificationProvider } from '@/lib/notifications'
import { NotificationBell } from '@/components/NotificationBell'
import { NotificationToast } from '@/components/NotificationToast'
import { ToastContainer } from '@/components/ui/ToastContainer'
import {
  LayoutDashboard, FileText, PlusCircle, CalendarDays, Truck, Radio,
  MapPin, Package, Users, Car, User, Warehouse, QrCode,
  ShieldCheck, CheckCircle2, Scale, FileBarChart, BarChart3, Bell,
  Settings, SlidersHorizontal, CreditCard, ScrollText, Navigation, Activity,
  Wrench, Search, LogOut, ChevronDown, PanelLeftClose, PanelLeft,
  type LucideIcon,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  roles: string[]
}

interface NavGroup {
  label: string | null
  items: NavItem[]
}

// ── Grouped Navigation ────────────────────────────

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard, roles: ['admin', 'dispatcher', 'dvkh', 'accountant', 'management'] },
      { href: '/dashboard/orders', label: 'Đơn hàng', icon: FileText, roles: ['admin', 'dispatcher', 'dvkh', 'accountant'] },
      { href: '/dashboard/orders/new', label: 'Tạo đơn hàng', icon: PlusCircle, roles: ['admin', 'dispatcher', 'dvkh'] },
      { href: '/dashboard/trips', label: 'Chuyến xe', icon: Truck, roles: ['admin', 'dispatcher'] },
    ],
  },
  {
    label: 'Điều phối',
    items: [
      { href: '/dashboard/planning', label: 'Lập kế hoạch', icon: CalendarDays, roles: ['admin', 'dispatcher'] },
      { href: '/dashboard/control-tower', label: 'Trung tâm điều phối', icon: Radio, roles: ['admin', 'dispatcher', 'management'] },
      { href: '/dashboard/map', label: 'Bản đồ GPS', icon: MapPin, roles: ['admin', 'dispatcher'] },
    ],
  },
  {
    label: 'Danh mục',
    items: [
      { href: '/dashboard/products', label: 'Sản phẩm', icon: Package, roles: ['admin', 'dispatcher', 'dvkh'] },
      { href: '/dashboard/customers', label: 'Khách hàng', icon: Users, roles: ['admin', 'dispatcher', 'dvkh'] },
      { href: '/dashboard/vehicles', label: 'Phương tiện', icon: Car, roles: ['admin', 'dispatcher'] },
      { href: '/dashboard/drivers-list', label: 'Tài xế', icon: User, roles: ['admin', 'dispatcher'] },
    ],
  },
  {
    label: 'Kho & Kiểm tra',
    items: [
      { href: '/dashboard/warehouse', label: 'Quản lý kho', icon: Warehouse, roles: ['admin', 'warehouse'] },
      { href: '/dashboard/pda-scanner', label: 'Quét barcode', icon: QrCode, roles: ['admin', 'dispatcher', 'warehouse'] },
      { href: '/dashboard/gate-check', label: 'Kiểm tra cổng', icon: ShieldCheck, roles: ['admin', 'warehouse', 'security'] },
      { href: '/dashboard/workshop', label: 'Phân xưởng vỏ', icon: Wrench, roles: ['admin', 'warehouse', 'workshop'] },
    ],
  },
  {
    label: 'Tài chính',
    items: [
      { href: '/dashboard/approvals', label: 'Duyệt đơn hàng', icon: CheckCircle2, roles: ['admin', 'accountant'] },
      { href: '/dashboard/reconciliation', label: 'Đối soát', icon: Scale, roles: ['admin', 'accountant'] },
      { href: '/dashboard/reconciliation/daily-close', label: 'Chốt sổ ngày', icon: FileBarChart, roles: ['admin', 'accountant'] },
      { href: '/dashboard/kpi', label: 'Báo cáo KPI', icon: BarChart3, roles: ['admin', 'management'] },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      { href: '/dashboard/settings', label: 'Quản trị hệ thống', icon: Settings, roles: ['admin'] },
      { href: '/dashboard/settings/configs', label: 'Cấu hình', icon: SlidersHorizontal, roles: ['admin'] },
      { href: '/dashboard/settings/credit-limits', label: 'Hạn mức tín dụng', icon: CreditCard, roles: ['admin'] },
      { href: '/dashboard/settings/audit-logs', label: 'Nhật ký hệ thống', icon: ScrollText, roles: ['admin'] },
      { href: '/dashboard/settings/routes', label: 'Tuyến giao hàng', icon: Navigation, roles: ['admin'] },
      { href: '/dashboard/settings/health', label: 'System Health', icon: Activity, roles: ['admin'] },
    ],
  },
]

const driverNav: NavItem[] = [
  { href: '/dashboard/driver', label: 'Chuyến xe của tôi', icon: Truck, roles: ['driver'] },
]

// ── Breadcrumb Labels ─────────────────────────────

const pathLabels: Record<string, string> = {
  '/dashboard': 'Tổng quan',
  '/dashboard/orders': 'Đơn hàng',
  '/dashboard/orders/new': 'Tạo đơn hàng',
  '/dashboard/trips': 'Chuyến xe',
  '/dashboard/planning': 'Lập kế hoạch',
  '/dashboard/control-tower': 'Trung tâm điều phối',
  '/dashboard/map': 'Bản đồ GPS',
  '/dashboard/products': 'Sản phẩm',
  '/dashboard/customers': 'Khách hàng',
  '/dashboard/vehicles': 'Phương tiện',
  '/dashboard/drivers-list': 'Tài xế',
  '/dashboard/warehouse': 'Quản lý kho',
  '/dashboard/pda-scanner': 'Quét barcode',
  '/dashboard/gate-check': 'Kiểm tra cổng',
  '/dashboard/workshop': 'Phân xưởng vỏ',
  '/dashboard/approvals': 'Duyệt đơn hàng',
  '/dashboard/reconciliation': 'Đối soát',
  '/dashboard/reconciliation/daily-close': 'Chốt sổ ngày',
  '/dashboard/kpi': 'Báo cáo KPI',
  '/dashboard/notifications': 'Thông báo',
  '/dashboard/settings': 'Quản trị hệ thống',
  '/dashboard/settings/configs': 'Cấu hình hệ thống',
  '/dashboard/settings/credit-limits': 'Hạn mức tín dụng',
  '/dashboard/settings/audit-logs': 'Nhật ký hệ thống',
  '/dashboard/settings/routes': 'Tuyến giao hàng',
  '/dashboard/settings/health': 'System Health',
  '/dashboard/driver': 'Chuyến xe của tôi',
}

const roleLabels: Record<string, string> = {
  admin: 'Quản trị viên',
  dvkh: 'Dịch vụ KH',
  dispatcher: 'Điều phối viên',
  accountant: 'Kế toán',
  driver: 'Tài xế',
  warehouse: 'Thủ kho',
  security: 'Bảo vệ',
  management: 'Ban giám đốc',
  workshop: 'Phân xưởng',
}

// ── Layout Component ──────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return }
    setUser(getUser())
  }, [router])

  // Close user dropdown on outside click
  useEffect(() => {
    if (!userMenuOpen) return
    const close = () => setUserMenuOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [userMenuOpen])

  if (!user) return null

  const handleLogout = () => { clearAuth(); router.push('/login') }

  // Derive page title from pathname
  const pageTitle = pathLabels[pathname] || (() => {
    const parts = pathname.split('/')
    if (parts.length >= 4) {
      const parent = parts.slice(0, 3).join('/')
      return pathLabels[parent] ? `${pathLabels[parent]} · Chi tiết` : ''
    }
    return ''
  })()

  // User initials for avatar
  const initials = (user.full_name || '')
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase() || '?'

  const isDriver = user.role === 'driver'

  // ── Render a single nav item ──
  const renderNavItem = (item: NavItem) => {
    const IconComp = item.icon
    const isActive = pathname === item.href ||
      (item.href !== '/dashboard' && item.href.length > 11 && pathname.startsWith(item.href))
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={`group flex items-center gap-2.5 ${collapsed ? 'justify-center' : 'px-3'} py-[7px] rounded-lg text-[13px] leading-5 transition-all duration-150 ${
          isActive
            ? 'bg-white/[0.08] text-white font-medium'
            : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-200'
        }`}
      >
        <IconComp
          size={18}
          strokeWidth={isActive ? 2 : 1.5}
          className={`shrink-0 transition-colors ${isActive ? 'text-brand-500' : 'text-gray-500 group-hover:text-gray-400'}`}
        />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {isActive && !collapsed && (
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
        )}
      </Link>
    )
  }

  return (
    <NotificationProvider>
      <div className="flex h-screen bg-gray-100/50">
        {/* ── Sidebar ── */}
        <aside className={`${collapsed ? 'w-[60px]' : 'w-[240px]'} bg-gray-950 flex flex-col shrink-0 transition-all duration-200 ease-out`}>
          {/* Brand */}
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'px-4'} h-14 shrink-0`}>
            {collapsed ? (
              <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
                <span className="text-white font-bold text-[10px] tracking-tight">BHL</span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-[10px] tracking-tight">BHL</span>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white leading-none">Beer Hạ Long</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-none">OMS · TMS · WMS</p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-2 px-2 styled-scrollbar">
            {isDriver ? (
              <div className="space-y-0.5">
                {driverNav.map(renderNavItem)}
                {renderNavItem({ href: '/dashboard/notifications', label: 'Thông báo', icon: Bell, roles: ['driver'] })}
              </div>
            ) : (
              <div className="space-y-5">
                {navGroups.map((group, gi) => {
                  const visible = group.items.filter(i => i.roles.includes(user.role))
                  if (visible.length === 0) return null
                  return (
                    <div key={gi}>
                      {group.label && !collapsed && (
                        <p className="px-3 mb-1.5 text-[10px] font-semibold text-gray-600 uppercase tracking-widest">
                          {group.label}
                        </p>
                      )}
                      {group.label && collapsed && (
                        <div className="mx-1 mb-2 border-t border-white/[0.06]" />
                      )}
                      <div className="space-y-0.5">
                        {visible.map(renderNavItem)}
                      </div>
                    </div>
                  )
                })}

                {/* Notification link — separated */}
                <div>
                  {!collapsed && <div className="mx-2 mb-2 border-t border-white/[0.06]" />}
                  {collapsed && <div className="mx-1 mb-2 border-t border-white/[0.06]" />}
                  {renderNavItem({ href: '/dashboard/notifications', label: 'Thông báo', icon: Bell, roles: [user.role] })}
                </div>
              </div>
            )}
          </nav>

          {/* User card at bottom */}
          <div className={`shrink-0 border-t border-white/[0.06] ${collapsed ? 'p-2' : 'p-3'}`}>
            {collapsed ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-[11px] font-semibold">
                  {initials}
                </div>
                <button onClick={handleLogout} className="text-gray-600 hover:text-red-400 transition" title="Đăng xuất">
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-[11px] font-semibold shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-200 truncate leading-tight">{user.full_name}</p>
                  <p className="text-[10px] text-gray-500 leading-tight">{roleLabels[user.role] || user.role}</p>
                </div>
                <button onClick={handleLogout} className="p-1 text-gray-600 hover:text-red-400 rounded transition" title="Đăng xuất">
                  <LogOut size={15} />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Topbar */}
          <header className="flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200/80 shrink-0 gap-4">
            {/* Left: Sidebar toggle + Page title */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setCollapsed(c => !c)}
                className="p-1.5 -ml-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition shrink-0"
                title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
              >
                {collapsed ? <PanelLeft size={20} strokeWidth={1.5} /> : <PanelLeftClose size={20} strokeWidth={1.5} />}
              </button>
              <div className="h-5 w-px bg-gray-200" />
              <h1 className="text-sm font-semibold text-gray-800 truncate">{pageTitle}</h1>
            </div>

            {/* Right: Search + Bell + User */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Search pill */}
              <button className="hidden sm:flex items-center gap-2 h-8 pl-2.5 pr-2 text-gray-400 bg-gray-50 hover:bg-gray-100 border border-gray-200/80 rounded-lg text-xs transition">
                <Search size={14} strokeWidth={2} />
                <span>Tìm kiếm...</span>
                <kbd className="hidden lg:inline ml-4 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-gray-400 font-mono leading-none">
                  ⌘K
                </kbd>
              </button>

              <div className="w-px h-6 bg-gray-200 mx-0.5 hidden sm:block" />

              {/* Notification bell */}
              <NotificationBell />

              {/* User avatar + dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setUserMenuOpen(o => !o) }}
                  className="flex items-center gap-2 ml-0.5 pl-1.5 pr-2 py-1 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center text-[11px] font-bold">
                    {initials}
                  </div>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform duration-150 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl border border-gray-200 shadow-lg shadow-gray-200/50 py-1.5 z-50 animate-fade-in">
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">{user.full_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{roleLabels[user.role] || user.role}</p>
                    </div>
                    <div className="p-1.5">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <LogOut size={16} />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Page content */}
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </main>

        <NotificationToast />
        <ToastContainer />
      </div>
    </NotificationProvider>
  )
}
