# CLAUDE.md — BHL OMS-TMS-WMS

> **Tip:** Đây là file AI đọc đầu tiên mỗi session. Mỗi khi AI làm sai → cập nhật file này ngay.  
> Kết thúc mỗi task: *"Hãy cập nhật CLAUDE.md nếu bạn học được điều gì mới."*

---

## Đọc ngay khi bắt đầu session

```
1. CURRENT_STATE.md   ← Hệ thống đang làm gì THỰC TẾ (5 phút)
2. TECH_DEBT.md       ← KHÔNG tự ý sửa những thứ này
3. KNOWN_ISSUES.md    ← Tránh lặp lỗi đã biết
4. TASK_TRACKER.md    ← Task nào đang làm
5. DECISIONS.md       ← Hiểu WHY code viết thế này
```

---

## Tech Stack nhanh

| Layer | Tech | Ghi chú |
|-------|------|---------|
| Backend | Go + Gin, port 8080 | 3-file pattern: handler/service/repository |
| Frontend | Next.js 14 + Tailwind, port 3000 | `apiFetch` wrapper, KHÔNG gọi `fetch` trực tiếp |
| DB | PostgreSQL 16, port 5434 | 12 migration files (001-011, two 009s) |
| Cache | Redis, port 6379 | LOCAL Windows Redis (không phải Docker) |
| VRP | Python + OR-Tools, port 8090 | |
| OSRM | Docker Vietnam data, port 5000 | |

---

## Các lỗi LUÔN xảy ra — đọc trước khi code

### ❌ pgx v5 enum/date scanning (KI-001, KI-002)
```go
// LUÔN thêm ::text khi SELECT enum hoặc date trong Go
SELECT status::text, delivery_date::text FROM sales_orders
```

### ❌ Redis conflict (KI-006)
- Go server kết nối local Windows Redis (port 6379), **không phải Docker Redis**
- Khi inject test data → dùng `go run ./cmd/inject_gps/` (Go tool)
- **KHÔNG pipe qua PowerShell** — JSON bị hỏng

### ❌ PowerShell + UTF-8
```powershell
# ✅ ĐÚNG: docker cp → psql -f
docker cp ./migrations/seed.sql bhl-oms-postgres-1:/tmp/
docker exec bhl-oms-postgres-1 psql -U bhl -d bhl_dev -f /tmp/seed.sql
# ❌ SAI: pipe qua PowerShell → hỏng tiếng Việt
```

### ❌ DB default port (phát hiện 17/03/2026)
- Docker PostgreSQL map sang port **5434**, KHÔNG phải 5432
- Default DB_URL trong config.go phải dùng `localhost:5434`

---

## Quyết định kỹ thuật đã chốt (KHÔNG thay đổi)

| Quyết định | Đang dùng | Lý do |
|-----------|-----------|-------|
| DEC-002 | Single `models.go` | Tránh circular import, dễ grep |
| DEC-003 | `pkg/response/` | Nhanh hơn `pkg/apperror/` cho demo |
| DEC-004 | Raw pgx queries | Dynamic filters dễ hơn sqlc |
| DEC-005 | Tailwind CSS | Bundle nhẹ, no Ant Design conflict |
| DEC-006 | Fire-and-forget async | Integration KHÔNG block user |
| DEC-007 | Notification Bell → Slide Panel | Right-side slide-in, không dropdown |
| DEC-008 | Entity Events JSONB | Immutable audit log, flexible detail |
| DEC-009 | UXUI_SPEC.md per-role | Brand #F68634, 8 role layouts, 5 UX rules |

---

## Quy tắc code quan trọng nhất

