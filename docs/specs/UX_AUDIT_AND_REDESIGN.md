# UX_AUDIT_AND_REDESIGN — BHL OMS-TMS-WMS

> **Vai trò người viết:** Chuyên gia UX/UI/Product Design, cấp top thế giới (chuẩn Stripe, Linear, Superhuman, Cash App level).
>
> **Phạm vi:** Toàn bộ 57 dashboard pages hiện có (đã inventory) + 12 features World-Class Strategy mới (F1–F15). Đánh giá per-role + end-to-end flow.
>
> **Ngày:** 23/04/2026 (Sprint 0).
>
> **Đọc kèm:** [WORLDCLASS_EXECUTION_PLAN.md](WORLDCLASS_EXECUTION_PLAN.md ), [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md ), [DATA_DICTIONARY.md](DATA_DICTIONARY.md ).

---

## 0. TÓM TẮT EXECUTIVE (5 phút đọc)

### Điểm mạnh hiện tại (giữ nguyên)
- ✅ **Design system đã có** — brand `#F68634`, typography Roboto, Heroicons, Headless UI nhất quán.
- ✅ **Per-role layout rõ ràng** — Dispatcher 3-col cockpit, DVKH 2-col form/preview, Driver mobile-first, Warehouse PDA scan-first.
- ✅ **5 UX Rules** đã codified (Zero dead ends, Instant feedback, Role-aware empty states, Trace ID, Driver tap target).
- ✅ **57 trang đã được implement**, có status-config single source, 16 StatusChip configs, 7 interaction modals.

### 7 vấn đề CRITICAL chưa đạt world-class

| # | Vấn đề | Impact | Severity |
|---|---|---|---|
| **U1** | **Cognitive overload** — Dispatcher cockpit có >40 elements visible cùng lúc, không có "Today's Focus" mode | Decision fatigue, miss alerts P0 | 🔴 HIGH |
| **U2** | **Không có command palette** (Cmd+K) — power users phải click qua 4+ menu để đến trang | Productivity tax cho dispatcher/DVKH (10+ navs/giờ) | 🔴 HIGH |
| **U3** | **Search/Filter rời rạc** — mỗi trang reinvent filter UI khác nhau, không có saved views | Re-train cost, không "muscle memory" | 🟡 MED |
| **U4** | **Notifications phân mảnh** — chỉ có toast tạm thời + trang `/notifications`. Không có "Inbox" pattern (read/unread/snooze/archive) | Bỏ sót việc, không track follow-up | 🔴 HIGH |
| **U5** | **Empty states + Loading states chưa nhất quán** — nhiều trang vẫn còn "Đang tải..." plain text thay vì skeleton + role-aware empty copy | Cảm giác chậm, "đã hỏng?" | 🟡 MED |
| **U6** | **Driver UX chưa one-handed** — dù có touch target h-14, layout vẫn yêu cầu reach top corners (back button, profile) | Tài xế dùng 2 tay → nguy hiểm khi giao gấp | 🔴 HIGH |
| **U7** | **Không có Onboarding/First-run experience** — user mới mở app thấy data trống không biết bắt đầu từ đâu | Adoption barrier, support tickets | 🟡 MED |

### Cho 12 features mới (F1–F15) — 6 nguyên tắc UX BẮT BUỘC

1. **Trust before automation** — không hiện ML suggestion mà không có nút "Tại sao?" (F15 Explainability layer).
2. **Human-in-the-loop default** — AI gợi ý, người bấm. KHÔNG auto-apply.
3. **Confidence visible** — mọi forecast có confidence band (lower/upper), không hiển thị 1 con số khô.
4. **Reversible** — apply suggestion → 1 nút "Undo" trong 30 giây.
5. **Progressive disclosure** — default hiện summary; chi tiết xem khi click "Mở rộng".
6. **Quiet by default** — chỉ alert khi vượt threshold (MAPE >30%, anomaly >2σ); không spam.

---

## 1. AUDIT PER-ROLE

### 1.1 DISPATCHER (Control Tower) — `/dashboard/control-tower` + 9 pages liên quan

