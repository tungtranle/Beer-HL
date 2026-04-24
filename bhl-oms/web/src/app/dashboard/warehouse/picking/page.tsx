'use client'

/**
 * Warehouse Picking — FEFO queue redesign.
 *
 * Reference: UX_AUDIT_REPORT.md §2.4
 *
 * UX features:
 *  - 3-state pipeline summary (Chờ / Đang soạn / Hôm nay đã xong)
 *  - First-in-queue card highlighted "ƯU TIÊN" with brand accent
 *  - FEFO badges with color-coded expiry-day chips (red <=3d, amber <=7d, slate >7d)
 *  - Inline expand for items with progress bar per line (picked/qty)
 *  - Sticky action footer per card on mobile
 *  - Skeleton + EmptyState
 *  - Pull-to-refresh hint via refresh button
 */

import { useEffect, useMemo, useState } from 'react'
import {
  Boxes, RefreshCcw, ChevronDown, ChevronRight, CheckCircle2,
  AlertTriangle, Package, Clock, Calendar, Hash, MapPin,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { handleError } from '@/lib/handleError'
import { toast } from '@/lib/useToast'
import { useDataRefresh } from '@/lib/notifications'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { KpiCard } from '@/components/ui/KpiCard'

interface EnrichedItem {
  product_id: string; product_name: string; product_sku: string
  lot_id: string; batch_number: string; expiry_date: string
  location_id: string; qty: number; picked_qty: number
}

interface PickingOrder {
  id: string; pick_number: string; shipment_id: string
  status: string; total_items: number; enriched_items: EnrichedItem[]
  created_at: string; warehouse_id: string
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ soạn', in_progress: 'Đang soạn', completed: 'Đã soạn', cancelled: 'Đã hủy',
}
const STATUS_TONE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  in_progress: 'bg-sky-50 text-sky-700 ring-sky-200',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
}

function daysUntilExpiry(expiryDate: string): number {
  if (!expiryDate) return 999
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000)
}

function expiryBadge(days: number) {
  if (days <= 3) return { cls: 'bg-rose-100 text-rose-700 ring-rose-200', label: `HSD ${days}d`, icon: AlertTriangle }
  if (days <= 7) return { cls: 'bg-amber-100 text-amber-700 ring-amber-200', label: `HSD ${days}d`, icon: AlertTriangle }
  if (days <= 30) return { cls: 'bg-sky-50 text-sky-700 ring-sky-200', label: `HSD ${days}d`, icon: Calendar }
  return { cls: 'bg-slate-50 text-slate-600 ring-slate-200', label: `HSD ${days}d`, icon: Calendar }
}