1. **Luồng bắt buộc:** `Handler → Service → Repository` (không bỏ tầng, không ngược)
2. **Tiền:** `NUMERIC(15,2)` hoặc `decimal.Decimal` — KHÔNG float64
3. **Timezone:** UTC trong DB, convert `Asia/Ho_Chi_Minh` ở app layer
4. **Enum/date trong pgx:** LUÔN cast `::text`
5. **Integration errors:** trả 202, KHÔNG block nghiệp vụ
6. **KHÔNG refactor code cũ** — chỉ áp dụng rule cho code mới
7. **Logger:** inject qua constructor, dùng `logger.Logger` interface — KHÔNG `log.Printf` global
8. **Trace ID:** truyền qua `ctx` xuyên suốt mọi tầng; inject tại `TracingMiddleware`
9. **I/O boundary:** LUÔN log `db_query` / `integration_call` / `cache_hit` với `duration_ms`
10. **UXUI_SPEC.md:** ĐỌC `docs/specs/UXUI_SPEC.md` section của role TRƯỚC khi code bất kỳ `.tsx` nào
11. **Localhost verify:** SAU MỖI LẦN sửa code → BẮT BUỘC kiểm tra localhost hoạt động (backend health check + frontend load). Nếu port cũ bị chiếm → chạy server mới trên port khác + cập nhật proxy. KHÔNG BAO GIỜ nói "đã xong" mà chưa verify localhost chạy thật.

---

## UX/UI — World-class per-role spec (đọc TRƯỚC khi code frontend)

**File:** `docs/specs/UXUI_SPEC.md` — đọc section của role trước khi code bất kỳ page nào.

### Quick reference — 8 user roles:

| Role | Layout pattern | Critical UX rule |
|------|---------------|------------------|
| **dispatcher** | 3-column cockpit (left/map/right) | Inline CTA trên mọi alert — không navigate đi đâu |
| **dvkh** | 2-column (form / preview) | ATP bar inline + Zalo preview TRƯỚC KHI submit |
| **driver** | Mobile full-width, bottom tabs | Tap targets tối thiểu h-12 (48px), offline-first |
| **accountant** | 2-column (table / action panel) | T+1 countdown luôn hiển thị, đỏ khi < 2h |
| **warehouse_handler** | PDA-optimized, text-base+ | FEFO badge "Pick trước" nổi bật nhất — gate check fail = full red screen |
| **management** | 5 KPI cards + 3-column body | 5-second scan — chỉ hiện executive alerts |
| **security** | Scan → Checklist → Green/Red | Full green/red screen khi quyết định — không có UI phức tạp |
| **admin** | Settings table + toggles | Mock mode warning banner khi bật |

### 5 UX rules áp dụng toàn hệ thống (BẮT BUỘC):
1. **Zero dead ends** — mọi error state phải có action cụ thể + trace ID
2. **Business rule feedback tức thì** — vượt ATP/hạn mức → đổi màu NGAY khi gõ
3. **Role-aware empty states** — text khác nhau cho từng role
4. **Trace ID** — `(Ref: ${traceRef})` trong mọi error message hiển thị
5. **Driver tap targets** — h-12 minimum, h-14 cho action chính

### UX Vibe Coding Spec v4 — ĐỌC TRƯỚC khi code UX:
**File:** `docs/specs/BHL_UX_VIBE_CODING_SPEC_v4.md`
- 16 StatusChip config + CountdownDisplay (2h đơn / 24h giao)
- 7 Interaction Modals (delivery_success/partial/reject, kt_approve, record_npp_rejection/dispute, gate_fail)
- Role flows chi tiết: DVKH (§5) · Điều phối (§6) · Thủ kho (§7) · Bảo vệ (§8) · Lái xe (§9) · Kế toán (§10) · BGĐ (§11) · NPP (§12)
- Auto-confirm: BR-OMS-AUTO (2h) + BR-REC-02 (24h)
- Anti double-submit pattern cho mobile
- SafeGo() cho goroutine — KHÔNG go func() trực tiếp

### Brand Color — BẮT BUỘC:
```
Brand Primary: #F68634 (rgb 246, 134, 52) — cam đặc trưng BHL
→ Primary buttons, active tabs, FEFO badge, current stop
→ KHÔNG vượt quá 10% diện tích visual
→ KHÔNG lẫn với amber/warning color
```

### formatVND — bắt buộc dùng nhất quán:
```typescript
formatVND(amount)        // 16,600,000 ₫
formatVNDCompact(amount) // 16.6M / 1.2T
```

---

## Business Rules cốt lõi (đọc BUSINESS_RULES.md để biết chi tiết)

