'use client'

import { useEffect, useState, useCallback } from 'react'
import SearchableSelect from '@/lib/SearchableSelect'

const API = '/api/test-portal'

// ===== Types =====
interface Order {
  id: string; order_number: string; customer_name: string; status: string
  total_amount: number; delivery_date: string; atp_status: string; credit_status: string
  created_at: string; confirm_token: string | null; confirm_status: string | null
  confirm_expires: string | null; reject_reason: string | null
}
interface OrderConfirmation {
  id: string; order_id: string; order_number: string; customer_name: string
  token: string; phone: string; status: string; total_amount: number
  pdf_url: string | null; sent_at: string; confirmed_at: string | null
  rejected_at: string | null; reject_reason: string | null
  auto_confirmed_at: string | null; expires_at: string
}
interface DeliveryConfirmation {
  id: string; order_id: string; order_number: string; customer_name: string
  token: string; phone: string; status: string; total_amount: number
  sent_at: string; confirmed_at: string | null; disputed_at: string | null
  dispute_reason: string | null; auto_confirmed_at: string | null
}
interface StockRow {
  product_id: string; product_name: string; product_sku: string
  warehouse_id: string; warehouse_name: string; total_qty: number
  reserved: number; available: number; batch_number: string; expiry_date: string
}
interface CreditRow {
  id: string; code: string; name: string; credit_limit: number
  current_balance: number; available_limit: number
}
interface Customer {
  id: string; code: string; name: string; phone: string; address: string; credit_limit: number
}
interface Product {
  id: string; sku: string; name: string; price: number; deposit_price: number
  weight_kg: number; volume_m3: number
}

type Tab = 'test-cases' | 'orders' | 'order-confirm' | 'delivery-confirm' | 'stock' | 'credit' | 'create-order' | 'gps-sim' | 'drivers'

// Scenario types from backend
interface ScenarioMeta {
  id: string; title: string; description: string; category: string
  roles: string[]; steps: ScenarioStep[]; data_summary: string
  gps_scenario?: string; preview_data: ScenarioDataPoint[]
}
interface ScenarioStep {
  role: string; page: string; action: string; expected: string
}
interface ScenarioDataPoint {
  label: string; value: string
}

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'test-cases', label: 'Kịch bản test', icon: '🎯' },
  { key: 'orders', label: 'Đơn hàng', icon: '📋' },
  { key: 'order-confirm', label: 'Xác nhận đơn (Zalo)', icon: '📱' },
  { key: 'delivery-confirm', label: 'Xác nhận giao hàng', icon: '🚛' },
  { key: 'stock', label: 'Tồn kho / ATP', icon: '📦' },
  { key: 'credit', label: 'Dư nợ / Tín dụng', icon: '💰' },
  { key: 'create-order', label: 'Tạo đơn test', icon: '➕' },
  { key: 'gps-sim', label: 'Giả lập GPS', icon: '📡' },
  { key: 'drivers', label: 'Tài xế & Tài khoản', icon: '🚛' },
]

const statusBadge = (status: string) => {
  const m: Record<string, string> = {
    pending_customer_confirm: 'bg-yellow-100 text-yellow-800',
    pending_approval: 'bg-orange-100 text-orange-800',
    confirmed: 'bg-green-100 text-green-800',
    delivered: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
    sent: 'bg-yellow-100 text-yellow-700',
    auto_confirmed: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-700',
    disputed: 'bg-red-100 text-red-700',
    draft: 'bg-gray-100 text-gray-700',
  }
  return m[status] || 'bg-gray-100 text-gray-600'
}

const statusLabel: Record<string, string> = {
  pending_customer_confirm: 'Chờ KH xác nhận',
  pending_approval: 'Chờ duyệt credit',
  confirmed: 'Đã xác nhận',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
  sent: 'Chờ xác nhận',
  auto_confirmed: 'Tự động xác nhận',
  rejected: 'KH từ chối',
  disputed: 'Khiếu nại',
  draft: 'Nháp',
}

const fmtMoney = (n: number) => n?.toLocaleString('vi-VN') + 'đ'
const fmtDate = (s: string) => s ? new Date(s).toLocaleString('vi-VN') : '-'

async function api<T>(path: string, opts?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(API + path, opts)
    const json = await res.json()
    return json.success ? json.data : null
  } catch { return null }
}

