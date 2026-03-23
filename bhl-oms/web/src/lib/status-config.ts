// Cấu hình trạng thái tập trung — SINGLE SOURCE OF TRUTH
// Tất cả các trang frontend import từ đây, KHÔNG định nghĩa local

// ==================== V4 STATUS CONFIG ====================
// Full 16 statuses theo BHL_UX_VIBE_CODING_SPEC_v4.md §2.1
// KHÔNG interpolate Tailwind class — dùng full string

export type OrderStatus =
  | 'draft' | 'pending_customer_confirm' | 'pending_approval' | 'confirmed'
  | 'planned' | 'picking' | 'loaded' | 'in_transit'
  | 'delivered' | 'partial_delivered' | 'rejected' | 're_delivery'
  | 'on_credit' | 'disputed' | 'cancelled' | 'completed'

export interface StatusConfig {
  dotClass: string
  bgClass: string
  textClass: string
  borderClass: string
  labels: Record<string, string>  // role → label, 'default' required
  isTerminal: boolean
  showCountdown?: boolean
  countdownType?: 'order' | 'delivery'
}

export const STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  draft: {
    dotClass: 'bg-stone-400', bgClass: 'bg-stone-100',
    textClass: 'text-stone-600', borderClass: 'border-stone-300',
    labels: { default: 'Nháp' },
    isTerminal: false,
  },
  pending_customer_confirm: {
    dotClass: 'bg-blue-500', bgClass: 'bg-blue-50',
    textClass: 'text-blue-700', borderClass: 'border-blue-300',
    labels: { default: 'Chờ NPP xác nhận', dispatcher: 'Chờ NPP', management: 'Chờ NPP' },
    isTerminal: false,
    showCountdown: true,
    countdownType: 'order',
  },
  pending_approval: {
    dotClass: 'bg-amber-500', bgClass: 'bg-amber-50',
    textClass: 'text-amber-700', borderClass: 'border-amber-300',
    labels: { default: 'Chờ duyệt hạn mức', accountant: 'Cần duyệt ngay', dvkh: 'Chờ Kế toán duyệt' },
    isTerminal: false,
  },
  confirmed: {
    dotClass: 'bg-teal-500', bgClass: 'bg-teal-50',
    textClass: 'text-teal-700', borderClass: 'border-teal-300',
    labels: { default: 'Đã xác nhận', dispatcher: 'Sẵn sàng xếp xe' },
    isTerminal: false,
  },
  planned: {
    dotClass: 'bg-violet-500', bgClass: 'bg-violet-50',
    textClass: 'text-violet-700', borderClass: 'border-violet-300',
    labels: { default: 'Đã xếp xe', warehouse_handler: 'Chờ picking' },
    isTerminal: false,
  },
  picking: {
    dotClass: 'bg-orange-500', bgClass: 'bg-orange-50',
    textClass: 'text-orange-700', borderClass: 'border-orange-300',
    labels: { default: 'Đang đóng hàng', warehouse_handler: 'Đang picking', dvkh: 'Kho đang chuẩn bị' },
    isTerminal: false,
  },
  loaded: {
    dotClass: 'bg-purple-500', bgClass: 'bg-purple-50',
    textClass: 'text-purple-700', borderClass: 'border-purple-300',
    labels: { default: 'Đã lên xe', dispatcher: 'Sẵn sàng xuất', security: 'Gate pass' },
    isTerminal: false,
  },
  in_transit: {
    dotClass: 'bg-sky-500', bgClass: 'bg-sky-50',
    textClass: 'text-sky-700', borderClass: 'border-sky-300',
    labels: { default: 'Đang giao', driver: 'Đang chạy', management: 'In Transit' },
    isTerminal: false,
  },
  delivered: {
    dotClass: 'bg-green-600', bgClass: 'bg-green-50',
    textClass: 'text-green-700', borderClass: 'border-green-300',
    labels: { default: 'Đã giao', dvkh: 'Giao thành công' },
    isTerminal: false,
    showCountdown: true,
    countdownType: 'delivery',
  },
  partial_delivered: {
    dotClass: 'bg-amber-400', bgClass: 'bg-amber-50',
    textClass: 'text-amber-700', borderClass: 'border-amber-300',
    labels: { default: 'Giao thiếu', dvkh: 'Giao thiếu — cần xử lý' },
    isTerminal: false,
  },
  rejected: {
    dotClass: 'bg-red-500', bgClass: 'bg-red-50',
    textClass: 'text-red-700', borderClass: 'border-red-300',
    labels: { default: 'Khách từ chối', dvkh: 'Khách từ chối — cần xử lý' },
    isTerminal: false,
  },
  re_delivery: {
    dotClass: 'bg-orange-600', bgClass: 'bg-orange-50',
    textClass: 'text-orange-700', borderClass: 'border-orange-300',
    labels: { default: 'Giao lại', dvkh: 'Đang giao lại' },
    isTerminal: false,
  },
  on_credit: {
    dotClass: 'bg-pink-500', bgClass: 'bg-pink-50',
    textClass: 'text-pink-700', borderClass: 'border-pink-300',
    labels: { default: 'Công nợ', accountant: 'Công nợ — chưa thu' },
    isTerminal: false,
  },
  disputed: {
    dotClass: 'bg-red-600', bgClass: 'bg-red-50',
    textClass: 'text-red-700', borderClass: 'border-red-400',
    labels: { default: 'Tranh chấp', accountant: 'Sai lệch cần xử lý', dvkh: 'NPP báo sai lệch' },
    isTerminal: false,
  },
  cancelled: {
    dotClass: 'bg-stone-300', bgClass: 'bg-stone-100',
    textClass: 'text-stone-500', borderClass: 'border-stone-200',
    labels: { default: 'Đã hủy' },
    isTerminal: true,
  },
  completed: {
    dotClass: 'bg-green-800', bgClass: 'bg-green-50',
    textClass: 'text-green-800', borderClass: 'border-green-400',
    labels: { default: 'Hoàn tất' },
    isTerminal: true,
  },
}