- **BR-OMS-01:** ATP per (product_id, warehouse_id), draft không trừ
- **BR-OMS-03:** Order number = `SO-{YYYYMMDD}-{NNNN}` (Asia/Ho_Chi_Minh)
- **BR-OMS-04:** Cutoff 16h — trước = giao trong ngày, sau = T+1
- **BR-WMS-01:** FEFO picking — expiry_date ASC, lot_number ASC
- **BR-TMS-04:** Gate check R01 — qty_loaded = qty_ordered (100%)

---

## State Machines (đọc STATE_MACHINES.md trước khi code status)

- **SM-01 Order:** 13 states, terminal: delivered/cancelled/rejected/on_credit
- **SM-02 Trip:** 13 states, terminal: completed/cancelled
- **SM-03 Stop:** pending → arrived → delivering → delivered/partial/rejected/re_delivery

```go
// Pattern bắt buộc cho mọi status transition
if !entity.CanTransitionTo(newStatus) {
    return apperror.InvalidTransition("order", string(entity.Status), string(newStatus), allowedList)
}
```

---

## Cuối mỗi session — Checklist bắt buộc

- [ ] **Localhost hoạt động?** Backend health check OK + Frontend load OK (BẮT BUỘC verify, không được bỏ qua)
- [ ] Đã cập nhật `CURRENT_STATE.md` cho mọi thay đổi?
- [ ] Đã ghi `CHANGELOG.md`?
- [ ] Đã đánh dấu tasks trong `TASK_TRACKER.md`?
- [ ] Có quyết định kỹ thuật mới → ghi vào `DECISIONS.md`?
- [ ] Có nợ kỹ thuật mới → ghi vào `TECH_DEBT.md`?
- [ ] Có lỗi mới phát hiện → ghi vào `KNOWN_ISSUES.md`?
- [ ] **AI làm sai điều gì → cập nhật file CLAUDE.md này ngay**

---

## Compounding Engineering

> Mỗi lần AI làm sai, kết thúc bằng:  
> *"Hãy cập nhật CLAUDE.md để lần sau không lặp lại lỗi này."*

Ví dụ đã học:
- pgx v5 cần `::text` cast → đã ghi vào Known Issues + file này
- PowerShell + tiếng Việt bị hỏng → đã ghi pattern `docker cp`
- Local Redis vs Docker Redis → đã ghi warning
- DB default port 5432 sai → phải dùng 5434 (Docker map)
- Nói "đã xong" nhưng không verify localhost → user không test được → BẮT BUỘC verify sau mỗi code change
- create_file tool KHÔNG dùng cho file đã tồn tại → phải dùng replace_string_in_file
- API spec drift: luôn check CURRENT_STATE.md thay vì API spec cho endpoint paths thực tế
- Notification dropdown trong sidebar w-64 bị tràn → dùng slide-in panel (DEC-007)
- reject_reason phải truyền qua cả chain: handler → service → event recorder, KHÔNG chỉ lưu DB
- Brand color #F68634 ≠ amber warning → KHÔNG dùng lẫn (DEC-009)
- Đọc UXUI_SPEC.md trước khi code frontend → tránh sửa lại layout/color
- Gap analysis: KHÔNG đánh P0 cho features enterprise-grade (what-if, 4-eye approval) khi business chỉ ~70 xe → đánh P2/P3
- Native mobile app luôn bị đề xuất P0 nhưng PWA đủ cho go-live — đánh giá lại sau 3 tháng production
- BRD định nghĩa 11 roles nhưng code chỉ 8 → đọc CURRENT_STATE.md "Những thứ KHÁC VỚI spec" trước khi code role mới
- Phân xưởng (workshop) = gap lớn nhất → BRD có nhưng code hoàn toàn thiếu → ưu tiên P0
- next.config.js proxy port phải = backend port (8080). Từng sai thành 8083 → mọi frontend API call fail âm thầm
- WMS picking-by-vehicle: KHÔNG default ngày hôm nay khi user không chọn → bỏ date filter, hiện ALL active trips

---

*Cập nhật: 21/03/2026 — Session 19g: Gap Analysis + Phase 6 planning*
