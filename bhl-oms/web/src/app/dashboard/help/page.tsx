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

// FAQ data constant - defined outside component to prevent tree-shaking
const FAQ_DATA = [
  { q: 'Không thấy menu trong sidebar?', a: 'Menu hiển thị theo quyền (role) của bạn. Ví dụ: DVKH không thấy menu Vận chuyển hay Kho. Liên hệ Admin nếu bạn cần thêm quyền.' },
  { q: 'Bị đăng xuất liên tục?', a: '3 bước: (1) Đăng xuất bằng nút Đăng xuất (không chỉ đóng tab). (2) Mở Ctrl+Shift+Delete → xóa Cookie và Cache. (3) Đăng nhập lại. Vẫn lỗi → báo IT kèm screenshot.' },
  { q: 'Tìm không thấy đơn cũ?', a: 'Đơn hàng mặc định chỉ hiện tháng hiện tại. Bộ lọc bên trái → Khoảng thời gian → chọn rộng hơn. Hoặc gõ mã đơn / tên khách vào ô Tìm kiếm ở đầu trang.' },
  { q: 'VRP báo lỗi khi chạy?', a: 'Kiểm tra: (1) Có đơn "Đã xác nhận" cho ngày đó chưa? (2) Có xe "Sẵn sàng" không? (3) Bấm "Chạy lại" 1 lần. (4) Vẫn lỗi → chụp screenshot → báo IT, đừng thử thêm.' },
  { q: 'Số liệu Dashboard có trễ không?', a: 'Stats tổng quan cache 30 giây. Kho cập nhật mỗi 10 giây. GPS cập nhật mỗi 5 giây. Số liệu cũ → bấm F5 để làm mới ngay.' },
  { q: 'Mã lỗi 401 / 403 / 503?', a: '401: Phiên đăng nhập hết hạn → đăng nhập lại. 403: Không có quyền truy cập trang này → báo Admin xem lại role. 503: Server đang quá tải → chờ 1–2 phút → thử lại.' },
  { q: 'Màn hình trắng / không load được?', a: '(1) Chờ 5 giây → F5. (2) Thử trình duyệt khác. (3) Xóa cache: Ctrl+Shift+Delete → "All time" → xóa. (4) Kiểm tra internet. (5) Vẫn lỗi → chụp màn hình → báo IT.' },
  { q: 'Bấm nút không thấy gì xảy ra?', a: 'Chờ 5–10 giây (không bấm thêm). Kiểm tra có thông báo lỗi nhỏ ở góc màn hình không. Mở F12 → Console → thấy chữ đỏ → chụp lại → báo IT.' },
  { q: 'Chữ quá nhỏ / khó nhìn?', a: 'Ctrl + (phóng to), Ctrl - (thu nhỏ), Ctrl+0 (về cỡ gốc). Khuyến nghị zoom 90%–110% tùy màn hình.' },
  { q: 'Lưu rồi mới phát hiện nhập sai, sửa thế nào?', a: 'Đơn còn "Nháp/Chờ xác nhận" → bấm Chỉnh sửa → sửa → Lưu. Đơn đã "Xác nhận" chưa vào kế hoạch → liên hệ Dispatcher hủy và tạo lại. Đơn đang giao → liên hệ Admin.' },
  { q: 'Đơn bị kẹt ở "Chờ duyệt" lâu?', a: 'Nhắn trực tiếp Dispatcher hoặc Quản lý qua Zalo/điện thoại. Hệ thống gửi thông báo nhưng không đảm bảo họ đã thấy. Nếu khẩn → Admin có thể duyệt ngay.' },
  { q: 'Khách chưa nhận được Zalo xác nhận?', a: '(1) Kiểm tra SĐT Zalo của khách trong hồ sơ NPP có đúng không. (2) Mở đơn → "Gửi lại Zalo". (3) Vẫn không đến → gọi điện xác nhận miệng → ghi chú vào đơn.' },
  { q: 'Tài xế không thấy chuyến trên app?', a: '(1) Dispatcher đã duyệt kế hoạch chưa? (2) Tài xế đã Check-in kho chưa? (3) Đúng kho chưa? (4) Tắt app hoàn toàn → mở lại.' },
  { q: 'Cách xem GPS xe đang ở đâu?', a: 'Sidebar → "Bản đồ GPS". Bấm vào xe để xem: tên tài xế, tốc độ, chuyến hiện tại, điểm giao tiếp theo. Cập nhật mỗi 5 giây.' },
  { q: 'Tạo tài khoản cho nhân viên mới?', a: '[Admin] Admin → Quản lý người dùng → Thêm → điền thông tin → chọn role → Tạo. Mật khẩu tạm: demo123. Nhắc nhân viên đổi mật khẩu ngay.' },
  { q: 'Cách đổi mật khẩu?', a: 'Bấm tên mình (góc dưới trái sidebar) → "Đổi mật khẩu" → nhập mật khẩu cũ → mật khẩu mới (≥8 ký tự) → Xác nhận. Không cần liên hệ Admin.' },
  { q: 'Dùng được trên điện thoại không?', a: 'Web app chạy được trên Chrome/Safari mobile. Nhưng VRP, bản đồ, đối soát phức tạp tốt hơn trên máy tính. Tài xế dùng Driver App riêng (không phải web này).' },
  { q: 'Dữ liệu có mất khi đóng tab không?', a: 'Dữ liệu đã bấm Lưu thì an toàn (trên server). Dữ liệu đang nhập chưa Lưu thì mất khi đóng tab. Quy tắc: nhập xong → Lưu ngay.' },
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
          <Callout type="info" className="mb-4">
            Dành cho người mới dùng lần đầu. Đọc từng bước, làm theo từng bước — thành thạo cơ bản trong 15 phút.
          </Callout>

          <h3 className="font-semibold text-[14px] text-gray-900 mb-2">Đăng nhập lần đầu</h3>
          <StepList steps={[
            { title: 'Mở trình duyệt Chrome hoặc Edge', body: 'KHÔNG dùng Internet Explorer. Khuyên dùng Chrome mới nhất.' },
            { title: 'Gõ địa chỉ: https://bhl.symper.us', body: 'Rồi bấm Enter. Trang đăng nhập xuất hiện.' },
            { title: 'Nhập tên đăng nhập (username)', body: 'Ví dụ: nguyen.van.a — chữ thường, không dấu, có dấu chấm. Admin đã gửi cho bạn qua Zalo.' },
            { title: 'Nhập mật khẩu', body: 'Mật khẩu tạm thời lần đầu là: demo123. Bấm nút "Đăng nhập".' },
            { title: 'ĐỔI MẬT KHẨU NGAY', body: 'Bấm vào tên của bạn (góc dưới trái sidebar) → "Đổi mật khẩu" → nhập mật khẩu mới (tối thiểu 8 ký tự, nên có số và chữ hoa).' },
          ]} />

          <Callout type="warning" className="mt-3">
            Nếu không đăng nhập được: (1) Kiểm tra internet (thử mở google.com). (2) Kiểm tra username có đúng không — thường lỗi ở dấu chấm hoặc chữ hoa. (3) Liên hệ Admin xin reset mật khẩu.
          </Callout>

          <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Giao diện sau khi đăng nhập</h3>
          <div className="space-y-2 text-sm">
            {[
              { zone: 'Sidebar trái', desc: 'Menu điều hướng — chỉ hiện các mục bạn có quyền truy cập. Bấm vào mục nào để mở trang đó.' },
              { zone: 'Header trên', desc: 'Thanh tìm kiếm AI (Ctrl+K), chuông thông báo (số đỏ = tin chưa đọc), avatar tài khoản của bạn.' },
              { zone: 'Vùng giữa', desc: 'Nội dung của trang hiện tại. Hầu hết có bộ lọc ở đầu trang và bảng dữ liệu ở dưới.' },
              { zone: 'Footer sidebar', desc: 'Tên đăng nhập + vai trò + nút Đăng xuất (mũi tên ra).' },
            ].map((z, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2.5 bg-white rounded-lg border border-gray-100">
                <span className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-mono shrink-0 mt-0.5">{z.zone}</span>
                <span className="text-[13px] text-gray-600">{z.desc}</span>
              </div>
            ))}
          </div>

          <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Việc cần làm đầu tiên theo vai trò</h3>
          <div className="space-y-2">
            {[
              { role: 'DVKH', color: 'bg-blue-50 text-blue-700', action: 'Sidebar → "Tạo đơn hàng" → nhập thông tin đơn đầu tiên của khách' },
              { role: 'Điều phối', color: 'bg-purple-50 text-purple-700', action: 'Sidebar → "Lập kế hoạch" → xem danh sách đơn chờ phân chuyến hôm nay' },
              { role: 'Tài xế', color: 'bg-green-50 text-green-700', action: 'Sidebar → "Chuyến hôm nay" → xem danh sách điểm giao và thứ tự' },
              { role: 'Thủ kho', color: 'bg-amber-50 text-amber-700', action: 'Sidebar → "Soạn hàng theo xe" → check danh sách xuất kho' },
              { role: 'Kế toán', color: 'bg-rose-50 text-rose-700', action: 'Sidebar → "Đối soát" → xem chuyến chưa đối soát' },
              { role: 'Admin', color: 'bg-gray-100 text-gray-700', action: 'Sidebar → "Admin" → kiểm tra user list, phân quyền nhân viên mới' },
            ].map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-gray-100">
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${r.color}`}>{r.role}</span>
                <span className="text-[13px] text-gray-600">{r.action}</span>
              </div>
            ))}
          </div>

          <Callout type="tip" className="mt-4">
            <strong>Bấm Ctrl+K</strong> bất cứ lúc nào để mở AI Copilot. Gõ bất kỳ câu hỏi bằng tiếng Việt — ví dụ: <em>"Hôm nay có bao nhiêu đơn chưa giao?"</em> hoặc <em>"Tìm đơn của khách Hà Nội"</em>.
          </Callout>
        </Section>

        {/* ── DVKH Orders ── */}
        {(!sections.find(s => s.id === 'orders')?.roles || sections.find(s => s.id === 'orders')?.roles?.includes(role) || role === 'admin') && (
          <Section id="orders" title="DVKH — Đơn hàng" icon={FileText} query={query}>
            <p className="text-sm text-gray-600 mb-4">
              DVKH là người tiếp nhận đơn từ khách/NPP và đảm bảo đơn đi đúng luồng. Quy trình chuẩn: Tiếp nhận đơn → Tạo trên hệ thống → Chờ xác nhận khách → Chuyển điều phối.
            </p>

            <h3 className="font-semibold text-[14px] text-gray-900 mb-2">Tạo đơn hàng mới — từng bước</h3>
            <StepList steps={[
              { title: 'Sidebar → bấm "Tạo đơn hàng"', body: 'Hoặc bấm phím tắt Ctrl+K → gõ "tạo đơn"' },
              { title: 'Chọn khách hàng / NPP', body: 'Gõ tên hoặc mã NPP (ví dụ: HAL-001). Danh sách gợi ý xuất hiện. Bấm chọn đúng khách.' },
              { title: 'Kiểm tra thông tin khách', body: 'Hệ thống hiện địa chỉ giao, hạn mức công nợ còn lại, lịch sử đặt hàng gần đây. Nếu sai địa chỉ → báo Admin sửa master data.' },
              { title: 'Chọn ngày giao hàng', body: 'Mặc định = ngày mai. Lưu ý: đơn tạo sau 16:00 sẽ tự đẩy sang ngày kia (cutoff 16h). Nếu đơn khẩn → tick "Ưu tiên" và báo Điều phối.' },
              { title: 'Chọn kho xuất hàng', body: 'Hạ Long hoặc Đông Mai — chọn đúng kho gần địa điểm giao nhất để tối ưu chi phí.' },
              { title: 'Thêm sản phẩm', body: 'Bấm "+ Thêm sản phẩm" → gõ tên hoặc SKU → chọn → nhập số lượng thùng/lon. Bấm "Thêm dòng" để thêm sản phẩm khác.' },
              { title: 'Kiểm tra tổng đơn', body: 'Xem lại: đúng khách? đúng ngày? đúng sản phẩm + số lượng? Tổng tiền hợp lý chưa?' },
              { title: 'Bấm "Lưu đơn"', body: 'Hệ thống tự động kiểm tra ATP (tồn kho) và hạn mức công nợ.' },
            ]} />

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Xử lý khi lưu đơn</h3>
            <div className="space-y-3">
              <div className="px-3.5 py-3 bg-green-50 border border-green-200 rounded-lg text-[13px] text-green-800">
                <p className="font-semibold mb-1">Đơn hợp lệ (ATP đủ + công nợ trong hạn)</p>
                <p>→ Trạng thái chuyển sang <strong>"Chờ xác nhận KH"</strong>. Hệ thống tự gửi Zalo cho khách. Khách có 2 giờ để bấm xác nhận.</p>
                <p className="mt-1">→ Nếu khách xác nhận: đơn thành <strong>"Đã xác nhận"</strong>, sẵn sàng vào kế hoạch vận chuyển.</p>
              </div>
              <div className="px-3.5 py-3 bg-amber-50 border border-amber-200 rounded-lg text-[13px] text-amber-800">
                <p className="font-semibold mb-1">Đơn vượt hạn mức công nợ</p>
                <p>→ Trạng thái <strong>"Chờ duyệt"</strong>. Báo Quản lý / Điều phối để phê duyệt.</p>
                <p className="mt-1">→ Không tự ý xóa đơn hay tạo lại. Chờ phê duyệt hoặc yêu cầu khách thanh toán trước.</p>
              </div>
              <div className="px-3.5 py-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-800">
                <p className="font-semibold mb-1">Đơn thiếu hàng / ATP không đủ</p>
                <p>→ Hệ thống cảnh báo màu đỏ, chỉ rõ sản phẩm nào thiếu bao nhiêu.</p>
                <p className="mt-1">→ Giải pháp: (a) Giảm số lượng xuống mức tồn kho cho phép. (b) Hỏi Thủ kho khi nào có hàng. (c) Chuyển một phần sang kho còn hàng.</p>
              </div>
            </div>

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Trạng thái đơn hàng — ý nghĩa</h3>
            <StatusTable rows={[
              { status: 'Nháp', color: 'gray', desc: 'Mới tạo, chưa gửi. Có thể sửa/xóa thoải mái. Nhớ bấm Lưu sau khi sửa.' },
              { status: 'Chờ xác nhận KH', color: 'yellow', desc: 'Đã gửi Zalo cho khách. Chờ phản hồi. Nếu sau 2h không phản hồi → gọi điện trực tiếp.' },
              { status: 'Đã xác nhận', color: 'blue', desc: 'Khách đã OK. Đơn đang chờ Điều phối xếp vào kế hoạch vận chuyển.' },
              { status: 'Chờ duyệt', color: 'orange', desc: 'Vượt ATP hoặc hạn mức công nợ. Báo Dispatcher hoặc Quản lý. Không làm gì thêm.' },
              { status: 'Đang vận chuyển', color: 'blue', desc: 'Xe đã xuất cổng. Theo dõi GPS trên bản đồ. Không sửa được đơn nữa.' },
              { status: 'Đã giao', color: 'green', desc: 'Giao thành công. Ảnh ePOD đã lưu. Kế toán sẽ đối soát trong T+1.' },
              { status: 'Giao một phần', color: 'orange', desc: 'Giao được một phần, còn hàng thừa. Cần tạo đơn Giao bổ sung cho phần chưa giao.' },
              { status: 'Giao thất bại', color: 'red', desc: 'Không giao được (khách vắng, đóng cửa, từ chối...). Tạo Giao bổ sung hoặc hủy đơn.' },
            ]} />

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Giao bổ sung (giao lại)</h3>
            <StepList steps={[
              { title: 'Mở chi tiết đơn có trạng thái "Giao thất bại" hoặc "Giao một phần"', body: '' },
              { title: 'Bấm nút "Tạo giao bổ sung"', body: 'Hệ thống tự copy thông tin, cho chọn sản phẩm và số lượng cần giao lại' },
              { title: 'Chọn ngày giao lại', body: 'Mặc định ngày hôm sau. Điều phối sẽ xếp vào chuyến phù hợp.' },
              { title: 'Xác nhận', body: 'Đơn bổ sung mới sẽ xuất hiện và đi qua đúng luồng như đơn thường.' },
            ]} />

            <Callout type="tip" className="mt-3">
              <strong>Tìm đơn cũ:</strong> Vào Đơn hàng → bộ lọc bên trái → chọn khoảng thời gian rộng hơn (mặc định chỉ hiện tháng này). Gõ tên khách vào ô Tìm kiếm.
            </Callout>
          </Section>
        )}

        {/* ── VRP ── */}
        {(role === 'dispatcher' || role === 'admin') && (
          <Section id="vrp" title="Điều phối — Lập kế hoạch VRP" icon={Truck} query={query}>
            <p className="text-sm text-gray-600 mb-4">
              VRP (Vehicle Routing Problem) = AI tự động tính tuyến đường tối ưu cho toàn đội xe mỗi ngày, thay cho việc lên kế hoạch thủ công mất 1–3 giờ. Điều phối chỉ cần review và duyệt.
            </p>

            <h3 className="font-semibold text-[14px] text-gray-900 mb-2">Quy trình lên kế hoạch hàng ngày</h3>
            <StepList steps={[
              { title: 'Kiểm tra đơn sẵn sàng (8:00–9:00 sáng)', body: 'Vào Đơn hàng → lọc ngày mai → xem các đơn ở trạng thái "Đã xác nhận". Đây là đơn sẽ vào VRP.' },
              { title: 'Vào Lập kế hoạch → bấm "Tạo kế hoạch VRP"', body: '' },
              { title: 'Chọn ngày giao và kho xuất hàng', body: 'Hạ Long hoặc Đông Mai. Mỗi kho tạo kế hoạch riêng.' },
              { title: 'Chọn mục tiêu tối ưu', body: '"Chi phí thấp nhất" (ngày bình thường) hoặc "Thời gian giao nhanh nhất" (ngày có đơn khẩn, ngày lễ).' },
              { title: 'Chọn xe tham gia', body: 'Hệ thống hiện danh sách xe + tài xế sẵn sàng. Bỏ tick xe nào đang nghỉ, bảo dưỡng, hoặc đặc biệt.' },
              { title: 'Bấm "Chạy VRP"', body: 'AI tính 1–3 phút tùy số lượng đơn. KHÔNG tắt tab, chờ đến khi có kết quả.' },
              { title: 'So sánh 2 phương án', body: 'Hệ thống hiện cả 2 tùy chọn: Chi phí thấp vs Thời gian nhanh. Xem bản đồ, tổng km, số chuyến.' },
              { title: 'Điều chỉnh thủ công nếu cần', body: 'Kéo-thả đơn sang xe khác. Ghép/bỏ điểm. Thay tài xế. Điều chỉnh thứ tự điểm dừng.' },
              { title: 'Bấm "Phê duyệt kế hoạch"', body: 'Hệ thống tự gửi lệnh xuất kho cho Thủ kho và thông báo chuyến cho từng Tài xế.' },
            ]} />

            <Callout type="warning" className="mt-3">
              <strong>Không được duyệt trước 7:00 sáng</strong> — Thủ kho chưa vào ca. Thời điểm duyệt lý tưởng: 9:00–10:00. Muộn nhất: 11:00 để kịp xuất hàng buổi chiều.
            </Callout>

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">VRP báo lỗi — xử lý thế nào?</h3>
            <div className="space-y-2 text-[13px]">
              {[
                { err: 'Không có đơn nào để tối ưu', fix: 'Kiểm tra đơn hàng ngày đó — có ở trạng thái "Đã xác nhận" chưa? Nếu chưa → yêu cầu DVKH xác nhận đơn trước.' },
                { err: 'Không có xe nào sẵn sàng', fix: 'Vào Phương tiện → kiểm tra trạng thái xe. Kích hoạt lại xe hoặc thêm xe đặc biệt.' },
                { err: 'Đơn không fit vào xe nào (quá tải)', fix: 'Có đơn quá to hoặc đơn + đơn vượt tải trọng xe. Tách đơn hoặc bổ sung xe tải lớn hơn.' },
                { err: 'VRP timeout sau 5 phút', fix: 'Quá nhiều đơn hoặc điểm giao. Thử chọn ít xe hơn, hoặc chia làm 2 lần chạy (sáng + chiều).' },
              ].map((e, i) => (
                <div key={i} className="flex items-start gap-3 px-3 py-2.5 bg-white rounded-lg border border-gray-100">
                  <div className="flex-1">
                    <p className="font-medium text-red-700">{e.err}</p>
                    <p className="text-gray-600 mt-0.5">{e.fix}</p>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Thêm đơn khẩn SAU khi đã duyệt kế hoạch</h3>
            <StepList steps={[
              { title: 'Vào trang kế hoạch đã duyệt → bấm "Mô phỏng"', body: 'Chế độ Simulation — không thay đổi kế hoạch thật.' },
              { title: 'Kéo đơn khẩn vào chuyến xe phù hợp nhất', body: 'AI tính lại tuyến và hiện tác động: chi phí tăng bao nhiêu, OTD thay đổi thế nào.' },
              { title: 'Xem kết quả mô phỏng', body: 'Nếu chấp nhận được → bấm "Áp dụng". Nếu không → bấm "Hủy" và xem xét phương án khác.' },
            ]} />

            <Callout type="tip" className="mt-3">
              <strong>Theo dõi trực tiếp:</strong> Vào bản đồ GPS để xem từng xe đang ở đâu trong thời gian thực. Màu xanh = đang di chuyển. Màu cam = đang giao. Màu đỏ = trễ so với kế hoạch.
            </Callout>
          </Section>
        )}

        {/* ── Driver ── */}
        {(role === 'driver' || role === 'admin') && (
          <Section id="driver" title="Tài xế — Driver App" icon={User} query={query}>
            <Callout type="warning">
              <strong>Quy tắc số 1:</strong> HẠ HÀNG TRƯỚC — thu tiền/xác nhận công nợ SAU. Tuyệt đối không giữ hàng vì lý do công nợ của khách. Vi phạm quy tắc này sẽ bị xử lý kỷ luật.
            </Callout>

            <h3 className="font-semibold text-[14px] text-gray-900 mt-4 mb-2">Buổi sáng tại kho (trước khi xuất)</h3>
            <StepList steps={[
              { title: 'Đến kho trước 7:30 sáng', body: 'Mở app → bấm "Check-in kho". GPS tự ghi nhận vị trí. Không bấm nếu chưa đến kho thực sự.' },
              { title: 'Xem chuyến hôm nay', body: 'App hiện danh sách điểm giao theo thứ tự tuyến tối ưu. Xem kỹ: địa chỉ, sản phẩm, số lượng, ghi chú của từng điểm.' },
              { title: 'Làm checklist xe trước khi lấy hàng', body: 'Mở mục "Checklist xe" → kiểm tra: phanh, đèn trước/sau, lốp (áp suất), gương, nước. Bấm tick từng mục. Nếu phát hiện vấn đề → báo Dispatcher NGAY, không tự ý xuất xe.' },
              { title: 'Nhận hàng từ Thủ kho', body: 'Kho soạn hàng theo danh sách. Bạn kiểm tra từng thùng/sản phẩm có khớp với lệnh trên app không.' },
              { title: 'Ký Bàn giao A + qua kiểm cổng', body: 'Bảo vệ đếm lại toàn bộ hàng. Hệ thống so sánh với lệnh xuất. Số lượng phải khớp 100% — nếu sai: dừng lại, báo Thủ kho xử lý. KHÔNG được ra cổng khi còn sai lệch.' },
              { title: 'Bấm "Bắt đầu chuyến"', body: 'Chỉ bấm khi xe đã ra khỏi cổng kho. GPS bắt đầu tracking.' },
            ]} />

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Tại mỗi điểm giao hàng</h3>
            <StepList steps={[
              { title: 'Bấm "Đến nơi" khi vừa tới địa điểm giao', body: 'Hệ thống ghi timestamp và GPS. Khách nhận được thông báo Zalo.' },
              { title: 'Bấm "Đang giao hàng"', body: 'Báo hệ thống bạn đang hạ hàng. Thủ kho và Điều phối thấy trạng thái real-time.' },
              { title: 'Hạ hàng xuống', body: 'Đếm và giao đúng số lượng từng loại. Khách hoặc nhân viên kho của khách ký nhận.' },
              { title: 'Chụp ảnh ePOD (BẮT BUỘC)', body: 'Chụp ảnh: (1) Hàng đã hạ xuống tại kho khách. (2) Biên nhận có chữ ký. Ảnh phải thấy rõ hàng và chữ ký.' },
              { title: 'Bấm "Giao thành công"', body: 'Nhập số lượng thực tế hạ (nếu khác lệnh → nhập đúng số thực, hệ thống tự xử lý phần chênh lệch).' },
              { title: 'Thu tiền mặt (nếu có)', body: 'Đếm tiền trước mặt khách. Ghi số tiền vào app. Khách ký xác nhận.' },
              { title: 'Thu vỏ (lon/chai/thùng rỗng)', body: 'Đếm vỏ và ghi số lượng vào app. Vỏ xếp gọn trên xe, mang về kho.' },
            ]} />

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Khi giao thất bại / khách không nhận</h3>
            <StepList steps={[
              { title: 'Bấm "Giao thất bại"', body: 'KHÔNG bỏ qua điểm mà không bấm. Phải ghi nhận trong hệ thống.' },
              { title: 'Chọn lý do', body: '"Khách vắng", "Cửa đóng", "Khách từ chối nhận", "Địa chỉ sai"... Chọn đúng lý do thực tế.' },
              { title: 'Chụp ảnh bằng chứng', body: 'Chụp ảnh cửa đóng hoặc địa chỉ để có bằng chứng. Bắt buộc nếu khách "từ chối nhận".' },
              { title: 'Báo Dispatcher qua Zalo/điện thoại', body: 'Dispatcher quyết định: giao lại buổi chiều, hủy đơn, hay lên lịch ngày khác.' },
            ]} />

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Cuối chuyến — về kho</h3>
            <StepList steps={[
              { title: 'Đến kho → Bàn giao B (vỏ)', body: 'Thủ kho đếm vỏ thu về. Phải khớp với số vỏ trong app. Ký xác nhận.' },
              { title: 'Bàn giao C (tiền mặt)', body: 'Kế toán đếm và xác nhận số tiền. Nhận phiếu thu. Đây là chứng từ quan trọng, giữ lại.' },
              { title: 'Báo cáo hàng thừa (nếu có)', body: 'Hàng không giao được → bàn giao lại Thủ kho, ký phiếu nhập kho.' },
              { title: 'Bấm "Hoàn thành chuyến" trên app', body: '' },
              { title: 'Bấm "Check-out kho"', body: 'Kết thúc ca. KHÔNG check-out trước khi hoàn tất bàn giao B và C.' },
            ]} />

            <Callout type="info" className="mt-3">
              <strong>Hỏng xe giữa chuyến:</strong> (1) Báo ngay Dispatcher + Quản lý qua Zalo. (2) Bấm "Báo sự cố" trên app, chọn "Hỏng xe". (3) Chờ hướng dẫn — có thể điều xe khác đến tiếp quản hoặc tổ chức giao bổ sung.
            </Callout>
          </Section>
        )}

        {/* ── Warehouse ── */}
        {(role === 'warehouse_handler' || role === 'admin') && (
          <Section id="warehouse" title="Thủ kho — Xuất/Nhập/Kiểm kê" icon={Warehouse} query={query}>
            <p className="text-sm text-gray-600 mb-4">
              Thủ kho quản lý toàn bộ hàng hóa vào-ra kho: soạn hàng theo xe, kiểm tra cổng, nhập hàng từ nhà máy, và cập nhật tồn kho liên tục.
            </p>

            <h3 className="font-semibold text-[14px] text-gray-900 mb-2">Soạn hàng theo xe (7:30–10:00 sáng)</h3>
            <StepList steps={[
              { title: 'Vào Kho → "Soạn hàng theo xe"', body: 'Chọn ngày giao. Hệ thống hiện danh sách từng xe với tổng sản phẩm cần xuất.' },
              { title: 'Mở từng xe → xem danh sách hàng', body: 'Hiện rõ: SKU, tên sản phẩm, số lượng thùng/lon, lô hàng gợi ý theo FEFO.' },
              { title: 'Lấy hàng theo lô FEFO', body: 'FEFO = First Expired First Out. Lấy đúng lô hệ thống gợi ý — lô gần hết hạn nhất xuất trước. Không được tự chọn lô khác trừ khi hết lô đó.' },
              { title: 'Xếp hàng lên xe', body: 'Xếp theo thứ tự điểm giao ngược (điểm giao sau xếp vào trước). Dán nhãn lô hàng rõ ràng.' },
              { title: 'Bấm "Xác nhận soạn xong"', body: 'Hệ thống ghi nhận hàng đã xuất khỏi kho (trừ tồn kho ảo). Tồn thật trừ khi xe ra cổng.' },
            ]} />

            <Callout type="warning" className="mt-3">
              <strong>Quy tắc FEFO nghiêm ngặt:</strong> Không được xuất lô mới khi còn lô cũ hơn. Nếu khách yêu cầu lô mới → báo Dispatcher hoặc Quản lý, không tự ý xuất.
            </Callout>

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Kiểm tra cổng — Bàn giao A (Gate Check)</h3>
            <StepList steps={[
              { title: 'Vào Kho → "Hàng chờ kiểm cổng"', body: 'Hiện danh sách xe sắp xuất cổng.' },
              { title: 'Đếm thực tế từng sản phẩm trên xe', body: 'Đếm đúng — không được dùng số từ lệnh. Đếm tay từng thùng.' },
              { title: 'Nhập số lượng thực tế vào hệ thống', body: 'Hệ thống so sánh ngay với lệnh xuất và hiện sai lệch (nếu có).' },
              { title: 'Nếu SỐ KHỚP: Ký bàn giao', body: 'Bấm "Xác nhận xuất cổng". Tài xế ký xác nhận. Xe được phép ra cổng.' },
              { title: 'Nếu CÓ CHÊNH LỆCH: Phải xử lý trước', body: 'Hệ thống KHÔNG cho ký khi sai lệch > 0. Điều chỉnh hàng thực tế cho khớp (bổ sung thiếu / lấy lại thừa) rồi đếm lại.' },
            ]} />

            <Callout type="warning" className="mt-2">
              <strong>Quy tắc R01 — Sai lệch = 0:</strong> Xe không được phép ra cổng khi còn sai lệch. Đây là quy tắc bất biến — không có ngoại lệ, kể cả xe trễ giờ hay đơn khẩn.
            </Callout>

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Nhập hàng từ nhà máy / nhà cung cấp</h3>
            <StepList steps={[
              { title: 'Vào Kho → "Nhập hàng"', body: '' },
              { title: 'Chọn nguồn nhập', body: 'Nhà máy Hạ Long / Đông Mai, hoặc nhà cung cấp bên ngoài.' },
              { title: 'Scan hoặc nhập mã lô hàng', body: 'Dùng máy scan barcode (nếu có) hoặc nhập tay. Nhập đúng: SKU, số lượng, HSD (hạn sử dụng), số lô.' },
              { title: 'Chỉ định vị trí bin', body: 'Hệ thống gợi ý bin trống phù hợp kích thước. Chọn bin và xếp Pallet vào đúng vị trí.' },
              { title: 'Xác nhận nhập kho', body: 'Tồn kho cập nhật ngay lập tức. Kiểm tra số tồn sau nhập có khớp không.' },
            ]} />

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Dashboard kho — đọc cảnh báo</h3>
            <StatusTable rows={[
              { status: 'Tồn kho thấp', color: 'orange', desc: 'Hàng xuống dưới ngưỡng an toàn (thường = 3 ngày tồn). Báo bộ phận mua hàng ngay.' },
              { status: 'Hết hạn trong 30 ngày', color: 'red', desc: 'Lô lớn sắp hết hạn. Ưu tiên xuất trước. Báo Sales xem có thể đẩy khuyến mãi không.' },
              { status: 'Bin > 90% sức chứa', color: 'orange', desc: 'Bin sắp đầy. Điều chuyển bớt sang bin khác hoặc khu vực sàn.' },
              { status: 'Pallet mồ côi', color: 'yellow', desc: 'Pallet chưa có vị trí bin. Cất vào bin ngay để dễ tìm sau.' },
              { status: 'Chênh lệch tồn kho', color: 'red', desc: 'Tồn thực tế ≠ tồn hệ thống. Cần kiểm kê ngay, báo Kế toán.' },
            ]} />
          </Section>
        )}

        {/* ── Reconciliation ── */}
        {(role === 'accountant' || role === 'admin') && (
          <Section id="reconciliation" title="Kế toán — Đối soát" icon={Scale} query={query}>
            <p className="text-sm text-gray-600 mb-4">
              Đối soát = so sánh thực tế (tiền thu, hàng giao, vỏ) với kế hoạch trên hệ thống, và giải quyết mọi sai lệch trong vòng T+1 (ngày hôm sau).
            </p>

            <h3 className="font-semibold text-[14px] text-gray-900 mb-2">Đối soát theo chuyến (hàng ngày)</h3>
            <StepList steps={[
              { title: 'Vào Đối soát → "Theo chuyến"', body: 'Chọn ngày hôm qua (hoặc chuyến vừa về). Danh sách chuyến chưa đối soát màu vàng.' },
              { title: 'Mở chi tiết từng chuyến', body: 'Hệ thống hiện bảng so sánh 3 cột: Dự kiến / Thực tế / Chênh lệch, cho từng mục: tiền mặt thu, công nợ, số lượng hàng, vỏ.' },
              { title: 'Nếu tất cả KHỚP', body: 'Bấm "Ký xác nhận đối soát". Chuyến đóng lại, dữ liệu gửi Bravo tự động.' },
              { title: 'Nếu CÓ CHÊNH LỆCH → Tạo Discrepancy', body: 'Bấm "Thêm sai lệch" → chọn loại (Tiền mặt / Hàng hóa / Vỏ) → ghi mô tả → gán trách nhiệm (Tài xế / Kho / DVKH) → đặt deadline xử lý (mặc định T+1).' },
              { title: 'Theo dõi và xử lý Discrepancy', body: 'Vào tab "Sai lệch mở" → liên hệ người có trách nhiệm → họ giải quyết và upload bằng chứng (biên nhận, ảnh...) → bạn xác nhận đóng sai lệch.' },
              { title: 'Đóng ngày (cuối ngày)', body: 'Khi tất cả chuyến trong ngày đã đối soát và sai lệch = 0 → Đối soát → "Đóng ngày" → hệ thống tổng hợp và gửi báo cáo Bravo.' },
            ]} />

            <Callout type="warning" className="mt-3">
              <strong>Deadline đối soát là T+1 lúc 12:00 trưa.</strong> Sai lệch chưa giải quyết sau deadline sẽ tự leo thang lên Trưởng kế toán và ghi vào báo cáo tuần.
            </Callout>

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Xử lý từng loại sai lệch</h3>
            <div className="space-y-2.5">
              {[
                { type: 'Tiền mặt thiếu', action: 'Gặp trực tiếp Tài xế → xác nhận số tiền thực nộp. Nếu Tài xế thiếu thật → Tài xế bổ sung hoặc trừ lương. Nếu do DVKH tính sai → điều chỉnh đơn.' },
                { type: 'Tiền mặt thừa', action: 'Khách trả dư hoặc nhầm. Xác nhận với Tài xế → trả lại khách trong chuyến tiếp theo, hoặc ghi công nợ âm cho khách.' },
                { type: 'Hàng giao thiếu', action: 'Xác nhận với Tài xế và Kho: hàng có trên xe khi xuất cổng không? Nếu kho thiếu soạn → điều chỉnh tồn kho. Nếu Tài xế giao thiếu → tạo giao bổ sung.' },
                { type: 'Vỏ thiếu', action: 'Tài xế thu chưa đủ vỏ từ khách. Ghi nhận nợ vỏ cho khách đó, Tài xế thu bổ sung trong chuyến sau.' },
              ].map((d, i) => (
                <div key={i} className="px-3.5 py-3 bg-white rounded-lg border border-gray-100">
                  <p className="text-[13px] font-semibold text-gray-900">{d.type}</p>
                  <p className="text-[13px] text-gray-600 mt-1">{d.action}</p>
                </div>
              ))}
            </div>

            <Callout type="info" className="mt-4">
              Chỉ <strong>Trưởng kế toán</strong> mới có quyền đóng sai lệch lớn hơn 5 triệu đồng. Admin có thể gán quyền này tại Cài đặt &gt; Người dùng → bật flag <code className="font-mono text-[11px] bg-gray-100 px-1 rounded">is_chief_accountant</code>.
            </Callout>
          </Section>
        )}

        {/* ── Management ── */}
        {(role === 'management' || role === 'admin') && (
          <Section id="management" title="Quản lý — Dashboard & KPI" icon={BarChart3} query={query}>
            <p className="text-sm text-gray-600 mb-4">
              Dashboard cung cấp cái nhìn tổng quan toàn bộ hoạt động vận hành trong ngày. Quản lý cần review KPI vào đầu ngày và cuối ngày.
            </p>

            <h3 className="font-semibold text-[14px] text-gray-900 mb-3">KPI mục tiêu</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'OTD Rate', target: '> 95%', desc: 'Tỷ lệ giao đúng giờ cam kết. Dưới 90% = cần họp ngay.' },
                { label: 'Tải xe TB', target: '> 80%', desc: 'Tải trọng trung bình. Dưới 70% = đang lãng phí xe.' },
                { label: 'Xe rỗng chiều về', target: '< 5%', desc: 'Tỷ lệ xe chạy không tải. Cao = lãng phí nhiên liệu.' },
                { label: 'Sai lệch mở', target: '= 0', desc: 'Discrepancy chưa giải quyết. Khác 0 = vấn đề ngay.' },
              ].map(k => (
                <div key={k.label} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                  <p className="text-[12px] text-gray-500">{k.label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{k.target}</p>
                  <p className="text-[11px] text-gray-500 mt-1 leading-snug">{k.desc}</p>
                </div>
              ))}
            </div>

            <h3 className="font-semibold text-[14px] text-gray-900 mb-2">Việc cần làm mỗi ngày</h3>
            <div className="space-y-2 text-[13px]">
              {[
                { time: '8:00 sáng', task: 'Check Dashboard → xem KPI hôm qua → OTD Rate < 95%? → họp nhanh với Dispatcher.' },
                { time: '9:00–10:00', task: 'Phê duyệt đơn hàng vượt hạn mức (nếu có). Xem tab "Chờ phê duyệt".' },
                { time: '12:00', task: 'Check tiến độ giao hàng buổi sáng trên bản đồ GPS. Có xe nào trễ không?' },
                { time: '17:00', task: 'Check OTD cuối ngày. Sai lệch Discrepancy mở? Yêu cầu Kế toán xử lý trước 12:00 hôm sau.' },
                { time: 'Cuối tuần', task: 'Xem báo cáo tuần: top NPP theo doanh thu, xe hiệu suất thấp, tuyến có OTD thấp nhất.' },
              ].map((r, i) => (
                <div key={i} className="flex items-start gap-3 px-3 py-2 bg-white rounded-lg border border-gray-100">
                  <span className="text-[11px] font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600 shrink-0 mt-0.5 whitespace-nowrap">{r.time}</span>
                  <span className="text-gray-600">{r.task}</span>
                </div>
              ))}
            </div>

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Phê duyệt đơn vượt hạn mức</h3>
            <StepList steps={[
              { title: 'Vào Đơn hàng → tab "Chờ phê duyệt"', body: 'Hiện danh sách đơn bị giữ vì vượt ATP hoặc hạn mức công nợ.' },
              { title: 'Bấm vào đơn → xem chi tiết', body: 'Xem: lý do vượt hạn mức, lịch sử thanh toán của NPP đó, đơn này có đặc biệt quan trọng không?' },
              { title: 'Chọn quyết định', body: '"Duyệt toàn bộ" / "Duyệt một phần" (giảm số lượng xuống hạn mức) / "Từ chối".' },
              { title: 'GHI LÝ DO (bắt buộc)', body: 'Hệ thống yêu cầu nhập lý do quyết định. Đây là dữ liệu audit, không bỏ qua.' },
            ]} />

            <Callout type="tip" className="mt-3">
              <strong>Xem NPP có vấn đề:</strong> Dashboard → "Top công nợ" → xem NPP nào đang gần hoặc vượt hạn mức → proactive liên hệ yêu cầu thanh toán trước khi họ đặt đơn lớn.
            </Callout>
          </Section>
        )}

        {/* ── Admin ── */}
        {role === 'admin' && (
          <Section id="admin" title="Admin — Quản trị hệ thống" icon={Settings} query={query}>
            <h3 className="font-semibold text-[14px] text-gray-900 mb-2">Tạo tài khoản nhân viên mới</h3>
            <StepList steps={[
              { title: 'Vào Admin → "Quản lý người dùng" → bấm "Thêm người dùng"', body: '' },
              { title: 'Nhập thông tin', body: 'Họ tên đầy đủ, email (dùng để gửi thông báo), số điện thoại. Username tự động tạo hoặc tự nhập.' },
              { title: 'Chọn vai trò (role)', body: 'Chỉ chọn 1 role phù hợp với công việc của nhân viên đó. Xem bảng role bên dưới.' },
              { title: 'Chọn kho phụ trách', body: 'Với Thủ kho, Tài xế: chọn đúng kho họ làm việc (Hạ Long hoặc Đông Mai).' },
              { title: 'Bấm "Tạo tài khoản"', body: 'Mật khẩu tạm: demo123. Hệ thống có thể gửi email hướng dẫn đăng nhập (nếu cấu hình email).' },
              { title: 'Nhắc nhân viên đổi mật khẩu ngay lần đầu đăng nhập', body: 'Bảo mật quan trọng — không để cả nhóm dùng chung demo123.' },
            ]} />

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Vai trò hệ thống (9 roles)</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['admin', 'Quản trị viên', 'Toàn quyền. Chỉ cấp cho IT/quản lý cấp cao.'],
                ['dispatcher', 'Điều phối', 'Lên kế hoạch VRP, phân chuyến, theo dõi GPS.'],
                ['dvkh', 'DVKH', 'Tạo và quản lý đơn hàng. Không thấy tài chính.'],
                ['driver', 'Tài xế', 'Driver App: chuyến, ePOD, thu tiền, vỏ.'],
                ['warehouse_handler', 'Thủ kho', 'Soạn hàng, xuất nhập kho, kiểm cổng.'],
                ['accountant', 'Kế toán', 'Đối soát, công nợ, đóng ngày, xuất Bravo.'],
                ['management', 'Quản lý', 'Dashboard, báo cáo, phê duyệt đơn vượt hạn.'],
                ['security', 'Bảo vệ', 'Xác nhận kiểm cổng. Không thấy dữ liệu khác.'],
                ['workshop', 'Phân xưởng', 'Quản lý vỏ lon/chai, bảo dưỡng phương tiện.'],
              ].map(([r, name, desc]) => (
                <div key={r} className="flex items-start gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                  <code className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-brand-600 font-mono shrink-0 mt-0.5">{r}</code>
                  <div>
                    <p className="text-[12px] font-semibold text-gray-800">{name}</p>
                    <p className="text-[11px] text-gray-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="font-semibold text-[14px] text-gray-900 mt-5 mb-2">Các tác vụ Admin thường gặp</h3>
            <div className="space-y-2 text-[13px]">
              {[
                { task: 'Đặt lại mật khẩu cho nhân viên', how: 'Admin → Người dùng → tìm nhân viên → bấm "Reset mật khẩu" → mật khẩu trở về demo123.' },
                { task: 'Khóa tài khoản nhân viên nghỉ việc', how: 'Admin → Người dùng → bấm "Vô hiệu hóa". TÀI KHOẢN BỊ KHÓA NGAY LẬP TỨC, không xóa dữ liệu lịch sử.' },
                { task: 'Sửa thông tin khách hàng / NPP', how: 'Admin → Danh mục → Khách hàng → tìm → sửa địa chỉ, hạn mức, thông tin liên hệ.' },
                { task: 'Gán quyền Trưởng kế toán', how: 'Admin → Người dùng → tìm kế toán → bật flag "is_chief_accountant" → lưu.' },
                { task: 'Xem log hệ thống khi có sự cố', how: 'Admin → System Log → lọc theo thời gian và loại lỗi → tìm nguyên nhân sự cố.' },
              ].map((a, i) => (
                <div key={i} className="px-3.5 py-3 bg-white rounded-lg border border-gray-100">
                  <p className="font-semibold text-gray-900">{a.task}</p>
                  <p className="text-gray-600 mt-0.5">{a.how}</p>
                </div>
              ))}
            </div>

            <Callout type="warning" className="mt-4">
              <strong>Bảo mật:</strong> Không cấp role <code className="font-mono text-[11px]">admin</code> cho nhân viên thông thường. Khi có nhân viên nghỉ việc → khóa tài khoản NGAY trong ngày cuối làm việc.
            </Callout>
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
            {FAQ_DATA.map((faq, i) => (
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
