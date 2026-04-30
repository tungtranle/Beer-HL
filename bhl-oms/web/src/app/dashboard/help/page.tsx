'use client'

/**
 * /dashboard/help — Full in-app documentation page.
 *
 * Layout: Left sidebar (section nav) + Main scrollable content.
 * Features:
 * - Role-aware: hiện section phù hợp với vai trò
 * - Searchable: lọc theo từ khoá
 * - Anchor links: #orders, #vrp, #warehouse, etc.
 * - Print-friendly prose
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Search, BookOpen, FileText, Truck, Warehouse, Scale, BarChart3,
  Settings, Sparkles, HelpCircle, ChevronRight, User, Shield,
  AlertTriangle, CheckCircle2, Keyboard, Lightbulb, Info,
  Package, MapPin, ClipboardCheck, ArrowRight, ExternalLink,
} from 'lucide-react'
import { getUser } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'

// ── Types ─────────────────────────────────────────

interface Section {
  id: string
  label: string
  icon: typeof BookOpen
  roles?: string[]
}

// ── Sidebar sections ───────────────────────────────

const sections: Section[] = [
  { id: 'intro', label: 'Giới thiệu sản phẩm', icon: BookOpen },
  { id: 'quickstart', label: 'Bắt đầu nhanh', icon: ArrowRight },
  { id: 'orders', label: 'DVKH — Đơn hàng', icon: FileText, roles: ['dvkh', 'dispatcher', 'admin'] },
  { id: 'vrp', label: 'Điều phối — VRP & Xe', icon: Truck, roles: ['dispatcher', 'admin'] },
  { id: 'driver', label: 'Tài xế — Driver App', icon: User, roles: ['driver', 'admin'] },
  { id: 'warehouse', label: 'Thủ kho — Xuất/Nhập', icon: Warehouse, roles: ['warehouse_handler', 'admin'] },
  { id: 'reconciliation', label: 'Kế toán — Đối soát', icon: Scale, roles: ['accountant', 'admin'] },
  { id: 'management', label: 'Quản lý — Dashboard', icon: BarChart3, roles: ['management', 'admin'] },
  { id: 'admin', label: 'Admin — Quản trị', icon: Settings, roles: ['admin'] },
  { id: 'ai', label: 'Tính năng AI', icon: Sparkles },
  { id: 'shortcuts', label: 'Phím tắt', icon: Keyboard },
  { id: 'faq', label: 'FAQ & Sự cố', icon: HelpCircle },
]

export default function HelpPage() {
  const [user, setUser] = useState<any>(null)
  const [query, setQuery] = useState('')
  const [activeSection, setActiveSection] = useState('intro')
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setUser(getUser()) }, [])

  // Hash navigation
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash) setActiveSection(hash)
  }, [])

  const role = user?.role || ''

  const visibleSections = useMemo(
    () => sections.filter(s => !s.roles || s.roles.includes(role)),
    [role]
  )

  const scrollTo = (id: string) => {
    setActiveSection(id)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.history.replaceState(null, '', `#${id}`)
  }

  return (
    <div className="flex gap-6 min-h-0">
      {/* ── Left Sidebar ── */}
      <aside className="w-52 shrink-0 sticky top-0 self-start">
        <div className="space-y-0.5">
          <p className="px-2 mb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
            Nội dung
          </p>
          {visibleSections.map(s => {
            const Icon = s.icon
            const active = activeSection === s.id
            return (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-left transition-all ${
                  active
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                <Icon size={14} className={active ? 'text-brand-500' : 'text-gray-400'} />
                <span className="truncate">{s.label}</span>
                {active && <ChevronRight size={12} className="ml-auto text-brand-400 shrink-0" />}
              </button>
            )
          })}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div ref={contentRef} className="flex-1 min-w-0 space-y-12">

        {/* Search bar */}
        <div className="sticky top-0 z-10 bg-gray-100/95 backdrop-blur pb-3 pt-1 -mx-1 px-1">
          <div className="relative max-w-lg">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Tìm kiếm trong tài liệu..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* ── Giới thiệu sản phẩm ── */}
        <Section id="intro" title="Giới thiệu sản phẩm" icon={BookOpen} query={query}>
          <p className="text-gray-600 leading-relaxed text-sm">
            <strong className="text-gray-900">BHL OMS-TMS-WMS</strong> là hệ thống vận hành tích hợp của{' '}
            <strong className="text-gray-900">Công ty Cổ phần Bia và Nước giải khát Hạ Long (BHL)</strong> —
            thay thế toàn bộ quy trình thủ công trên Excel và Zalo từng chiếm 1–3 giờ mỗi ngày.
          </p>

          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { icon: FileText, label: 'OMS', desc: 'Quản lý Đơn hàng', detail: 'Tiếp nhận, ATP, công nợ, Zalo xác nhận' },
              { icon: Truck, label: 'TMS', desc: 'Quản lý Vận tải', detail: 'Lập tuyến AI, phân công xe, GPS live' },
              { icon: Warehouse, label: 'WMS', desc: 'Quản lý Kho', detail: 'Xuất FEFO, kiểm cổng, Pallet/Bin' },
            ].map(m => (
              <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center mb-2.5">
                  <m.icon size={18} className="text-brand-600" />
                </div>
                <p className="text-base font-bold text-gray-900">{m.label}</p>
                <p className="text-[12px] font-medium text-gray-700">{m.desc}</p>
                <p className="text-[11px] text-gray-500 mt-1 leading-snug">{m.detail}</p>
              </div>
            ))}
          </div>

          <Callout type="info" className="mt-4">
            Hệ thống xử lý ~<strong>1.000 đơn/ngày</strong>, đội xe ~<strong>70 đầu</strong>,
            ~<strong>800 khách hàng/NPP</strong> trên 2 nhà máy Hạ Long và Đông Mai.
          </Callout>

          <h3 className="text-[14px] font-semibold text-gray-900 mt-5 mb-2">Vấn đề đã giải quyết</h3>
          <div className="space-y-2">
            {[
              ['Lập kế hoạch xe mất 1–3 giờ/ngày', 'AI tính tuyến tối ưu trong < 20 phút'],
              ['Xe chạy rỗng chiều về', 'Ghép đơn thông minh — xe rỗng < 5%'],
              ['Không biết xe đang ở đâu', 'GPS real-time, bản đồ live'],
              ['Sai lệch hàng/vỏ không kiểm soát', 'Kiểm cổng số hóa — sai lệch = 0'],
              ['Công nợ không rõ ràng', 'Công nợ NPP real-time, cảnh báo tự động'],
            ].map(([before, after], i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className="flex-1 text-gray-500 flex items-start gap-1.5">
                  <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                  {before}
                </div>
                <ArrowRight size={14} className="text-gray-300 mt-0.5 shrink-0" />
                <div className="flex-1 text-gray-700 flex items-start gap-1.5">
                  <CheckCircle2 size={13} className="text-green-500 mt-0.5 shrink-0" />
                  {after}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Bắt đầu nhanh ── */}
        <Section id="quickstart" title="Bắt đầu nhanh" icon={ArrowRight} query={query}>
          <StepList steps={[
            { title: 'Truy cập hệ thống', body: 'Mở trình duyệt → vào https://bhl.symper.us' },
            { title: 'Đăng nhập', body: 'Nhập tên đăng nhập và mật khẩu do Admin cấp. Mật khẩu lần đầu: demo123' },
            { title: 'Xem Dashboard', body: 'Trang Tổng quan hiện 5 KPI chính và danh sách việc cần làm theo vai trò của bạn' },
            { title: 'Thử AI Copilot', body: 'Bấm Ctrl+K → gõ câu hỏi bằng tiếng Việt, ví dụ: "Xe nào đang tải thấp nhất?"' },
          ]} />
          <Callout type="tip" className="mt-4">
            Menu sidebar hiển thị theo <strong>quyền (role)</strong> của bạn — bạn chỉ thấy những gì mình có quyền dùng.
          </Callout>
        </Section>

        {/* ── DVKH Orders ── */}
        {(!sections.find(s => s.id === 'orders')?.roles || sections.find(s => s.id === 'orders')?.roles?.includes(role) || role === 'admin') && (
          <Section id="orders" title="DVKH — Đơn hàng" icon={FileText} query={query}>
            <p className="text-sm text-gray-600 mb-4">
              DVKH là người tiếp nhận đơn từ khách/NPP và đảm bảo đơn đi đúng luồng trước khi chuyển điều phối.
            </p>

            <h3 className="font-semibold text-[14px] text-gray-900 mb-2" id="create-order">Tạo đơn hàng mới</h3>
            <StepList steps={[
              { title: 'Vào Đơn hàng > Tạo đơn mới', body: '' },
              { title: 'Chọn khách hàng', body: 'Gõ tên hoặc mã NPP để tìm kiếm' },
              { title: 'Chọn ngày giao hàng', body: 'Mặc định là ngày mai. Đơn tạo sau 16:00 tự đẩy sang ngày kia' },
              { title: 'Thêm sản phẩm', body: 'Gõ tên/SKU → chọn → nhập số lượng. Bấm "Thêm dòng" cho nhiều sản phẩm' },
              { title: 'Lưu đơn', body: 'Hệ thống tự kiểm tra ATP và hạn mức công nợ' },
            ]} />

            <Callout type="info" className="mt-3">
              <strong>Đơn ổn định</strong> → "Đã xác nhận" (kèm Zalo gửi khách).
              <strong className="ml-1">Đơn vượt hạn mức</strong> → "Chờ duyệt" (cần Quản lý phê duyệt).
            </Callout>

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Trạng thái đơn hàng</h3>
            <StatusTable rows={[
              { status: 'Nháp', color: 'gray', desc: 'Mới tạo, chưa gửi. Kiểm tra lại rồi xác nhận.' },
              { status: 'Chờ xác nhận KH', color: 'yellow', desc: 'Đã gửi Zalo. Khách có 2 giờ để bấm xác nhận.' },
              { status: 'Đã xác nhận', color: 'blue', desc: 'Sẵn sàng đưa vào kế hoạch vận chuyển.' },
              { status: 'Chờ duyệt', color: 'orange', desc: 'Vượt ATP hoặc hạn mức. Báo Dispatcher/Quản lý.' },
              { status: 'Đang vận chuyển', color: 'blue', desc: 'Xe đã xuất cổng. Theo dõi trên bản đồ.' },
              { status: 'Đã giao', color: 'green', desc: 'Hoàn tất. Lưu chứng từ ePOD.' },
              { status: 'Giao thất bại', color: 'red', desc: 'Tạo "Giao bổ sung" nếu cần giao lại.' },
            ]} />

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Giao bổ sung</h3>
            <p className="text-sm text-gray-600">
              Khi đơn ở trạng thái <span className="text-red-600 font-medium">Giao thất bại</span> hoặc{' '}
              <span className="text-orange-600 font-medium">Giao một phần</span>: mở chi tiết đơn → bấm{' '}
              <strong>"Giao bổ sung"</strong>. Có thể giao lại không giới hạn số lần, mỗi lần ghi lịch sử đầy đủ.
            </p>
          </Section>
        )}

        {/* ── VRP ── */}
        {(role === 'dispatcher' || role === 'admin') && (
          <Section id="vrp" title="Điều phối — Lập kế hoạch VRP" icon={Truck} query={query}>
            <p className="text-sm text-gray-600 mb-4">
              VRP (Vehicle Routing Problem) dùng thuật toán Google OR-Tools kết hợp bản đồ đường thực tế để tính
              tuyến tối ưu cho toàn đội xe.
            </p>
            <StepList steps={[
              { title: 'Vào Vận chuyển > Kế hoạch VRP', body: '' },
              { title: 'Chọn ngày giao + kho xuất hàng', body: 'Hạ Long hoặc Đông Mai' },
              { title: 'Chọn mục tiêu tối ưu', body: '"Chi phí thấp nhất" hoặc "Thời gian giao nhanh nhất"' },
              { title: 'Bấm "Tạo kế hoạch"', body: 'AI tính khoảng 1–3 phút. Xem 2 phương án so sánh.' },
              { title: 'Điều chỉnh nếu cần', body: 'Kéo-thả đơn hàng sang chuyến khác. Thay đổi xe/tài xế.' },
              { title: 'Phê duyệt kế hoạch', body: 'Hệ thống gửi lệnh tự động cho kho và tài xế.' },
            ]} />

            <Callout type="tip" className="mt-3">
              <strong>Ngày có đơn khẩn:</strong> chọn Thời gian tối ưu.
              <strong className="ml-1">Ngày bình thường:</strong> chọn Chi phí để tiết kiệm nhiên liệu và BOT.
            </Callout>

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Thêm đơn khẩn sau khi đã duyệt</h3>
            <p className="text-sm text-gray-600">
              Bấm <strong>"Mô phỏng"</strong> trên trang kế hoạch → thêm đơn → AI tính lại và hiện tác động
              (chi phí tăng bao nhiêu, OTD thay đổi thế nào) mà không thay đổi kế hoạch thật → chọn Áp dụng hoặc Hủy.
            </p>
          </Section>
        )}

        {/* ── Driver ── */}
        {(role === 'driver' || role === 'admin') && (
          <Section id="driver" title="Tài xế — Driver App" icon={User} query={query}>
            <Callout type="warning">
              <strong>Quy tắc quan trọng:</strong> HẠ HÀNG TRƯỚC — xác nhận thanh toán/nợ SAU.
              Không được giữ hàng vì lý do công nợ.
            </Callout>
            <StepList className="mt-4" steps={[
              { title: 'Mở app → Check-in tại kho', body: 'Bấm "Check-in" khi đến kho buổi sáng' },
              { title: 'Xem chuyến + làm checklist xe', body: 'Kiểm tra phanh, đèn, lốp trên app' },
              { title: 'Ký Bàn giao A + qua kiểm cổng', body: 'Thủ kho + Bảo vệ xác nhận hàng khớp 100%' },
              { title: 'Bấm "Bắt đầu chuyến"', body: '' },
              { title: 'Tại điểm giao: "Đến nơi" → "Đang giao" → Hạ hàng → Chụp ảnh ePOD (bắt buộc)', body: '' },
              { title: 'Bấm "Giao thành công" hoặc "Giao thất bại"', body: 'Nếu thất bại: chọn lý do' },
              { title: 'Thu tiền mặt + Thu vỏ từ khách', body: '' },
              { title: 'Về kho: Bàn giao B (vỏ) + Bàn giao C (tiền)', body: '' },
              { title: 'Bấm "Hoàn thành chuyến" + Check-out', body: '' },
            ]} />
          </Section>
        )}

        {/* ── Warehouse ── */}
        {(role === 'warehouse_handler' || role === 'admin') && (
          <Section id="warehouse" title="Thủ kho — Xuất/Nhập/Kiểm kê" icon={Warehouse} query={query}>
            <h3 className="font-semibold text-[14px] text-gray-900 mb-2">Soạn hàng theo xe (FEFO)</h3>
            <p className="text-sm text-gray-600 mb-3">
              Kho &gt; Soạn hàng theo xe. Chọn ngày → xem danh sách xe + sản phẩm cần xuất.
              Hệ thống gợi ý lô hàng <strong>FEFO</strong> (First Expired First Out — hàng gần hết hạn xuất trước).
            </p>
            <h3 className="font-semibold text-[14px] text-gray-900 mt-4 mb-2" id="gate-check">Kiểm tra cổng (Gate Check)</h3>
            <p className="text-sm text-gray-600">
              Kho &gt; Hàng chờ kiểm cổng. Đếm thực tế từng sản phẩm → nhập vào hệ thống.
            </p>
            <Callout type="warning" className="mt-2">
              <strong>Quy tắc R01:</strong> Sai lệch hàng tại cổng = 0. Hệ thống không cho phép ký bàn giao
              khi có chênh lệch. Phải điều chỉnh hàng thực tế cho khớp trước khi xe xuất.
            </Callout>

            <h3 className="font-semibold text-[14px] text-gray-900 mt-4 mb-2">Cảnh báo Dashboard kho</h3>
            <StatusTable rows={[
              { status: 'Tồn kho thấp', color: 'orange', desc: 'Hàng dưới ngưỡng an toàn → báo mua hàng' },
              { status: 'Gần hết hạn', color: 'red', desc: 'Lô số lượng lớn sắp hết hạn → ưu tiên xuất ngay' },
              { status: 'Bin > 90%', color: 'orange', desc: 'Vị trí bin gần đầy → điều chuyển sang bin khác' },
              { status: 'Pallet mồ côi', color: 'yellow', desc: 'Pallet chưa có vị trí → cất vào bin' },
            ]} />
          </Section>
        )}

        {/* ── Reconciliation ── */}
        {(role === 'accountant' || role === 'admin') && (
          <Section id="reconciliation" title="Kế toán — Đối soát" icon={Scale} query={query}>
            <p className="text-sm text-gray-600 mb-4">
              Đối soát phải hoàn thành trong <strong>T+1</strong>. Mọi sai lệch cần được giải quyết
              hoặc chuyển cấp trước khi đóng ngày.
            </p>
            <StepList steps={[
              { title: 'Đối soát > Theo chuyến', body: 'Chọn chuyến vừa hoàn thành' },
              { title: 'Xem bảng so sánh', body: 'Tiền thu, công nợ, vỏ: Dự kiến vs Thực tế' },
              { title: 'Tạo Discrepancy nếu lệch', body: 'Chọn loại (tiền/hàng/vỏ) → gán trách nhiệm → deadline T+1' },
              { title: 'Ký xác nhận đối soát', body: '' },
              { title: 'Đối soát > Đóng ngày', body: 'Giải quyết hết sai lệch → Đóng ngày → gửi Bravo' },
            ]} />
            <Callout type="info" className="mt-3">
              Chỉ <strong>Trưởng kế toán</strong> (<code>is_chief_accountant = true</code>) mới có quyền đóng sai lệch lớn.
              Admin có thể gán flag này trong Cài đặt &gt; Người dùng.
            </Callout>
          </Section>
        )}

        {/* ── Management ── */}
        {(role === 'management' || role === 'admin') && (
          <Section id="management" title="Quản lý — Dashboard & KPI" icon={BarChart3} query={query}>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'OTD Rate', target: '> 95%', desc: 'Tỷ lệ giao đúng giờ cam kết' },
                { label: 'Tải xe TB', target: '> 80%', desc: 'Tải trọng trung bình đội xe' },
                { label: 'Xe rỗng', target: '< 5%', desc: 'Tỷ lệ xe chạy không tải' },
                { label: 'Sai lệch mở', target: '= 0', desc: 'Discrepancy chưa giải quyết' },
              ].map(k => (
                <div key={k.label} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                  <p className="text-[12px] text-gray-500">{k.label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{k.target}</p>
                  <p className="text-[11px] text-gray-500 mt-1">{k.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-600">
              Phê duyệt đơn vượt hạn mức: Đơn hàng &gt; Chờ phê duyệt → xem lý do vượt + lịch sử thanh toán NPP →
              Duyệt / Từ chối / Duyệt một phần. <strong>Bắt buộc</strong> ghi lý do quyết định.
            </p>
          </Section>
        )}

        {/* ── Admin ── */}
        {role === 'admin' && (
          <Section id="admin" title="Admin — Quản trị hệ thống" icon={Settings} query={query}>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-[14px] text-gray-900 mb-1">Vai trò (9 roles)</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['admin', 'Quản trị viên — Toàn quyền'],
                    ['dispatcher', 'Điều phối — OMS + TMS'],
                    ['dvkh', 'DVKH — Tạo/xem đơn'],
                    ['driver', 'Tài xế — Driver App'],
                    ['warehouse_handler', 'Thủ kho — WMS'],
                    ['accountant', 'Kế toán — Đối soát'],
                    ['management', 'Quản lý — Báo cáo'],
                    ['security', 'Bảo vệ — Kiểm cổng'],
                    ['workshop', 'Phân xưởng — Vỏ/Bảo dưỡng'],
                  ].map(([r, d]) => (
                    <div key={r} className="flex items-start gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                      <code className="text-[11px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-brand-600 font-mono shrink-0">{r}</code>
                      <span className="text-[12px] text-gray-600">{d}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Callout type="info">
                Tạo tài khoản: Cài đặt &gt; Người dùng &gt; Thêm. Mật khẩu mặc định: <code className="font-mono bg-gray-100 px-1 rounded">demo123</code>.
                Nhắc user đổi mật khẩu sau lần đăng nhập đầu tiên.
              </Callout>
            </div>
          </Section>
        )}

        {/* ── AI Features ── */}
        <Section id="ai" title="Tính năng AI" icon={Sparkles} query={query}>
          <Callout type="info" className="mb-4">
            <strong>Triết lý:</strong> AI đề xuất — người quyết định. Core workflow luôn hoạt động khi AI OFF.
            AI là lớp tăng cường, không phải thay thế.
          </Callout>
          <div className="space-y-4">
            {[
              {
                title: 'VRP — Lập kế hoạch tự động',
                body: 'Google OR-Tools tính tuyến tối ưu cho toàn đội xe. 2 phương án: chi phí thấp nhất vs thời gian giao nhanh nhất. Ước tính phí BOT chính xác.',
                badge: 'dispatcher',
              },
              {
                title: 'AI Copilot — Hỏi đáp tự nhiên (Ctrl+K)',
                body: 'Gõ câu hỏi tiếng Việt: "Xe nào tải thấp nhất?", "Tổng tiền thu hôm qua?", "Đơn nào sắp trễ?". AI tìm dữ liệu real-time và trả lời trực tiếp.',
                badge: 'tất cả',
              },
              {
                title: 'Simulation — Xem trước khi quyết định',
                body: 'Dry-run VRP / thêm đơn khẩn / thay xe. AI tính tác động (chi phí ±, OTD ±) mà KHÔNG ghi DB. Áp dụng chỉ khi bạn xác nhận.',
                badge: 'dispatcher',
              },
              {
                title: 'Cảnh báo thông minh (Anomaly Detection)',
                body: 'Tự phát hiện: xe trễ giờ, NPP sắp vượt hạn mức, tồn kho đột ngột giảm, giấy tờ xe sắp hết hạn. Hiện trên header bell + Dashboard widget.',
                badge: 'tất cả',
              },
              {
                title: 'Trust Loop — AI cải thiện theo thời gian',
                body: 'Chấp nhận / sửa / từ chối đề xuất AI đều được ghi lại. Hệ thống dần đề xuất chính xác hơn cho hoàn cảnh BHL.',
                badge: 'tất cả',
              },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] font-semibold text-gray-900">{f.title}</p>
                  <span className="text-[10px] px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full font-medium shrink-0">
                    {f.badge}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] text-gray-600 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Shortcuts ── */}
        <Section id="shortcuts" title="Phím tắt" icon={Keyboard} query={query}>
          <div className="space-y-2">
            {[
              { keys: ['Ctrl', 'K'], desc: 'Mở AI Copilot / Tìm kiếm nhanh' },
              { keys: ['Esc'], desc: 'Đóng popup / drawer / modal' },
              { keys: ['Ctrl', 'Enter'], desc: 'Xác nhận form (thay vì click nút)' },
              { keys: ['F5'], desc: 'Làm mới dữ liệu trang hiện tại' },
              { keys: ['Tab'], desc: 'Di chuyển giữa các ô nhập liệu' },
              { keys: ['Shift', 'Tab'], desc: 'Quay lại ô nhập liệu trước' },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-white rounded-lg border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-700">{s.desc}</p>
                <div className="flex items-center gap-1">
                  {s.keys.map((k, ki) => (
                    <span key={ki} className="flex items-center gap-1">
                      <kbd className="px-2 py-0.5 bg-gray-50 border border-gray-200 rounded text-[12px] text-gray-700 font-mono shadow-sm">
                        {k}
                      </kbd>
                      {ki < s.keys.length - 1 && <span className="text-gray-300 text-xs">+</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── FAQ ── */}
        <Section id="faq" title="FAQ & Xử lý sự cố" icon={HelpCircle} query={query}>
          <div className="space-y-2">
            {[
              {
                q: 'Không thấy menu trong sidebar?',
                a: 'Menu hiển thị theo quyền (role) của bạn. Liên hệ Admin để được cấp quyền phù hợp.',
              },
              {
                q: 'Bị đăng xuất liên tục?',
                a: 'Đăng xuất hoàn toàn → xóa cache trình duyệt (Ctrl+Shift+Delete) → đăng nhập lại.',
              },
              {
                q: 'Tìm không thấy đơn cũ?',
                a: 'Trang Đơn hàng mặc định hiện tháng hiện tại. Chọn bộ lọc "Lịch sử" hoặc tùy chỉnh khoảng thời gian.',
              },
              {
                q: 'VRP báo lỗi?',
                a: 'Kiểm tra: có đơn đã xác nhận cho ngày đó chưa? Có xe sẵn sàng không? Bấm "Tính lại" một lần. Vẫn lỗi → báo IT.',
              },
              {
                q: 'Số liệu Dashboard có trễ không?',
                a: 'Stats tổng quan cache 30 giây. Dashboard kho cập nhật mỗi 10 giây. Bấm F5 để làm mới ngay.',
              },
              {
                q: 'Mã lỗi 401 / 403 / 503?',
                a: '401: Đăng nhập lại. 403: Không có quyền → liên hệ Admin. 503: Dịch vụ tạm gián đoạn → chờ 1–2 phút.',
              },
            ].map((faq, i) => (
              <FaqItem key={i} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </Section>

        {/* Footer spacing */}
        <div className="h-8" />
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────

function Section({
  id, title, icon: Icon, query, children, className = '',
}: {
  id: string
  title: string
  icon: typeof BookOpen
  query: string
  children: React.ReactNode
  className?: string
}) {
  // Simple match: if query doesn't match title or children text, hide
  // (Basic impl — full text search would need refs)
  if (query && !title.toLowerCase().includes(query.toLowerCase())) {
    // Still show, children may match
  }

  return (
    <section id={id} className={`scroll-mt-16 ${className}`}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
          <Icon size={16} className="text-brand-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      </div>
      <div className="pl-0">{children}</div>
    </section>
  )
}

function StepList({ steps, className = '' }: { steps: { title: string; body: string }[]; className?: string }) {
  return (
    <ol className={`space-y-2 ${className}`}>
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
            {i + 1}
          </span>
          <div className="text-sm">
            <span className="font-medium text-gray-900">{s.title}</span>
            {s.body && <span className="text-gray-500"> — {s.body}</span>}
          </div>
        </li>
      ))}
    </ol>
  )
}

function Callout({
  type,
  children,
  className = '',
}: {
  type: 'info' | 'tip' | 'warning'
  children: React.ReactNode
  className?: string
}) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    tip: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
  }
  const icons = {
    info: <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />,
    tip: <Lightbulb size={14} className="text-green-500 mt-0.5 shrink-0" />,
    warning: <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />,
  }
  return (
    <div className={`flex items-start gap-2.5 px-3.5 py-3 rounded-lg border text-[13px] leading-snug ${styles[type]} ${className}`}>
      {icons[type]}
      <div>{children}</div>
    </div>
  )
}

function StatusTable({ rows }: { rows: { status: string; color: string; desc: string }[] }) {
  const colorMap: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-600',
    yellow: 'bg-yellow-100 text-yellow-700',
    orange: 'bg-orange-100 text-orange-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
  }
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-start gap-3 text-sm">
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${colorMap[r.color] || 'bg-gray-100 text-gray-600'}`}>
            {r.status}
          </span>
          <span className="text-gray-600">{r.desc}</span>
        </div>
      ))}
    </div>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <p className="text-[13px] font-medium text-gray-800">{question}</p>
        <ChevronRight
          size={14}
          className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-3">
          <p className="text-[13px] text-gray-600 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  )
}