// Helper: lấy label theo role, fallback 'default'
export function getStatusLabel(status: string, role?: string): string {
  const cfg = STATUS_CONFIG[status as OrderStatus]
  if (!cfg) return orderStatusLabels[status] || status
  if (role && cfg.labels[role]) return cfg.labels[role]
  return cfg.labels.default
}

// Helper: lấy config, fallback safe
export function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status as OrderStatus] || {
    dotClass: 'bg-gray-400', bgClass: 'bg-gray-100',
    textClass: 'text-gray-600', borderClass: 'border-gray-300',
    labels: { default: status }, isTerminal: false,
  }
}

// ==================== LEGACY EXPORTS (backward compatible) ====================

// ==================== ĐƠN HÀNG (Order) ====================

export const orderStatusLabels: Record<string, string> = {
  draft: 'Nháp',
  pending_customer_confirm: 'Chờ KH xác nhận',
  pending_approval: 'Chờ duyệt công nợ',
  confirmed: 'Đã xác nhận',
  approved: 'Đã duyệt',
  processing: 'Đang xử lý',
  ready_to_ship: 'Sẵn sàng giao',
  shipped: 'Đã xuất kho',
  in_transit: 'Đang giao hàng',
  delivered: 'Đã giao',
  partially_delivered: 'Giao một phần',
  cancelled: 'Đã hủy',
  returned: 'Đã trả hàng',
  closed: 'Đã đóng',
  on_hold: 'Tạm giữ',
  // Aliases from different parts of the system
  shipment_created: 'Đã tạo chuyến',
  delivering: 'Đang giao',
  failed: 'Giao thất bại',
  rejected: 'NPP từ chối',
  on_credit: 'Ghi nợ',
  planned: 'Đã lên kế hoạch',
  picking: 'Đang soạn hàng',
  loaded: 'Đã xếp xe',
  partial_delivered: 'Giao một phần',
  re_delivery: 'Giao lại',
}