export default function PickingOrdersPage() {
  const [orders, setOrders] = useState<PickingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/warehouse/picking-orders')
      setOrders(res.data || [])
    } catch (err) { handleError(err, { userMessage: 'Không tải được danh sách picking' }) }
    finally { setLoading(false) }
  }
  useEffect(() => { loadData() }, [])
  useDataRefresh('order', loadData)

  const confirmPick = async (order: PickingOrder) => {
    setConfirming(order.id)
    try {
      const items = (order.enriched_items || []).map(item => ({
        product_id: item.product_id, lot_id: item.lot_id, location_id: item.location_id, picked_qty: item.qty,
      }))
      await apiFetch('/warehouse/confirm-pick', {
        method: 'POST',
        body: { picking_order_id: order.id, items },
      })
      toast.success(`Đã hoàn tất ${order.pick_number || order.id.slice(0, 8)}`)
      await loadData()
    } catch (err: any) { toast.error('Lỗi: ' + err.message) }
    finally { setConfirming(null) }
  }

  const { pending, inProgress, completed } = useMemo(() => ({
    pending: orders.filter(o => o.status === 'pending'),
    inProgress: orders.filter(o => o.status === 'in_progress'),
    completed: orders.filter(o => o.status === 'completed'),
  }), [orders])

  const queue = [...pending, ...inProgress]
  const totalItems = queue.reduce((s, o) => s + (o.enriched_items?.length || 0), 0)

  if (loading) return <LoadingState label="Đang tải lệnh đóng hàng..." />

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader
        icon={Boxes}
        iconTone="brand"
        title="Lệnh đóng hàng"
        subtitle="Soạn theo FEFO — lô có HSD sớm nhất ưu tiên xuất trước"
        actions={
          <Button variant="secondary" size="sm" leftIcon={RefreshCcw} onClick={loadData}>
            Làm mới
          </Button>
        }
      />

      {/* Pipeline KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <KpiCard label="Chờ soạn" value={pending.length} icon={Clock} tone={pending.length > 0 ? 'warning' : 'neutral'} hint={`${totalItems} mặt hàng`} pulse={pending.length > 5} />
        <KpiCard label="Đang soạn" value={inProgress.length} icon={Package} tone="info" hint="Đang xử lý" />
        <KpiCard label="Đã soạn hôm nay" value={completed.length} icon={CheckCircle2} tone="success" hint="Hoàn tất" />
      </div>

      {/* Queue */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            Hàng đợi soạn hàng
            <span className="text-xs font-medium text-slate-500">({queue.length})</span>
          </h2>
          {queue.length > 0 && (
            <span className="text-xs text-slate-500">Sắp xếp theo thời gian tạo (FIFO chuyến)</span>
          )}
        </div>

        {queue.length === 0 ? (
          <Card variant="elevated" padding="lg">
            <EmptyState
              icon={CheckCircle2}
              title="Hết việc rồi! 🎉"
              messageByRole={{ warehouse_handler: 'Tất cả lệnh đóng hàng đã được xử lý xong. Nghỉ ngơi một chút nhé!' }}
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {queue.map((order, idx) => {
              const isExpanded = expanded === order.id
              const items = order.enriched_items || []
              const sortedItems = [...items].sort((a, b) => daysUntilExpiry(a.expiry_date) - daysUntilExpiry(b.expiry_date))
              const isFirst = idx === 0
              const totalQty = items.reduce((s, i) => s + (i.qty || 0), 0)
              const pickedQty = items.reduce((s, i) => s + (i.picked_qty || 0), 0)
              const progress = totalQty > 0 ? (pickedQty / totalQty) * 100 : 0

              return (
                <Card
                  key={order.id}
                  variant="default"
                  padding="none"
                  className={`overflow-hidden border-l-4 ${isFirst ? 'border-l-brand-500 ring-1 ring-brand-100' : 'border-l-amber-400'}`}
                >
                  <button
                    onClick={() => setExpanded(isExpanded ? null : order.id)}
                    className="w-full text-left p-5 hover:bg-slate-50/50 transition"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {isFirst && (
                          <span className="bg-brand-500 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">
                            Ưu tiên
                          </span>
                        )}
                        <span className="font-bold text-slate-900 truncate">
                          {order.pick_number || `PK-${order.id.slice(0, 8)}`}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ring-1 font-medium ${STATUS_TONE[order.status]}`}>
                          {STATUS_LABEL[order.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm text-slate-500 tabular-nums">{items.length} SKU</span>
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span>Tạo lúc: {new Date(order.created_at).toLocaleString('vi-VN')}</span>
                      {order.status === 'in_progress' && (
                        <span className="font-medium tabular-nums text-sky-600">{pickedQty}/{totalQty} ({progress.toFixed(0)}%)</span>
                      )}
                    </div>

                    {order.status === 'in_progress' && (
                      <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-sky-400 to-sky-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-200 px-5 pb-5 bg-slate-50/30">
                      <div className="mt-4 space-y-2.5">
                        {sortedItems.map((item, itemIdx) => {
                          const days = daysUntilExpiry(item.expiry_date)
                          const badge = expiryBadge(days)
                          const Icon = badge.icon
                          const linePct = item.qty > 0 ? (item.picked_qty / item.qty) * 100 : 0
                          const isFefoFirst = itemIdx === 0

                          return (
                            <div
                              key={`${item.product_id}-${item.lot_id}`}
                              className={`bg-white rounded-xl p-4 ring-1 ${isFefoFirst ? 'ring-brand-200' : 'ring-slate-200'}`}
                            >
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm text-slate-900 truncate">{item.product_name || item.product_sku}</p>
                                  <p className="text-xs text-slate-400 font-mono mt-0.5">{item.product_sku}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  {isFefoFirst && (
                                    <span className="text-[10px] uppercase tracking-wider bg-brand-500 text-white px-2 py-0.5 rounded-full font-bold">
                                      Lấy trước
                                    </span>
                                  )}
                                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ring-1 font-medium ${badge.cls}`}>
                                    <Icon className="h-3 w-3" />
                                    {badge.label}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                <Field icon={Hash} label="Lô" value={item.batch_number || '—'} />
                                <Field icon={Calendar} label="HSD" value={item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('vi-VN') : '—'} />
                                <Field icon={MapPin} label="Vị trí" value={item.location_id || '—'} mono />
                                <Field icon={Package} label="SL" value={`${item.picked_qty}/${item.qty}`} highlight={item.picked_qty >= item.qty} />
                              </div>

                              <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${item.picked_qty >= item.qty ? 'bg-emerald-500' : 'bg-brand-500'}`}
                                  style={{ width: `${Math.min(linePct, 100)}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        leftIcon={CheckCircle2}
                        loading={confirming === order.id}
                        onClick={(e) => { e.stopPropagation(); confirmPick(order) }}
                        className="mt-4 h-14"
                      >
                        Xác nhận đã soạn xong
                      </Button>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Completed today */}
      {completed.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Đã soạn hôm nay ({completed.length})
          </h2>
          <div className="space-y-2">
            {completed.map((order) => (
              <Card key={order.id} variant="default" padding="sm" className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="font-medium text-sm truncate">{order.pick_number || order.id.slice(0, 8)}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                    Đã soạn
                  </span>
                </div>
                <span className="text-xs text-slate-500 tabular-nums">{(order.enriched_items || []).length} SKU</span>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Field({ icon: Icon, label, value, mono, highlight }: { icon: any; label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon className="h-3 w-3 mt-0.5 text-slate-400 shrink-0" />
      <div className="min-w-0">
        <span className="text-slate-500">{label}: </span>
        <span className={`font-semibold ${mono ? 'font-mono text-[11px]' : ''} ${highlight ? 'text-emerald-600' : 'text-slate-800'}`}>
          {value}
        </span>
      </div>
    </div>
  )
}
