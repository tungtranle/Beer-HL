# DATA MIGRATION PLAN — BHL OMS-TMS-WMS

| Thông tin | Giá trị |
|-----------|---------|
| Phiên bản | **v1.0** |
| Dựa trên | BRD v2.0 §12, DBS v1.0, INT v1.0 |
| Thực hiện | Phase 4 — Week 7 (12/05 – 16/05/2026) |

---

# MỤC LỤC

1. [Migration Overview](#1-migration-overview)
2. [Data Sources](#2-data-sources)
3. [Entity Migration Matrix](#3-entity-migration-matrix)
4. [Migration Scripts](#4-migration-scripts)
5. [Data Validation](#5-data-validation)
6. [Opening Balances](#6-opening-balances)
7. [Migration Schedule](#7-migration-schedule)
8. [Rollback Plan](#8-rollback-plan)
9. [Sign-off Checklist](#9-sign-off-checklist)

---

# 1. MIGRATION OVERVIEW

## 1.1 Scope

| Category | Items | Source | Complexity |
|----------|-------|--------|-----------|
| **Master Data** | NPP, Products, Vehicles, Drivers, Routes, Warehouses | BHL Excel / Bravo export | Thấp |
| **Opening Balances** | Credit balances, Asset (vỏ) balances | Bravo export | Trung bình |
| **Operational Data** | — | — | **Không migrate** |

> **Nguyên tắc:** Chỉ migrate master data + opening balances. Không migrate lịch sử giao dịch (orders, trips, etc.) — hệ thống mới bắt đầu sạch.

## 1.2 Strategy

```
┌──────────────────────────────────────────────────────┐
│                MIGRATION PIPELINE                     │
│                                                      │
│  BHL Excel/   ──► Validate ──► Transform ──► Load    │
│  Bravo CSV       (schema)     (mapping)    (DB)      │
│                      │             │          │       │
│                      ▼             ▼          ▼       │
│                  Error Log    Mapping Log   Audit Log │
│                                                      │
│  ═══════════════════════════════════════════════════  │
│  Run 1: Staging (dry run) → Fix → Run 2: Production  │
└──────────────────────────────────────────────────────┘
```

**2-pass approach:**
1. **Dry run on Staging:** Import → validate → fix data issues → repeat
2. **Production run:** Clean import vào production DB → verify → sign-off

## 1.3 Continuous Sync During Product Development

Trong giai đoạn sản phẩm còn thay đổi liên tục, production không chỉ cần migration một lần. Hệ thống hiện dùng thêm cơ chế **continuous master-data sync**:

- File nguồn chuẩn: `bhl-oms/migrations/seed_master.sql`
- Script chạy sau deploy: `bhl-oms/scripts/db-sync.sh`
- Phạm vi sync tự động:
  - schema migrations mới,
  - master users cần có mặt trên server.
- Phạm vi **không** sync tự động:
  - orders,
  - trips,
  - payments,
  - dữ liệu vận hành phát sinh trên production.

Nguyên tắc: dùng seed idempotent (`ON CONFLICT DO UPDATE`) để đồng bộ cấu hình người dùng và master data, nhưng tránh xóa hoặc reset dữ liệu vận hành thực tế.

---

# 2. DATA SOURCES

| Source | Format | Provider | Deadline |
|--------|--------|----------|----------|
| Danh sách NPP (800) | Excel (.xlsx) | BHL PM | 05/05/2026 |
| Danh sách sản phẩm (30 SKU) | Excel (.xlsx) | BHL PM | 05/05/2026 |
| Danh sách xe (70) | Excel (.xlsx) | BHL PM | 05/05/2026 |
| Danh sách tài xế (70) | Excel (.xlsx) | BHL PM | 05/05/2026 |
| Tuyến đường (500) | Excel (.xlsx) + waypoints | BHL PM | 05/05/2026 |
| Kho + vị trí | Excel (.xlsx) | BHL Thủ kho | 05/05/2026 |
| Hạn mức tín dụng | Bravo export (CSV) | BHL Kế toán | 10/05/2026 |
| Công nợ hiện tại | Bravo export (CSV) | BHL Kế toán | 10/05/2026 |
| Tồn vỏ tại NPP | Bravo export (CSV) | BHL Kế toán | 10/05/2026 |
| Tồn kho hiện tại | Bravo export (CSV) | BHL Thủ kho | 10/05/2026 |
| Users + roles | Excel (.xlsx) | BHL PM | 05/05/2026 |
| Delivery windows | Excel (.xlsx) | BHL PM | 05/05/2026 |

> ⚠️ **Deadline 05/05 cho master data, 10/05 cho balances** — cần có trước UAT Week 7.

---

# 3. ENTITY MIGRATION MATRIX

## 3.1 Customers (NPP)

| Source Column (Excel) | Target Column (DB) | Transform | Validation |
|----------------------|-------------------|-----------|-----------|
| Mã NPP | customer_code | Trim, uppercase | Unique, not empty |
| Tên NPP | name | Trim | Not empty, max 255 |
| Địa chỉ | address | Trim | Not empty |
| Tỉnh/TP | province | Normalize | In province list |
| Quận/Huyện | district | Normalize | — |
| SĐT | phone | Remove spaces, format | Regex `^0[0-9]{9,10}$` |
| SĐT Zalo | zalo_phone | Remove spaces, format | Regex or NULL |
| Latitude | gps_lat | Decimal | -90 to 90, precision 6 |
| Longitude | gps_lng | Decimal | 90 to 180, precision 6 |
| Tuyến đường | route_id | Lookup route_code → UUID | Must exist |
| Khung giờ giao | delivery_window_id | Lookup → UUID | Must exist |
| Loại khách | priority | Map (VIP=1, Normal=2) | — |
| Trạng thái | is_active | Map (HĐ=true, KHĐ=false) | — |

**Expected:** 800 records. Tolerance: 0 errors (master data phải sạch).

## 3.2 Products

| Source Column | Target Column | Transform | Validation |
|--------------|--------------|-----------|-----------|
| Mã SP | product_code | Trim, uppercase | Unique |
| Tên SP | name | Trim | Not empty |
| Barcode prefix | barcode_prefix | Trim | Unique, 3-5 digits |
| Trọng lượng (kg/thùng) | weight_kg | Decimal | > 0 |
| Thể tích (m³/thùng) | volume_m3 | Decimal | > 0 |
| Thùng/pallet | cases_per_pallet | Integer | > 0 |
| SP tươi | is_fresh | Boolean | — |
| Danh mục | category | Enum mapping | In category list |
| Đơn vị | unit | "thùng" default | — |

**Expected:** 30 records.

## 3.3 Vehicles

| Source Column | Target Column | Transform | Validation |
|--------------|--------------|-----------|-----------|
| Biển số | plate_number | Trim, uppercase | Unique, regex |
| Loại xe | vehicle_type | Enum mapping | In type list |
| Tải trọng (kg) | capacity_kg | Decimal | > 0 |
| Thể tích (m³) | capacity_m3 | Decimal | > 0 |
| Nhiên liệu | fuel_type | Enum mapping | — |
| Kho | warehouse_id | Lookup warehouse_code → UUID | Must exist |
| Trạng thái | is_active | Boolean mapping | — |

**Expected:** 70 records.

## 3.4 Drivers

| Source Column | Target Column | Transform | Validation |
|--------------|--------------|-----------|-----------|
| Mã tài xế | driver_code | Trim, uppercase | Unique |
| Họ tên | full_name | Trim | Not empty |
| SĐT | phone | Format | Regex |
| CMND/CCCD | id_number | Trim | Unique |
| Bằng lái | license_number | Trim | — |
| Hạng bằng | license_class | — | — |
| Ngày hết hạn BL | license_expiry | Date | ≥ today |
| Kho | warehouse_id | Lookup | Must exist |
| Trạng thái | is_active | Boolean | — |

**Expected:** 70 records.

## 3.5 Routes

| Source Column | Target Column | Transform | Validation |
|--------------|--------------|-----------|-----------|
| Mã tuyến | route_code | Trim | Unique |
| Tên tuyến | name | Trim | Not empty |
| Kho xuất phát | warehouse_id | Lookup | Must exist |
| Danh sách điểm | waypoints (JSONB) | Parse lat/lng list | Valid coordinates |
| Khoảng cách (km) | distance_km | Decimal | ≥ 0 (recalculate via OSRM) |

**Expected:** 500 records. **Note:** Khoảng cách sẽ được tính lại bằng OSRM sau import.

## 3.6 Warehouses & Locations

| Source Column | Target Column | Transform | Validation |
|--------------|--------------|-----------|-----------|
| Mã kho | warehouse_code | Trim | Unique |
| Tên kho | name | Trim | Not empty |
| Địa chỉ | address | Trim | — |
| GPS | gps_lat, gps_lng | Decimal | Valid |
| Vị trí (hierarchy) | path (LTREE) | Build LTREE: "wh01.zone_a.row_1.slot_01" | Valid LTREE |

**Expected:** 2 warehouses, ~50-100 locations.

## 3.7 Delivery Windows

| Source Column | Target Column | Transform |
|--------------|--------------|-----------|
| Mã khung giờ | code | Trim |
| Tên | name | "Sáng 8-10", "Chiều 14-16" |
| Giờ bắt đầu | start_time | TIME |
| Giờ kết thúc | end_time | TIME |

**Expected:** 4-6 records.

## 3.8 Users

| Source Column | Target Column | Transform | Validation |
|--------------|--------------|-----------|-----------|
| Họ tên | full_name | Trim | Not empty |
| Username | username | Lowercase, trim | Unique |
| Email | email | Lowercase | Valid email |
| SĐT | phone | Format | Regex |
| Role | role | Enum mapping | In role list |
| Kho | warehouse_ids (JSONB) | Lookup → UUID array | Must exist |
| Mật khẩu | password_hash | Default "BHL@2026" → bcrypt | Temp, force change |

**Expected:** ~30-50 records. **Security:** Mật khẩu mặc định, bắt buộc đổi lần đầu login.

---

# 4. MIGRATION SCRIPTS

## 4.1 Script Structure

```
cmd/migrate-data/
├── main.go                 # Entry point: parse flags, run pipeline
├── readers/
│   ├── excel.go           # Read .xlsx files
│   └── csv.go             # Read Bravo CSV exports
├── transformers/
│   ├── customer.go        # NPP transform + validate
│   ├── product.go
│   ├── vehicle.go
│   ├── driver.go
│   ├── route.go
│   ├── warehouse.go
│   └── balance.go
├── loaders/
│   └── postgres.go        # Batch INSERT with ON CONFLICT
├── validators/
│   └── validator.go       # Shared validation rules
└── reports/
    └── report.go          # Generate migration report
```

## 4.2 Execution

```bash
# Dry run (validate only, no write)
go run cmd/migrate-data/main.go \
  --mode=dry-run \
  --source-dir=/data/migration/ \
  --db-url="postgres://..." \
  --output-report=/data/migration/report_dry.json

# Production run
go run cmd/migrate-data/main.go \
  --mode=execute \
  --source-dir=/data/migration/ \
  --db-url="postgres://..." \
  --output-report=/data/migration/report_prod.json
```

## 4.3 Batch Insert Pattern

```go
// Batch INSERT with ON CONFLICT (idempotent)
INSERT INTO customers (id, customer_code, name, address, phone, ...)
VALUES ($1, $2, $3, $4, $5, ...)
ON CONFLICT (customer_code) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  updated_at = NOW();
```

→ Re-runnable. Safe to execute multiple times.

---

# 5. DATA VALIDATION

## 5.1 Validation Rules

| Rule | Check | Severity |
|------|-------|----------|
| **V01** | No duplicate customer_code | Error |
| **V02** | No duplicate product_code | Error |
| **V03** | All route_id references exist | Error |
| **V04** | All warehouse_id references exist | Error |
| **V05** | Phone format valid | Warning (auto-fix) |
| **V06** | GPS coordinates in Vietnam bounding box (lat: 8-24, lng: 102-110) | Error |
| **V07** | Credit limit ≥ 0 | Error |
| **V08** | Opening balance amounts match Bravo total | Error |
| **V09** | Product weight/volume > 0 | Error |
| **V10** | License expiry ≥ today | Warning |
| **V11** | All required fields not empty | Error |
| **V12** | vehicle plate_number format XX[A-Z]-XXXXX | Warning |

## 5.2 Validation Report

```json
{
  "run_id": "mig-2026-05-12-001",
  "mode": "dry-run",
  "timestamp": "2026-05-12T09:00:00+07:00",
  "entities": {
    "customers": {
      "total": 800,
      "valid": 795,
      "errors": 3,
      "warnings": 2,
      "details": [
        {"row": 45, "field": "phone", "value": "098765", "rule": "V05", "message": "Invalid phone format"},
        {"row": 120, "field": "gps_lat", "value": "0", "rule": "V06", "message": "GPS outside Vietnam"},
        {"row": 333, "field": "customer_code", "value": "NPP001", "rule": "V01", "message": "Duplicate code"}
      ]
    },
    "products": { "total": 30, "valid": 30, "errors": 0, "warnings": 0 },
    "vehicles": { "total": 70, "valid": 70, "errors": 0, "warnings": 0 },
    "drivers": { "total": 70, "valid": 69, "errors": 0, "warnings": 1 }
  },
  "summary": {
    "total_records": 970,
    "total_valid": 964,
    "total_errors": 3,
    "total_warnings": 3,
    "can_proceed": false
  }
}
```

**Rule:** `can_proceed = true` only when `total_errors = 0`.

---

# 6. OPENING BALANCES

## 6.1 Credit Balances (Công nợ)

**Source:** Bravo export CSV — danh sách NPP + công nợ hiện tại.

| Bravo Column | Target | Transform |
|-------------|--------|-----------|
| Ma_KH | customer_id | Lookup customer_code → UUID |
| So_du_no | amount | ABS (Bravo might use negative for debt) |
| Ngay_xuat | effective_date | Date | 

**Action:** INSERT vào `receivable_ledger` với `tx_type = 'opening_balance'`.

```sql
INSERT INTO receivable_ledger (id, customer_id, tx_type, reference_type, 
    reference_id, amount, running_balance, note)
VALUES (gen_random_uuid(), $1, 'opening_balance', 'migration', 
    'MIG-OPEN-2026', $2, $2, 'Số dư đầu kỳ từ Bravo');
```

**Verification:** `SUM(running_balance) across all NPP = Bravo total`. Must match ±0.

## 6.2 Asset Balances (Vỏ tồn tại NPP)

**Source:** Bravo export CSV — NPP + loại vỏ + số lượng.

| Bravo Column | Target | Transform |
|-------------|--------|-----------|
| Ma_KH | customer_id | Lookup |
| Loai_vo | asset_type | Enum mapping (két, chai) |
| So_luong | quantity | Integer |

**Action:** INSERT vào `asset_ledger` với `tx_type = 'opening_balance'`.

## 6.3 Stock Balances (Tồn kho)

**Source:** Bravo export / Thủ kho report — product + warehouse + lot + quantity.

| Column | Target | Transform |
|--------|--------|-----------|
| Ma_SP | product_id | Lookup |
| Ma_Kho | warehouse_id | Lookup |
| So_lo | lot_number | Trim |
| Ngay_SX | manufacturing_date | Date |
| HSD | expiry_date | Date |
| So_luong | quantity | Integer |
| Vi_tri | location_id | Lookup LTREE path |

**Action:** INSERT vào `lots` + `stock_quants`.

**Verification:** `SUM(quantity) per product per warehouse = Bravo stock report total`.

---

# 7. MIGRATION SCHEDULE

| Day | Date | Activity | Owner |
|-----|------|----------|-------|
| **D-7** | 05/05 | BHL delivers master data Excel files | BHL PM |
| **D-5** | 07/05 | Dry run #1 on staging | Dev |
| **D-4** | 08/05 | Fix data issues, report back to BHL | Dev + BA |
| **D-3** | 09/05 | BHL fixes data, redelivers | BHL PM |
| **D-2** | 10/05 | BHL delivers balance exports (Bravo) | BHL KT |
| **D-1** | 11/05 | Dry run #2 on staging (full cycle) | Dev |
| **D-1** | 11/05 | BHL KT verifies balances on staging | BHL KT |
| **D-Day** | 12/05 | **Production migration** (morning 08:00) | Dev |
| **D-Day** | 12/05 | BHL KT + PM verify on production | BHL |
| **D-Day** | 12/05 | OSRM recalculate route distances | Dev |
| **D+1** | 13/05 | UAT begins with real data | All |

## Migration Day Protocol (D-Day)

```
08:00  Stop: Đảm bảo hệ thống production empty (no prior data)
08:15  Run: Migration script --mode=execute
08:30  Verify: Check counts match
08:45  Verify: BHL KT verify credit balances (random sample 50 NPP)
09:00  Verify: BHL Thủ kho verify stock (random sample 10 products)
09:15  Verify: OSRM recalculate distances
09:30  Announce: Migration complete, system ready for UAT
```

---

# 8. ROLLBACK PLAN

## 8.1 Pre-migration Backup

```bash
# Backup empty production DB (with schema)
pg_dump -U bhl_prod -Fc bhl_prod > /backup/pre_migration_$(date +%Y%m%d).dump
```

## 8.2 Rollback Scenario

| Scenario | Action |
|----------|--------|
| Migration script fails mid-way | Script uses transaction — auto-rollback |
| Data wrong after migration | Truncate target tables → re-run script |
| Catastrophic | Restore from pre-migration backup |

## 8.3 Rollback Commands

```bash
# Option 1: Truncate and re-run
docker exec bhl-postgres-1 psql -U bhl_prod -d bhl_prod -c "
  TRUNCATE customers, products, vehicles, drivers, delivery_routes, 
    warehouses, warehouse_locations, delivery_windows, credit_limits,
    receivable_ledger, asset_ledger, lots, stock_quants, users CASCADE;
"
# Then re-run migration script

# Option 2: Full restore
docker compose stop api worker
docker exec -i bhl-postgres-1 pg_restore -U bhl_prod -d bhl_prod \
  --clean < /backup/pre_migration_YYYYMMDD.dump
docker compose start api worker
```

---

# 9. SIGN-OFF CHECKLIST

| # | Check | Verifier | Status |
|---|-------|----------|--------|
| 1 | 800 NPP imported, addresses correct | BHL PM | ☐ |
| 2 | 30 products, barcodes match | BHL PM | ☐ |
| 3 | 70 vehicles, plates correct | BHL PM | ☐ |
| 4 | 70 drivers, IDs correct | BHL PM | ☐ |
| 5 | 500 routes loaded, distances calculated (OSRM) | Dev | ☐ |
| 6 | 2 warehouses + locations hierarchy correct | BHL Thủ kho | ☐ |
| 7 | Credit balances match Bravo (random 50 NPP) | BHL Kế toán | ☐ |
| 8 | `SUM(all credit balances)` = Bravo total | BHL Kế toán | ☐ |
| 9 | Asset (vỏ) balances match Bravo | BHL Kế toán | ☐ |
| 10 | Stock balances match Bravo / physical count | BHL Thủ kho | ☐ |
| 11 | All users created, roles correct, can login | BHL PM | ☐ |
| 12 | Delivery windows configured | BHL PM | ☐ |
| 13 | System configs correct (cutoff, timeout, etc.) | Dev | ☐ |
| 14 | Migration report: 0 errors | Dev | ☐ |

**Sign-off:** BHL PM + BHL Kế toán + Dev ký xác nhận. Sau sign-off mới bắt đầu UAT.

---

**=== HẾT TÀI LIỆU MIG v1.0 ===**

*Data Migration Plan v1.0 — 12 entities, mapping tables, validation rules, schedule, rollback, sign-off checklist.*