export const orderStatusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_customer_confirm: 'bg-amber-100 text-amber-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  approved: 'bg-green-100 text-green-700',
  processing: 'bg-blue-100 text-blue-700',
  ready_to_ship: 'bg-indigo-100 text-indigo-700',
  shipped: 'bg-violet-100 text-violet-700',
  shipment_created: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-purple-100 text-purple-700',
  delivering: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-teal-100 text-teal-700',
  partially_delivered: 'bg-orange-100 text-orange-700',
  partial_delivered: 'bg-orange-100 text-orange-700',
  failed: 'bg-red-100 text-red-700',
  rejected: 'bg-red-100 text-red-700',
  on_credit: 'bg-cyan-100 text-cyan-700',
  cancelled: 'bg-gray-200 text-gray-600',
  returned: 'bg-rose-100 text-rose-700',
  closed: 'bg-gray-200 text-gray-600',
  on_hold: 'bg-yellow-100 text-yellow-700',
  planned: 'bg-blue-100 text-blue-700',
  picking: 'bg-indigo-100 text-indigo-700',
  loaded: 'bg-violet-100 text-violet-700',
  re_delivery: 'bg-rose-100 text-rose-700',
}

// Luồng chính đơn hàng E2E (cho thanh tiến trình)
// Mỗi step = 1 trạng thái user nhìn thấy + mô tả
export interface OrderStep {
  key: string
  label: string
  description: string
  icon: string
  matchStatuses: string[] // Các status code khớp với step này
}

export const orderProgressSteps: OrderStep[] = [
  {
    key: 'created',
    label: 'Đã tạo đơn',
    description: 'Đơn hàng được lập bởi DVKH',
    icon: '📝',
    matchStatuses: ['draft'],
  },
  {
    key: 'customer_confirmed',
    label: 'KH xác nhận',
    description: 'Khách hàng xác nhận qua Zalo/tự động',
    icon: '✅',
    matchStatuses: ['pending_customer_confirm', 'confirmed', 'pending_approval', 'approved'],
  },
  {
    key: 'warehouse_processing',
    label: 'Kho xử lý',
    description: 'Soạn hàng, kiểm tra tồn kho, xếp xe',
    icon: '🏭',
    matchStatuses: ['processing', 'ready_to_ship', 'planned', 'picking', 'loaded'],
  },
  {
    key: 'shipping',
    label: 'Đang vận chuyển',
    description: 'Tài xế đang giao hàng đến NPP',
    icon: '🚚',
    matchStatuses: ['shipped', 'shipment_created', 'in_transit', 'delivering'],
  },
  {
    key: 'completed',
    label: 'Hoàn thành',
    description: 'Đã giao hàng thành công',
    icon: '🎉',
    matchStatuses: ['delivered'],
  },
]

// Trạng thái đặc biệt (nhánh phụ, không nằm trên thanh tiến trình chính)
export const orderSpecialStatuses: Record<string, { label: string; icon: string; color: string; description: string }> = {
  partially_delivered: { label: 'Giao một phần', icon: '⚠️', color: 'text-orange-600 bg-orange-50 border-orange-200', description: 'Chỉ giao được một phần sản phẩm' },
  partial_delivered: { label: 'Giao một phần', icon: '⚠️', color: 'text-orange-600 bg-orange-50 border-orange-200', description: 'Chỉ giao được một phần sản phẩm' },
  rejected: { label: 'NPP từ chối', icon: '❌', color: 'text-red-600 bg-red-50 border-red-200', description: 'NPP từ chối nhận hàng' },
  failed: { label: 'Giao thất bại', icon: '❌', color: 'text-red-600 bg-red-50 border-red-200', description: 'Không giao được hàng' },
  cancelled: { label: 'Đã hủy', icon: '🚫', color: 'text-gray-600 bg-gray-50 border-gray-200', description: 'Đơn hàng đã bị hủy' },
  returned: { label: 'Đã trả hàng', icon: '↩️', color: 'text-rose-600 bg-rose-50 border-rose-200', description: 'Hàng đã được trả lại' },
  on_credit: { label: 'Ghi nợ', icon: '💳', color: 'text-cyan-600 bg-cyan-50 border-cyan-200', description: 'Đơn hàng ghi nợ cho NPP' },
  re_delivery: { label: 'Giao lại', icon: '🔄', color: 'text-rose-600 bg-rose-50 border-rose-200', description: 'Đang lên kế hoạch giao lại' },
  on_hold: { label: 'Tạm giữ', icon: '⏸️', color: 'text-yellow-600 bg-yellow-50 border-yellow-200', description: 'Đơn hàng tạm giữ' },
}

