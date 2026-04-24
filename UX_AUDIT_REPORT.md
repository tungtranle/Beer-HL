# UX_AUDIT_REPORT — BHL OMS-TMS-WMS

> **Phiên bản:** 1.0  
> **Ngày:** 30/04/2026  
> **Phạm vi:** Toàn bộ 60+ màn hình của 9 user roles, end-to-end flows  
> **Tiêu chuẩn so sánh:** Top 1% sản phẩm SaaS thế giới (Linear, Stripe, Vercel, Shopify Polaris, Apple HIG, Material You)

---

## 1. TÓM TẮT ĐIỀU HÀNH

### 1.1 Trạng thái hiện tại: **B− (75/100)** — Functional nhưng không "thấy là thích"

Hệ thống đã cover đầy đủ nghiệp vụ (OMS+TMS+WMS), 60+ pages, 9 roles. Tuy nhiên:

| Tiêu chí world-class | Hiện trạng | Khoảng cách |
|---|---|---|
| **Design system thống nhất** | Mỗi page tự style; emoji + Tailwind trộn | ❌ Cao |
| **Visual hierarchy** | Title tất cả `text-2xl font-bold` + `mb-6` lặp lại 50+ lần | ❌ Cao |
| **Empty states giàu cảm xúc** | "Không có dữ liệu" text-xám | ❌ Cao |
| **Loading skeleton** | Spinner xám tròn (90% page) | ❌ Cao |
| **Mobile responsiveness** | Desktop-only cho dispatcher/accountant; driver mới mobile | ⚠️ TB |
| **Accessibility (WCAG 2.1 AA)** | Thiếu aria-label, focus ring inconsistent | ⚠️ TB |
| **Microinteractions** | Không có; transition đơn giản | ❌ Cao |
| **Information density** | Quá dày (KPI page 363 LOC), khó scan | ⚠️ TB |
| **Error UX** | TD-020 đã fix 18/35 (toast) — còn 17 silent | 🟡 Đang làm |
| **Onboarding/empty product** | Không có; user mới mở vào màn trắng | ❌ Cao |

### 1.2 Chiến lược cải thiện (3 sprints)

1. **Sprint UX-1 (tuần này)**: Design tokens + 8 primitive components + áp dụng cho 5 màn hình quan trọng nhất
2. **Sprint UX-2**: Áp dụng cho 20 màn hình tiếp theo, redesign empty/loading states toàn diện
3. **Sprint UX-3**: Microinteractions, animation choreography, accessibility audit

---

## 2. AUDIT THEO TỪNG ROLE

### 2.1 🚚 DRIVER — Đã redesign Sprint UX-0 (✅ DONE)

**Trạng thái:** **A (90/100)** — World-class mobile-first PWA

| Màn hình | Trước | Sau | Status |
|---|---|---|---|
| `/dashboard/driver` | Sidebar desktop + emoji card list | Hero gradient + 3 KPI tiles overlap + progress ring trip card + bottom nav | ✅ DONE |
| `/dashboard/driver/profile` | Form info đơn điệu | Hero avatar + setting sections (Tài khoản/Hỗ trợ) + bottom-sheet logout | ✅ DONE |
| `/dashboard/driver/[id]` (trip detail) | 1714 LOC, modal chồng modal | **CHƯA REDESIGN — Sprint UX-2** | ⏳ |
| `/dashboard/driver/[id]/eod` (kết ca 3 trạm) | OK nhưng dùng `[#F68634]` hardcode | **TODO — chuyển sang token brand** | ⏳ |

**Việc còn lại cho Driver:** Refactor trip-detail modal tower (1714 LOC) thành step-based wizard (4 steps: Pre-check → Stops → Post-check → EOD), dùng bottom sheets thay full-screen modals.

---

### 2.2 📋 DISPATCHER — Trạng thái: **C+ (68/100)**

**Vấn đề chính:**

1. **Control Tower (1660 LOC)** — Mật độ thông tin quá cao, không có visual rest. 4 panels chen chúc, người mới nhìn không biết bắt đầu từ đâu. **So với Uber Freight Operations Console / Convoy**: thiếu workflow priority, thiếu focus mode, thiếu split-panel resize.
2. **Planning (3282 LOC)** — Page lớn nhất hệ thống, nghi ngờ trộn nhiều concerns. Cần break thành sub-routes.
3. **Trips list (151 LOC)** — Plain table, không filter sticky, không bulk action, không saved view.
4. **Map (284 LOC)** — Standalone không tích hợp với trips list (phải back-and-forth).

**Đề xuất redesign:**

