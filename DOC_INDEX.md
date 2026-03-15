# 📚 BHL OMS-TMS-WMS — MASTER DOCUMENT INDEX

**Dự án:** Hệ thống Quản lý Vận hành BHL (OMS – TMS – WMS)  
**Khách hàng:** Công ty CP Bia và Nước giải khát Hạ Long  
**Ngày tạo:** 13/03/2026  
**Go-live mục tiêu:** ~15/05/2026 (Vibe Coding Accelerated)

---

## Tổng quan Document Suite

| # | Tài liệu | File | Trạng thái | Mục đích |
|---|----------|------|-----------|----------|
| 1 | **BRD** — Business Requirements Document | `BRD_BHL_OMS_TMS_WMS.md` | ✅ v2.0 Final | Yêu cầu nghiệp vụ, user stories, acceptance criteria |
| 2 | **SAD** — System Architecture Document | `SAD_BHL_OMS_TMS_WMS.md` | ✅ v2.1 | Kiến trúc, tech stack, ADR, component design |
| 3 | **DBS** — Database Schema Design | `DBS_BHL_OMS_TMS_WMS.md` | ✅ v1.0 | DDL chi tiết, indexes, partitioning, migration |
| 4 | **API** — API Contract Specification | `API_BHL_OMS_TMS_WMS.md` | ✅ v1.0 | REST endpoints, request/response, error codes |
| 5 | **PEP** — Project Execution Plan | `PEP_BHL_OMS_TMS_WMS.md` | ✅ v1.0 | Phase breakdown, task checklist, milestones, progress tracking |
| 6 | **TST** — Test Strategy & Plan | `TST_BHL_OMS_TMS_WMS.md` | ✅ v1.0 | Unit/integration/E2E/load test, UAT checklist |
| 7 | **INT** — Integration Specification | `INT_BHL_OMS_TMS_WMS.md` | ✅ v1.0 | Bravo/DMS/Zalo chi tiết: payload, error handling, sequence |
| 8 | **INF** — Infrastructure & DevOps Guide | `INF_BHL_OMS_TMS_WMS.md` | ✅ v1.0 | Docker, CI/CD, monitoring, backup/DR, runbook |
| 9 | **UIX** — UI/UX Screen Inventory & Flow | `UIX_BHL_OMS_TMS_WMS.md` | ✅ v1.0 | Screen list, navigation, component inventory |
| 10 | **MIG** — Data Migration Plan | `MIG_BHL_OMS_TMS_WMS.md` | ✅ v1.0 | Legacy → New system, mapping, validation, rollback |

---

## Trình tự đọc tài liệu

```
BRD (Nghiệp vụ)
 └→ SAD (Kiến trúc tổng thể)
     ├→ DBS (Database Schema)  ← Cần cho sqlc code generation
     ├→ API (API Contract)     ← Cần cho frontend + backend parallel dev
     ├→ INT (Integration Spec) ← Cần cho Bravo/DMS/Zalo integration
     └→ INF (Infrastructure)   ← Cần cho DevOps setup
 └→ UIX (UI/UX Screens)       ← Cần cho frontend dev
 └→ PEP (Execution Plan)      ← Cần cho progress tracking
 └→ TST (Test Plan)           ← Cần cho quality assurance
 └→ MIG (Data Migration)      ← Cần cho Go-live
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