#### Hiện tại
- 3-col cockpit: Metrics+Trip list (25%) | GPS Map (50%) | Alerts+Check-in+Expiry (25%).
- 14 KPIs trong `ControlTowerStats` interface (total_trips_today, in_transit, completed, planned, stops_delivered, stops_failed, stops_pending, active_vehicles, idle_vehicles, exception_count, on_time_rate, total_weight_kg, total_distance_km).
- Toggle "Mở rộng bản đồ" + "Toàn màn hình".

#### Vấn đề cụ thể
| ID | Vấn đề | Bằng chứng |
|---|---|---|
| D-1 | 14 KPIs hiển thị cùng lúc — vi phạm Miller's law (7±2) | `ControlTowerStats` interface |
| D-2 | Map + Trip list + Alerts cạnh tranh attention; không có visual hierarchy "what to do NEXT" | 3-col luôn full |
| D-3 | Alert không có "Snooze 15 min" / "Assign to..." / "Resolved" → dispatcher đọc rồi quên | TripException type |
| D-4 | Không có "shift handover" view — dispatcher ca sáng giao ca chiều không có summary | — |
| D-5 | VRP button ở left column — phải scroll khi nhiều trips | — |

#### Redesign đề xuất

**Layout mới: "Focus Mode" toggle + Smart Summary**

```
┌─────────────────────────────────────────────────────────────┐
│ TODAY · 23/04 · Ca sáng 06:00–14:00 · 12 trips / 89 stops  │  ← context bar
│ ⚠ 2 việc CẦN BẠN BÂY GIỜ:  [Xem ▾]                          │  ← actionable summary (NEW)
└─────────────────────────────────────────────────────────────┘
┌──────────────┬──────────────────────────┬──────────────────┐
│ FOCUS PANEL  │  MAP (60% width default) │  INBOX (collapsible) │
│  ─────────   │                          │                  │
│ ⚡ NEXT       │  • on-time pin (green)   │ □ P0 (2)         │
│ Trip #45     │  • late pin (red blink)  │ □ P1 (5)         │
│ ETA chậm 12' │  • idle pin (gray)       │ □ Snoozed (3)    │
│ [Xử lý ▸]    │                          │ □ Done (8)       │
│              │                          │                  │
│ Recent KPIs  │  Time-of-day overlay     │ Quick filters:   │
│ (chỉ 4):     │  (NEW — F4 calibrated)   │ - Khu vực Hải Dương │
│ On-time 87%  │                          │ - Tài xế Hùng    │
│ Late 3       │                          │ - SKU Sapphire   │
│ Idle 2       │                          │                  │
│ Failed 0     │                          │                  │
└──────────────┴──────────────────────────┴──────────────────┘
[Cmd+K: lệnh nhanh]              [Bàn giao ca →]    [VRP ▸]
```

**Quy tắc mới:**
- **Focus Panel** chỉ hiện 1 việc CẦN LÀM TIẾP. Sau khi xử lý, auto chuyển việc kế tiếp.
- **Inbox** thay panel Alerts cũ — có Snooze/Assign/Resolve, persist sau reload.
- **4 KPIs visible** (rút từ 14 → 4 nhất quán: on-time%, late count, idle count, failed count). Còn lại nằm trong "Mở rộng".
- **Time-of-day overlay** trên map — dùng F4 travel_time_matrix bucket (morning_peak/midday/evening/night).
- **Shift Handover button** — generate PDF/email summary ca trước.

**Acceptance criteria:**
- Dispatcher mới tap được "việc tiếp" trong < 3s sau khi mở app.
- Snoozed alerts auto-reappear sau X phút.
- 95% alerts P0 được resolved/snoozed trong 5 phút (đo qua telemetry).

---

### 1.2 DVKH (Customer Service) — `/dashboard/orders/new` + customers + orders

#### Hiện tại
- 2-col form/preview, ATP inline, credit badge, Zalo preview right panel.
- SearchableSelect cho customer/product, debounced ATP batch check.

#### Vấn đề cụ thể
| ID | Vấn đề | Bằng chứng |
|---|---|---|
| C-1 | Không có "đơn nháp tự động" — đang gõ mà refresh là mất | `useState` only |
| C-2 | Không gợi ý SKU "thường mua thêm" (F3 chưa có) | basket_rules.csv chưa connect |
| C-3 | Credit info show riêng, không link với order total đang nhập → DVKH phải tự tính | `creditInfo` state riêng |
| C-4 | Không có "duplicate last order" — NPP đặt y chang tuần trước phải gõ lại từ đầu | — |
| C-5 | Zalo preview right panel: chỉ preview, không soạn được message tùy chỉnh | — |
| C-6 | Không có forecast vs order delta cảnh báo (F1 chưa có) | — |

