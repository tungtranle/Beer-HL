# UI/UX SCREEN INVENTORY & FLOW — BHL OMS-TMS-WMS

| Thông tin | Giá trị |
|-----------|---------|
| Phiên bản | **v1.0** |
| Dựa trên | BRD v2.0, SAD v2.1, API v1.0 |
| Platforms | Web (Next.js 14) + Driver App (React Native Expo) + PDA (PWA) + NPP Portal (Public page) |

---

# MỤC LỤC

1. [Screen Overview & Count](#1-screen-overview--count)
2. [Role → Screen Access Matrix](#2-role--screen-access-matrix)
3. [Web — Common & Auth](#3-web--common--auth)
4. [Web — OMS Screens](#4-web--oms-screens)
5. [Web — TMS Screens](#5-web--tms-screens)
6. [Web — WMS Screens](#6-web--wms-screens)
7. [Web — Reconciliation Screens](#7-web--reconciliation-screens)
8. [Web — Reports & Dashboard](#8-web--reports--dashboard)
9. [Web — Admin Screens](#9-web--admin-screens)
10. [Driver App Screens](#10-driver-app-screens)
11. [PDA Screens](#11-pda-screens)
12. [NPP Portal](#12-npp-portal)
13. [Navigation Flow Diagrams](#13-navigation-flow-diagrams)
14. [Component Library](#14-component-library)
15. [Responsive & Accessibility](#15-responsive--accessibility)

---

# 1. SCREEN OVERVIEW & COUNT

| Platform | Module | Screens | Priority |
|----------|--------|---------|----------|
| **Web** | Auth | 3 | P1 |
| **Web** | OMS | 6 | P1 |
| **Web** | TMS | 5 | P1 |
| **Web** | WMS | 5 | P2 |
| **Web** | Reconciliation | 3 | P2 |
| **Web** | Reports & Dashboard | 4 | P2 |
| **Web** | Admin | 8 | P1 |
| **Web** | Notifications | 1 | P2 |
| **Web** | **Subtotal** | **35** | |
| **Driver App** | All | 10 | P2 |
| **PDA** | All | 3 | P2 |
| **NPP Portal** | All | 1 | P3 |
| **Total** | | **49** | |

---

# 2. ROLE → SCREEN ACCESS MATRIX

| Screen Group | Admin | Giám đốc | Dispatcher | DVKH | Kế toán | KT Trưởng | Thủ kho | Tài xế (App) | NPP |
|-------------|-------|----------|-----------|------|---------|-----------|---------|-------------|-----|
| Dashboard | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | — | — |
| OMS | ✅ | ✅(R) | ✅ | ✅ | ✅(R) | ✅(R) | — | — | — |
| TMS Planning | ✅ | ✅(R) | ✅ | — | — | — | — | — | — |
| TMS Map | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| WMS | ✅ | — | — | — | — | — | ✅ | — | — |
| Reconciliation | ✅ | ✅(R) | — | — | ✅ | ✅ | — | — | — |
| Reports | ✅ | ✅ | ✅(own) | ✅(own) | ✅ | ✅ | ✅(own) | — | — |
| Admin | ✅ | — | — | — | — | — | — | — | — |
| Driver App | — | — | — | — | — | — | — | ✅ | — |
| PDA | — | — | — | — | — | — | ✅ | — | — |
| NPP Portal | — | — | — | — | — | — | — | — | ✅ |

*(R) = Read-only*

---

# 3. WEB — COMMON & AUTH

## 3.1 Layout

```
┌──────────────────────────────────────────────────┐
│ ┌──────┐  BHL OMS-TMS-WMS    🔔(3)  👤 Nguyễn A │  Header
│ │ Logo │                      Bell   User menu   │
├──┬───────────────────────────────────────────────┤
│  │                                               │
│S │            Main Content Area                  │
│i │                                               │
│d │  ┌─────────────────────────────────────────┐  │
│e │  │  Breadcrumb: Dashboard / Orders / #001  │  │
│b │  ├─────────────────────────────────────────┤  │
│a │  │                                         │  │
│r │  │          Page Content                   │  │
│  │  │                                         │  │
│  │  └─────────────────────────────────────────┘  │
└──┴───────────────────────────────────────────────┘
```

**Sidebar menu items** (hiển thị theo role):

| Icon | Menu | Sub-items | Roles |
|------|------|-----------|-------|
| 📊 | Dashboard | — | Admin, GĐ, Dispatcher, KT |
| 📦 | Đơn hàng | Danh sách / Tạo mới | Dispatcher, DVKH, Admin |
| 🚛 | Vận chuyển | Kế hoạch VRP / Chuyến xe / Bản đồ | Dispatcher, Admin |
| 🏭 | Kho | Nhập kho / Tồn kho / Picking / Gate Check | Thủ kho, Admin |
| ✅ | Đối soát | Đối soát chuyến / Chênh lệch | KT, KT Trưởng, Admin |
| 📈 | Báo cáo | OTD / Utilization / Empty Run / Redelivery | All (filtered) |
| ⚙️ | Quản trị | Users / Products / NPP / Routes / Vehicles / Config | Admin |
| 🔔 | Thông báo | — | All |

## 3.2 Auth Screens

### WEB-AUTH-01: Login Page

```
┌──────────────────────────────────┐
│                                  │
│         [BHL Logo]               │
│   HỆ THỐNG QUẢN LÝ GIAO VẬN    │
│                                  │
│   ┌──────────────────────────┐   │
│   │ 📧 Username              │   │
│   └──────────────────────────┘   │
│   ┌──────────────────────────┐   │
│   │ 🔒 Password              │   │
│   └──────────────────────────┘   │
│                                  │
│   [     ĐĂNG NHẬP     ]         │
│                                  │
│   ☐ Ghi nhớ đăng nhập          │
│                                  │
└──────────────────────────────────┘
```

### WEB-AUTH-02: Change Password

| Field | Type |
|-------|------|
| Mật khẩu hiện tại | Password |
| Mật khẩu mới | Password (min 8, uppercase, number) |
| Xác nhận mật khẩu | Password |

### WEB-AUTH-03: Profile

| Field | Editable |
|-------|----------|
| Họ tên | Không |
| Username | Không |
| Email | Có |
| Số điện thoại | Có |
| Role | Không |
| Kho phụ trách | Không |

---

# 4. WEB — OMS SCREENS

### WEB-OMS-01: Danh sách đơn hàng

```
┌──────────────────────────────────────────────────────┐
│ Đơn hàng                              [+ Tạo đơn]   │
├──────────────────────────────────────────────────────┤
│ 🔍 Tìm kiếm    [Trạng thái ▼] [Kho ▼] [Ngày ▼]    │
├──────────────────────────────────────────────────────┤
│ # │ Mã đơn     │ NPP          │ Tổng tiền  │ TT    │
│───┼────────────┼──────────────┼────────────┼───────│
│ 1 │ ORD-001    │ NPP Hải Phòng│ 25,000,000 │ 🟢Mới │
│ 2 │ ORD-002    │ NPP Quảng Ninh│ 15,000,000│ 🟡Duyệt│
│ 3 │ ORD-003    │ NPP Hà Nội   │ 50,000,000 │ 🔴Chờ │
├──────────────────────────────────────────────────────┤
│                    ◀ 1 2 3 ... 10 ▶                  │
└──────────────────────────────────────────────────────┘
```

**Filters:** Trạng thái (13 values), Kho, Ngày tạo, NPP, Mã đơn search.

**Actions:** View detail, Edit (nếu status=new), Delete (nếu status=new), Approve (nếu pending_approval + role ≥ manager).

### WEB-OMS-02: Chi tiết đơn hàng

```
┌──────────────────────────────────────────────────────┐
│ Đơn hàng #ORD-2026-04-15-001        Status: 🟢 Mới  │
├──────────────┬───────────────────────────────────────┤
│  Thông tin   │  NPP: NPP Hải Phòng 01               │
│              │  Địa chỉ: 123 Lê Lợi, HP             │
│              │  SĐT: 0987654321                      │
│              │  Kho xuất: Kho Hạ Long                │
│              │  Ngày tạo: 15/04/2026 08:00           │
│              │  Hạn mức còn: 50,000,000 ₫            │
├──────────────┴───────────────────────────────────────┤
│  Sản phẩm                                            │
│ ┌────┬──────────────┬────┬──────────┬──────────────┐ │
│ │ #  │ Sản phẩm     │ SL │ Đơn giá  │ Thành tiền   │ │
│ │ 1  │ Bia HN 330ml │100 │ 250,000  │ 25,000,000   │ │
│ │ 2  │ Bia HN 500ml │ 50 │ 300,000  │ 15,000,000   │ │
│ ├────┴──────────────┴────┴──────────┼──────────────┤ │
│ │                           Tổng:   │ 40,000,000 ₫ │ │
│ └───────────────────────────────────┴──────────────┘ │
├──────────────────────────────────────────────────────┤
│  Timeline (Updated Session 22/03 — world-class redesign)  │
│  ┌──────────────────────────────────────────────────┐     │
│  │ Tabs: [Tất cả] [Trạng thái] [Giao hàng] [Ghi chú]│   │
│  │ ── Hôm nay ──                                     │   │
│  │ 📝 15:48 Tạo đơn (DVKH Nguyễn A)                │   │
│  │    ⏱ 30 phút sau                                  │   │
│  │ ✅ 16:18 KH xác nhận qua Zalo                    │   │
│  │    ⏱ 2 giờ sau                                    │   │
│  │ 📋 18:20 Đã xếp xe — Trip #TRP-001               │   │
│  │ ── Hôm qua ──                                     │   │
│  │ 🏭 08:00 Kho bắt đầu soạn hàng                   │   │
│  │ 🚛 09:15 Xe xuất phát — Nguyễn Văn B             │   │
│  └──────────────────────────────────────────────────┘     │
│                                                           │
│  OrderStatusStepper (MỚI Session 22/03):                  │
│  ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐       │
│  │✓ Tạo│───│✓ KH │───│● Kho│───│○ V/c│───│○ Done│       │
│  │ đơn │   │xác  │   │xử lý│   │     │   │     │        │
│  └─────┘   └─────┘   └─────┘   └─────┘   └─────┘       │
│  (✓=done, ●=current #F68634, ○=pending)                   │
├──────────────────────────────────────────────────────┤
│  [Sửa đơn]  [Huỷ đơn]  [Duyệt hạn mức]            │
│  [📦 Giao bổ sung] ← chỉ hiện khi partially_delivered/failed │
└──────────────────────────────────────────────────────┘
```

### WEB-OMS-03: Tạo / Sửa đơn hàng

| Field | Type | Validation |
|-------|------|-----------|
| NPP (autocomplete) | Select + search | Required |
| Kho xuất | Select | Required, theo khu vực NPP |
| Ngày giao dự kiến | Date | ≥ today |
| Khung giờ giao | Select (delivery_windows) | Required |
| Sản phẩm (multi-line) | Product picker + qty | ≥ 1 item |
| ATP indicator | Real-time display | Auto-check on qty change |
| Ghi chú | Textarea | Optional, max 500 |

**ATP Real-time:** Khi chọn sản phẩm + nhập số lượng → gọi API ATP → hiển thị ✅ Đủ / ⚠️ Thiếu (còn X).

### WEB-OMS-04: ATP Dashboard

```
┌──────────────────────────────────────────────────────┐
│ Tồn kho khả dụng (ATP)           [Kho: Hạ Long ▼]   │
├──────────────────────────────────────────────────────┤
│ Sản phẩm     │ Tổng tồn │ Đã book │ ATP    │ Trend │
│──────────────┼──────────┼─────────┼────────┼───────│
│ Bia HN 330ml │   5,000  │  1,200  │ 3,800  │  ↗    │
│ Bia HN 500ml │   3,000  │    800  │ 2,200  │  →    │
│ Bia HN lon   │   2,000  │  1,900  │   100  │  ↘ ⚠  │
└──────────────────────────────────────────────────────┘
```

### WEB-OMS-05: Duyệt hạn mức

Danh sách đơn hàng `status=pending_approval` cho Manager/GĐ duyệt.

| Column | Content |
|--------|---------|
| Mã đơn | Link to detail |
| NPP | Tên + mã |
| Tổng tiền | Formatted VND |
| Hạn mức còn | Remaining credit |
| Vượt hạn mức | Amount exceeded (red) |
| [Duyệt] [Từ chối] | Action buttons |

### WEB-OMS-06: Gom / Tách đơn (Consolidation View)

Hiển thị danh sách đơn cùng NPP cùng ngày → gom vào 1 shipment. Hiển thị đơn multi-warehouse → tách thành nhiều shipment.

---

# 5. WEB — TMS SCREENS

### WEB-TMS-01: Kế hoạch VRP

```
┌──────────────────────────────────────────────────────┐
│ Kế hoạch vận chuyển                                  │
├──────────────────────────────────────────────────────┤
│ Ngày: [15/04/2026] Kho: [Hạ Long ▼]  [🚀 Chạy VRP] │
├──────────────────────────────────────────────────────┤
│ Trạng thái: ⏳ Đang tính toán... (45/120s)           │
│ ████████████████░░░░░░░░░ 60%                        │
├──────────────────────────────────────────────────────┤
│ KẾT QUẢ VRP                                          │
│                                                      │
│ Chuyến 1: 14C-12345 (Nguyễn Văn A)                  │
│   📍 Kho HL → NPP001 (08:30) → NPP005 (09:15) →    │
│   NPP012 (10:00) → Kho HL                           │
│   📦 15 đơn │ ⚖️ 4.2/5.0 tấn │ 🕐 4h15'            │
│                                                      │
│ Chuyến 2: 14C-67890 (Trần Văn B)                    │
│   📍 Kho HL → NPP003 (08:00) → NPP008 (09:00) →    │
│   📦 12 đơn │ ⚖️ 3.8/5.0 tấn │ 🕐 3h45'            │
│                                                      │
│ Tổng: 8 chuyến │ 120/150 đơn assigned │ 30 unassigned│
├──────────────────────────────────────────────────────┤
│ [✅ Duyệt kế hoạch]  [🔄 Chạy lại]  [✏️ Sửa thủ công]│
└──────────────────────────────────────────────────────┘
```

### WEB-TMS-02: Danh sách chuyến xe

| Column | Filter |
|--------|--------|
| Mã chuyến | Search |
| Xe / Biển số | Select |
| Tài xế | Select |
| Trạng thái | Dropdown (13 trip_status) |
| Số điểm giao | — |
| Tải trọng | — |
| Bắt đầu / Kết thúc | DateTime |

### WEB-TMS-03: Chi tiết chuyến xe

Hiển thị: thông tin xe + tài xế, danh sách stops (order, NPP, time window, status), bản đồ route, GPS trail, checklist status, sự cố.

### WEB-TMS-04: Bản đồ Dispatcher (Real-time)

```
┌──────────────────────────────────────────────────────┐
│ Bản đồ theo dõi                    [Auto-refresh: ON]│
├──────────────────────────────────────────────────────┤
│                                                      │
│   ┌────────────────────────────────────────────┐     │
│   │         GOOGLE MAPS / LEAFLET              │     │
│   │                                            │     │
│   │    🚛(1)            🚛(3)                  │     │
│   │         🚛(2)                              │     │
│   │                          🚛(4)             │     │
│   │    📍NPP001    📍NPP005                   │     │
│   │                                            │     │
│   └────────────────────────────────────────────┘     │
│                                                      │
│ Sidebar:                                             │
│ ┌────────────────┐                                   │
│ │ 🟢 14C-12345   │ ← Đang giao (stop 3/5)          │
│ │ 🟢 14C-67890   │ ← Đang di chuyển                │
│ │ 🟡 14C-11111   │ ← Dừng > 15 phút ⚠️            │
│ │ ⚫ 14C-22222   │ ← Chưa khởi hành                │
│ └────────────────┘                                   │
└──────────────────────────────────────────────────────┘
```

Control Tower triển khai thực tế theo layout 3 cột:
- Cột trái: KPI + danh sách chuyến active + progress bar theo stop + ETA countdown + badge lệch ETA (đúng tiến độ/trễ/thiếu ETA).
- Cột giữa: bản đồ GPS real-time (Leaflet) + filter trạng thái xe; các chuyến `in_transit`, `assigned`, `ready` đều có route overview trên map, trong đó chuyến đang chạy dùng line nổi bật hơn và lệch tuyến hiển thị đỏ.
- Cột phải: panel cảnh báo P0/P1 với CTA xử lý nhanh.

SC-11 demo data cho Control Tower dùng nhà máy `WH-HL` tại Cái Lân làm điểm xuất phát và 7 cụm NPP thực tế quanh Quảng Ninh để người điều phối nhìn thấy tuyến giao hàng hợp lý thay vì marker rải rác.

### WEB-TMS-05: Gán xe / tài xế thủ công

Drag-drop interface hoặc form: chọn chuyến → chọn xe + tài xế → gán. Hiển thị constraint violations (capacity, time window).

---

# 6. WEB — WMS SCREENS

### WEB-WMS-01: Nhập kho (Inbound)

| Field | Type |
|-------|------|
| Kho nhập | Select |
| Sản phẩm | Product picker |
| Số lượng | Number |
| Số lô | Text (auto-generate or manual) |
| Ngày sản xuất | Date |
| Hạn sử dụng | Date |
| Vị trí kho | Location tree (LTREE) |
| Ghi chú | Textarea |

### WEB-WMS-02: Tồn kho

```
┌──────────────────────────────────────────────────────┐
│ Tồn kho                      [Kho: Hạ Long ▼]       │
├──────────────────────────────────────────────────────┤
│ Sản phẩm     │ Lô        │ HSD       │ SL  │ Vị trí│
│──────────────┼───────────┼───────────┼─────┼───────│
│ Bia HN 330ml │ LOT-03-01 │ 01/09/2026│ 500 │ A1-01 │
│ Bia HN 330ml │ LOT-03-15 │ 15/09/2026│ 300 │ A1-02 │
│ Bia HN 500ml │ LOT-04-01 │ 01/10/2026│ 200 │ B2-01 │
│ ⚠️ Bia lon   │ LOT-01-01 │ 15/04/2026│  50 │ C1-01 │ ← Sắp hết hạn
└──────────────────────────────────────────────────────┘
```

### WEB-WMS-03: Picking Order

Danh sách picking orders → chi tiết: sản phẩm + lô gợi ý (FEFO) + trạng thái pick.

### WEB-WMS-04: Gate Check

```
┌──────────────────────────────────────────────────────┐
│ Kiểm tra cổng xuất                                   │
├──────────────────────────────────────────────────────┤
│ Chuyến: TRP-001  │  Xe: 14C-12345  │  TT: ⏳ Đang KT│
├──────────────────────────────────────────────────────┤
│ Sản phẩm     │ Phiếu xuất │ Đã scan │ Kết quả      │
│──────────────┼────────────┼─────────┼──────────────│
│ Bia HN 330ml │     100    │   100   │ ✅ Khớp      │
│ Bia HN 500ml │      50    │    48   │ ❌ Thiếu 2   │
├──────────────────────────────────────────────────────┤
│ ⚠️ Chênh lệch: 2 thùng Bia HN 500ml                │
│ [🔄 Scan lại]  [✅ Xác nhận OK]  [❌ Từ chối xuất] │
└──────────────────────────────────────────────────────┘
```

### WEB-WMS-05: Quản lý vỏ / Assets

Danh sách vỏ (két, chai) tại mỗi NPP: tồn đầu kỳ, thu trong kỳ, giao trong kỳ, tồn cuối kỳ, hư hỏng, bồi hoàn.

---

# 7. WEB — RECONCILIATION SCREENS

### WEB-RECON-01: Đối soát chuyến

```
┌──────────────────────────────────────────────────────┐
│ Đối soát giao hàng              [Ngày: 15/04/2026 ▼]│
├──────────────────────────────────────────────────────┤
│ Chuyến │ Tài xế    │ Hàng   │ Tiền    │ Vỏ   │ TT  │
│────────┼───────────┼────────┼─────────┼──────┼─────│
│ TRP-01 │ Nguyễn A  │ ✅ OK  │ ✅ OK   │ ✅ OK│ ✅  │
│ TRP-02 │ Trần B    │ ⚠️ -2  │ ✅ OK   │ ✅ OK│ ⚠️  │
│ TRP-03 │ Lê C      │ ✅ OK  │ ⚠️ -50k │ ❌-5 │ ❌  │
├──────────────────────────────────────────────────────┤
│ Tổng: 8 chuyến │ 6 OK │ 2 chênh lệch               │
└──────────────────────────────────────────────────────┘
```

### WEB-RECON-02: Chi tiết đối soát

Hiển thị trip summary: mỗi stop với hàng giao/nhận, tiền thu/tổng, vỏ thu/tổng. Highlight chênh lệch đỏ.

### WEB-RECON-03: Quản lý chênh lệch (Discrepancy Tickets)

| Column | Content |
|--------|---------|
| Mã ticket | Auto-generated |
| Chuyến | Link to trip |
| Loại (Hàng/Tiền/Vỏ) | Tag |
| Mô tả | Chi tiết chênh lệch |
| T+1 deadline | Countdown timer ⏱️ |
| Trạng thái | Open / Investigating / Resolved / Escalated |
| Actions | [Resolve] [Escalate] |

---

# 8. WEB — REPORTS & DASHBOARD

### WEB-DASH-01: Dashboard

```
┌──────────────────────────────────────────────────────┐
│ Dashboard                            Hôm nay 15/04   │
├──────────────┬────────────────────────────────────────┤
│              │  ┌────────┐ ┌────────┐ ┌────────┐     │
│  PIPELINE    │  │ Đơn mới│ │ Đang   │ │ Hoàn   │     │
│  Orders      │  │  125   │ │ giao 45│ │ thành 80│    │
│              │  └────────┘ └────────┘ └────────┘     │
├──────────────┼────────────────────────────────────────┤
│              │  Today KPIs:                           │
│  BẢN ĐỒ     │  OTD: 94.5% ✅  │ Empty Run: 8.2% ✅  │
│  (Minimap    │  Utilization: 82% │ Redelivery: 3.1%  │
│   vehicles)  │                                       │
├──────────────┼────────────────────────────────────────┤
│              │  ⚠️ ALERTS                             │
│  ĐỐI SOÁT   │  • 2 chuyến chênh lệch chưa xử lý    │
│  STATUS      │  • 1 NPP vượt hạn mức đang chờ duyệt │
│  5 OK, 2 ⚠️  │  • 3 lô hàng sắp hết hạn (7 ngày)   │
└──────────────┴────────────────────────────────────────┘
```

### WEB-RPT-01: Báo cáo OTD (On-Time Delivery)

Chart: Line chart OTD % theo ngày/tuần/tháng. Table: details chuyến trễ.

### WEB-RPT-02: Báo cáo hiệu suất xe

Chart: Bar chart vehicle utilization %. Table: mỗi xe với km chạy, tải trung bình, % sử dụng.

### WEB-RPT-03: Báo cáo tổng hợp

Tổng hợp theo kỳ: đơn hàng, doanh thu, chuyến, redelivery, discrepancy, empty run.

---

# 9. WEB — ADMIN SCREENS

### WEB-ADM-01: Quản lý Users

CRUD users: tên, username, role, email, SĐT, kho phụ trách, active/inactive.

### WEB-ADM-02: Quản lý NPP (Customers)

CRUD: mã, tên, địa chỉ, SĐT, Zalo phone, GPS coordinates, delivery_window_id, route_id, priority, active.

### WEB-ADM-03: Quản lý Sản phẩm

CRUD: mã, tên, barcode_prefix, weight_kg, volume_m3, case_per_pallet, is_fresh, category.

### WEB-ADM-04: Quản lý Tuyến đường (Routes)

CRUD: mã, tên, warehouse, waypoints (ordered list), distance_km.

### WEB-ADM-05: Quản lý Xe

CRUD: biển số, loại xe, capacity_kg, capacity_m3, fuel_type, active, giấy tờ.

### WEB-ADM-06: Cấu hình hệ thống

| Config | Type | Default |
|--------|------|---------|
| order_cutoff_hour | Number | 16 |
| reconciliation_deadline_hours | Number | 24 |
| vrp_max_timeout_seconds | Number | 120 |
| atp_cache_ttl_seconds | Number | 30 |
| gps_interval_seconds | Number | 30 |
| zalo_auto_confirm_hours | Number | 24 |
| max_upload_size_mb | Number | 5 |
| offline_sync_max_hours | Number | 4 |

### WEB-ADM-07: Quản lý hạn mức tín dụng

CRUD: NPP, credit_limit, current_balance, last_updated.

### WEB-ADM-08: DLQ Management

Danh sách failed integration tasks: system, event, payload, error, attempts, [Retry] [Skip].

---

# 10. DRIVER APP SCREENS

### APP-01: Login

```
┌────────────────────┐
│                    │
│    [BHL Logo]      │
│                    │
│ ┌────────────────┐ │
│ │ Số điện thoại  │ │
│ └────────────────┘ │
│ ┌────────────────┐ │
│ │ Mật khẩu      │ │
│ └────────────────┘ │
│                    │
│ [ ĐĂNG NHẬP ]     │
│                    │
│ v1.0.0 (build 12) │
└────────────────────┘
```

### APP-02: Home (My Trip)

```
┌────────────────────┐
│ Xin chào, Anh A    │ 
│ 14C-12345          │
├────────────────────┤
│ Chuyến hôm nay     │
│ TRP-2026-04-15-001 │
│                    │
│ 📦 8 điểm giao    │
│ ⚖️ 4.2 tấn        │
│ 🕐 ~4h15'          │
│                    │
│ ✅ Checklist: Done │
│                    │
│ Stops:             │
│ 1. 🟢 NPP001 ✓    │
│ 2. 🟡 NPP005 →    │
│ 3. ⚪ NPP012      │
│ ...                │
│                    │
│ [🚀 BẮT ĐẦU GIAO]│
├────────────────────┤
│ 🏠  📋  🚛  👤    │
│Home Check Trip Prof│
└────────────────────┘
```

### APP-03: Checklist (Pre/Post Trip)

8 items checklist (BRD): tình trạng xe, lốp, phanh, đèn, giấy tờ, hàng hoá, seal, nhiệt độ.

| Item | Type | Required |
|------|------|----------|
| Tình trạng xe | OK/NG + photo | Yes |
| Lốp xe | OK/NG | Yes |
| Phanh | OK/NG | Yes |
| Đèn | OK/NG | Yes |
| Giấy tờ xe | OK/NG | Yes |
| Hàng hoá đã xếp | OK/NG + photo | Yes |
| Seal container | OK/NG + photo nếu NG | Yes |
| Nhiệt độ thùng | Number + photo | If applicable |

### APP-04: Stop Detail (Deliver)

```
┌────────────────────┐
│ ← Stop 2/8        │
│ NPP Hải Phòng 05  │
│ 📍 45 Trần Phú, HP│
│ 📞 0987654321     │
│ 🕐 09:00-10:00    │
│ [📍 Chỉ đường]    │
├────────────────────┤
│ Hàng giao:         │
│ ┌────────────────┐ │
│ │Bia HN 330 × 50│ │
│ │Bia HN 500 × 30│ │
│ └────────────────┘ │
│ Tổng: 15,000,000₫  │
├────────────────────┤
│ [📸 Chụp ePOD]    │
│ [✅ Giao thành công]│
│ [❌ Không giao được]│
│ [⚠️ Giao 1 phần]  │
└────────────────────┘
```

### APP-05: ePOD Confirmation

| Field | Type | Required |
|-------|------|----------|
| Trạng thái | Giao đủ / Giao thiếu / Không giao | Yes |
| Sản phẩm nhận (nếu thiếu) | Qty per item | If partial |
| Lý do (nếu fail/partial) | Select + text | If not full |
| Ảnh chụp | Camera (1-5 photos) | Yes (min 1) |
| Người nhận | Text input | Yes |
| GPS location | Auto-captured | Auto |

### APP-06: Payment Screen

```
┌────────────────────┐
│ Thu tiền − NPP005  │
├────────────────────┤
│ Tổng phải thu:     │
│ 15,000,000 ₫       │
│                    │
│ Hình thức:         │
│ ○ Tiền mặt        │
│ ○ Chuyển khoản     │
│ ○ Ghi nợ (công nợ) │
│                    │
│ Số tiền thu:       │
│ ┌────────────────┐ │
│ │ 15,000,000     │ │
│ └────────────────┘ │
│                    │
│ Ghi chú:           │
│ ┌────────────────┐ │
│ │                │ │
│ └────────────────┘ │
│                    │
│ [💰 XÁC NHẬN THU] │
└────────────────────┘
```

### APP-07: Return Collection (Vỏ)

| Field | Type |
|-------|------|
| Loại vỏ | Select (két, chai, ...) |
| Số lượng | Number |
| Tình trạng | Tốt / Hư hỏng |
| Ảnh chụp | Camera (1-3) |
| Ghi chú | Text |

### APP-08: Incident Report

Báo cáo sự cố: loại (tai nạn, hỏng xe, hàng hư, ...), mô tả, ảnh, GPS.

### APP-09: Sync Status

```
┌────────────────────┐
│ Trạng thái đồng bộ │
├────────────────────┤
│ 📶 Online          │
│                    │
│ Queue: 0 pending   │
│ Last sync: 2 min   │
│                    │
│ ── OR ──           │
│                    │
│ 📴 Offline         │
│ Queue: 5 pending   │
│ • ePOD NPP005     │
│ • Payment NPP005  │
│ • ePOD NPP012     │
│ • Return NPP012   │
│ • GPS batch (120pt)│
│                    │
│ [🔄 Sync Now]      │
└────────────────────┘
```

### APP-10: Profile / Settings

Đổi mật khẩu, xem thông tin cá nhân, phiên bản app, logout.

---

# 11. PDA SCREENS

### PDA-01: Login (PWA)

Simple login form, persist session.

### PDA-02: Scan & Lookup

```
┌────────────────────┐
│ Quét mã vạch       │
│                    │
│ ┌────────────────┐ │
│ │  [CAMERA VIEW] │ │
│ │  ────────────  │ │
│ │  Barcode scan  │ │
│ └────────────────┘ │
│                    │
│ Kết quả:           │
│ ✅ Bia HN 330ml    │
│ Lô: LOT-2026-03-01│
│ HSD: 01/09/2026   │
│ Vị trí: A1-01     │
│ SL tồn: 500 thùng │
└────────────────────┘
```

### PDA-03: Gate Check

Scan từng sản phẩm, đối chiếu với picking order. Beep xanh = match, beep đỏ = mismatch. Hiển thị progress: X/Y scanned.

---

# 12. NPP PORTAL

### NPP-01: Xác nhận giao hàng

(Chi tiết tại INT §4.3 — public page, no auth, token-based access)

Hiển thị: thông tin đơn hàng, danh sách sản phẩm, nút xác nhận / phản hồi chênh lệch.

---

# 13. NAVIGATION FLOW DIAGRAMS

## 13.1 Web — Main Flow

```
Login → Dashboard
          ├── Đơn hàng → List → Create / Detail → Edit
          │                              └── Approve Credit
          ├── Vận chuyển → VRP Plan → Approve → Trip List → Trip Detail
          │                                                    └── Map
          ├── Kho → Inbound → Stock → Picking → Gate Check
          ├── Đối soát → Trip Summary → Detail → Discrepancy
          ├── Báo cáo → OTD / Utilization / Summary
          ├── Quản trị → Users / NPP / Products / Routes / Vehicles / Config
          └── Thông báo
```

## 13.2 Driver App — Main Flow

```
Login → Home (My Trip)
          ├── Checklist (Pre-trip)
          ├── Stop 1 → Deliver → ePOD → Payment → Return
          ├── Stop 2 → Deliver → ePOD → Payment → Return
          ├── ...
          ├── Stop N → Deliver → ePOD → Payment → Return
          ├── Checklist (Post-trip)
          ├── Incident (anytime)
          └── Sync Status
```

## 13.3 Order Lifecycle Screen Flow

```
WEB-OMS-03 (Create) → WEB-OMS-01 (List, status=new)
    → WEB-OMS-05 (Approve if credit exceeded)
    → WEB-OMS-06 (Consolidate/Split)
    → WEB-TMS-01 (VRP assigns to trip)
    → WEB-TMS-02 (Trip list)
    → APP-04 (Driver delivers)
    → APP-05 (ePOD)
    → WEB-RECON-01 (Reconciliation)
    → Finished
```

---

# 14. COMPONENT LIBRARY

## 14.1 Design System

> **Tham chiếu:** Tuân thủ UXUI.md — Brand color ratio ≤ 10% diện tích màn hình.

### Brand & Semantic Colors

| Token | Value | Ghi chú |
|-------|-------|---------|
| **Primary (Brand)** | `#F68634` / `rgb(246, 134, 52)` | Orange — dùng cho primary actions, highlights, active states |
| Success | `#34A853` (Green) | |
| Warning | `#FBBC05` (Yellow) | |
| Error | `#EA4335` (Red) | |
| Info | `#1A73E8` (Blue) | |

### Neutral Colors

| Token | Value |
|-------|-------|
| Background | `#FFFFFF` |
| Secondary Background | `#F7F8FA` |
| Border | `#E5E6EB` |
| Text Primary | `#1F1F1F` |
| Text Secondary | `#595959` |
| Disabled | `#BFBFBF` |

### Typography & Layout

| Token | Value |
|-------|-------|
| Font | Roboto (Web), System default (App) |
| Fallback | `'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |
| Border radius | 8px |
| Spacing unit | 4px (base) |
| Spacing scale | 4, 8, 12, 16, 24, 32, 48 px |

## 14.2 Shared Components (Next.js)

| Component | Usage |
|-----------|-------|
| `DataTable` | Sortable, filterable, paginated table |
| `StatusBadge` | Color-coded status pill (order_status, trip_status) |
| `SearchSelect` | Autocomplete select for NPP, products, etc. |
| `DateRangePicker` | Date range cho filters/reports |
| `FileUpload` | Drag-drop + camera, pre-signed URL upload |
| `ConfirmDialog` | Approve/delete confirmation modal |
| `Notification Bell` | Topbar bell with unread count + right-side slide panel |
| `MapView` | Google Maps / Leaflet wrapper with vehicle markers |
| `KPICard` | Dashboard metric card with trend arrow |
| `Timeline` | Order/trip event timeline vertical display |
| `BarcodeScanner` | Camera-based scanner (PDA + Driver App) |

## 14.3 Shared Components (React Native — Driver App)

| Component | Usage |
|-----------|-------|
| `TripCard` | Trip summary card on home screen |
| `StopCard` | Stop summary with status indicator |
| `CameraCapture` | Photo capture with preview thumbnails |
| `OfflineBanner` | Yellow banner when offline |
| `SyncIndicator` | Queue count + last sync time |
| `QuantityInput` | Stepper +/- for item quantities |
| `SignaturePad` | Customer signature capture (if needed) |

---

# 15. RESPONSIVE & ACCESSIBILITY

## 15.1 Breakpoints

| Breakpoint | Width | Target |
|-----------|-------|--------|
| Mobile | < 768px | Dispatcher on phone (limited) |
| Tablet | 768–1024px | Thủ kho tablet at warehouse |
| Desktop | > 1024px | Primary: back-office |

## 15.2 Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Keyboard navigation | Tab order, Enter to confirm |
| Color contrast | WCAG AA (4.5:1 text, 3:1 large) |
| Screen reader | `aria-label` on icons, `alt` on images |
| Error messages | Inline validation, focus on first error |
| Loading states | Skeleton loader, spinner with text |
| Toast notifications | Auto-dismiss 5s, manual dismiss |

---

**=== HẾT TÀI LIỆU UIX v1.0 ===**

*UI/UX Screen Inventory & Flow v1.0 — 49 screens, wireframes, navigation flows, component library, design system.*