| Màn hình | Đề xuất world-class |
|---|---|
| Control Tower | **Split-pane 70/30 với Cmd+B toggle**; Top KPI bar 48px sticky; Left = vehicles list virtualized; Right = map full-bleed; Bottom drawer cho exceptions; Right rail 320px cho selected entity. Floating "What's next?" suggestion card khi idle. |
| Planning | Tách thành **3 routes**: `/planning/inbox` (đơn chờ), `/planning/board` (kanban gom chuyến), `/planning/optimize` (VRP). Mỗi route tối đa 800 LOC. |
| Trips | **Linear/Notion-style table** — sticky header, column resize, saved views ("Hôm nay", "Đang chạy", "Có vấn đề"), bulk action toolbar khi select. |
| Map | Merge vào Control Tower (xóa standalone). |

---

### 2.3 💰 ACCOUNTANT — Trạng thái: **C (65/100)**

**Vấn đề chính:**

1. **Approvals (294 LOC)** — Card list dạng từng đơn, không có batch approve, không sort theo urgency tự động (chỉ countdown text màu).
2. **Reconciliation (626 LOC)** — Bảng đối soát quá nhiều cột không có frozen column, scroll ngang khó đọc.
3. **Daily-close (153 LOC)** — Quá đơn giản cho task quan trọng nhất ngày của kế toán.

**Đề xuất:**

| Màn hình | Đề xuất |
|---|---|
| Approvals | **Inbox-style queue** (Gmail/Linear): list trái 360px sortable theo priority score, detail phải; keyboard shortcuts (J/K navigate, A approve, R reject); batch select + 1-click approve nếu < threshold; AI risk score badge. |
| Reconciliation | **Bảng có frozen first/last col + sticky filter bar**; row expansion thay modal; diff highlight (red strike old / green new). |
| Daily-close | **Wizard 3 bước** (Tổng hợp → Đối chiếu → Khóa sổ) với progress indicator; large-format numbers giống Stripe Dashboard. |

---

### 2.4 🏭 WAREHOUSE_HANDLER — Trạng thái: **C+ (70/100)**

**Vấn đề chính:**

1. **Dashboard kho (212 LOC)** — 4 metric card rất tốt nhưng quick-link grid 5 nút không phân nhóm, lẫn lộn task theo flow vs reference data.
2. **Picking (228 LOC)** — Hàng đợi text-only, không có batch view, không drag-to-assign.
3. **Picking-by-vehicle (494 LOC)** — Phức tạp, scan flow chưa rõ visual feedback.
4. **Handover-A (624 LOC)** — Form dài, không phân step rõ.

**Đề xuất:**

| Màn hình | Đề xuất |
|---|---|
| Dashboard kho | **Top: 4 KPI tile (giữ); Mid: "Việc cần làm hôm nay" personalized list; Bottom: 2 nhóm — "Quy trình chính" (5 nút lớn) + "Tham khảo" (link nhỏ).** |
| Picking | **Kanban 3 cột** (Chờ / Đang soạn / Xong) với drag, FEFO badge expiry-day chip màu; sound feedback khi pick lệch. |
| Picking-by-vehicle | **Scan-first UI** — full-bleed scanner camera + giant counter `15/50` + voice feedback. Giống PDA của Amazon FC. |
| Handover-A | **Stepper 3 bước** (Kiểm hàng → Ký số → Đóng cổng); sticky CTA bottom. |

---

### 2.5 📞 DVKH — Trạng thái: **B− (72/100)**

**Vấn đề chính:**

1. **Orders list (661 LOC)** — Functional nhưng search bar nhỏ, filter chips ẩn, control desk stats dày 12 chỉ số trông như Excel.
2. **Orders/new (790 LOC)** — Form 1 trang dài, không có autosave, không có draft list.
3. **Customers (241 LOC)** — Chỉ table, không có CRM card view.

**Đề xuất:**

| Màn hình | Đề xuất |
|---|---|
| Orders list | **Stripe Dashboard pattern**: Search + Filter pills bên trái (sticky), 6 KPI top tiles (gom 12 → 6 nhóm), table responsive với expand row; quick actions hover. |
| Orders/new | **Multi-step form** (Khách → SP → Giao hàng → Xác nhận) với progress; autosave 30s; draft sidebar; SKU suggestions inline (F3). |
| Customers | **Card + table toggle**; card view có avatar khu vực, health badge (F2 NPP score), last-order chip; bulk-import CSV. |

---

### 2.6 🛡️ SECURITY — Trạng thái: **B (78/100)**

Gate-check (297 LOC) là 1 trong những page UX tốt nhất hệ thống — đã có full-screen PASS state, chỉ cần:

- Thêm scan barcode camera (thay vì gõ tay)
- Sound + haptic feedback khi PASS/FAIL
- History 5 chuyến gần nhất ở footer

---

### 2.7 🔧 WORKSHOP — Trạng thái: **C (60/100)**

Workshop (253 LOC) — list-only, thiếu kanban repair flow (Diagnose → Quote → Repair → QC → Done). Đề xuất chuyển sang Trello-style board.

---

### 2.8 📊 MANAGEMENT — Trạng thái: **D+ (55/100)** ⚠️ YẾU NHẤT

KPI page (363 LOC) là dashboard duy nhất cho ban giám đốc — phải đẹp và hiệu quả nhất.