// Tính step hiện tại từ status
export function getOrderStepIndex(status: string): number {
  for (let i = orderProgressSteps.length - 1; i >= 0; i--) {
    if (orderProgressSteps[i].matchStatuses.includes(status)) return i
  }
  return 0 // default = step đầu tiên
}

export function isSpecialStatus(status: string): boolean {
  return status in orderSpecialStatuses
}

// ==================== CHUYẾN XE (Trip) ====================

export const tripStatusLabels: Record<string, string> = {
  planned: 'Đã lập kế hoạch',
  assigned: 'Đã phân công',
  pre_check: 'Kiểm tra xe',
  ready: 'Sẵn sàng',
  loading: 'Đang xếp hàng',
  gate_checked: 'Đã kiểm tra cổng',
  in_transit: 'Đang giao hàng',
  returning: 'Đang về kho',
  settling: 'Đang đối soát',
  reconciled: 'Đã đối soát',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

export const tripStatusColors: Record<string, string> = {
  planned: 'bg-gray-100 text-gray-700',
  assigned: 'bg-blue-100 text-blue-700',
  pre_check: 'bg-indigo-100 text-indigo-700',
  ready: 'bg-green-100 text-green-700',
  loading: 'bg-violet-100 text-violet-700',
  gate_checked: 'bg-teal-100 text-teal-700',
  in_transit: 'bg-purple-100 text-purple-700',
  returning: 'bg-amber-100 text-amber-700',
  settling: 'bg-cyan-100 text-cyan-700',
  reconciled: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-teal-100 text-teal-700',
  cancelled: 'bg-gray-200 text-gray-600',
}

// ==================== ĐIỂM GIAO (Stop) ====================

export const stopStatusLabels: Record<string, string> = {
  pending: 'Chờ giao',
  arrived: 'Đã đến',
  delivering: 'Đang giao',
  delivered: 'Đã giao',
  partially_delivered: 'Giao một phần',
  failed: 'Thất bại',
  rejected: 'NPP từ chối',
  skipped: 'Bỏ qua',
  re_delivery: 'Giao lại',
}

export const stopStatusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  arrived: 'bg-blue-100 text-blue-700',
  delivering: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-teal-100 text-teal-700',
  partially_delivered: 'bg-orange-100 text-orange-700',
  failed: 'bg-red-100 text-red-700',
  rejected: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-200 text-gray-600',
  re_delivery: 'bg-rose-100 text-rose-700',
}

// ==================== ĐỐI SOÁT (Reconciliation) ====================

export const reconStatusLabels: Record<string, string> = {
  pending: 'Chờ đối soát',
  matched: 'Khớp',
  discrepancy: 'Sai lệch',
  resolved: 'Đã xử lý',
}

export const reconStatusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  matched: 'bg-green-100 text-green-700',
  discrepancy: 'bg-red-100 text-red-700',
  resolved: 'bg-blue-100 text-blue-700',
}

export const discStatusLabels: Record<string, string> = {
  open: 'Mở',
  investigating: 'Đang xử lý',
  resolved: 'Đã giải quyết',
  escalated: 'Báo cáo lên',
  closed: 'Đã đóng',
}

export const discStatusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  investigating: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  escalated: 'bg-purple-100 text-purple-700',
  closed: 'bg-gray-100 text-gray-700',
}

// ==================== ZALO ====================

export const zaloStatusLabels: Record<string, string> = {
  sent: 'Đã gửi',
  confirmed: 'Đã xác nhận',
  rejected: 'Từ chối',
  auto_confirmed: 'Tự xác nhận',
  expired: 'Hết hạn',
  disputed: 'Khiếu nại',
}

export const zaloStatusColors: Record<string, string> = {
  sent: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  auto_confirmed: 'bg-cyan-50 text-cyan-700',
  expired: 'bg-gray-100 text-gray-500',
  disputed: 'bg-orange-50 text-orange-700',
}

// ==================== FORMAT ====================

export const formatVND = (n: number) =>
  new Intl.NumberFormat('vi-VN').format(n) + ' ₫'

export const formatVNDCompact = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'T'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return n.toString()
}
