'use client'

/**
 * Approvals (Accountant) — inbox-style queue redesign.
 *
 * Reference: UX_AUDIT_REPORT.md §2.3
 *
 * UX features:
 *  - Priority sort: urgent + overdue first, then countdown ASC
 *  - SLA top banner with overdue count + on-track count
 *  - Inline expand for items (no full modal jump)
 *  - Credit usage progress bar with intuitive 3-stop gradient
 *  - Approve = primary green; Reject = ghost danger
 *  - Reject modal with quick-reason chips + freeform textarea
 *  - Skeleton loading + empty state celebration
 *  - Keyboard hint
 */

import { useEffect, useMemo, useState } from 'react'
import {
  ShieldAlert, RefreshCcw, ChevronDown, ChevronRight, AlertCircle,
  CheckCircle2, XCircle, Clock, Store, Zap, FileText, Sparkles,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { handleError } from '@/lib/handleError'
import { formatVND } from '@/lib/status-config'
import { toast } from '@/lib/useToast'
import { useDataRefresh } from '@/lib/notifications'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { KpiCard } from '@/components/ui/KpiCard'
import { CreditRiskChip } from '@/components/ai'

interface OrderItem {
  product_code: string; product_name: string
  quantity: number; unit_price: number; line_total: number
}

interface PendingOrder {
  id: string; order_number: string; customer_id: string; customer_name: string; customer_code: string
  total_amount: number; credit_limit: number; current_balance: number; available_limit: number
  exceed_amount: number; status: string; created_at: string; notes: string
  items?: OrderItem[]
  is_urgent?: boolean
}

interface Countdown { text: string; tone: 'overdue' | 'urgent' | 'soon' | 'normal'; minutesLeft: number }

function getT1Countdown(createdAt: string): Countdown {
  const deadline = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000
  const diff = deadline - Date.now()
  if (diff <= 0) return { text: 'Quá hạn', tone: 'overdue', minutesLeft: -1 }
  const minutes = Math.floor(diff / 60000)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const text = h > 0 ? `${h}h ${m}m` : `${m}m`
  if (h < 2) return { text, tone: 'urgent', minutesLeft: minutes }
  if (h < 8) return { text, tone: 'soon', minutesLeft: minutes }
  return { text, tone: 'normal', minutesLeft: minutes }
}

const TONE_PILL: Record<Countdown['tone'], string> = {
  overdue: 'bg-rose-100 text-rose-800 ring-rose-200 animate-pulse',
  urgent: 'bg-rose-50 text-rose-700 ring-rose-200',
  soon: 'bg-amber-50 text-amber-700 ring-amber-200',
  normal: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const QUICK_REASONS = [
  'Vượt hạn mức quá nhiều',
  'NPP có lịch sử chậm thanh toán',
  'Cần thanh toán nợ cũ trước',
  'Liên hệ NPP để chia nhỏ đơn',
]

function priorityScore(order: PendingOrder) {
  const countdown = getT1Countdown(order.created_at)
  const slaScore = countdown.tone === 'overdue' ? 100 : countdown.tone === 'urgent' ? 80 : countdown.tone === 'soon' ? 45 : 20
  const overLimitRatio = order.credit_limit > 0 ? Math.min(100, (order.exceed_amount / order.credit_limit) * 100) : 0
  const orderValueScore = Math.min(100, order.total_amount / 2_000_000)
  const urgentScore = order.is_urgent ? 35 : 0
  return Math.round(slaScore * 0.45 + overLimitRatio * 0.3 + orderValueScore * 0.2 + urgentScore)
}

export default function ApprovalsPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [queueMode, setQueueMode] = useState<'sla' | 'priority'>('sla')

  const loadData = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/orders/pending-approvals')
      setOrders(res.data || [])
    } catch (err) { handleError(err, { userMessage: 'Không tải được danh sách đơn chờ duyệt' }) }
    finally { setLoading(false) }
  }
  useEffect(() => { loadData() }, [])
  useDataRefresh('order', loadData)

  // Sort by: SLA baseline or Decision Intelligence priority mode.
  const sorted = useMemo(() => {
    return [...orders].sort((a, b) => {
      if (queueMode === 'priority') return priorityScore(b) - priorityScore(a)
      const ca = getT1Countdown(a.created_at).minutesLeft
      const cb = getT1Countdown(b.created_at).minutesLeft
      // overdue (-1) bubbles first
      if (ca < 0 && cb >= 0) return -1
      if (cb < 0 && ca >= 0) return 1
      return ca - cb
    })
  }, [orders, queueMode])

  const overdueCount = sorted.filter(o => getT1Countdown(o.created_at).tone === 'overdue').length
  const urgentCount = sorted.filter(o => getT1Countdown(o.created_at).tone === 'urgent').length
  const totalExceed = sorted.reduce((sum, o) => sum + (o.exceed_amount || 0), 0)

  const [selectedIdx, setSelectedIdx] = useState(0)

  // Keyboard shortcuts: J/K navigate, A approve, R reject
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx(i => Math.min(i + 1, sorted.length - 1))
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'a' && sorted[selectedIdx]) {
        e.preventDefault()
        approveOrder(sorted[selectedIdx].id)
      } else if (e.key === 'r' && sorted[selectedIdx]) {
        e.preventDefault()
        setRejectModal(sorted[selectedIdx].id)
        setRejectReason('')
      } else if (e.key === 'Escape') {
        setRejectModal(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sorted, selectedIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const approveOrder = async (orderId: string) => {
    setProcessing(orderId)
    try {
      await apiFetch(`/orders/${orderId}/approve`, { method: 'POST', body: { approved: true } })
      toast.success('Đã duyệt đơn hàng')
      await loadData()
    } catch (err: any) { toast.error('Lỗi: ' + err.message) }
    finally { setProcessing(null) }
  }

  const rejectOrder = async () => {
    if (!rejectModal) return
    if (!rejectReason.trim()) { toast.warning('Vui lòng nhập lý do từ chối'); return }
    setProcessing(rejectModal)
    try {
      await apiFetch(`/orders/${rejectModal}/approve`, {
        method: 'POST',
        body: { approved: false, reason: rejectReason },
      })
      toast.success('Đã từ chối đơn hàng')
      setRejectModal(null); setRejectReason('')
      await loadData()
    } catch (err: any) { toast.error('Lỗi: ' + err.message) }
    finally { setProcessing(null) }
  }

  const exceedPercent = (o: PendingOrder) =>
    o.credit_limit > 0 ? ((o.exceed_amount / o.credit_limit) * 100).toFixed(1) : '0'

  if (loading) return <LoadingState label="Đang tải đơn chờ duyệt..." />

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader
        icon={ShieldAlert}
        iconTone="warning"
        title="Duyệt đơn vượt hạn mức"
        subtitle="SLA T+1: xử lý trong vòng 24h kể từ khi đơn được tạo"
        actions={
          <Button variant="secondary" size="sm" leftIcon={RefreshCcw} onClick={loadData}>
            Làm mới
          </Button>
        }
      />

      {/* SLA mini-dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <KpiCard
          label="Quá hạn"
          value={overdueCount}
          icon={AlertCircle}
          tone="danger"
          pulse={overdueCount > 0}
          hint="Cần xử lý ngay"
        />
        <KpiCard
          label="Sắp đến hạn (<2h)"
          value={urgentCount}
          icon={Clock}
          tone="warning"
          hint="Ưu tiên cao"
        />
        <KpiCard
          label="Tổng giá trị vượt hạn mức"
          value={formatVND(totalExceed)}
          icon={Zap}
          tone="info"
          hint={`${sorted.length} đơn chờ`}
        />
      </div>

      {/* Keyboard hint */}
      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {[
          ['sla', 'Theo SLA'],
          ['priority', 'Ưu tiên xử lý'],
        ].map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setQueueMode(mode as 'sla' | 'priority')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${queueMode === mode ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-5 text-xs text-gray-400">
        <span>Phím tắt:</span>
        {[['J/↓', 'Xuống'], ['K/↑', 'Lên'], ['A', 'Duyệt'], ['R', 'Từ chối'], ['Esc', 'Đóng']].map(([key, label]) => (
          <span key={key} className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono text-[10px]">{key}</kbd>
            <span>{label}</span>
          </span>
        ))}
      </div>

      {sorted.length === 0 ? (
        <Card variant="elevated" padding="lg">
          <EmptyState
            icon={CheckCircle2}
            title="Tuyệt vời! Đã xử lý hết"
            messageByRole={{ accountant: 'Không còn đơn nào vượt hạn mức chờ phê duyệt. Tiếp tục giữ nhịp này!' }}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((order, idx) => {
            const cd = getT1Countdown(order.created_at)
            const isOverUrgent = cd.tone === 'overdue' || cd.tone === 'urgent'
            const used = ((order.current_balance + order.total_amount) / (order.credit_limit || 1)) * 100
            const isExpanded = expanded === order.id
            const isKeySelected = idx === selectedIdx

            return (
              <Card
                key={order.id}
                variant="default"
                padding="none"
                className={`overflow-hidden border-l-4 transition ${isKeySelected ? 'ring-2 ring-brand-400' : ''} ${isOverUrgent ? 'border-l-rose-500' : 'border-l-brand-400'}`}
                onClick={() => setSelectedIdx(idx)}
              >
                {/* Header row */}
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.is_urgent && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                            <Zap className="h-3 w-3" /> GẤP
                          </span>
                        )}
                        <h3 className="text-base font-bold text-slate-900">{order.order_number}</h3>
                      </div>
                      <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                        <Store className="h-3.5 w-3.5 shrink-0" />
                        <span className="font-mono text-xs">{order.customer_code}</span>
                        <span>—</span>
                        <span className="truncate">{order.customer_name}</span>
                      </p>
                      <div className="mt-2">
                        <CreditRiskChip customerId={order.customer_id} />
                      </div>
                      {queueMode === 'priority' && (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                          Ưu tiên {priorityScore(order)}/100 · SLA + vượt hạn mức + giá trị đơn
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 bg-rose-50 text-rose-700 ring-rose-200">
                        Vượt {exceedPercent(order)}%
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${TONE_PILL[cd.tone]}`} title="Thời gian còn lại để xử lý (T+1)">
                        <Clock className="h-3 w-3" />
                        {cd.text}
                      </span>
                    </div>
                  </div>

                  {/* Credit summary 4-up */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                    <Mini label="Giá trị đơn" value={formatVND(order.total_amount)} tone="slate" />
                    <Mini label="Hạn mức" value={formatVND(order.credit_limit)} tone="info" />
                    <Mini label="Công nợ" value={formatVND(order.current_balance)} tone="warning" />
                    <Mini label="Vượt hạn mức" value={formatVND(order.exceed_amount)} tone="danger" />
                  </div>

                  {/* Credit usage bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Sử dụng hạn mức nếu duyệt</span>
                      <span className="font-semibold tabular-nums text-slate-700">{Math.min(used, 999).toFixed(0)}%</span>
                    </div>
                    <div className="relative w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500"
                        style={{ width: `${Math.min(used, 100)}%` }}
                      />
                      {used > 100 && (
                        <div className="absolute inset-y-0 right-0 w-1.5 bg-rose-700 animate-pulse" />
                      )}
                    </div>
                  </div>

                  {/* Items expand */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : order.id)}
                    className="text-sm text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 mb-3"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Chi tiết sản phẩm ({order.items?.length || 0} mặt hàng)
                  </button>

                  {isExpanded && order.items && order.items.length > 0 && (
                    <div className="mb-4 rounded-lg ring-1 ring-slate-200 overflow-hidden bg-slate-50/50">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100/80 text-xs">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Mã SP</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Tên sản phẩm</th>
                            <th className="text-right px-3 py-2 font-medium text-slate-600">SL</th>
                            <th className="text-right px-3 py-2 font-medium text-slate-600">Đơn giá</th>
                            <th className="text-right px-3 py-2 font-medium text-slate-600">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((item, idx) => (
                            <tr key={idx} className="border-t border-slate-200">
                              <td className="px-3 py-2 font-mono text-xs text-slate-600">{item.product_code}</td>
                              <td className="px-3 py-2 text-slate-800">{item.product_name}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-800">{item.quantity}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-600">{formatVND(item.unit_price)}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">{formatVND(item.line_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-100/80 font-bold border-t-2 border-slate-200">
                          <tr>
                            <td colSpan={4} className="px-3 py-2 text-right text-slate-600">Tổng cộng:</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-900">{formatVND(order.total_amount)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  {order.notes && (
                    <div className="text-sm text-amber-800 bg-amber-50 ring-1 ring-amber-200 px-3 py-2 rounded-lg mb-3 flex gap-2">
                      <FileText className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{order.notes}</span>
                    </div>
                  )}

                  {/* CTA */}
                  <div className="flex gap-3">
                    <Button
                      variant="success"
                      size="lg"
                      fullWidth
                      loading={processing === order.id}
                      leftIcon={CheckCircle2}
                      onClick={() => approveOrder(order.id)}
                    >
                      Phê duyệt
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      fullWidth
                      disabled={processing === order.id}
                      leftIcon={XCircle}
                      onClick={() => { setRejectModal(order.id); setRejectReason('') }}
                      className="text-rose-700 hover:bg-rose-50 ring-rose-200 hover:ring-rose-300"
                    >
                      Từ chối
                    </Button>
                  </div>

                  <p className="text-xs text-slate-400 mt-3">
                    Tạo lúc: {new Date(order.created_at).toLocaleString('vi-VN')}
                  </p>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={() => setRejectModal(null)}>
          <div
            className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl ring-1 ring-slate-200 p-6 animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Từ chối đơn hàng</h3>
                <p className="text-sm text-slate-500 mt-0.5">Lý do sẽ được gửi cho DVKH và NPP</p>
              </div>
            </div>

            {/* Quick reasons */}
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Lý do thường dùng (bấm để chọn)
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRejectReason(r)}
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:ring-1 hover:ring-rose-200 transition"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Hoặc nhập lý do chi tiết..."
              autoFocus
              className="w-full border border-slate-300 rounded-xl p-3 text-sm h-28 resize-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 outline-none mb-4"
            />

            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setRejectModal(null)}>Hủy</Button>
              <Button variant="danger" loading={processing === rejectModal} onClick={rejectOrder}>
                Xác nhận từ chối
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────
function Mini({ label, value, tone }: { label: string; value: string; tone: 'slate' | 'info' | 'warning' | 'danger' }) {
  const map = {
    slate: 'bg-slate-50 text-slate-700 ring-slate-200/60',
    info: 'bg-sky-50 text-sky-700 ring-sky-200/60',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200/60',
    danger: 'bg-rose-50 text-rose-700 ring-rose-200/60',
  }[tone]
  return (
    <div className={`rounded-lg p-2.5 ring-1 ${map}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70 font-medium">{label}</div>
      <div className="font-bold tabular-nums text-sm mt-0.5">{value}</div>
    </div>
  )
}
