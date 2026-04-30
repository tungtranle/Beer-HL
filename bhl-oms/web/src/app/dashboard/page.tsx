'use client'

/**
 * Dashboard root — role-aware home with KPI tiles + workflow next-steps.
 *
 * Reference: UX_AUDIT_REPORT.md §2 (Dashboard root redesign)
 *
 * UX features:
 *  - Greeting "Chào buổi sáng, {name}" personalized
 *  - 4-5 KPI tiles via KpiCard primitive (no emoji, real icons)
 *  - "Việc cần làm hôm nay" priority list (role-specific quick actions)
 *  - Quy trình nghiệp vụ as numbered horizontal steps with hover description
 *  - Skeleton loading state
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardList, Package, Truck, Beer, Store, ClockArrowDown, AlertTriangle,
  CircleDollarSign, BarChart3, ArrowRight, Sparkles, type LucideIcon,
} from 'lucide-react'
import { apiFetch, getUser } from '@/lib/api'
import { formatVND, formatCount } from '@/lib/status-config'
import { handleError } from '@/lib/handleError'
import { PageHeader } from '@/components/ui/PageHeader'
import { KpiCard } from '@/components/ui/KpiCard'
import { Card, CardHeader } from '@/components/ui/Card'
import { SkeletonGrid } from '@/components/ui/Skeleton'
import { AIInboxPanel, DispatchBriefCard, OutreachQueueWidget } from '@/components/ai'

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
  scope_from?: string
  scope_to?: string
  scope_label?: string
}

type CardCfg = {
  label: string
  value: React.ReactNode
  icon: LucideIcon
  tone: 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'neutral'
  href: string
  hint?: string
  pulse?: boolean
}

function greeting() {
  const h = new Date().getHours()
  if (h < 11) return { period: 'sáng', emoji: '☀️' }
  if (h < 14) return { period: 'trưa', emoji: '🌤️' }
  if (h < 18) return { period: 'chiều', emoji: '🌅' }
  return { period: 'tối', emoji: '🌙' }
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Quản trị viên',
  dispatcher: 'Điều phối viên',
  accountant: 'Kế toán',
  dvkh: 'Dịch vụ khách hàng',
  management: 'Ban giám đốc',
  warehouse_handler: 'Thủ kho',
  security: 'Bảo vệ',
  workshop: 'Tổ vỏ',
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ full_name?: string; role?: string } | null>(null)

  useEffect(() => {
    const u = getUser()
    if (u?.role === 'driver') {
      router.replace('/dashboard/driver')
      return
    }
    setUser(u)
    apiFetch<any>('/dashboard/stats')
      .then((res) => setStats(res.data))
      .catch((err) => handleError(err, { userMessage: 'Không tải được số liệu tổng quan' }))
      .finally(() => setLoading(false))
  }, [router])

  const role = user?.role || ''
  const { period, emoji } = greeting()

  const cards: CardCfg[] = useMemo(() => {
    const base: CardCfg = {
      label: 'Đơn trong tháng', value: stats ? formatCount(stats.total_orders) : '—',
      icon: ClipboardList, tone: 'info', href: '/dashboard/orders',
      hint: stats ? `${formatCount(stats.orders_today)} mới hôm nay` : undefined,
    }
    if (['admin', 'dispatcher'].includes(role)) {
      return [
        base,
        { label: 'Đơn chờ giao', value: stats ? formatCount(stats.pending_shipments) : '—', icon: Package, tone: 'warning', href: '/dashboard/orders?status=confirmed' },
        { label: 'Chuyến đang chạy', value: stats ? formatCount(stats.active_trips) : '—', icon: Truck, tone: 'success', href: '/dashboard/trips', hint: stats ? `Hoàn tất hôm nay: ${formatCount(stats.completed_trips_today)}` : undefined },
        { label: 'Sản phẩm', value: stats ? formatCount(stats.total_products) : '—', icon: Beer, tone: 'brand', href: '/dashboard/products' },
        { label: 'Khách hàng (NPP)', value: stats ? formatCount(stats.total_customers) : '—', icon: Store, tone: 'neutral', href: '/dashboard/customers' },
      ]
    }
    if (role === 'accountant') {
      const overdue = (stats?.pending_approvals ?? 0) > 0
      return [
        base,
        { label: 'Đơn chờ duyệt', value: stats ? formatCount(stats.pending_approvals) : '—', icon: ClockArrowDown, tone: overdue ? 'danger' : 'warning', href: '/dashboard/approvals', hint: 'T+1 SLA', pulse: overdue },
        { label: 'Sai lệch chưa xử lý', value: stats ? formatCount(stats.pending_discrepancies) : '—', icon: AlertTriangle, tone: 'danger', href: '/dashboard/reconciliation' },
        { label: 'Doanh thu hôm nay', value: formatVND(stats?.revenue_today ?? 0), icon: CircleDollarSign, tone: 'success', href: '/dashboard/reconciliation/daily-close' },
        { label: 'Chuyến đang chạy', value: stats ? formatCount(stats.active_trips) : '—', icon: Truck, tone: 'info', href: '/dashboard/trips' },
      ]
    }
    if (role === 'dvkh') {
      return [
        base,
        { label: 'Đơn chờ giao', value: stats ? formatCount(stats.pending_shipments) : '—', icon: Package, tone: 'warning', href: '/dashboard/orders?status=confirmed' },
        { label: 'Sản phẩm', value: stats ? formatCount(stats.total_products) : '—', icon: Beer, tone: 'brand', href: '/dashboard/products' },
        { label: 'Khách hàng (NPP)', value: stats ? formatCount(stats.total_customers) : '—', icon: Store, tone: 'neutral', href: '/dashboard/customers' },
      ]
    }
    if (role === 'management') {
      return [
        { label: 'Doanh thu hôm nay', value: formatVND(stats?.revenue_today ?? 0), icon: CircleDollarSign, tone: 'success', href: '/dashboard/kpi?period=today' },
        { label: 'Tỷ lệ giao thành công', value: stats?.delivery_rate ? `${stats.delivery_rate.toFixed(1)}%` : '—', icon: BarChart3, tone: 'info', href: '/dashboard/kpi' },
        { label: 'Chuyến đang chạy', value: stats?.active_trips ?? '—', icon: Truck, tone: 'brand', href: '/dashboard/trips' },
        { label: 'Sai lệch chưa xử lý', value: stats?.pending_discrepancies ?? '—', icon: AlertTriangle, tone: 'danger', href: '/dashboard/reconciliation' },
        { label: 'Khách hàng (NPP)', value: stats?.total_customers ?? '—', icon: Store, tone: 'neutral', href: '/dashboard/customers' },
      ]
    }
    return [
      base,
      { label: 'Đơn chờ giao', value: stats ? formatCount(stats.pending_shipments) : '—', icon: Package, tone: 'warning', href: '/dashboard/orders?status=confirmed' },
      { label: 'Chuyến đang chạy', value: stats ? formatCount(stats.active_trips) : '—', icon: Truck, tone: 'success', href: '/dashboard/trips' },
      { label: 'Sản phẩm', value: stats ? formatCount(stats.total_products) : '—', icon: Beer, tone: 'brand', href: '/dashboard/products' },
      { label: 'Khách hàng (NPP)', value: stats ? formatCount(stats.total_customers) : '—', icon: Store, tone: 'neutral', href: '/dashboard/customers' },
    ]
  }, [stats, role])

  // Workflow steps
  const workflow = [
    { n: 1, label: 'Tạo đơn', desc: 'Nhập đơn hàng từ NPP', href: '/dashboard/orders/new', tone: 'bg-sky-50 text-sky-700 ring-sky-200' },
    { n: 2, label: 'Kiểm tra ATP', desc: 'Hạn mức nợ + tồn kho', href: '/dashboard/orders/new', tone: 'bg-amber-50 text-amber-700 ring-amber-200' },
    { n: 3, label: 'Lập kế hoạch', desc: 'VRP gom chuyến tối ưu', href: '/dashboard/planning', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    { n: 4, label: 'Theo dõi chuyến', desc: 'Bản đồ + GPS realtime', href: '/dashboard/trips', tone: 'bg-violet-50 text-violet-700 ring-violet-200' },
    { n: 5, label: 'Đối soát', desc: 'Sai lệch + chốt sổ T+1', href: '/dashboard/reconciliation', tone: 'bg-rose-50 text-rose-700 ring-rose-200' },
  ]

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title={`Chào buổi ${period} ${emoji}, ${user?.full_name?.split(' ').slice(-1)[0] || 'bạn'}`}
        subtitle={role ? `Bảng điều khiển — ${ROLE_LABEL[role] ?? role} · ${stats?.scope_label || 'Tháng hiện tại'}` : 'Bảng điều khiển'}
      />

      {/* KPI tiles */}
      {loading ? (
        <SkeletonGrid count={5} cols={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
          {cards.map((c) => (
            <KpiCard
              key={c.label}
              label={c.label}
              value={c.value}
              icon={c.icon}
              tone={c.tone}
              href={c.href}
              hint={c.hint}
              pulse={c.pulse}
            />
          ))}
        </div>
      )}

      <div className="mb-6">
        <AIInboxPanel />
      </div>

      <DispatchBriefCard />

      {['admin', 'dvkh', 'management'].includes(role) && (
        <div className="mb-6">
          <OutreachQueueWidget />
        </div>
      )}

      {/* Workflow */}
      <Card variant="default" padding="lg" className="mb-6">
        <CardHeader
          title="Quy trình nghiệp vụ"
          subtitle="Bấm vào từng bước để chuyển đến màn hình tương ứng"
          action={
            <span className="inline-flex items-center gap-1.5 text-xs text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full ring-1 ring-brand-100">
              <Sparkles className="h-3 w-3" /> Hướng dẫn nhanh
            </span>
          }
        />
        <ol className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {workflow.map((s, i) => (
            <li key={s.n} className="relative">
              <button
                onClick={() => router.push(s.href)}
                className={`group w-full text-left p-3 rounded-xl ring-1 ${s.tone} hover:shadow-md hover:-translate-y-0.5 transition`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-white/80 text-xs font-bold tabular-nums">
                    {s.n}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition" />
                </div>
                <p className="text-sm font-semibold">{s.label}</p>
                <p className="text-xs opacity-70 mt-0.5">{s.desc}</p>
              </button>
              {i < workflow.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-2 -translate-y-1/2 text-slate-300 pointer-events-none" aria-hidden>
                  <ArrowRight className="h-3 w-3" />
                </div>
              )}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