#### Redesign đề xuất — "Conversational Order Builder"

```
┌──────────────────────────────────────────────────────────┐
│ Khách hàng: [HD-53 Lê Văn Hoan ▾]   📞 091xxx  🟢 GREEN │  ← health score badge (F2 NEW)
│ 📊 Forecast tuần này: 340 vỉ Sapphire ± 15  Bạn đặt: __ │  ← F1 NEW
├──────────────────────────────────────────────────────────┤
│ ⚡ ĐẶT NHANH:                                             │
│ [Lặp lại đơn 16/04 (340 vỉ + 12 keg)]  [Đơn mẫu tuần] │  ← C-4 fix
├──────────────────────────────────────────────────────────┤
│ ITEMS                                                    │
│ ┌──────────────────────────────────────┬──────────────┐ │
│ │ Vỉ Sapphire     [340  ] vỉ × 245k = 83.3M │ ATP: 1,200 ✓│ │
│ │ Bia hơi 30L     [ 12  ] keg × 380k = 4.6M │ ATP:    85 ✓│ │
│ │ + thêm SKU                                │             │ │
│ ├──────────────────────────────────────┴──────────────┤ │
│ │ 💡 Khách thường mua thêm:                            │ │  ← F3 NEW
│ │   Gông 5 keg 2L (98% NPP đặt cùng) [+ Thêm 5]      │ │
│ │   Lon 330ml (lift 1.8) [+ Thêm 24]   [Tại sao? ⓘ] │ │  ← F15 NEW
│ └──────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│ TỔNG: 87.9M  │  Hạn mức còn: 142M (61% used) ▮▮▮▯▯       │
│ ⚠ Đơn này VƯỢT 10% so với forecast tuần — bình thường?   │  ← F1 NEW
├──────────────────────────────────────────────────────────┤
│ Zalo template: [Mặc định ▾]  [✏ Tùy chỉnh trước khi gửi]│  ← C-5 fix
│ Preview: "Anh Hoan ơi, đơn 23/04: 340 vỉ Sapphire + ..."│
├──────────────────────────────────────────────────────────┤
│   [Lưu nháp ↻ tự động 30s]      [Tạo đơn & gửi Zalo →] │
└──────────────────────────────────────────────────────────┘
```

**Quy tắc mới:**
- **Auto-save draft** mỗi 30s vào localStorage + backend (`POST /v1/orders/draft`).
- **F2 health badge** ngay cạnh tên NPP — DVKH nhìn 1 giây biết NPP RED/YELLOW/GREEN.
- **F1 forecast pill** cạnh forecast number, nếu order < 70% hoặc > 130% → cảnh báo soft (không block).
- **F3 suggestions** chỉ hiện khi confidence ≥ 60%; auto-add cho rule confidence ≥ 98% (bundle nghiệp vụ như Gông 5 keg → Bia 2L).
- **F15 explainability** — icon ⓘ tooltip "vì sao?" cho MỌI suggestion.

---

### 1.3 DRIVER (Mobile-first) — `/dashboard/driver/[id]` + eod + profile

#### Hiện tại
- Bottom tabs Chuyến/Bản đồ/Hàng/Tiền, h-14 CTA.
- Stop circle done=green/current=brand/next=gray.

