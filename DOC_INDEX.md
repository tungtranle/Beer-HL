# 📚 BHL OMS-TMS-WMS — MASTER DOCUMENT INDEX

**Dự án:** Hệ thống Quản lý Vận hành BHL (OMS – TMS – WMS)  
**Khách hàng:** Công ty CP Bia và Nước giải khát Hạ Long  
**Ngày tạo:** 13/03/2026  
**Go-live mục tiêu:** ~15/05/2026 (Vibe Coding Accelerated)

---

## Tổng quan Document Suite

| # | Tài liệu | File | Trạng thái | Mục đích |
|---|----------|------|-----------|----------|
| 1 | **BRD** — Business Requirements Document | `BRD_BHL_OMS_TMS_WMS.md` | ✅ v3.0 | Yêu cầu nghiệp vụ, user stories, acceptance criteria |
| 2 | **SAD** — System Architecture Document | `SAD_BHL_OMS_TMS_WMS.md` | ✅ v2.1 | Kiến trúc, tech stack, ADR, component design |
| 3 | **DBS** — Database Schema Design | `DBS_BHL_OMS_TMS_WMS.md` | ✅ v1.1 | DDL chi tiết, indexes, partitioning, migration |
| 4 | **API** — API Contract Specification | `API_BHL_OMS_TMS_WMS.md` | ✅ v1.2 | REST endpoints, request/response, error codes |
| 5 | **PEP** — Project Execution Plan | `PEP_BHL_OMS_TMS_WMS.md` | ✅ v1.0 | Phase breakdown, task checklist, milestones, progress tracking |
| 6 | **TST** — Test Strategy & Plan | `TST_BHL_OMS_TMS_WMS.md` | ✅ v1.0 | Unit/integration/E2E/load test, UAT checklist |
| 7 | **INT** — Integration Specification | `INT_BHL_OMS_TMS_WMS.md` | ✅ v1.0 | Bravo/DMS/Zalo chi tiết: payload, error handling, sequence |
| 8 | **INF** — Infrastructure & DevOps Guide | `INF_BHL_OMS_TMS_WMS.md` | ✅ v1.0 | Docker, CI/CD, monitoring, backup/DR, runbook |
| 9 | **UIX** — UI/UX Screen Inventory & Flow | `UIX_BHL_OMS_TMS_WMS.md` | ✅ v1.0 | Screen list, navigation, component inventory |
| 10 | **MIG** — Data Migration Plan | `MIG_BHL_OMS_TMS_WMS.md` | ✅ v1.0 | Legacy → New system, mapping, validation, rollback |

### Tracking & Process (cập nhật liên tục)

| # | Tài liệu | File | Mục đích |
|---|----------|------|----------|
| 11 | **CURRENT_STATE** — Trạng thái thực tế | `CURRENT_STATE.md` | AI đọc để biết code đang làm gì (source of truth) |
| 12 | **TASK_TRACKER** — Tiến độ tasks | `TASK_TRACKER.md` | 78 tasks, 4 phases, % hoàn thành |
| 13 | **CHANGELOG** — Lịch sử thay đổi | `CHANGELOG.md` | Mỗi session ghi gì đã thêm/sửa + docs updated |
| 14 | **DECISIONS** — Quyết định kỹ thuật | `DECISIONS.md` | WHY code viết theo cách này, không phải cách khác |
| 15 | **KNOWN_ISSUES** — Bugs & workarounds | `KNOWN_ISSUES.md` | AI check trước khi code để tránh lặp lỗi |
| 16 | **TECH_DEBT** — Nợ kỹ thuật | `TECH_DEBT.md` | Hoạt động nhưng chưa chuẩn — AI KHÔNG tự sửa |
| 16B | **ROADMAP** — Ecosystem & Phase Plan | `ROADMAP.md` | 20 Ecosystem components, phase plan, chi phí ước tính |

### Specs chi tiết (docs/specs/)

| # | Tài liệu | File | Mục đích |
|---|----------|------|----------|
| 17 | **BUSINESS_RULES** | `docs/specs/BUSINESS_RULES.md` | Công thức ATP, credit, cutoff, FEFO |
| 18 | **STATE_MACHINES** | `docs/specs/STATE_MACHINES.md` | 7 state machines (SM-01 đến SM-07) |
| 19 | **ERROR_CATALOGUE** | `docs/specs/ERROR_CATALOGUE.md` | 60+ error codes chuẩn |
| 20 | **INTEGRATION_MOCKS** | `docs/specs/INTEGRATION_MOCKS.md` | Mock payloads Bravo/DMS/Zalo |
| 21 | **SEQUENCE_DIAGRAMS** | `docs/specs/SEQUENCE_DIAGRAMS.md` | 6 Mermaid sequence flows |

### AI Instructions (.github/instructions/)

| File | Trigger |
|------|---------|
| `coding-standards.instructions.md` | Mọi file Go/TS/SQL/Python |
| `business-rules.instructions.md` | service.go, repository.go |
| `state-machines.instructions.md` | service.go, handler.go (status) |
| `error-codes.instructions.md` | handler.go, service.go (errors) |
| `frontend-patterns.instructions.md` | *.tsx pages |
| `sync-brd-docs.instructions.md` | Code thay đổi so với BRD |
| `doc-update-rules.instructions.md` | **Mọi thay đổi code** — sync docs |

---

## Trình tự đọc tài liệu

### AI bắt đầu session mới → Đọc theo thứ tự:
```
1. CURRENT_STATE.md        ← Hệ thống đang làm gì (5 phút đọc)
2. TECH_DEBT.md            ← Không tự ý sửa những thứ này
3. KNOWN_ISSUES.md         ← Tránh lặp lỗi đã biết
4. TASK_TRACKER.md         ← Biết task nào đang làm
5. DECISIONS.md            ← Hiểu WHY code viết thế này
```

### Khi cần implement feature → Đọc thêm:
```
BRD (Nghiệp vụ)
 └→ SAD (Kiến trúc tổng thể)
     ├→ DBS (Database Schema)
     ├→ API (API Contract)
     ├→ INT (Integration Spec)
     └→ INF (Infrastructure)
 └→ UIX (UI/UX Screens)
 └→ BUSINESS_RULES + STATE_MACHINES (logic chi tiết)
```

## Trình tự sử dụng khi vibe coding

| Phase | Tài liệu cần | Mục đích |
|-------|-------------|----------|
| **Phase 1** (Setup + Core) | DBS → API → INF → PEP | Gen DB migration, scaffold API, setup Docker |
| **Phase 2** (WMS + Driver App) | API → UIX → TST | Gen screens, API handlers, test cases |
| **Phase 3** (Integration) | INT → API → TST | Gen integration adapters, test stubs |
| **Phase 4** (UAT + Go-live) | TST → MIG → PEP | Run tests, migrate data, track progress |

---

## Quy ước tài liệu

- **Mã tham chiếu BRD:** R01-R15 (Quy tắc), US-OMS-xx, US-TMS-xx, US-WMS-xx, US-REC-xx
- **Mã tham chiếu SAD:** ADR-01 đến ADR-08
- **Mã tham chiếu API:** `[METHOD] /path` (ví dụ: `POST /v1/orders`)
- **Mã tham chiếu DB:** Tên bảng lowercase + underscore (ví dụ: `sales_orders`)
- **Ngôn ngữ:** Tiếng Việt (technical terms giữ tiếng Anh)

---

*Document Index v1.0 — 13/03/2026*