export default function TestPortalPage() {
  const [tab, setTab] = useState<Tab>('test-cases')
  const [refreshKey, setRefreshKey] = useState(0)
  const [resetting, setResetting] = useState(false)
  const [toast, setToast] = useState('')

  const refresh = () => setRefreshKey(k => k + 1)
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleReset = async () => {
    if (!confirm('Xóa toàn bộ dữ liệu test?\n\n(Giữ lại: NPP, Sản phẩm, Kho, Tồn kho)')) return
    setResetting(true)
    const res = await api<{ message: string }>('/reset-data', { method: 'POST' })
    showToast(res?.message || 'Đã reset dữ liệu')
    setResetting(false)
    refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-amber-700 text-white py-4 px-6 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🧪 Test Portal — BHL OMS</h1>
            <p className="text-amber-200 text-sm mt-1">Module test nghiệp vụ, xác nhận đơn hàng, tồn kho, dư nợ</p>
          </div>
          <div className="flex gap-3">
            <button onClick={refresh}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-400 rounded-lg text-sm font-medium transition">
              🔄 Refresh
            </button>
            <button onClick={handleReset} disabled={resetting}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition disabled:opacity-50">
              {resetting ? '⏳ Đang xóa...' : '🗑️ Reset Data'}
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce">
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 mt-4">
        <div className="flex gap-1 flex-wrap bg-white rounded-xl p-1 shadow-sm">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 min-w-[140px] px-3 py-2.5 rounded-lg text-sm font-medium transition
                ${tab === t.key ? 'bg-brand-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        {tab === 'test-cases' && <TestCasesTab setTab={setTab} showToast={showToast} refresh={refresh} />}
        {tab === 'orders' && <OrdersTab refreshKey={refreshKey} showToast={showToast} refresh={refresh} />}
        {tab === 'order-confirm' && <OrderConfirmTab refreshKey={refreshKey} showToast={showToast} refresh={refresh} />}
        {tab === 'delivery-confirm' && <DeliveryConfirmTab refreshKey={refreshKey} />}
        {tab === 'stock' && <StockTab refreshKey={refreshKey} />}
        {tab === 'credit' && <CreditTab refreshKey={refreshKey} />}
        {tab === 'create-order' && <CreateOrderTab showToast={showToast} refresh={refresh} />}
        {tab === 'gps-sim' && <GPSSimTab refreshKey={refreshKey} showToast={showToast} />}
        {tab === 'drivers' && <DriversTab />}
      </div>
    </div>
  )
}

// ===== Tab: Test Cases =====
interface TestCase {
  id: string
  category: string
  categoryColor: string
  title: string
  description: string
  precondition: string
  steps: { action: string; expected: string }[]
  dataRules: string[]
  businessRules: string[]
}

const testCases: TestCase[] = [
  {
    id: 'TC-OMS-01',
    category: 'OMS',
    categoryColor: 'bg-blue-100 text-blue-700',
    title: 'Tạo đơn hàng thành công (Happy Path)',
    description: 'Tạo đơn bình thường với NPP có đủ hạn mức và tồn kho đủ → đơn chuyển sang chờ KH xác nhận',
    precondition: 'Reset data, chọn NPP có credit_limit > tổng đơn, kho có đủ tồn',
    steps: [
      { action: 'Tab "Tạo đơn test" → Chọn 1 NPP bất kỳ có hạn mức cao (VD: BG-1, 500 triệu)', expected: 'Hiện thông tin NPP, hạn mức' },
      { action: 'Chọn kho WH-HL', expected: '' },
      { action: 'Chọn SP: BHL-LON-330 × 10 thùng', expected: 'Tổng ~ 1.85 triệu' },
      { action: 'Nhấn "Tạo đơn hàng test"', expected: '✅ Tạo thành công' },
      { action: 'Kiểm tra tab "Đơn hàng"', expected: 'Đơn ở trạng thái Chờ KH xác nhận' },
      { action: 'Kiểm tra tab "Xác nhận đơn Zalo"', expected: 'Có 1 record status = sent' },
      { action: 'Kiểm tra tab "Tồn kho"', expected: 'Reserved tăng +10 cho BHL-LON-330' },
    ],
    dataRules: [
      'NPP phải có credit_limit > tổng tiền đơn hàng',
      'Kho phải có stock available > số lượng đặt',
      'Đơn tạo thành công → status = pending_customer_confirm',
      'Reserved tăng ngay lúc tạo đơn (ATP trừ)',
    ],
    businessRules: ['BR-OMS-01 (ATP)', 'BR-OMS-02 (Credit)', 'BR-OMS-03 (Mã đơn)'],
  },
  {
    id: 'TC-OMS-02',
    category: 'OMS',
    categoryColor: 'bg-blue-100 text-blue-700',
    title: 'Tạo đơn nhiều sản phẩm',
    description: 'Tạo đơn với 3 sản phẩm khác nhau → kiểm tra tổng tiền và reserved cho từng SP',
    precondition: 'NPP có hạn mức đủ, kho có tồn cả 3 SP',
    steps: [
      { action: 'Tab "Tạo đơn" → Chọn NPP + kho WH-HL', expected: '' },
      { action: 'Thêm 3 SP: BHL-LON-330 × 20, BHL-GOLD-330 × 10, NGK-CHANH-330 × 15', expected: 'Tổng ~ 7.8 triệu' },
      { action: 'Tạo đơn', expected: '✅ Thành công' },
      { action: 'Tab "Tồn kho"', expected: 'Reserved tăng cho cả 3 SP tại WH-HL' },
    ],
    dataRules: [
      'Mỗi order_item tạo 1 dòng reserved riêng',
      'Tổng tiền = SUM(price × quantity) tất cả items',
    ],
    businessRules: ['BR-OMS-01 (ATP per product per warehouse)'],
  },
  {
    id: 'TC-OMS-03',
    category: 'OMS',
    categoryColor: 'bg-blue-100 text-blue-700',
    title: 'Tạo đơn — ATP không đủ',
    description: 'Đặt số lượng vượt tồn kho → bị từ chối, stock không bị trừ',
    precondition: 'Tab Tồn kho → ghi nhận available hiện tại',
    steps: [
      { action: 'Tab "Tồn kho" → Ghi nhận available BHL-LON-330', expected: 'VD: 500' },
      { action: 'Tạo đơn BHL-LON-330 × 99999 thùng', expected: '❌ Lỗi ATP_INSUFFICIENT' },
      { action: 'Tab "Tồn kho"', expected: 'Reserved KHÔNG thay đổi (rollback)' },
    ],
    dataRules: [
      'Số lượng đặt phải > available stock',
      'Khi ATP check fail → đơn không được tạo',
      'Stock reserved KHÔNG thay đổi khi reject',
    ],
    businessRules: ['BR-OMS-01 — Draft không trừ ATP'],
  },
  {
    id: 'TC-OMS-04',
    category: 'CREDIT',
    categoryColor: 'bg-orange-100 text-orange-700',
    title: 'Tạo đơn — Vượt hạn mức tín dụng',
    description: 'Tạo đơn cho NPP có hạn mức nhỏ (VD: TB-127 hoặc HD-59) → đơn chuyển pending_approval chờ kế toán duyệt',
    precondition: 'Chọn NPP có credit_limit thấp: TB-127 (20 triệu) hoặc HD-59 (10 triệu)',
    steps: [
      { action: 'Tab "Dư nợ" → Ghi nhận available_limit của NPP nhỏ', expected: '' },
      { action: 'Tạo đơn lớn cho NPP đó (tổng > available_limit)', expected: 'Đơn tạo thành công nhưng status = pending_approval' },
      { action: 'Tab "Đơn hàng"', expected: 'Đơn hiện trạng thái Chờ duyệt credit' },
      { action: 'Tab "Xác nhận đơn Zalo"', expected: 'KHÔNG có record (chưa gửi Zalo)' },
    ],
    dataRules: [
      'NPP phải có hạn mức nhỏ (TB-127 = 20tr, HD-59 = 10tr)',
      'Tổng đơn phải > available_limit của NPP',
      'Đơn vượt credit → pending_approval, KHÔNG gửi Zalo',
      'Kế toán duyệt xong → chuyển pending_customer_confirm → gửi Zalo',
    ],
    businessRules: ['BR-OMS-02 (Credit exceed → pending_approval)'],
  },
  {
    id: 'TC-CREDIT-01',
    category: 'CREDIT',
    categoryColor: 'bg-orange-100 text-orange-700',
    title: 'Kiểm tra dư nợ trước/sau tạo đơn',
    description: 'Tạo đơn → xác nhận qua Zalo → kiểm tra dư nợ tăng tương ứng',
    precondition: 'Reset data, ghi nhận dư nợ ban đầu',
    steps: [
      { action: 'Tab "Dư nợ" → Ghi nhận NPP available_limit = X', expected: '' },
      { action: 'Tạo đơn cho NPP, tổng tiền = Y', expected: '' },
      { action: 'Tab "Dư nợ" → NPP available_limit', expected: 'Chưa thay đổi (chưa confirm)' },
      { action: 'Tab "Xác nhận đơn Zalo" → Xác nhận đơn', expected: '' },
      { action: 'Tab "Dư nợ" → NPP available_limit', expected: 'Giảm Y (debit entry created)' },
    ],
    dataRules: [
      'Dư nợ chỉ tăng SAU KHI đơn được xác nhận (confirmed)',
      'Đơn pending_customer_confirm chưa tạo debit entry',
    ],
    businessRules: ['BR-OMS-02 (Credit after confirm)'],
  },
  {
    id: 'TC-CONFIRM-01',
    category: 'CONFIRM',
    categoryColor: 'bg-green-100 text-green-700',
    title: 'KH xác nhận đơn qua Zalo (Happy Path)',
    description: 'Tạo đơn → mô phỏng KH nhấn xác nhận → đơn chuyển confirmed',
    precondition: 'Tạo ít nhất 1 đơn (credit OK)',
    steps: [
      { action: 'Tab "Xác nhận đơn Zalo" → có record status = sent', expected: '' },
      { action: 'Nhấn "✅ Xác nhận đơn hàng (vai KH)"', expected: 'Toast: Đơn đã xác nhận!' },
      { action: 'Tab "Đơn hàng"', expected: 'Status → confirmed' },
      { action: 'Tab "Dư nợ"', expected: 'Available_limit giảm' },
    ],
    dataRules: [
      'Phải có đơn ở trạng thái pending_customer_confirm',
      'Tab Zalo confirm phải hiện token status = sent',
    ],
    businessRules: ['SM-01 (Customer confirm → confirmed)'],
  },
  {
    id: 'TC-CONFIRM-02',
    category: 'CONFIRM',
    categoryColor: 'bg-green-100 text-green-700',
    title: 'KH từ chối đơn qua Zalo',
    description: 'Tạo đơn → KH từ chối → đơn hủy, stock giải phóng, dư nợ không đổi',
    precondition: 'Tạo ít nhất 1 đơn',
    steps: [
      { action: 'Tab "Xác nhận đơn Zalo" → Nhấn "❌ Từ chối"', expected: 'Nhập lý do → OK' },
      { action: 'Tab "Đơn hàng"', expected: 'Status → cancelled' },
      { action: 'Tab "Tồn kho"', expected: 'Reserved GIẢM (stock released)' },
      { action: 'Tab "Dư nợ"', expected: 'Available_limit KHÔNG thay đổi' },
    ],
    dataRules: [
      'KH từ chối → đơn cancel → release reserved',
      'Dư nợ không bị ảnh hưởng khi reject',
    ],
    businessRules: ['SM-01 (Customer reject → cancelled)'],
  },
  {
    id: 'TC-ATP-02',
    category: 'ATP',
    categoryColor: 'bg-purple-100 text-purple-700',
    title: 'Reserved tăng/giảm khi tạo/hủy đơn',
    description: 'Kiểm tra reserved_qty tăng sau tạo đơn và giảm sau hủy đơn',
    precondition: 'Reset data, ghi nhận reserved ban đầu',
    steps: [
      { action: 'Tab "Tồn kho" → Ghi nhận reserved BHL-LON-330 = R₀', expected: '' },
      { action: 'Tạo đơn BHL-LON-330 × 20', expected: '' },
      { action: 'Tab "Tồn kho"', expected: 'Reserved = R₀ + 20' },
      { action: 'Tab "Xác nhận đơn Zalo" → Từ chối đơn', expected: '' },
      { action: 'Tab "Tồn kho"', expected: 'Reserved = R₀ (phục hồi)' },
    ],
    dataRules: [
      'Tạo đơn → reserved += quantity (per product per warehouse)',
      'Hủy/từ chối đơn → reserved -= quantity (release)',
    ],
    businessRules: ['BR-OMS-01 (ATP Reserve/Release)'],
  },
  {
    id: 'TC-E2E-01',
    category: 'E2E',
    categoryColor: 'bg-red-100 text-red-700',
    title: 'Luồng đầy đủ: Đơn hàng → Xác nhận → Giao hàng',
    description: 'Test toàn bộ luồng từ tạo đơn → KH xác nhận → giao hàng → NPP xác nhận giao (qua Zalo)',
    precondition: 'Reset data trước khi bắt đầu',
    steps: [
      { action: 'Nhấn "Reset Data"', expected: 'Clean state' },
      { action: 'Tạo đơn: NPP bất kỳ + kho WH-HL + BHL-LON-330 × 10', expected: 'Đơn pending_customer_confirm' },
      { action: 'Tab "Xác nhận đơn Zalo" → Xác nhận', expected: 'Đơn → confirmed' },
      { action: 'Kiểm tra "Dư nợ"', expected: 'Available_limit giảm' },
      { action: 'Kiểm tra "Tồn kho"', expected: 'Reserved = 10' },
      { action: 'API: POST /api/test-portal/simulate-delivery (order_id)', expected: 'Đơn → delivered' },
      { action: 'Tab "Xác nhận giao hàng"', expected: 'Xuất hiện record sent' },
    ],
    dataRules: [
      'Luồng đầy đủ: draft → pending_confirm → confirmed → delivered',
      'Mỗi bước chuyển status phải kiểm tra ở tab tương ứng',
      'Simulate delivery cần order_id (copy từ tab Đơn hàng)',
    ],
    businessRules: ['SM-01 Full flow', 'BR-OMS-01', 'BR-OMS-02'],
  },
  {
    id: 'TC-E2E-02',
    category: 'E2E',
    categoryColor: 'bg-red-100 text-red-700',
    title: 'Luồng vượt credit → Kế toán duyệt → Xác nhận',
    description: 'NPP hạn mức nhỏ → đơn pending_approval → kế toán duyệt → KH xác nhận',
    precondition: 'Chọn NPP hạn mức nhỏ (TB-127 = 20tr hoặc HD-59 = 10tr)',
    steps: [
      { action: 'Tạo đơn lớn cho NPP nhỏ (tổng > hạn mức)', expected: 'Đơn pending_approval' },
      { action: 'Tab "Đơn hàng" → Không có Zalo confirm', expected: '' },
      { action: 'Dashboard → Login accountant01 (demo123) → Approve', expected: 'Đơn → pending_customer_confirm' },
      { action: 'Tab "Xác nhận đơn Zalo" → Xác nhận', expected: 'Đơn → confirmed' },
    ],
    dataRules: [
      'NPP hạn mức nhỏ: TB-127 = 20tr, HD-59 = 10tr',
      'Đơn > hạn mức → pending_approval (KHÔNG gửi Zalo)',
      'Kế toán duyệt → chuyển thành pending_customer_confirm → gửi Zalo',
    ],
    businessRules: ['BR-OMS-02 + SM-01 (Credit approval path)'],
  },
]

// Hardcoded fallback scenarios (used if API not reachable)
const fallbackScenarios: ScenarioMeta[] = [
  {
    id: 'SC-01', title: 'Luồng giao hàng đầy đủ (Happy Path)', category: 'E2E',
    description: '8 đơn hàng multi-product (~6.5 tấn) qua tất cả 8 vai trò: DVKH → Zalo → Kế toán → Dispatcher (3 chuyến VRP) → Soạn hàng → Kiểm cổng → Tài xế → Đối soát.',
    roles: ['dvkh','accountant','dispatcher','warehouse','security','driver','accountant','management'],
    data_summary: '8 đơn hàng cho 8 NPP (multi-product, ~6.5 tấn), 3 chuyến xe, GPS giả lập',
    gps_scenario: 'normal_delivery',
    steps: [
      { role:'dvkh', page:'/dashboard/orders/new', action:'Tạo đơn NPP-001: BHL-LON-330 × 200 + BHL-CHAI-450 × 80', expected:'Đơn Chờ KH xác nhận' },
      { role:'dvkh', page:'/test-portal → Zalo', action:'✅ Xác nhận tất cả 8 đơn', expected:'Tất cả → Đã xác nhận' },
      { role:'dispatcher', page:'/dashboard/planning', action:'Chọn 3 xe → VRP → Duyệt', expected:'3 chuyến, 8 điểm giao, notify warehouse' },
      { role:'warehouse', page:'/dashboard/warehouse', action:'Soạn hàng 8 picking orders', expected:'All completed → trip ready' },
      { role:'security', page:'/dashboard/gate-check', action:'Kiểm cổng 3 chuyến → PASS', expected:'Trips → In Transit' },
      { role:'driver', page:'/dashboard/driver', action:'driver01: Giao từng điểm → ePOD → Thu tiền', expected:'Stops delivered' },
      { role:'accountant', page:'/dashboard/reconciliation', action:'Đối soát 3 chuyến', expected:'0 discrepancy' },
      { role:'management', page:'/dashboard/kpi', action:'Xem KPI', expected:'OTD = 100%' },
    ],
    preview_data: [
      { label: 'NPP', value: '8 NPP (NPP-001 → NPP-008), Quảng Ninh + Hải Phòng' },
      { label: 'Sản phẩm', value: 'Multi: BHL-LON-330, BHL-CHAI-450, BHL-GOLD-330, NGK-CHANH-330... ~6.5 tấn' },
      { label: 'Chuyến xe', value: '3 chuyến, 8 điểm giao (truck_5t + truck_3t5)' },
    ],
  },
  {
    id: 'SC-02', title: 'Vượt hạn mức tín dụng → Kế toán duyệt', category: 'CREDIT',
    description: 'NPP có hạn mức thấp (20-30 triệu), tạo đơn lớn vượt hạn mức → đơn tự động chuyển pending_approval → Kế toán phải duyệt.',
    roles: ['dvkh','accountant'],
    data_summary: '2 NPP hạn mức 25 triệu, 1 NPP hạn mức 500 triệu (contrast). Đơn 40 triệu cho NPP nhỏ.',
    steps: [
      { role:'dvkh', page:'/dashboard/orders/new', action:'Tạo đơn 40 triệu cho NPP hạn mức 25M', expected:'Status = Chờ duyệt credit' },
      { role:'dvkh', page:'/dashboard/orders', action:'Kiểm tra danh sách → Badge 🟠 Chờ duyệt', expected:'KHÔNG có Zalo confirmation' },
      { role:'accountant', page:'/dashboard/approvals', action:'Login accountant01 → Duyệt đơn', expected:'Đơn → pending_customer_confirm, Zalo gửi' },
      { role:'dvkh', page:'/test-portal → Zalo', action:'KH xác nhận', expected:'Đơn confirmed' },
    ],
    preview_data: [
      { label: 'NPP vượt hạn mức', value: 'NPP-016 (hạn mức 25 triệu, dư nợ ~20 triệu)' },
      { label: 'Đơn hàng', value: 'BHL-LON-330 × 200 (~37 triệu)' },
    ],
  },
  {
    id: 'SC-03', title: 'Tồn kho không đủ (ATP Fail)', category: 'ATP',
    description: 'Tạo đơn với số lượng vượt tồn kho → đơn bị từ chối. Reserved KHÔNG thay đổi.',
    roles: ['dvkh'],
    data_summary: 'Tồn kho BHL-LON-330: 100 thùng (giảm xuống thấp). Đặt 500 → fail.',
    steps: [
      { role:'dvkh', page:'/test-portal → Tồn kho', action:'Kiểm tra available BHL-LON-330 = 100', expected:'Reserved = 0' },
      { role:'dvkh', page:'/dashboard/orders/new', action:'Tạo đơn BHL-LON-330 × 500', expected:'❌ Lỗi ATP không đủ' },
      { role:'dvkh', page:'/test-portal → Tồn kho', action:'Kiểm tra reserved', expected:'Reserved vẫn = 0' },
      { role:'dvkh', page:'/dashboard/orders/new', action:'Tạo đơn BHL-LON-330 × 50', expected:'✅ Thành công' },
    ],
    preview_data: [
      { label: 'Sản phẩm', value: 'BHL-LON-330 — chỉ 100 thùng' },
      { label: 'Thử vượt', value: '500 thùng → ATP fail' },
    ],
  },
  {
    id: 'SC-04', title: 'KH từ chối đơn qua Zalo', category: 'ZALO',
    description: 'Đơn gửi Zalo → KH từ chối → đơn hủy, stock reserved giải phóng.',
    roles: ['dvkh'],
    data_summary: '2 đơn Zalo: 1 xác nhận, 1 từ chối → so sánh kết quả.',
    steps: [
      { role:'dvkh', page:'/test-portal → Tồn kho', action:'Ghi nhận reserved hiện tại', expected:'Reserved = 70' },
      { role:'dvkh', page:'/test-portal → Zalo', action:'✅ Xác nhận đơn 1', expected:'Đơn 1 confirmed' },
      { role:'dvkh', page:'/test-portal → Zalo', action:'❌ Từ chối đơn 2', expected:'Đơn 2 cancelled, reserved giảm' },
      { role:'dvkh', page:'/test-portal → Tồn kho', action:'Kiểm tra reserved', expected:'Reserved = 50' },
    ],
    preview_data: [
      { label: 'Đơn 1', value: 'NPP-001, BHL-LON-330 × 50 (sẽ xác nhận)' },
      { label: 'Đơn 2', value: 'NPP-002, BHL-LON-330 × 20 (sẽ từ chối)' },
    ],
  },
  {
    id: 'SC-05', title: 'Lập chuyến xe & Điều phối (12 đơn)', category: 'TMS',
    description: '12 đơn confirmed (~8 tấn, multi-product) → Dispatcher lập VRP hoặc THỦ CÔNG → 4 chuyến → GPS tracking.',
    roles: ['dispatcher'],
    data_summary: '12 đơn confirmed, multi-product, 8 tấn tổng, 5 xe available.',
    gps_scenario: 'normal_delivery',
    steps: [
      { role:'dispatcher', page:'/dashboard/planning', action:'Login dispatcher01 → 12 đơn chờ (~8 tấn)', expected:'12 shipments pending' },
      { role:'dispatcher', page:'/dashboard/planning', action:'Chọn 4-5 xe → VRP hoặc Lập thủ công', expected:'VRP: 4 chuyến tối ưu. Thủ công: kéo thả' },
      { role:'dispatcher', page:'/dashboard/planning', action:'Duyệt kế hoạch', expected:'4 trips, notify warehouse + drivers' },
      { role:'dispatcher', page:'/dashboard/control-tower', action:'Xem bản đồ', expected:'4 chuyến trên bản đồ' },
    ],
    preview_data: [
      { label: 'Đơn', value: '12 đơn confirmed (NPP-001 → NPP-012), ~8 tấn' },
      { label: 'Xe', value: '5 xe: truck_3t5 + truck_5t' },
      { label: '2 chế độ', value: 'VRP Tự động (AI) hoặc Lập thủ công (kéo thả)' },
    ],
  },
  {
    id: 'SC-06', title: 'Giao hàng 5 điểm — multi-product (Driver)', category: 'DRIVER',
    description: '1 chuyến 5 tấn × 5 điểm, multi-product (~4.5 tấn, mỗi stop 800-1200kg) → driver01 giao + thu tiền.',
    roles: ['driver','dispatcher'],
    data_summary: '1 chuyến 5 tấn, 5 stops, multi-product, tổng ~4.5 tấn.',
    gps_scenario: 'normal_delivery',
    steps: [
      { role:'driver', page:'/dashboard/driver', action:'Login driver01 → Nhận chuyến → Checklist', expected:'1 chuyến, 5 điểm' },
      { role:'driver', page:'/dashboard/driver', action:'Điểm 1: NPP-001, 120 thùng bia + 40 két chai → ePOD → 26.8M', expected:'Stop 1 delivered' },
      { role:'driver', page:'/dashboard/driver', action:'Lặp 4 điểm còn lại', expected:'All 5 delivered' },
      { role:'driver', page:'/dashboard/driver', action:'Hoàn thành chuyến', expected:'Trip completed, notify kế toán + dispatcher' },
    ],
    preview_data: [
      { label: 'Chuyến', value: 'Xe 5 tấn, tài xế driver01, 5 điểm' },
      { label: 'Sản phẩm', value: 'BHL-LON-330, BHL-CHAI-450, BHL-GOLD-330, NGK-CHANH-330' },
      { label: 'Tổng', value: '~110 triệu, thu tiền mặt/CK tại mỗi điểm' },
    ],
  },
  {
    id: 'SC-07', title: 'Kiểm tra cổng lỗi (Gate Check Fail)', category: 'WMS',
    description: 'Chuyến xe soạn hàng → kiểm cổng thiếu → Fail → Dispatcher xử lý.',
    roles: ['warehouse','security','dispatcher'],
    data_summary: '1 chuyến loaded, kiểm cổng thiếu 5 thùng.',
    steps: [
      { role:'warehouse', page:'/dashboard/warehouse', action:'Xem picking order completed', expected:'Hàng đã soạn' },
      { role:'security', page:'/dashboard/gate-check', action:'Login baove01 → Kiểm tra → Thiếu 5 thùng → FAIL', expected:'Gate check FAIL' },
      { role:'dispatcher', page:'/dashboard/control-tower', action:'Xem alert cổng', expected:'Exception alert' },
    ],
    preview_data: [
      { label: 'Items', value: 'BHL-LON-330 × 150 (expected) vs 145 (actual)' },
    ],
  },
  {
    id: 'SC-08', title: 'Đối soát có chênh lệch (Discrepancy)', category: 'RECON',
    description: 'Chuyến đã giao → đối soát phát hiện chênh lệch tiền → Kế toán xử lý.',
    roles: ['accountant','management'],
    data_summary: '2 chuyến delivered: 1 matched, 1 thiếu 2 triệu.',
    steps: [
      { role:'accountant', page:'/dashboard/reconciliation', action:'Login accountant01 → Xem Đối soát', expected:'1 matched, 1 discrepancy' },
      { role:'accountant', page:'/dashboard/reconciliation', action:'Xử lý chênh lệch -2M', expected:'Discrepancy resolved' },
      { role:'management', page:'/dashboard/kpi', action:'Login manager01 → Xem KPI', expected:'1 discrepancy reported' },
    ],
    preview_data: [
      { label: 'Chuyến 1', value: 'Matched (0 chênh lệch)' },
      { label: 'Chuyến 2', value: 'Thu thiếu 2 triệu' },
    ],
  },
]

function TestCasesTab({ setTab, showToast, refresh }: { setTab: (t: Tab) => void; showToast: (m: string) => void; refresh: () => void }) {
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>(fallbackScenarios)
  const [loading, setLoading] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [activeScenario, setActiveScenario] = useState<ScenarioMeta | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({})
  const [showManual, setShowManual] = useState(false)

  // Try to load from API, fallback to hardcoded
  useEffect(() => {
    api<ScenarioMeta[]>('/scenarios').then(d => {
      if (d && d.length > 0) setScenarios(d)
    })
  }, [])

  const categories = ['all', ...Array.from(new Set(scenarios.map(s => s.category)))]
  const filtered = filterCat === 'all' ? scenarios : scenarios.filter(s => s.category === filterCat)

  const handleLoadScenario = async (scenarioId: string) => {
    if (!confirm(`Nạp dữ liệu cho kịch bản ${scenarioId}?\n\nThao tác này sẽ XÓA toàn bộ dữ liệu nghiệp vụ (đơn, chuyến, đối soát...) và nạp dữ liệu mới phù hợp với kịch bản.`)) return
    setLoadingId(scenarioId)
    const res = await api<{ scenario_id: string; status: string; message: string }>('/load-scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: scenarioId })
    })
    setLoadingId(null)
    if (res) {
      showToast(res.message)
      const sc = scenarios.find(s => s.id === scenarioId)
      setActiveScenario(sc || null)
      setExpandedId(scenarioId)
      setCompletedSteps({})
      refresh()
    } else {
      showToast('❌ Lỗi nạp dữ liệu — kiểm tra console')
    }
  }

  const toggleStep = (key: string) => {
    setCompletedSteps(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const catColor: Record<string, string> = {
    E2E: 'bg-red-100 text-red-700 border-red-200',
    CREDIT: 'bg-orange-100 text-orange-700 border-orange-200',
    ATP: 'bg-purple-100 text-purple-700 border-purple-200',
    ZALO: 'bg-blue-100 text-blue-700 border-blue-200',
    TMS: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    DRIVER: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    WMS: 'bg-teal-100 text-teal-700 border-teal-200',
    RECON: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  }

  const catIcon: Record<string, string> = {
    E2E: '🔄', CREDIT: '💳', ATP: '📦', ZALO: '📱',
    TMS: '🗺️', DRIVER: '🚛', WMS: '🏭', RECON: '📊',
  }

  const roleIcon: Record<string, string> = {
    dvkh: '👩‍💼', accountant: '🧾', dispatcher: '🗺️', warehouse: '📦',
    security: '🛡️', driver: '🚛', management: '📊', admin: '⚙️',
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-xl mb-2">🎯 Kịch bản Test — Chọn & Nạp dữ liệu</h3>
            <p className="text-gray-300 text-sm">
              Mỗi kịch bản đi kèm dữ liệu riêng. Nhấn <strong>&quot;Nạp data&quot;</strong> để xóa dữ liệu cũ và tải dữ liệu test mới.
              <br />Sau đó thực hiện từng bước, đánh dấu hoàn thành ✅ và kiểm tra kết quả ở các tab.
            </p>
          </div>
          <button onClick={() => setShowManual(!showManual)}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition flex-shrink-0">
            {showManual ? '✕ Ẩn' : '📖 Manual test cases'}
          </button>
        </div>

        {/* Account reference */}
        <details className="mt-4 bg-white/10 border border-white/20 rounded-lg">
          <summary className="px-4 py-2.5 cursor-pointer text-sm font-semibold text-amber-300 hover:text-amber-200">
            🔐 Danh sách tài khoản test (mật khẩu: demo123)
          </summary>
          <div className="px-4 pb-3 pt-1">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="bg-white/5 rounded p-2">
                <div className="text-amber-300 font-semibold mb-1">👩‍💼 ĐVKH (Nhân viên KD)</div>
                <div className="text-gray-300">dvkh01 / demo123</div>
                <div className="text-gray-400 text-[10px] mt-0.5">Tạo đơn, theo dõi đơn hàng</div>
              </div>
              <div className="bg-white/5 rounded p-2">
                <div className="text-amber-300 font-semibold mb-1">🧾 Kế toán</div>
                <div className="text-gray-300">accountant01 / demo123</div>
                <div className="text-gray-400 text-[10px] mt-0.5">Duyệt credit, đối soát</div>
              </div>
              <div className="bg-white/5 rounded p-2">
                <div className="text-amber-300 font-semibold mb-1">🗺️ Dispatcher</div>
                <div className="text-gray-300">dispatcher01 / demo123</div>
                <div className="text-gray-400 text-[10px] mt-0.5">Lập chuyến, điều phối</div>
              </div>
              <div className="bg-white/5 rounded p-2">
                <div className="text-amber-300 font-semibold mb-1">📦 Thủ kho</div>
                <div className="text-gray-300">warehouse01 / demo123</div>
                <div className="text-gray-400 text-[10px] mt-0.5">Soạn hàng, picking</div>
              </div>
              <div className="bg-white/5 rounded p-2">
                <div className="text-amber-300 font-semibold mb-1">🛡️ Bảo vệ</div>
                <div className="text-gray-300">baove01 / demo123</div>
                <div className="text-gray-400 text-[10px] mt-0.5">Kiểm tra cổng</div>
              </div>
              <div className="bg-white/5 rounded p-2">
                <div className="text-amber-300 font-semibold mb-1">🚛 Tài xế</div>
                <div className="text-gray-300">driver01 ~ driver08 / demo123</div>
                <div className="text-gray-400 text-[10px] mt-0.5">Nhận chuyến, giao hàng</div>
              </div>
              <div className="bg-white/5 rounded p-2">
                <div className="text-amber-300 font-semibold mb-1">📊 Quản lý</div>
                <div className="text-gray-300">manager01 / demo123</div>
                <div className="text-gray-400 text-[10px] mt-0.5">KPI, báo cáo tổng hợp</div>
              </div>
              <div className="bg-white/5 rounded p-2">
                <div className="text-amber-300 font-semibold mb-1">⚙️ Admin</div>
                <div className="text-gray-300">admin / demo123</div>
                <div className="text-gray-400 text-[10px] mt-0.5">Quản lý hệ thống</div>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-gray-400">
              📌 Dashboard: <span className="text-gray-300">http://localhost:3001/dashboard</span> · Mỗi role tự redirect về trang phù hợp sau khi đăng nhập
            </div>
          </div>
        </details>

        {/* Active scenario indicator */}
        {activeScenario && (
          <div className="mt-4 bg-green-500/20 border border-green-400/30 rounded-lg p-3 flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400" />
            </span>
            <span className="text-green-200 text-sm">
              Đang test: <strong className="text-white">{activeScenario.id} — {activeScenario.title}</strong>
            </span>
          </div>
        )}

        {/* Category filter */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setFilterCat(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                filterCat === c ? 'bg-white text-gray-900' : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}>
              {c === 'all' ? '📋 Tất cả' : `${catIcon[c] || '📁'} ${c}`}
            </button>
          ))}
        </div>
      </div>

      {/* Scenario cards */}
      {filtered.map(sc => {
        const isExpanded = expandedId === sc.id
        const isActive = activeScenario?.id === sc.id
        const isLoading = loadingId === sc.id
        const totalSteps = sc.steps.length
        const doneSteps = sc.steps.filter((_, i) => completedSteps[`${sc.id}-${i}`]).length

        return (
          <div key={sc.id} className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all ${
            isActive ? 'border-green-400 ring-2 ring-green-100' : 'border-gray-100 hover:border-gray-200'
          }`}>
            {/* Card header — clickable to expand */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : sc.id)}
              className="w-full px-5 py-4 flex items-center gap-3 hover:bg-gray-50 transition text-left"
            >
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${catColor[sc.category] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {catIcon[sc.category] || '📁'} {sc.category}
              </span>
              <span className="font-mono text-sm text-gray-400">{sc.id}</span>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-gray-900">{sc.title}</span>
                {!isExpanded && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{sc.description}</p>
                )}
              </div>

              {/* Roles */}
              <div className="hidden md:flex gap-1 mr-2 flex-shrink-0">
                {Array.from(new Set(sc.roles)).slice(0, 4).map((r, i) => (
                  <span key={i} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm"
                    title={r}>{roleIcon[r] || '👤'}</span>
                ))}
              </div>

              {/* Chevron */}
              <svg className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t">
                {/* Big "Nạp data" section */}
                <div className="px-5 py-4 bg-gradient-to-r from-orange-50 to-amber-50 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{sc.description}</p>
                    <p className="text-xs text-gray-500 mt-1">📊 {sc.data_summary}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleLoadScenario(sc.id) }}
                    disabled={isLoading}
                    className={`px-6 py-3 rounded-xl text-base font-bold transition flex items-center gap-2 flex-shrink-0 shadow-md ${
                      isActive
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-[#F68634] text-white hover:bg-[#e5762a]'
                    } disabled:opacity-50`}>
                    {isLoading ? (
                      <><span className="animate-spin">⏳</span> Đang nạp...</>
                    ) : isActive ? (
                      <><span>✅</span> Nạp lại data</>
                    ) : (
                      <><span>▶️</span> Nạp data cho kịch bản này</>
                    )}
                  </button>
                </div>

                <div className="px-5 pb-5 bg-gray-50 space-y-4 pt-4">

                {/* Data preview */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-xs font-bold text-blue-700 uppercase mb-2">📊 Dữ liệu sẽ được nạp</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {sc.preview_data.map((dp, i) => (
                      <div key={i} className="flex gap-2 text-sm">
                        <span className="text-blue-500 font-medium min-w-[80px]">{dp.label}:</span>
                        <span className="text-blue-900">{dp.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step-by-step guide */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-gray-500 uppercase">
                      📝 Các bước thực hiện ({doneSteps}/{totalSteps})
                    </h4>
                    {isActive && totalSteps > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-1.5">
                          <div className="bg-green-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${(doneSteps / totalSteps) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{Math.round((doneSteps / totalSteps) * 100)}%</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {sc.steps.map((s, i) => {
                      const stepKey = `${sc.id}-${i}`
                      const isDone = completedSteps[stepKey]
                      return (
                        <div key={i} className={`flex gap-3 items-start rounded-lg p-3 border transition ${
                          isDone ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                        }`}>
                          {isActive ? (
                            <button onClick={() => toggleStep(stepKey)}
                              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition text-xs font-bold ${
                                isDone ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                              }`}>
                              {isDone ? '✓' : i + 1}
                            </button>
                          ) : (
                            <span className="bg-amber-100 text-amber-700 font-bold text-xs rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                              {i + 1}
                            </span>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs"
                                title={s.role}>{roleIcon[s.role] || '👤'}</span>
                              <span className="text-xs text-gray-400 font-medium">{s.role}</span>
                              <span className="text-xs text-gray-300">→</span>
                              <span className="text-xs text-gray-400 font-mono">{s.page}</span>
                            </div>
                            <p className={`text-sm font-medium ${isDone ? 'text-green-700 line-through' : 'text-gray-800'}`}>{s.action}</p>
                            {s.expected && (
                              <p className="text-xs text-green-600 mt-1">✓ Kỳ vọng: {s.expected}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* GPS link */}
                {sc.gps_scenario && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm text-emerald-700">
                      📡 Kịch bản GPS: <strong>{sc.gps_scenario}</strong>
                    </span>
                    <button onClick={() => setTab('gps-sim')}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition">
                      Mở GPS Simulator →
                    </button>
                  </div>
                )}

                {/* Quick nav */}
                <div className="flex gap-2 pt-2 border-t flex-wrap">
                  {sc.roles.includes('dvkh') && (
                    <button onClick={() => setTab('create-order')}
                      className="px-3 py-1.5 bg-[#F68634] text-white rounded-lg text-xs font-medium hover:bg-[#e5762a] transition">
                      ➕ Tạo đơn test
                    </button>
                  )}
                  <button onClick={() => setTab('orders')}
                    className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-xs font-medium hover:bg-gray-700 transition">
                    📋 Đơn hàng
                  </button>
                  <button onClick={() => setTab('order-confirm')}
                    className="px-3 py-1.5 bg-brand-500 text-white rounded-lg text-xs font-medium hover:bg-brand-600 transition">
                    📱 Zalo
                  </button>
                  <button onClick={() => setTab('stock')}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition">
                    📦 Tồn kho
                  </button>
                  <button onClick={() => setTab('credit')}
                    className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 transition">
                    💰 Dư nợ
                  </button>
                </div>
              </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Manual test cases (collapsible) */}
      {showManual && (
        <div className="space-y-3 mt-6">
          <h3 className="text-lg font-semibold text-gray-700 border-t pt-4">📖 Manual Test Cases (tham khảo)</h3>
          {testCases.map(tc => (
            <div key={tc.id} className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${tc.categoryColor}`}>{tc.category}</span>
                <span className="font-mono text-xs text-gray-400">{tc.id}</span>
                <span className="font-medium text-sm">{tc.title}</span>
              </div>
              <p className="text-xs text-gray-500">{tc.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===== Tab: Orders =====
function OrdersTab({ refreshKey, showToast, refresh }: { refreshKey: number; showToast: (m: string) => void; refresh: () => void }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api<Order[]>('/orders').then(d => { setOrders(d || []); setLoading(false) })
  }, [refreshKey])

  if (loading) return <Spinner />
  if (!orders.length) return <EmptyState text="Chưa có đơn hàng nào. Tạo đơn test ở tab ➕" />

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50">
        <h2 className="font-bold text-lg">📋 Danh sách đơn hàng ({orders.length})</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Mã đơn</th>
              <th className="px-4 py-3 text-left">Khách hàng</th>
              <th className="px-4 py-3 text-left">Trạng thái</th>
              <th className="px-4 py-3 text-right">Tổng tiền</th>
              <th className="px-4 py-3 text-left">Ngày giao</th>
              <th className="px-4 py-3 text-left">Xác nhận KH</th>
              <th className="px-4 py-3 text-left">Tạo lúc</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-amber-50 transition">
                <td className="px-4 py-3 font-mono font-medium text-amber-700">{o.order_number}</td>
                <td className="px-4 py-3">{o.customer_name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(o.status)}`}>
                    {statusLabel[o.status] || o.status}
                  </span>
                  {o.reject_reason && (
                    <div className="mt-1 text-xs text-red-600">Lý do: {o.reject_reason}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium">{fmtMoney(o.total_amount)}</td>
                <td className="px-4 py-3">{o.delivery_date}</td>
                <td className="px-4 py-3">
                  {o.confirm_token ? (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(o.confirm_status || 'sent')}`}>
                      {statusLabel[o.confirm_status || 'sent'] || o.confirm_status}
                    </span>
                  ) : <span className="text-gray-400">-</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===== Tab: Order Confirmations =====
function OrderConfirmTab({ refreshKey, showToast, refresh }: { refreshKey: number; showToast: (m: string) => void; refresh: () => void }) {
  const [items, setItems] = useState<OrderConfirmation[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api<OrderConfirmation[]>('/order-confirmations').then(d => { setItems(d || []); setLoading(false) })
  }, [refreshKey])

  const handleConfirm = async (token: string) => {
    setActing(token)
    const res = await fetch(`/api/order-confirm/${token}/confirm`, { method: 'POST' })
    const json = await res.json()
    showToast(json.success ? '✅ Đơn hàng đã xác nhận!' : `❌ ${json.error?.message || 'Lỗi'}`)
    setActing(null)
    refresh()
  }

  const handleReject = async (token: string) => {
    const reason = prompt('Lý do từ chối:')
    if (!reason) return
    setActing(token)
    const res = await fetch(`/api/order-confirm/${token}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    })
    const json = await res.json()
    showToast(json.success ? '❌ Đơn hàng đã từ chối!' : `Lỗi: ${json.error?.message}`)
    setActing(null)
    refresh()
  }

  if (loading) return <Spinner />
  if (!items.length) return <EmptyState text="Chưa có xác nhận đơn hàng nào. Tạo đơn test trước." />

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-bold text-blue-700 mb-2">📱 Mô phỏng xác nhận đơn hàng qua Zalo</h3>
        <p className="text-sm text-blue-600">
          Sau khi DVKH tạo đơn → Zalo gửi link cho KH → KH nhấn Xác nhận hoặc Từ chối.
          <br />Nếu 2h không phản hồi → tự động xác nhận.
          <br />Nhấn nút bên dưới để mô phỏng hành động của khách hàng.
        </p>
      </div>

      {items.map(item => (
        <div key={item.id} className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-amber-500">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-mono font-bold text-amber-700 text-lg">{item.order_number}</span>
              <span className="ml-3 text-gray-500">{item.customer_name}</span>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusBadge(item.status)}`}>
              {statusLabel[item.status] || item.status}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
            <div><span className="text-gray-500">Tổng tiền:</span> <span className="font-bold">{fmtMoney(item.total_amount)}</span></div>
            <div><span className="text-gray-500">SĐT:</span> {item.phone}</div>
            <div><span className="text-gray-500">Gửi lúc:</span> {fmtDate(item.sent_at)}</div>
            <div><span className="text-gray-500">Hết hạn:</span>
              <span className={new Date(item.expires_at) < new Date() ? 'text-red-600 font-medium' : ''}>
                {' '}{fmtDate(item.expires_at)}
              </span>
            </div>
            {item.confirmed_at && <div><span className="text-gray-500">Xác nhận lúc:</span> <span className="text-green-600">{fmtDate(item.confirmed_at)}</span></div>}
            {item.rejected_at && <div><span className="text-gray-500">Từ chối lúc:</span> <span className="text-red-600">{fmtDate(item.rejected_at)}</span></div>}
            {item.reject_reason && <div className="col-span-2"><span className="text-gray-500">Lý do:</span> <span className="text-red-600">{item.reject_reason}</span></div>}
            {item.auto_confirmed_at && <div><span className="text-gray-500">Tự động XN:</span> <span className="text-blue-600">{fmtDate(item.auto_confirmed_at)}</span></div>}
          </div>

          {item.status === 'sent' && (
            <div className="flex gap-3 pt-3 border-t">
              <button onClick={() => handleConfirm(item.token)} disabled={acting === item.token}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition">
                {acting === item.token ? '⏳...' : '✅ Xác nhận đơn hàng (vai KH)'}
              </button>
              <button onClick={() => handleReject(item.token)} disabled={acting === item.token}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition">
                {acting === item.token ? '⏳...' : '❌ Từ chối đơn hàng (vai KH)'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ===== Tab: Delivery Confirmations =====
function DeliveryConfirmTab({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<DeliveryConfirmation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api<DeliveryConfirmation[]>('/delivery-confirmations').then(d => { setItems(d || []); setLoading(false) })
  }, [refreshKey])

  if (loading) return <Spinner />
  if (!items.length) return <EmptyState text="Chưa có xác nhận giao hàng nào." />

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50">
        <h2 className="font-bold text-lg">🚛 Xác nhận giao hàng — Zalo ({items.length})</h2>
        <p className="text-sm text-gray-500 mt-1">Sau tài xế giao hàng → Zalo gửi NPP → NPP xác nhận/khiếu nại (24h auto)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Mã đơn</th>
              <th className="px-4 py-3 text-left">Khách hàng</th>
              <th className="px-4 py-3 text-left">SĐT</th>
              <th className="px-4 py-3 text-left">Trạng thái</th>
              <th className="px-4 py-3 text-right">Tổng tiền</th>
              <th className="px-4 py-3 text-left">Gửi lúc</th>
              <th className="px-4 py-3 text-left">XN/Khiếu nại</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-amber-50">
                <td className="px-4 py-3 font-mono text-amber-700">{item.order_number}</td>
                <td className="px-4 py-3">{item.customer_name}</td>
                <td className="px-4 py-3 text-gray-500">{item.phone}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(item.status)}`}>
                    {statusLabel[item.status] || item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{fmtMoney(item.total_amount)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(item.sent_at)}</td>
                <td className="px-4 py-3 text-xs">
                  {item.confirmed_at && <span className="text-green-600">{fmtDate(item.confirmed_at)}</span>}
                  {item.disputed_at && <span className="text-red-600">{fmtDate(item.disputed_at)}: {item.dispute_reason}</span>}
                  {item.auto_confirmed_at && <span className="text-blue-600">Auto: {fmtDate(item.auto_confirmed_at)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===== Tab: Stock =====
function StockTab({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api<StockRow[]>('/stock').then(d => { setItems(d || []); setLoading(false) })
  }, [refreshKey])

  if (loading) return <Spinner />
  if (!items.length) return <EmptyState text="Chưa có dữ liệu tồn kho." />

  // Group by warehouse
  const grouped: Record<string, StockRow[]> = {}
  items.forEach(i => {
    const k = i.warehouse_name || 'Unknown'
    if (!grouped[k]) grouped[k] = []
    grouped[k].push(i)
  })

  return (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <h3 className="font-bold text-green-700 mb-1">📦 Tồn kho / ATP (Available-To-Promise)</h3>
        <p className="text-sm text-green-600">
          Available = Tổng - Reserved. Khi tạo đơn → Reserved tăng. Khi hủy đơn → Reserved giảm.
        </p>
      </div>

      {Object.entries(grouped).map(([wh, rows]) => (
        <div key={wh} className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-3 bg-gray-50 border-b">
            <h3 className="font-bold">🏭 {wh}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-left">Sản phẩm</th>
                  <th className="px-4 py-3 text-right">Tổng</th>
                  <th className="px-4 py-3 text-right">Đã đặt</th>
                  <th className="px-4 py-3 text-right">Khả dụng (ATP)</th>
                  <th className="px-4 py-3 text-left">Lô</th>
                  <th className="px-4 py-3 text-left">Hạn sử dụng</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((s, i) => (
                  <tr key={i} className="hover:bg-amber-50">
                    <td className="px-4 py-2 font-mono text-xs">{s.product_sku}</td>
                    <td className="px-4 py-2">{s.product_name}</td>
                    <td className="px-4 py-2 text-right font-medium">{s.total_qty}</td>
                    <td className="px-4 py-2 text-right text-orange-600">{s.reserved}</td>
                    <td className={`px-4 py-2 text-right font-bold ${s.available <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {s.available}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{s.batch_number || '-'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{s.expiry_date || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// ===== Tab: Credit =====
function CreditTab({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<CreditRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api<CreditRow[]>('/credit-balances').then(d => { setItems(d || []); setLoading(false) })
  }, [refreshKey])

  if (loading) return <Spinner />
  if (!items.length) return <EmptyState text="Chưa có dữ liệu dư nợ." />

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50">
        <h2 className="font-bold text-lg">💰 Dư nợ & Hạn mức tín dụng NPP</h2>
        <p className="text-sm text-gray-500 mt-1">
          Khi Available {'<'} Tổng tiền đơn hàng → Đơn chuyển pending_approval → Kế toán duyệt
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Mã NPP</th>
              <th className="px-4 py-3 text-left">Tên NPP</th>
              <th className="px-4 py-3 text-right">Hạn mức</th>
              <th className="px-4 py-3 text-right">Dư nợ hiện tại</th>
              <th className="px-4 py-3 text-right">Khả dụng</th>
              <th className="px-4 py-3 text-left">Tình trạng</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(c => {
              const pct = c.credit_limit > 0 ? (c.current_balance / c.credit_limit * 100) : 0
              return (
                <tr key={c.id} className="hover:bg-amber-50">
                  <td className="px-4 py-3 font-mono text-amber-700">{c.code}</td>
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3 text-right">{fmtMoney(c.credit_limit)}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{fmtMoney(c.current_balance)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${c.available_limit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {fmtMoney(c.available_limit)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{pct.toFixed(0)}%</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===== Tab: Create Order =====
function CreateOrderTab({ showToast, refresh }: { showToast: (m: string) => void; refresh: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [orderItems, setOrderItems] = useState<{ productId: string; quantity: number }[]>([{ productId: '', quantity: 10 }])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    api<Customer[]>('/customers').then(d => setCustomers(d || []))
    api<Product[]>('/products').then(d => setProducts(d || []))
    // Get warehouses from stock data
    api<StockRow[]>('/stock').then(d => {
      if (!d) return
      const whMap = new Map<string, string>()
      d.forEach(s => whMap.set(s.warehouse_id, s.warehouse_name))
      setWarehouses(Array.from(whMap.entries()).map(([id, name]) => ({ id, name })))
    })
  }, [])

  const addItem = () => setOrderItems(prev => [...prev, { productId: '', quantity: 10 }])
  const removeItem = (idx: number) => setOrderItems(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async () => {
    if (!selectedCustomer || !selectedWarehouse || !orderItems.some(i => i.productId && i.quantity > 0)) {
      showToast('Vui lòng chọn khách hàng, kho và sản phẩm')
      return
    }
    setSubmitting(true)
    setResult(null)
    const body = {
      customer_id: selectedCustomer,
      warehouse_id: selectedWarehouse,
      items: orderItems.filter(i => i.productId && i.quantity > 0).map(i => ({
        product_id: i.productId, quantity: i.quantity
      }))
    }
    const res = await api<Record<string, unknown>>('/create-test-order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (res) {
      setResult(res)
      showToast(`✅ Tạo đơn thành công: ${res.order_number}`)
      refresh()
    } else {
      showToast('❌ Lỗi tạo đơn - kiểm tra console')
    }
    setSubmitting(false)
  }

  const totalAmount = orderItems.reduce((sum, item) => {
    const p = products.find(pr => pr.id === item.productId)
    return sum + (p ? p.price * item.quantity : 0)
  }, 0)

  const selectedCust = customers.find(c => c.id === selectedCustomer)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 className="font-bold text-amber-700 mb-1">➕ Tạo đơn test nhanh</h3>
        <p className="text-sm text-amber-600">
          Tạo đơn hàng trực tiếp qua DB (bypass business validation). Đơn sẽ ở trạng thái pending_customer_confirm
          hoặc pending_approval (nếu vượt credit).
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        {/* Customer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Khách hàng (NPP)</label>
          <SearchableSelect
            options={customers.map(c => ({
              value: c.id,
              label: `${c.code} — ${c.name}`,
              sublabel: `HM: ${fmtMoney(c.credit_limit)} | ${c.phone || ''} | ${c.address?.substring(0, 50) || ''}`
            }))}
            value={selectedCustomer}
            onChange={setSelectedCustomer}
            placeholder="🔍 Tìm NPP theo mã hoặc tên..."
          />
          {selectedCust && (
            <p className="text-xs text-gray-500 mt-1">
              📞 {selectedCust.phone || 'N/A'} | 📍 {selectedCust.address?.substring(0, 60) || 'N/A'}
            </p>
          )}
        </div>

        {/* Warehouse */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kho xuất</label>
          <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">-- Chọn kho --</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {/* Items */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Sản phẩm</label>
          {orderItems.map((item, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <div className="flex-1">
                <SearchableSelect
                  options={products.map(p => ({
                    value: p.id,
                    label: `${p.sku} — ${p.name}`,
                    sublabel: `${fmtMoney(p.price)}/thùng`
                  }))}
                  value={item.productId}
                  onChange={val => setOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, productId: val } : it))}
                  placeholder="🔍 Tìm sản phẩm..."
                />
              </div>
              <input type="number" min="1" value={item.quantity || ''}
                onChange={e => setOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Number(e.target.value) || 0 } : it))}
                className="w-24 border rounded-lg px-3 py-2 text-sm text-center"
              />
              {orderItems.length > 1 && (
                <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 px-2">✕</button>
              )}
            </div>
          ))}
          <button onClick={addItem} className="text-sm text-amber-600 hover:text-amber-800 mt-1">+ Thêm sản phẩm</button>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between text-lg font-bold">
            <span>Tổng tiền:</span>
            <span className="text-amber-700">{fmtMoney(totalAmount)}</span>
          </div>
          {selectedCust && (
            <p className={`text-sm mt-1 ${totalAmount > selectedCust.credit_limit ? 'text-red-600 font-medium' : 'text-green-600'}`}>
              {totalAmount > selectedCust.credit_limit
                ? `⚠️ Vượt hạn mức! (${fmtMoney(selectedCust.credit_limit)}) → Đơn sẽ pending_approval`
                : `✅ Trong hạn mức (${fmtMoney(selectedCust.credit_limit)})`
              }
            </p>
          )}
        </div>

        <button onClick={handleSubmit} disabled={submitting}
          className="w-full py-3 bg-brand-500 text-white rounded-lg font-bold text-lg hover:bg-brand-600 disabled:opacity-50 transition">
          {submitting ? '⏳ Đang tạo...' : '🛒 Tạo đơn hàng test'}
        </button>

        {result && (
          <div className="bg-green-50 border border-green-300 rounded-lg p-4">
            <h4 className="font-bold text-green-700 mb-2">✅ Đơn đã tạo thành công!</h4>
            <pre className="text-xs text-green-800 overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

// ===== Shared Components =====
// ===== Tab: GPS Simulation =====
interface GPSScenario {
  id: string; name: string; description: string; category: string
  vehicle_count: number; duration: string
  routes?: { name: string; waypoints: { lat: number; lng: number; name: string }[] }[]
}
interface GPSVehicle {
  id: string; plate: string; type: string; driver_name: string; trip_status: string
}
interface GPSSimStatusData {
  running: boolean; scenario_id?: string; scenario_name?: string
  vehicle_count?: number; started_at?: string; tick_count?: number
  vehicle_states?: { vehicle_id: string; plate: string; lat: number; lng: number; speed: number; heading: number; status: string; waypoint_idx: number }[]
}

function GPSSimTab({ refreshKey, showToast }: { refreshKey: number; showToast: (m: string) => void }) {
  const [scenarios, setScenarios] = useState<GPSScenario[]>([])
  const [vehicles, setVehicles] = useState<GPSVehicle[]>([])
  const [selectedScenario, setSelectedScenario] = useState<string>('')
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([])
  const [intervalMs, setIntervalMs] = useState(3000)
  const [status, setStatus] = useState<GPSSimStatusData | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    api<GPSScenario[]>('/gps/scenarios').then(d => d && setScenarios(d))
    api<GPSVehicle[]>('/gps/vehicles').then(d => d && setVehicles(d))
    api<GPSSimStatusData>('/gps/status').then(d => d && setStatus(d))
  }, [refreshKey])

  // Auto-refresh status every 3s while running
  useEffect(() => {
    if (!autoRefresh) return
    const iv = setInterval(async () => {
      const s = await api<GPSSimStatusData>('/gps/status')
      if (s) setStatus(s)
      if (s && !s.running) setAutoRefresh(false)
    }, 3000)
    return () => clearInterval(iv)
  }, [autoRefresh])

  const handleStart = async () => {
    if (!selectedScenario) { showToast('Chọn kịch bản trước'); return }
    setLoading(true)
    const res = await api<{ message: string }>('/gps/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario_id: selectedScenario,
        vehicle_ids: selectedVehicles.length > 0 ? selectedVehicles : undefined,
        interval_ms: intervalMs,
      }),
    })
    setLoading(false)
    if (res) {
      showToast(res.message)
      setAutoRefresh(true)
      const s = await api<GPSSimStatusData>('/gps/status')
      if (s) setStatus(s)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    const res = await api<{ message: string }>('/gps/stop', { method: 'POST' })
    setLoading(false)
    if (res) showToast(res.message)
    setAutoRefresh(false)
    const s = await api<GPSSimStatusData>('/gps/status')
    if (s) setStatus(s)
  }

  const toggleVehicle = (id: string) => {
    setSelectedVehicles(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])
  }

  const sc = scenarios.find(s => s.id === selectedScenario)
  const catColor: Record<string, string> = {
    delivery: 'bg-green-100 text-green-700', anomaly: 'bg-red-100 text-red-700',
    performance: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {status?.running && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
            <div>
              <p className="font-semibold text-green-800">Đang chạy: {status.scenario_name}</p>
              <p className="text-sm text-green-600">
                {status.vehicle_count} xe · Tick #{status.tick_count} · Bắt đầu: {status.started_at ? fmtDate(status.started_at) : '-'}
              </p>
            </div>
          </div>
          <button onClick={handleStop} disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 text-sm font-medium disabled:opacity-50">
            ⏹️ Dừng
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Scenario selection */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-lg font-semibold mb-4">📡 Chọn kịch bản giả lập</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scenarios.map(s => (
                <button key={s.id} onClick={() => setSelectedScenario(s.id)}
                  className={`text-left p-4 rounded-lg border-2 transition ${
                    selectedScenario === s.id ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${catColor[s.category] || 'bg-gray-100 text-gray-600'}`}>
                      {s.category}
                    </span>
                    <span className="text-xs text-gray-400">{s.duration}</span>
                  </div>
                  <p className="font-medium text-gray-900">{s.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{s.description}</p>
                  {s.vehicle_count > 0 && <p className="text-xs text-gray-400 mt-1">🚛 {s.vehicle_count} xe mặc định</p>}
                </button>
              ))}
            </div>
          </div>

          {/* Route preview */}
          {sc?.routes && sc.routes.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-lg font-semibold mb-3">🗺️ Tuyến đường trong kịch bản</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sc.routes.map((r, i) => (
                  <div key={i} className="border rounded-lg p-3">
                    <p className="font-medium text-sm">{r.name}</p>
                    <div className="mt-2 space-y-1">
                      {r.waypoints?.map((wp, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs text-gray-600">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                            j === 0 ? 'bg-green-500' : j === (r.waypoints?.length || 0) - 1 ? 'bg-red-500' : 'bg-amber-500'
                          }`}>{j + 1}</span>
                          {wp.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Controls + Vehicle selection */}
        <div className="space-y-4">
          {/* Controls */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-lg font-semibold mb-4">⚙️ Cài đặt</h3>

            <label className="block text-sm font-medium text-gray-700 mb-1">Tần suất GPS (ms)</label>
            <input type="range" min={1000} max={10000} step={500} value={intervalMs}
              onChange={e => setIntervalMs(Number(e.target.value))}
              className="w-full mb-1" />
            <p className="text-xs text-gray-500 mb-4">{intervalMs}ms ({(intervalMs / 1000).toFixed(1)}s mỗi update)</p>

            <div className="flex gap-2">
              <button onClick={handleStart} disabled={loading || !selectedScenario || status?.running === true}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-500 text-sm font-medium disabled:opacity-50 transition">
                {loading ? '⏳...' : '▶️ Bắt đầu'}
              </button>
              <button onClick={handleStop} disabled={loading || !status?.running}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-500 text-sm font-medium disabled:opacity-50 transition">
                ⏹️ Dừng
              </button>
            </div>

            <a href="/dispatcher" target="_blank" rel="noopener noreferrer"
              className="block text-center mt-3 text-sm text-amber-600 hover:text-amber-700 font-medium">
              🗺️ Mở Control Tower để xem bản đồ →
            </a>
          </div>

          {/* Vehicle selection */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold mb-3">🚛 Chọn xe (tuỳ chọn)</h3>
            <p className="text-xs text-gray-500 mb-3">Không chọn = dùng xe mặc định từ DB</p>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {vehicles.map(v => (
                <label key={v.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input type="checkbox" checked={selectedVehicles.includes(v.id)}
                    onChange={() => toggleVehicle(v.id)} className="rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.plate}</p>
                    <p className="text-xs text-gray-500">{v.driver_name} · {v.trip_status === 'has_trip' ? '🟢 Có trip' : '⚪ Rảnh'}</p>
                  </div>
                </label>
              ))}
              {vehicles.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Không có xe</p>}
            </div>
          </div>

          {/* Live vehicle states */}
          {status?.running && status.vehicle_states && status.vehicle_states.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold mb-3">📍 Trạng thái xe</h3>
              <div className="space-y-2">
                {status.vehicle_states.map(vs => {
                  const stColor: Record<string, string> = {
                    moving: 'bg-green-100 text-green-700', delivering: 'bg-amber-100 text-amber-700',
                    idle: 'bg-gray-100 text-gray-600', lost_signal: 'bg-red-100 text-red-700',
                  }
                  return (
                    <div key={vs.vehicle_id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-gray-50">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${stColor[vs.status] || 'bg-gray-100'}`}>
                        {vs.status}
                      </span>
                      <span className="font-medium">{vs.plate}</span>
                      <span className="text-gray-400 text-xs ml-auto">
                        {vs.speed.toFixed(0)} km/h · WP {vs.waypoint_idx}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500" />
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-20 text-gray-500">
      <div className="text-4xl mb-3">📭</div>
      <p>{text}</p>
    </div>
  )
}

// ===== Tab: Tài xế & Tài khoản =====
interface DriverInfo {
  id: string; full_name: string; phone: string; license_number: string | null
  status: string; warehouse_id: string; user_id: string
}

function DriversTab() {
  const [drivers, setDrivers] = useState<DriverInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/drivers', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.json())
      .then(d => setDrivers(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Mapping username từ user_id (pattern: d1000000-...-00000000XXXX → driverXX)
  const getUsername = (userId: string): string => {
    // Tìm số cuối cùng từ UUID
    const suffix = userId.replace(/-/g, '').slice(-4)
    const num = parseInt(suffix, 10)
    if (num > 0 && num <= 70) return `driver${num.toString().padStart(2, '0')}`
    // Fallback cho seed.sql cũ (b0000000-...)
    if (userId.startsWith('b0000000')) {
      const old = parseInt(userId.slice(-4), 10) - 4
      if (old > 0 && old <= 8) return `driver${old.toString().padStart(2, '0')}`
    }
    return `driver??`
  }

  const getWarehouseName = (whId: string) => {
    if (whId?.includes('0001')) return '🏭 Kho Hạ Long'
    if (whId?.includes('0002')) return '🏭 Kho Hải Phòng'
    return whId || '-'
  }

  if (loading) return <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>

  return (
    <div>
      {/* E2E Test Guide */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
        <h3 className="font-bold text-amber-800 text-lg mb-3">📋 Hướng dẫn Test E2E — Tài xế</h3>
        <div className="space-y-2 text-sm text-amber-900">
          <p><strong>Bước 1:</strong> Đăng nhập tài khoản <code className="bg-amber-100 px-1 rounded">dispatcher01</code> → Tạo chuyến, gán tài xế</p>
          <p><strong>Bước 2:</strong> Ghi nhớ tên tài xế đã gán (xem bảng bên dưới)</p>
          <p><strong>Bước 3:</strong> Đăng nhập bằng tài khoản tương ứng (mật khẩu: <code className="bg-amber-100 px-1 rounded">demo123</code>)</p>
          <p><strong>Bước 4:</strong> Vào trang Tài xế → Xem chuyến → Bắt đầu giao → ePOD → Thu tiền → Hoàn thành</p>
        </div>
        <div className="mt-3 p-3 bg-white rounded-lg border border-amber-100">
          <p className="text-xs text-amber-700 font-medium mb-1">💡 Mẹo test nhanh:</p>
          <p className="text-xs text-amber-600">Dùng <strong>driver01</strong> (Phạm Văn Đức) hoặc <strong>driver09</strong> (Bùi Văn Sáng) — đây là 2 tài xế thường được gán chuyến nhất.</p>
        </div>
      </div>

      {/* Driver-Account Mapping Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">🚛 Danh sách Tài xế — Tài khoản đăng nhập</h3>
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">{drivers.length} tài xế</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left py-3 px-4">#</th>
                <th className="text-left py-3 px-4">Tên tài xế</th>
                <th className="text-left py-3 px-4">Tài khoản</th>
                <th className="text-left py-3 px-4">Mật khẩu</th>
                <th className="text-left py-3 px-4">SĐT</th>
                <th className="text-left py-3 px-4">GPLX</th>
                <th className="text-left py-3 px-4">Kho</th>
                <th className="text-left py-3 px-4">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drivers.map((d, idx) => (
                <tr key={d.id} className="hover:bg-amber-50 transition">
                  <td className="py-2.5 px-4 text-gray-400">{idx + 1}</td>
                  <td className="py-2.5 px-4 font-medium text-gray-900">{d.full_name}</td>
                  <td className="py-2.5 px-4">
                    <code className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono">{getUsername(d.user_id)}</code>
                  </td>
                  <td className="py-2.5 px-4">
                    <code className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">demo123</code>
                  </td>
                  <td className="py-2.5 px-4 text-gray-600">{d.phone}</td>
                  <td className="py-2.5 px-4 text-gray-600 font-mono text-xs">{d.license_number || '-'}</td>
                  <td className="py-2.5 px-4 text-xs">{getWarehouseName(d.warehouse_id)}</td>
                  <td className="py-2.5 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      d.status === 'active' ? 'bg-green-100 text-green-700'
                      : d.status === 'on_trip' ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600'
                    }`}>
                      {d.status === 'active' ? 'Sẵn sàng' : d.status === 'on_trip' ? 'Đang giao' : d.status}
                    </span>
                  </td>
                </tr>
              ))}
              {drivers.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">Chưa có dữ liệu tài xế trong hệ thống</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Reference Card */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-blue-500">
          <h4 className="font-semibold text-blue-800 mb-2">👤 Tài khoản hệ thống (test)</h4>
          <div className="space-y-1.5 text-sm">
            <p><code className="bg-blue-50 px-1 rounded">dvkh01</code> — Dịch vụ khách hàng</p>
            <p><code className="bg-blue-50 px-1 rounded">dispatcher01</code> — Điều phối viên</p>
            <p><code className="bg-blue-50 px-1 rounded">accountant01</code> — Kế toán</p>
            <p><code className="bg-blue-50 px-1 rounded">warehouse01</code> — Thủ kho</p>
            <p><code className="bg-blue-50 px-1 rounded">security01</code> — Bảo vệ</p>
            <p><code className="bg-blue-50 px-1 rounded">admin</code> — Quản trị</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-500">
          <h4 className="font-semibold text-green-800 mb-2">🔑 Luồng test E2E đầy đủ</h4>
          <ol className="space-y-1.5 text-sm text-green-900 list-decimal list-inside">
            <li><strong>dvkh01</strong> → Tạo đơn hàng</li>
            <li><strong>KH</strong> → Xác nhận qua link Zalo</li>
            <li><strong>accountant01</strong> → Duyệt công nợ</li>
            <li><strong>dispatcher01</strong> → Tạo chuyến, gán tài xế</li>
            <li><strong>warehouse01</strong> → Soạn hàng, xếp xe</li>
            <li><strong>security01</strong> → Kiểm tra cổng</li>
            <li><strong>driver01</strong> → Giao hàng, ePOD, thu tiền</li>
            <li><strong>accountant01</strong> → Đối soát</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