**Vấn đề:** Charts default Recharts/Chart.js không có theme; quá nhiều số liệu raw; không có "Insight" tự động; không có timeframe selector global.

**Đề xuất world-class:**
- **Stripe-style dashboard**: hero metric (Doanh thu hôm nay) hiển thị to với delta % vs hôm qua; sparkline mini bên cạnh
- **6 area charts** với gradient fill, dùng [Tremor](https://tremor.so) hoặc custom với recharts theme
- **AI Insights card** (top): "Doanh thu thấp hơn TB tuần 12% — chủ yếu do NPP Hạ Long giảm" (auto-generated từ data)
- **Drill-down**: click vào chart → modal full-detail
- **Time controls global**: 7d / 30d / 90d / YTD / Custom

---

### 2.9 ⚙️ ADMIN — Trạng thái: **C+ (68/100)**

Settings (486 LOC) tab `users/roles/sessions` ổn nhưng:
- User table không có avatar
- Permissions matrix khó scan (241 LOC)
- Audit logs (451 LOC) thiếu filter & export

**Đề xuất:** Áp dụng pattern Linear/Vercel Settings — sidebar trái với sections, content phải centered max-w-3xl, search global Cmd+K.

---

## 3. PHÁT HIỆN HỆ THỐNG (CROSS-CUTTING)

### 3.1 Anti-patterns lặp lại

| Anti-pattern | Số page bị | Ảnh hưởng |
|---|---|---|
| `<h1 className="text-2xl font-bold text-gray-800 mb-2">` lặp y hệt | 50+ | Không có hierarchy |
| Spinner load `border-brand border-t-transparent` | 90% page | UX nghèo nàn |
| Empty state text 1 dòng | 80% page | Không hướng dẫn |
| Card `bg-white rounded-xl shadow-sm p-5` cứng | 100+ chỗ | Cần component |
| Nút action `bg-brand-500 hover:bg-brand-600` | 200+ | Cần Button primitive |
| Status chip màu hardcode | 80+ | Cần StatusBadge |
| `console.error` thay toast | 17 còn lại | Silent fail |
| Modal full-screen cho task ngắn | 30+ | Nên dùng bottom sheet trên mobile |

### 3.2 Thiếu hoàn toàn

- ❌ **Design tokens** (color/spacing/typography scale)
- ❌ **Dark mode**
- ❌ **Skeleton loaders** (chỉ có spinner)
- ❌ **Optimistic updates**
- ❌ **Undo toast** (kiểu Gmail)
- ❌ **Command palette** (đã có file `CommandPalette.tsx` nhưng không thấy dùng nhiều)
- ❌ **Onboarding tour** cho user mới
- ❌ **Keyboard shortcuts** doc + hint
- ❌ **Search global**
- ❌ **Notification center** redesign

---

## 4. ROADMAP REDESIGN (3 SPRINTS)

### Sprint UX-1 (tuần này — đang thực hiện)

**Foundation + 5 page ưu tiên cao**

- [ ] Design tokens (colors/spacing/typography/shadows/radius)
- [ ] 8 primitive components: `PageHeader`, `Card`, `Button`, `KpiCard`, `EmptyState`, `LoadingState`, `StatusBadge`, `Skeleton`
- [ ] Login page redesign (first impression)
- [ ] Dashboard root redesign (mỗi user thấy đầu tiên)
- [ ] Approvals redesign (kế toán dùng nhiều)
- [ ] Warehouse picking redesign (thủ kho dùng nhiều)
- [ ] Empty states cho 5 page trên

### Sprint UX-2

- Control Tower split-pane redesign
- Planning split thành 3 sub-routes
- Driver trip-detail wizard
- KPI dashboard Stripe-style
- Apply primitives cho 15 page còn lại

### Sprint UX-3

- Microinteractions (Framer Motion)
- Dark mode
- Command palette deep integration
- Accessibility audit + fix
- Onboarding tour

---

## 5. METRICS THÀNH CÔNG

Sau Sprint UX-1+2+3, target:

| Metric | Baseline | Target |
|---|---|---|
| Time to first action (login → first task) | ~25s | < 8s |
| User satisfaction (NPS nội bộ) | n/a | > 60 |
| Lighthouse Performance | ~75 | > 90 |
| Lighthouse Accessibility | ~78 | 100 |
| Code reuse (primitives usage) | 0% | > 80% các page |
| LOC trung bình page | 290 | < 250 |
| Page > 800 LOC | 5 page | 0 page |

---

## 6. THỰC HIỆN NGAY (Sprint UX-1 — bắt đầu)

Các bước tiếp theo trong session này:

1. ✅ Báo cáo này (đã viết)
2. 🔄 Build design tokens + 8 primitives
3. 🔄 Redesign 5 page ưu tiên
4. 🔄 Update CHANGELOG + DECISIONS

**Chữ ký:** AI Senior UX/Product Designer  
**Reviewer cần:** Product Owner + 1 user đại diện mỗi role
