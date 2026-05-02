'use client'

/**
 * HelpDrawer — Contextual in-app help panel.
 *
 * Features:
 * - Role-aware: chỉ hiện nội dung phù hợp với vai trò user
 * - Context-aware: gợi ý phù hợp trang hiện tại
 * - Searchable: lọc nội dung theo từ khoá
 * - Tabs: Hướng dẫn / Tính năng AI / Phím tắt / FAQ
 */

import { useState, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  X, Search, BookOpen, Sparkles, Keyboard, HelpCircle,
  FileText, Truck, Warehouse, Scale, BarChart3, Settings,
  ChevronRight, ExternalLink, Lightbulb,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────

interface HelpItem {
  title: string
  body: string
  tags?: string[]
  /** optional link để đọc thêm trên trang /dashboard/help */
  link?: string
}

interface HelpSection {
  id: string
  icon: typeof BookOpen
  label: string
  items: HelpItem[]
  /** roles được hiện section này. Rỗng = hiện với tất cả */
  roles?: string[]
}

interface HelpDrawerProps {
  open: boolean
  onClose: () => void
  userRole: string
}

// ── Contextual hints per page ─────────────────────

const pageHints: Record<string, { title: string; tip: string; link?: string }> = {
  '/dashboard': {
    title: 'Dashboard Tổng quan',
    tip: 'Các ô KPI cập nhật mỗi 30 giây. Bấm vào ô để xem chi tiết. "Việc cần làm" hiển thị ưu tiên theo vai trò của bạn.',
  },
  '/dashboard/orders': {
    title: 'Trang Đơn hàng',
    tip: 'Mặc định hiện tháng hiện tại. Chọn "Lịch sử" để tìm đơn cũ hơn. Bấm mã đơn để xem chi tiết hoặc thực hiện giao bổ sung.',
    link: '/dashboard/help#orders',
  },
  '/dashboard/orders/new': {
    title: 'Tạo Đơn hàng mới',
    tip: 'Sau khi chọn khách hàng, hệ thống tự kiểm tra ATP (tồn kho) và hạn mức công nợ. Đơn vượt hạn mức chuyển về "Chờ duyệt".',
    link: '/dashboard/help#create-order',
  },
  '/dashboard/planning': {
    title: 'Lập Kế hoạch VRP',
    tip: 'Bấm "Tạo kế hoạch" → AI tính tuyến ~1–3 phút. So sánh 2 phương án: Chi phí vs Thời gian. Kéo-thả đơn để điều chỉnh thủ công.',
    link: '/dashboard/help#vrp',
  },
  '/dashboard/control-tower': {
    title: 'Trung tâm Điều phối',
    tip: 'Màu xe: Xanh = đang chạy, Đỏ = sự cố, Xám = chờ. Bấm xe để gọi điện hoặc xem lộ trình thực tế.',
  },
  '/dashboard/map': {
    title: 'Bản đồ GPS Real-time',
    tip: 'Tất cả xe hiện vị trí live. Bấm biểu tượng xe để xem chi tiết chuyến và tài xế.',
  },
  '/dashboard/warehouse': {
    title: 'Quản lý Kho',
    tip: 'Soạn hàng theo nguyên tắc FEFO (hàng gần hết hạn xuất trước). Dashboard cảnh báo cập nhật mỗi 10 giây.',
    link: '/dashboard/help#warehouse',
  },
  '/dashboard/reconciliation': {
    title: 'Đối soát',
    tip: 'Đối soát phải hoàn thành trong T+1. Sai lệch lớn cần Trưởng kế toán duyệt. Export Excel để đối chiếu với Bravo.',
    link: '/dashboard/help#reconciliation',
  },
  '/dashboard/settings': {
    title: 'Quản trị Hệ thống',
    tip: 'Chỉ Admin mới thấy trang này. Quản lý user, phân quyền RBAC, cấu hình hệ thống và xem Audit Log.',
    link: '/dashboard/help#admin',
  },
  '/dashboard/gate-check': {
    title: 'Kiểm soát Cổng',
    tip: 'Quy tắc R01: Sai lệch hàng tại cổng = 0. Nhập số lượng thực tế — hệ thống tự so sánh và không cho xe xuất nếu lệch.',
    link: '/dashboard/help#gate-check',
  },
  '/dashboard/trips': {
    title: 'Chuyến xe',
    tip: 'Xem tiến độ giao hàng, GPS, ePOD từng điểm. Lọc "Đang hoạt động" để xem chuyến chưa đóng.',
  },
  '/dashboard/kpi': {
    title: 'Báo cáo KPI',
    tip: 'OTD rate > 95% = đạt chuẩn. Tải xe > 80% = hiệu quả. Export Excel để báo cáo lên BGĐ.',
  },
}

// ── Guide sections content ─────────────────────────

const guideSections: HelpSection[] = [
  {
    id: 'dvkh',
    icon: FileText,
    label: 'DVKH — Đơn hàng',
    roles: ['dvkh', 'dispatcher', 'admin'],
    items: [
      {
        title: 'Tạo đơn hàng mới',
        body: 'Đơn hàng > Tạo đơn mới. Chọn khách hàng → thêm sản phẩm → kiểm tra ATP + công nợ → Lưu. Đơn ổn định: "Đã xác nhận". Đơn vượt hạn mức: "Chờ duyệt".',
        tags: ['đơn', 'tạo', 'dvkh', 'khách hàng'],
        link: '/dashboard/help#create-order',
      },
      {
        title: 'Giao bổ sung khi thất bại',
        body: 'Khi đơn "Giao thất bại" hoặc "Giao một phần": mở chi tiết đơn → bấm "Giao bổ sung". Hệ thống tạo chuyến mới, không giới hạn số lần.',
        tags: ['giao lại', 'thất bại', 'bổ sung'],
      },
      {
        title: 'Mốc chốt đơn 16:00',
        body: 'Đơn tạo trước 16:00 → giao ngày mai. Đơn tạo sau 16:00 → giao ngày kia (hoặc theo cấu hình Dispatcher). Dispatcher có thể thay đổi ngày giao.',
        tags: ['cutoff', '16h', 'ngày giao'],
      },
      {
        title: 'Lọc và tìm đơn cũ',
        body: 'Trang Đơn hàng mặc định hiện tháng hiện tại. Chọn bộ lọc "Lịch sử" hoặc "Tùy chỉnh" để tìm đơn cũ hơn.',
        tags: ['tìm kiếm', 'lọc', 'lịch sử'],
      },
    ],
  },
  {
    id: 'dispatcher',
    icon: Truck,
    label: 'Điều phối — VRP & Xe',
    roles: ['dispatcher', 'admin'],
    items: [
      {
        title: 'Lập kế hoạch VRP bằng AI',
        body: 'Vận chuyển > Kế hoạch VRP. Chọn ngày + kho + mục tiêu (chi phí/thời gian) → Tạo kế hoạch. AI tính ~1–3 phút. Xem 2 phương án, kéo-thả điều chỉnh, rồi Phê duyệt.',
        tags: ['vrp', 'kế hoạch', 'tuyến', 'ai', 'tự động'],
        link: '/dashboard/help#vrp',
      },
      {
        title: 'Phương án Chi phí vs Thời gian',
        body: 'AI luôn trả 2 phương án: tối ưu chi phí (ít km, ít BOT) và tối ưu thời gian (giao nhanh, OTD cao). Chọn theo ưu tiên ngày đó.',
        tags: ['vrp', 'phương án', 'so sánh'],
      },
      {
        title: 'Thêm đơn khẩn vào kế hoạch đã duyệt',
        body: 'Trên trang kế hoạch → bấm "Mô phỏng" → thêm đơn → AI tính lại và hiện tác động (chi phí tăng bao nhiêu, OTD thay đổi thế nào) → chọn Áp dụng hoặc Bỏ qua.',
        tags: ['đơn khẩn', 'mô phỏng', 'simulation'],
      },
      {
        title: 'Giấy tờ xe sắp hết hạn',
        body: 'Vận chuyển > Phương tiện > tab "Giấy tờ hết hạn". Hệ thống cảnh báo trước 30 ngày (đăng kiểm/bảo hiểm) và 60 ngày (giấy phép lái xe).',
        tags: ['xe', 'giấy tờ', 'đăng kiểm', 'bảo hiểm'],
      },
    ],
  },
  {
    id: 'warehouse',
    icon: Warehouse,
    label: 'Thủ kho — Xuất/Nhập',
    roles: ['warehouse_handler', 'admin'],
    items: [
      {
        title: 'Soạn hàng theo FEFO',
        body: 'Kho > Soạn hàng theo xe. Chọn ngày → xem danh sách xe. Hệ thống gợi ý lô hàng gần hết hạn nhất (FEFO). Cập nhật tiến độ % khi soạn xong từng xe.',
        tags: ['soạn hàng', 'fefo', 'xuất kho', 'xe'],
        link: '/dashboard/help#warehouse',
      },
      {
        title: 'Kiểm tra cổng Gate Check',
        body: 'Kho > Hàng chờ kiểm cổng. Đếm thực tế từng sản phẩm → nhập vào hệ thống. Khớp 100% → xanh → ký bàn giao. Lệch → đỏ → không cho xe xuất.',
        tags: ['gate check', 'cổng', 'kiểm tra', 'sai lệch'],
      },
      {
        title: 'Nhập vỏ về kho',
        body: 'Kho > Nhận vỏ về. Chọn chuyến xe → nhập số lượng từng loại → phân loại Tốt/Hỏng/Mất → ký Bàn giao B cùng tài xế.',
        tags: ['vỏ', 'nhập kho', 'bàn giao B'],
      },
      {
        title: 'Kiểm kê Cycle Count',
        body: 'Kho > Kiểm kê. AI tạo danh sách theo độ ưu tiên A/B/C. Quét mã QR → đếm thực tế → hệ thống tính chênh lệch tự động.',
        tags: ['kiểm kê', 'cycle count', 'qr', 'quét mã'],
      },
    ],
  },
  {
    id: 'accountant',
    icon: Scale,
    label: 'Kế toán — Đối soát',
    roles: ['accountant', 'admin'],
    items: [
      {
        title: 'Đối soát chuyến xe',
        body: 'Đối soát > Theo chuyến. Chọn chuyến → xem bảng so sánh dự kiến vs thực tế (tiền, hàng, vỏ). Nếu lệch → Tạo Discrepancy → gán trách nhiệm → đặt deadline T+1.',
        tags: ['đối soát', 'chuyến', 'sai lệch', 'discrepancy'],
        link: '/dashboard/help#reconciliation',
      },
      {
        title: 'Đóng ngày (EOD)',
        body: 'Đối soát > Đóng ngày. Xem tổng hợp toàn bộ chuyến. Phải giải quyết hoặc chuyển cấp mọi sai lệch trước khi Đóng ngày. Sau khi đóng, dữ liệu khóa và gửi Bravo.',
        tags: ['đóng ngày', 'eod', 'bravo'],
      },
      {
        title: 'Xử lý sai lệch Discrepancy',
        body: 'Sai lệch nhỏ: Kế toán thường giải quyết. Sai lệch lớn: cần Trưởng kế toán (chief accountant) mới được đóng. Mọi hành động ghi vào lịch sử entity_events.',
        tags: ['sai lệch', 'discrepancy', 'trưởng kế toán'],
      },
    ],
  },
  {
    id: 'management',
    icon: BarChart3,
    label: 'Quản lý — Dashboard & KPI',
    roles: ['management', 'admin'],
    items: [
      {
        title: 'Đọc Dashboard KPI',
        body: 'Dashboard hiện 5 chỉ số chính: Tổng đơn, OTD rate, Tải xe trung bình, Sai lệch chưa xử lý, Xe đang hoạt động. OTD > 95% và Tải xe > 80% là mục tiêu chuẩn.',
        tags: ['dashboard', 'kpi', 'otd', 'tải xe'],
      },
      {
        title: 'Phê duyệt đơn vượt hạn mức',
        body: 'Đơn hàng > Chờ phê duyệt (hoặc thông báo). Xem lý do vượt + lịch sử thanh toán NPP → Duyệt / Từ chối / Duyệt một phần. Bắt buộc ghi lý do.',
        tags: ['duyệt', 'phê duyệt', 'hạn mức', 'công nợ'],
      },
      {
        title: 'Xuất báo cáo Excel',
        body: 'Tất cả trang list đều có nút "Xuất Excel" góc trên phải. Xuất theo bộ lọc hiện tại — chọn khoảng thời gian trước khi xuất.',
        tags: ['xuất', 'excel', 'báo cáo'],
      },
    ],
  },
  {
    id: 'admin',
    icon: Settings,
    label: 'Admin — Quản trị',
    roles: ['admin'],
    items: [
      {
        title: 'Tạo tài khoản người dùng',
        body: 'Cài đặt > Người dùng > Thêm. Chọn vai trò (9 roles). Mật khẩu tạm thời là demo123 — nhắc user đổi sau lần đầu đăng nhập.',
        tags: ['user', 'tài khoản', 'mật khẩu', 'role'],
        link: '/dashboard/help#admin',
      },
      {
        title: 'Phân quyền RBAC nâng cao',
        body: 'Cài đặt > Phân quyền. Xem ma trận quyền theo vai trò. Tùy chỉnh quyền riêng cho từng user (override). Mọi thay đổi ghi Audit Log.',
        tags: ['rbac', 'phân quyền', 'quyền', 'permission'],
      },
      {
        title: 'Xem Audit Log',
        body: 'Cài đặt > Nhật ký hệ thống. Lọc theo user/thời gian/loại hành động. Bấm "Xem diff" để so sánh trước/sau từng thay đổi.',
        tags: ['audit log', 'nhật ký', 'lịch sử'],
      },
    ],
  },
]

// ── AI features section ────────────────────────────

const aiFeatures: HelpItem[] = [
  {
    title: 'VRP — Lập kế hoạch tự động',
    body: 'AI dùng Google OR-Tools tính tuyến tối ưu cho toàn đội xe. 2 phương án: chi phí thấp nhất vs thời gian giao nhanh nhất. Ước tính phí BOT chính xác trước khi duyệt.',
    tags: ['vrp', 'tuyến', 'or-tools'],
  },
  {
    title: 'AI Copilot — Hỏi đáp ngôn ngữ tự nhiên',
    body: 'Bấm Ctrl+K (hoặc biểu tượng AI). Gõ câu hỏi: "Xe nào đang tải thấp nhất?", "Tổng tiền thu hôm qua?", "Đơn nào sắp trễ?". AI tìm dữ liệu và trả lời.',
    tags: ['copilot', 'ctrlk', 'tìm kiếm', 'hỏi đáp'],
  },
  {
    title: 'Simulation — Xem trước kết quả',
    body: 'Trên trang Kế hoạch → bấm "Mô phỏng". Thêm/bỏ đơn, thay xe — AI tính lại và hiện tác động (chi phí ±, OTD ±) mà không thay đổi dữ liệu thật. Sau đó mới Áp dụng.',
    tags: ['simulation', 'mô phỏng', 'dry-run'],
  },
  {
    title: 'Cảnh báo thông minh',
    body: 'Hệ thống tự phát hiện: xe trễ giờ, NPP sắp vượt hạn mức, tồn kho đột ngột giảm, giấy tờ xe sắp hết hạn. Hiện trên header bell + Dashboard widget.',
    tags: ['cảnh báo', 'anomaly', 'alert'],
  },
  {
    title: 'Trust Loop — AI cải thiện theo thời gian',
    body: 'Mỗi khi bạn chấp nhận, sửa, hoặc từ chối đề xuất AI (có lý do), hệ thống học thêm. Theo thời gian AI sẽ đề xuất chính xác hơn theo hoàn cảnh BHL.',
    tags: ['trust loop', 'feedback', 'cải thiện'],
  },
]

// ── Keyboard shortcuts ─────────────────────────────

const shortcuts = [
  { keys: ['Ctrl', 'K'], desc: 'Mở AI Copilot / Tìm kiếm nhanh' },
  { keys: ['Esc'], desc: 'Đóng popup / drawer / modal' },
  { keys: ['Ctrl', 'Enter'], desc: 'Xác nhận form (thay vì click nút)' },
  { keys: ['F5'], desc: 'Làm mới dữ liệu trang hiện tại' },
  { keys: ['Tab'], desc: 'Di chuyển giữa các ô nhập liệu' },
]

// ── FAQ ────────────────────────────────────────────

const faqs: HelpItem[] = [
  {
    title: 'Không thấy menu trong sidebar?',
    body: 'Menu hiển thị theo quyền (role) của bạn. Liên hệ Admin để được cấp quyền phù hợp.',
    tags: ['menu', 'quyền', 'role'],
  },
  {
    title: 'Bị đăng xuất liên tục?',
    body: 'Đăng xuất hoàn toàn → xóa cache trình duyệt (Ctrl+Shift+Delete) → đăng nhập lại. Token hết hạn tự làm mới nếu bạn đang dùng.',
    tags: ['đăng xuất', 'token', 'cache'],
  },
  {
    title: 'Tìm không thấy đơn cũ?',
    body: 'Trang Đơn hàng mặc định hiện tháng hiện tại. Chọn bộ lọc "Lịch sử" hoặc tùy chỉnh khoảng thời gian.',
    tags: ['đơn', 'tìm kiếm', 'lịch sử'],
  },
  {
    title: 'VRP báo lỗi / không tính được?',
    body: 'Kiểm tra: có đơn đã xác nhận cho ngày đó chưa? Có xe sẵn sàng không? Bấm "Tính lại" một lần. Vẫn lỗi → báo IT.',
    tags: ['vrp', 'lỗi', 'error'],
  },
  {
    title: 'Số liệu Dashboard có trễ không?',
    body: 'Stats trang tổng quan cache 30 giây. Dashboard kho cập nhật mỗi 10 giây (không cache). Bấm F5 để làm mới ngay.',
    tags: ['dashboard', 'cache', 'cập nhật'],
  },
  {
    title: 'Mã lỗi 401 / 403 / 503 là gì?',
    body: '401: Chưa đăng nhập / token hết hạn → đăng nhập lại. 403: Không có quyền → liên hệ Admin. 503: Dịch vụ tạm gián đoạn → chờ 1–2 phút rồi thử lại.',
    tags: ['lỗi', '401', '403', '503'],
  },
]

// ── Main Component ─────────────────────────────────

export function HelpDrawer({ open, onClose, userRole }: HelpDrawerProps) {
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'guide' | 'ai' | 'shortcuts' | 'faq'>('guide')

  // Find contextual hint for current page
  const currentHint = useMemo(() => {
    // exact match first
    if (pageHints[pathname]) return pageHints[pathname]
    // prefix match
    for (const [key, val] of Object.entries(pageHints)) {
      if (pathname.startsWith(key) && key !== '/dashboard') return val
    }
    return pageHints['/dashboard']
  }, [pathname])

  // Filter sections by role
  const visibleSections = useMemo(
    () => guideSections.filter(s => !s.roles || s.roles.includes(userRole)),
    [userRole]
  )

  // Search filter
  const filtered = useMemo(() => {
    if (!query.trim()) return visibleSections
    const q = query.toLowerCase()
    return visibleSections
      .map(s => ({
        ...s,
        items: s.items.filter(
          item =>
            item.title.toLowerCase().includes(q) ||
            item.body.toLowerCase().includes(q) ||
            item.tags?.some(t => t.includes(q))
        ),
      }))
      .filter(s => s.items.length > 0)
  }, [query, visibleSections])

  const filteredAI = useMemo(() => {
    if (!query.trim()) return aiFeatures
    const q = query.toLowerCase()
    return aiFeatures.filter(
      i =>
        i.title.toLowerCase().includes(q) ||
        i.body.toLowerCase().includes(q) ||
        i.tags?.some(t => t.includes(q))
    )
  }, [query])

  const filteredFAQ = useMemo(() => {
    if (!query.trim()) return faqs
    const q = query.toLowerCase()
    return faqs.filter(
      i =>
        i.title.toLowerCase().includes(q) ||
        i.body.toLowerCase().includes(q) ||
        i.tags?.some(t => t.includes(q))
    )
  }, [query])

  if (!open) return null

  const tabs = [
    { key: 'guide', label: 'Hướng dẫn', icon: BookOpen },
    { key: 'ai', label: 'Tính năng AI', icon: Sparkles },
    { key: 'shortcuts', label: 'Phím tắt', icon: Keyboard },
    { key: 'faq', label: 'FAQ', icon: HelpCircle },
  ] as const

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center">
              <BookOpen size={15} className="text-brand-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Trợ giúp</p>
              <p className="text-[10px] text-gray-400 leading-tight">Hướng dẫn sử dụng BHL OMS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Contextual hint for current page */}
        <div className="mx-4 mt-3 mb-1 px-3 py-2.5 bg-amber-50 border border-amber-200/70 rounded-lg">
          <div className="flex items-start gap-2">
            <Lightbulb size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-semibold text-amber-800">{currentHint.title}</p>
              <p className="text-[11px] text-amber-700 mt-0.5 leading-snug">{currentHint.tip}</p>
              {currentHint.link && (
                <Link
                  href={currentHint.link}
                  onClick={onClose}
                  className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium mt-1 hover:underline"
                >
                  Xem hướng dẫn chi tiết <ArrowRight size={10} />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm trong trợ giúp..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 gap-0">
          {tabs.map(t => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-2.5 py-2.5 text-[12px] font-medium border-b-2 transition-colors -mb-px ${
                  active
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={13} />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

          {/* Guide Tab */}
          {tab === 'guide' && (
            <>
              {filtered.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Không tìm thấy kết quả cho &quot;{query}&quot;
                </div>
              )}
              {filtered.map(section => {
                const Icon = section.icon
                return (
                  <div key={section.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={14} className="text-gray-500" />
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {section.label}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {section.items.map((item, i) => (
                        <GuideCard key={i} item={item} onClose={onClose} />
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Link to full guide */}
              <div className="pt-2 pb-1">
                <Link
                  href="/dashboard/help"
                  onClick={onClose}
                  className="flex items-center justify-between w-full px-3 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition group"
                >
                  <span className="text-sm font-medium text-gray-700">Xem hướng dẫn đầy đủ</span>
                  <ExternalLink size={14} className="text-gray-400 group-hover:text-brand-500 transition" />
                </Link>
              </div>
            </>
          )}

          {/* AI Tab */}
          {tab === 'ai' && (
            <>
              <div className="px-3 py-2.5 bg-brand-50 border border-brand-100 rounded-lg mb-2">
                <p className="text-[12px] text-brand-700 font-medium">
                  AI đề xuất — người quyết định
                </p>
                <p className="text-[11px] text-brand-600 mt-0.5">
                  Core workflow luôn hoạt động ngay cả khi AI flag OFF. AI là lớp tăng cường, không thay thế.
                </p>
              </div>
              {filteredAI.map((item, i) => (
                <GuideCard key={i} item={item} onClose={onClose} />
              ))}
            </>
          )}

          {/* Shortcuts Tab */}
          {tab === 'shortcuts' && (
            <div className="space-y-1.5">
              {shortcuts.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">{s.desc}</p>
                  <div className="flex items-center gap-1">
                    {s.keys.map((k, ki) => (
                      <span key={ki}>
                        <kbd className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[11px] text-gray-600 font-mono shadow-sm">
                          {k}
                        </kbd>
                        {ki < s.keys.length - 1 && (
                          <span className="text-gray-400 text-xs mx-0.5">+</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FAQ Tab */}
          {tab === 'faq' && (
            <>
              {filteredFAQ.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Không tìm thấy kết quả cho &quot;{query}&quot;
                </div>
              )}
              {filteredFAQ.map((item, i) => (
                <GuideCard key={i} item={item} onClose={onClose} />
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
          <p className="text-[11px] text-gray-400">BHL OMS v1.0 · 01/05/2026</p>
          <Link
            href="/dashboard/help"
            onClick={onClose}
            className="text-[11px] text-brand-600 hover:underline font-medium"
          >
            Tài liệu đầy đủ
          </Link>
        </div>
      </aside>
    </div>,
    document.body
  )
}

// ── GuideCard sub-component ────────────────────────

function GuideCard({
  item,
  onClose,
}: {
  item: HelpItem
  onClose: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <button
      onClick={() => setExpanded(v => !v)}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
        expanded
          ? 'bg-white border-gray-200 shadow-sm'
          : 'bg-gray-50 border-transparent hover:border-gray-200 hover:bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-gray-800 leading-snug">{item.title}</p>
        <ChevronRight
          size={14}
          className={`text-gray-400 shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </div>
      {expanded && (
        <p className="mt-1.5 text-[12px] text-gray-600 leading-relaxed">{item.body}</p>
      )}
      {expanded && item.link && (
        <Link
          href={item.link}
          onClick={e => { e.stopPropagation(); onClose() }}
          className="inline-flex items-center gap-1 mt-2 text-[11px] text-brand-600 font-medium hover:underline"
        >
          Xem hướng dẫn chi tiết <ArrowRight size={10} />
        </Link>
      )}
    </button>
  )
}