#### Vấn đề cụ thể
| ID | Vấn đề | Bằng chứng |
|---|---|---|
| DR-1 | Top header (back button) ở góc trái — tài xế phải dùng 2 tay (one-hand reach <60% màn 6.5") | — |
| DR-2 | Không có "voice command" để nói "đã giao stop 3" khi đang lái — phải dừng xe để chạm | — |
| DR-3 | Không có in-app coaching post-trip (F13 chưa có) | — |
| DR-4 | Reject/Partial modal yêu cầu chọn reason → chụp ảnh → ghi chú; nhiều bước, tài xế bỏ qua note | InteractionModals §7 |
| DR-5 | Offline mode có nhưng không hiện rõ "X đơn đang chờ sync" — tài xế lo lắng | — |
| DR-6 | EOD (end of day) phải đối soát thủ công từng đơn, không có "auto-match expected vs actual" | — |

#### Redesign đề xuất — "Glove-friendly + Confidence"

**Top bar bỏ — thay bằng Bottom Action Sheet (one-thumb reach):**

```
┌─────────────────────────────────────┐
│  STOP 3/8 · NPP HD-53               │  ← header chỉ info, không action
│  ─────────────────────────────────  │
│  Lê Văn Hoan-HD-53                  │
│  📞 091xxxx (tap to call)           │
│  📍 [Chỉ đường] (mở Google Maps)    │
│  ─────────────────────────────────  │
│                                     │
│  HÀNG GIAO (4 SKU)                  │
│  • Vỉ Sapphire ×340  ✓             │
│  • Bia hơi 30L ×12   ✓             │
│  • Gông 5 keg ×60    ✓             │
│  • Lon 330ml ×24                    │
│                                     │
│  ─────────────────────────────────  │
│  💡 Sau khi giao xong:              │
│   Stop 4 cách 8km (~12 phút)        │  ← F4 calibrated NEW
│   Coaching: tốc độ ổn 50-60 km/h   │  ← F13 NEW (chỉ 1 dòng)
│  ─────────────────────────────────  │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  [✓ GIAO XONG]   ← thumb zone       │  ← h-14, brand color
│  [❌ Sự cố]  [↩ Lùi stop]           │  ← h-12
└─────────────────────────────────────┘
[bottom nav: Chuyến / Bản đồ / Hàng / Tiền]
```

**Quy tắc mới:**
- **No top action button** — mọi action ở bottom sheet, thumb-reachable trên Galaxy A55 / iPhone SE.
- **Sync indicator** — pill nhỏ trên cùng "🟢 Online" / "🟠 3 đơn chờ sync" / "🔴 Offline 5 phút".
- **F13 coaching card** SAU EOD (không during trip — gây mất tập trung):
  ```
  Hôm nay bạn:
  • Giao 8/8 đơn (on-time 7) — top 30% fleet
  • Route HD-CB nhanh hơn baseline 12% 🎉
  • Tip mai: NPP HY-12 thường vắng trước 9h, ưu tiên cuối tuyến
  ```
- **Voice-confirm** (Phase 3): tap mic → nói "stop 3 đã giao đủ" → AI parse + confirm modal.
- **Auto-match EOD**: backend tính diff giao thực vs kế hoạch, hiện sẵn — tài xế chỉ confirm hoặc giải trình lệch.

---

### 1.4 WAREHOUSE_HANDLER (PDA scan-first) — 11 pages

#### Hiện tại
- 11 trang: dashboard / inbound / putaway / picking / picking-by-vehicle / loading / returns / scan / cycle-count / bin-map.
- FEFO badge brand color, gate full-screen green/red.

#### Vấn đề cụ thể
| ID | Vấn đề | Bằng chứng |
|---|---|---|
| W-1 | 11 trang quá nhiều — handler bối rối "task tiếp theo của tôi ở đâu?" | menu listdir |
| W-2 | Picking-by-vehicle vs picking — naming gây nhầm lẫn | 2 routes |
| W-3 | Không có "Tomorrow heads-up" panel (F14 chưa có) | — |
| W-4 | Cycle count manual — không có gợi ý "SKU X 6 tháng chưa kiểm" | — |

#### Redesign — "Single Task Queue"

```
┌──────────────────────────────────────────────────┐
│ KHO HD · 23/04 · 14:30                          │
│ 👤 Việc của bạn (3):                             │  ← personal queue (NEW)
│ [▶ Pick xe 14C-1234 (8 SKU)]                    │
│ [▶ Putaway PO-456 (2 pallet)]                   │
│ [▶ Cycle count Bin A-12 (7 SKU)]                │
├──────────────────────────────────────────────────┤
│ 📅 NGÀY MAI (T+1) — F14 NEW                      │
│ Dự kiến: 1,400 keg + 2,800 vỉ → 6 xe            │
│ ⚠ SKU "Lon 330ml" tồn 200, dự kiến 280 → đề xuất │
│   sản xuất +100 [Báo trợ lý kho]                 │
├──────────────────────────────────────────────────┤
│ Toolbox: [Quét] [Bin map] [Tra cứu SKU] [Báo cáo]│  ← collapsible
└──────────────────────────────────────────────────┘
```

**Quy tắc mới:**
- **Personal task queue** thay vì 11 trang menu. Trang `/warehouse` = task list cá nhân.
- **F14 panel** mỗi chiều 16:00 push notification + persist trong dashboard.
- **Smart cycle count** — backend gợi ý SKU lâu chưa kiểm hoặc có discrepancy (ml feature).

---

### 1.5 ACCOUNTANT — `/dashboard/reconciliation` + daily-close + credit-limits + approvals

#### Hiện tại
- T+1 countdown chip, "Chốt ngày" button brand color.
- Approvals page riêng cho credit overdraft.

#### Vấn đề
| ID | Vấn đề |
|---|---|
| A-1 | "Chốt ngày" toàn-or-nothing — không thể partial close cho 1 kho |
| A-2 | Approval cho credit không có "auto-suggest action" dựa trên health score (F2) |
| A-3 | Không có forecast cashflow (F10 Revenue Intelligence chưa có) |

#### Redesign
- **Partial close** — chọn kho/route để close, others remain pending.
- **Credit approval card** kèm F2 health badge + 90-day payment history → KT quyết định nhanh.
- **F10 cashflow widget** — top 10 NPP overdue, top 10 routes by margin.

---

### 1.6 MANAGEMENT (BGĐ) — `/dashboard/kpi` + `/dashboard` (homepage)

#### Hiện tại
- 5 KPI cards + 3-col layout (5-second scan).

#### Vấn đề
| ID | Vấn đề |
|---|---|
| M-1 | Static KPIs — không có "drill-down to root cause" |
| M-2 | Không có forecast scenarios "nếu Tết 2026 tăng 30%, kho có đủ?" (F1 + F5) |
| M-3 | Mobile view chưa optimize — BGĐ check trên iPhone không thấy gọn |

#### Redesign — "Story-driven Dashboard"

Thay vì 5 cards rời, dùng **narrative cards** kiểu Stripe:

```
"Tuần này doanh thu 4.2 tỷ, tăng 12% so với tuần trước.
 Drivers chính: NPP HD-53 (+340 vỉ), HY-12 (+12 keg).
 ⚠ Cảnh báo: 3 NPP RED-banded, có nguy cơ churn 90 ngày → [Xem F2]"
```

- **F10 Revenue Intelligence** — Metabase iframe embedded.
- **F5 Seasonal scenarios** — slider "What if +20% Tết?" → real-time impact on warehouse capacity.

---

### 1.7 SECURITY (Bảo vệ) — `/dashboard/gate-check`

#### Hiện tại
- Scan → Checklist → Green/Red full-screen.

#### Vấn đề
| ID | Vấn đề |
|---|---|
| S-1 | Không có quick-pass cho xe quen thuộc (manifest match 100% trước đó) |
| S-2 | Không có "log gate-out" cho xe rời cổng (chỉ có gate-in?) |

#### Redesign
- **Trust score per vehicle** — 5 lần liên tiếp PASS → suggest "auto-pass with photo only".
- **Gate-out flow riêng** với checklist khác (mileage out, seal intact).

---

### 1.8 WORKSHOP — `/dashboard/workshop`

#### Hiện tại
- 2-col vỏ trả về / panel phân loại; reason bắt buộc khi hỏng/mất.

#### Vấn đề: ít vấn đề. Một bổ sung: **F12 Predictive Maintenance** (Phase 2) — gợi ý xe nào cần bảo dưỡng dựa trên km tích lũy.

---

### 1.9 ADMIN — settings (8 sub-pages)

#### Vấn đề
| ID | Vấn đề |
|---|---|
| AD-1 | 8 sub-pages flat menu — admin lạc lối |
| AD-2 | Không có "global search settings" — tìm cấu hình nào ở đâu? |
| AD-3 | Không có audit "ai đổi cái gì" cho mỗi setting (chỉ có audit-logs trang riêng) |

#### Redesign
- **Settings sidebar 2-tier** + **Cmd+K search settings**.
- Inline "Đổi lần cuối: KT Hà, 15/04 14:30" cho mỗi setting card.

---

## 2. END-TO-END FLOW AUDIT

### Flow A: NPP đặt hàng → giao thành công → đối soát (happy path)

```
[1. DVKH tạo đơn]    → [2. NPP xác nhận Zalo]   → [3. KT duyệt credit (nếu cần)]
   ↓ 2-5 phút            ↓ ≤2h auto-confirm         ↓ ≤30 phút
[4. Dispatcher VRP]  → [5. Warehouse picking]    → [6. Loading + Gate-out]
   ↓ tối hôm trước       ↓ sáng sớm                 ↓ 6:00-8:00
[7. Driver giao]     → [8. Driver EOD]           → [9. KT đối soát T+1]
   ↓ 8:00-16:00          ↓ chiều                    ↓ trước 24h
```

**Vấn đề end-to-end:**

| ID | Vấn đề | Stakeholders affected |
|---|---|---|
| E-1 | **Không có "shipment timeline" view duy nhất** mà mọi role đều thấy cùng 1 góc nhìn | Tất cả |
| E-2 | **Hand-off invisible** — DVKH gửi đơn xong không biết Dispatcher đã thấy chưa | DVKH ↔ Dispatcher |
| E-3 | **NPP chỉ thấy Zalo, không có portal** để track real-time | NPP |
| E-4 | **Driver không biết EOD KT phát hiện lệch** cho đến hôm sau | Driver ↔ KT |
| E-5 | **BGĐ không có "incident timeline"** khi có sự cố lớn (xe hỏng, NPP từ chối hàng loạt) | BGĐ |

**Redesign — "Universal Timeline"**

Mỗi `order_id` có 1 timeline duy nhất (component `OrderTimeline` đã có), nhưng cần:
- **Cross-role visibility** — DVKH thấy được "Dispatcher đã VRP lúc 14:32".
- **Real-time push** — WebSocket subscribe theo `order_id`, mọi role có cập nhật.
- **NPP Portal** (F8 Phase 2) — NPP login web/app xem timeline của đơn mình.
- **Driver "Yesterday's recap"** — sáng hôm sau driver mở app thấy "đơn 22/04 lệch 2 vỉ, đã giải trình OK".

---

## 3. CROSS-CUTTING UX FOUNDATIONS (cần build cho world-class)

### 3.1 Command Palette (Cmd+K) — global

Linear/Superhuman pattern. Triggered từ bất kỳ trang nào.

```
┌────────────────────────────────────────┐
│ ⌘K  [_______________________________] │
│ 🔍 Tạo đơn cho NPP HD-53               │
│ 🚚 Xem trip #45                        │
│ 👤 Mở profile tài xế Hùng              │
│ ⚙ Cấu hình credit limit                │
│ 📊 KPI tuần này                        │
└────────────────────────────────────────┘
```

**Implementation note:** dùng `cmdk` library hoặc Headless UI Combobox. Index entities (NPP, vehicles, orders, settings) qua API.

### 3.2 Inbox Pattern — global

Replace toast-only notifications. Pages:
- `/inbox` (default landing thay /dashboard?)
- Tabs: Cần làm / Đợi người khác / Snoozed / Done
- Each item = card với inline action (Resolve/Snooze 15m/Assign).

### 3.3 Saved Views

Mọi list page (orders, trips, customers...) cho user save filter combo:
- "Đơn HD chờ xác nhận" (DVKH)
- "Trip late hôm nay" (Dispatcher)
- "NPP RED-banded Hải Dương" (Sales)

Pattern: dropdown "Views" cạnh search bar, save to user preferences.

### 3.4 Optimistic UI

Mọi tap action update UI ngay (rollback nếu API fail). Hiện tại dùng `setLoading(true)` block UI → cảm giác chậm.

```tsx
// Bad (current)
setLoading(true); await api(); setLoading(false)

// Good
const prev = state; setState(optimistic); api().catch(() => setState(prev))
```

### 3.5 Skeleton + Suspense

Replace mọi "Đang tải..." text bằng skeleton matching final layout.

### 3.6 Onboarding Tour

First login per role → Shepherd.js tour 5 steps highlight key features. Skippable, replay từ profile menu.

### 3.7 Accessibility (WCAG 2.1 AA)

- Color contrast: brand `#F68634` trên white = 3.4:1 (FAIL AA cho text < 18px). Phải dùng `brand-700` `#9A4905` cho text.
- Keyboard navigation full (Tab, Esc, Arrow).
- Screen reader: `aria-label` mọi icon button (đa số đang thiếu).
- Focus ring visible (`focus-visible:ring-2 ring-brand`).

### 3.8 Internationalization-ready

Hiện hardcode tiếng Việt khắp nơi. Phase 3: extract sang `messages/vi.json` để dễ thêm tiếng Anh cho consultant/QA.

---

## 4. WORLD-CLASS UX CHO 12 FEATURES MỚI (F1–F15)

### F1 — Demand Intelligence Panel (DVKH + BGĐ)

**Anti-pattern cần tránh:** show forecast number khô khan "340 vỉ" → DVKH không tin.

**World-class pattern:**
```
┌──────────────────────────────────────┐
│ Vỉ Sapphire — Tuần 17/2026          │
│ 340 vỉ ± 15 (90% CI)                │
│ ▮▮▮▮▮▮▯▯▯ Confidence: HIGH          │  ← visual confidence bar
│                                      │
│ ⓘ Vì sao 340?                        │
│   "4 tuần gần nhất NPP HD-53 đặt    │
│    320/340/355/360 — pattern tăng   │
│    +5%/tuần. Tuần này là tuần 3     │
│    trong tháng (peak +8%)."         │
│                                      │
│ MAPE 4 tuần qua: 12% ✓              │  ← trust signal
└──────────────────────────────────────┘
```

### F2 — NPP Health Heatmap (DVKH dashboard widget)

**Pattern:** MapLibre choropleth theo tỉnh, color GREEN/YELLOW/RED. Hover hiện tooltip top 3 NPP của tỉnh đó. Click → drilldown danh sách NPP.

**Critical:** RED segment **không được kỳ thị** — copy cần neutral, action-oriented:
- ❌ "NPP có vấn đề"
- ✅ "NPP cần chăm sóc — chưa đặt 30 ngày"

### F3 — Smart SKU Suggestions

Inline trong order form (đã thiết kế ở §1.2). Bonus: hiển thị Lift score cho power users (DVKH chuyên nghiệp).

### F4 — GPS-Calibrated VRP

User-facing chỉ thay đổi: ETA chính xác hơn. Hidden behind scenes. Dashboard `/dashboard/ml/health` cho admin xem MAPE.

### F5 — Seasonal Mode

Toggle ở `/dashboard/admin/seasonal-mode`. Khi ON → banner cam ở mọi trang "🎊 Chế độ Tết: VRP +20% buffer". Tránh user confused "sao ETA dài hơn bình thường".

### F6 — Driver Performance Dashboard

**Critical UX:** read-only, KHÔNG hiển thị lương. Copy:
- ✅ "Hùng — top 30% fleet about on-time. Tip: route HD-CB tối ưu hơn nếu xuất phát trước 7:30."
- ❌ "Hùng — KPI 75/100, lương dự kiến giảm 5%."

NĐ13 banner trên cùng: "Bạn được xem chỉ số cá nhân hóa vì đã đồng ý ngày X."

### F7 — GPS Anomaly Alert

Pattern: alert pin đỏ animate-ping trên Control Tower map + push Zalo dispatcher. Click pin → modal:
```
🚨 Sự cố GPS — Trip #45
Xe 14C-1234 dừng 25 phút tại km 18 QL5.
Không nằm trong kế hoạch. Tài xế: Hùng.
[Gọi tài xế] [Đánh dấu OK] [Tạo ticket sự cố]
```

### F10 — Revenue Intelligence (Metabase)

Embedded iframe trong `/dashboard/kpi/revenue`. SSO via JWT (Phase 2 work).

### F13 — Driver Coaching Card

Sau EOD. Already designed ở §1.3. Quy tắc: **positive framing**, max 3 bullets, có 1 tip cụ thể.

### F14 — Warehouse Tomorrow Panel

Đã design ở §1.4. Critical: panel phải có nút "Báo trợ lý kho" để escalate.

### F15 — Explainability Layer

Pattern global: mọi card ML có icon ⓘ ở top-right → click hiện modal:
```
┌──────────────────────────────┐
│ Vì sao gợi ý này?            │
│                              │
│ Mô hình: Prophet              │
│ Dữ liệu: 4 tuần gần nhất    │
│ Tin cậy: 87%                  │
│                              │
│ Logic:                        │
│ • Trend +5%/tuần              │
│ • Tuần 3/tháng = peak +8%   │
│ • Tổng: 340 vỉ                │
│                              │
│ MAPE 30 ngày: 12%             │
│                              │
│ [Báo cáo gợi ý sai]           │  ← feedback loop
└──────────────────────────────┘
```

Nút "Báo cáo gợi ý sai" → ghi vào `ml_features.suggestion_feedback` để retrain.

---

## 5. PRIORITY MATRIX — Cái gì làm trước?

| Priority | Item | Effort | Sprint |
|---|---|---|---|
| **P0** | Inbox pattern (U4) | 1W | S1 |
| **P0** | F2 NPP Health badge inline order form | 0.5W | S1 |
| **P0** | F3 Smart SKU Suggestions | 1W | S1 |
| **P0** | Driver one-thumb redesign (DR-1) | 1W | S1 |
| **P0** | F15 Explainability layer (cùng F1, F3) | continuous | S2 |
| **P1** | Command palette (U2) | 1W | S2 |
| **P1** | F1 Forecast pill in order form | 1W | S2 |
| **P1** | F14 Warehouse Tomorrow Panel | 1W | S3 |
| **P1** | F13 Driver Coaching Card | 0.5W | S3 |
| **P1** | F7 GPS Anomaly UX | 1W | S1 |
| **P2** | Saved Views | 1W | S3 |
| **P2** | Optimistic UI refactor | 2W | S3 |
| **P2** | Onboarding tour | 1W | S3 |
| **P3** | F8 NPP Portal | 4W | Phase 2 |
| **P3** | Voice command (DR-2) | 3W | Phase 3 |
| **P3** | i18n extraction | 2W | Phase 3 |

---

## 6. ACCEPTANCE CRITERIA — World-class checklist

Một feature/page chỉ được merge nếu:

- [ ] **Visual** — đúng design system (`brand`, Heroicons, Headless UI, không lẫn warning)
- [ ] **Loading** — skeleton matching layout, KHÔNG plain text "Đang tải"
- [ ] **Empty** — role-aware copy, có CTA "Bắt đầu"
- [ ] **Error** — có Trace ID + retry button + link "Báo lỗi"
- [ ] **Success** — toast Sonner + optimistic update
- [ ] **Touch** — đủ tap target (h-9 web / h-12 driver / h-14 CTA / h-[72px] PDA)
- [ ] **Keyboard** — Tab/Esc/Arrow hoạt động, focus ring visible
- [ ] **A11y** — color contrast AA, aria-label icon buttons, screen reader OK
- [ ] **Mobile** — render OK 375px width tối thiểu
- [ ] **Performance** — LCP < 2.5s, FID < 100ms, CLS < 0.1
- [ ] **AI/ML** — có F15 Explainability nút "Tại sao?"
- [ ] **Reversible** — action quan trọng có Undo 30s
- [ ] **Telemetry** — log event để track adoption + drop-off

---

## 7. METRICS để đo "đã world-class chưa?"

| Metric | Baseline | Target Q3/2026 | Source |
|---|---|---|---|
| Time to first action (login → useful tap) | _N/A_ | < 5s | telemetry |
| Order creation time (DVKH) | ~3 phút | < 90s | telemetry |
| Dispatcher daily plan time | 90 phút | < 30 phút | UAT timing |
| Driver one-thumb success rate | _N/A_ | > 95% (mobile usability test) | UT |
| Inbox zero-rate dispatcher EOD | 0% | > 80% | inbox API |
| AI suggestion acceptance rate | _N/A_ | > 40% | F15 feedback |
| Cmd+K usage (DVKH/Dispatcher) | 0 | > 5 invocations/day/user | telemetry |
| Lighthouse score (web) | ? | > 90 | CI |
| Mobile usability test SUS score | _N/A_ | > 80 (excellent) | quarterly UT |
| NPS internal users | _N/A_ | > 50 | quarterly survey |

---

*Phiên bản v1.0 — 23/04/2026. Sprint 0 World-Class. Sẽ revise sau UAT Sprint 1.*
