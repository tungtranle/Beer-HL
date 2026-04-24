# DATA_DICTIONARY — BHL OMS-TMS-WMS

> **Mục đích:** Định nghĩa thống nhất các thực thể dữ liệu xuất hiện trong **3 nguồn khác nhau**:
> 1. **Hệ thống Core** (PostgreSQL `bhl_oms`) — runtime production
> 2. **Lịch sử LENH 5 năm** (file Excel BHL — đã ETL ra `D:\Xu ly Data cho BHL\output\enriched`)
> 3. **GPS raw 2024** (Camera GPS Stream — `gps_clean.parquet` 17.8 MB)
>
> Trước khi xây dựng feature ML/Analytics, mọi developer/AI agent **phải đọc file này** để tránh nhầm lẫn ngữ nghĩa.
>
> **Phiên bản:** v1.0 — 23/04/2026 (Sprint 0 World-Class Strategy)

---

## 1. ÁNH XẠ CỐT LÕI — 3 nguồn dữ liệu

| Khái niệm nghiệp vụ | OMS Core (live) | LENH lịch sử (Excel) | GPS raw (parquet) |
|---|---|---|---|
| **Đơn hàng (gốc)** | `orders.id` (UUID) | _(không có)_ | — |
| **Dòng đơn hàng (line)** | `order_items.id` | 1 row trong file LENH-`<ngày>.xlsx` (cấp dòng) | — |
| **Nhà phân phối (NPP)** | `customers.id` (UUID), `customers.code` | Cột `Tên NPP` (free-text, đã chuẩn hóa → `Ten NPP chuan`) | — |
| **SKU (sản phẩm)** | `products.code` | Cột tên cột Excel (mỗi cột Excel = 1 SKU, mapped qua `sku_column_map_5y.csv`) | — |
| **Xe (vehicle)** | `vehicles.plate_number` | Cột `Biển số xe` (đã chuẩn hóa → `bien_so_chuan`) | Cột `plate` (định dạng khác, xem §3) |
| **Lái xe** | `drivers.id` + `users` | Cột `Lái xe` + bảng lương 2022 (`Ho ten`) | — |
| **Kho** | `warehouses.code` (`HD`, `CB`) | Suy ra từ vùng giao + tên file | — |
| **Chuyến (trip)** | `trips.id` | Suy ra: `(date × plate)` group | Suy ra: chuỗi điểm GPS giữa 2 stop dài |

> ⚠️ **Khác biệt quan trọng:** OMS Core là **per-order**, LENH lịch sử là **per-line**. Khi join cần group `order_items` theo `order_id` để bằng "đơn LENH".

---

## 2. NPP — Nhà phân phối

### 2.1 Mã NPP (`NPP Code`) trong file enriched

- Format: `<Mã tỉnh>-<Số thứ tự>` ví dụ `HD-53`, `HY-12`, `BN-05`.
- Tổng số NPP unique trong dữ liệu lịch sử 5 năm: **~300** (tất cả tỉnh phía Bắc).
- Mã này **chưa tồn tại trong OMS Core** — Core hiện dùng UUID + `customers.code` BHL nội bộ.
- **Quy ước mapping (Sprint 0):** import enriched data vào schema riêng `ml_features.*`, **KHÔNG** ghi đè `customers`. Khi cần join cross-source: dùng cột mapping `ml_features.npp_code_map (npp_code TEXT, customer_id UUID)` (sẽ build trong P1 khi BHL confirm danh sách NPP "live").

### 2.2 Tên NPP

- **Raw:** `Tên NPP` (free-text, có dấu, có lỗi gõ) — KHÔNG dùng làm key.
- **Chuẩn hóa:** `Ten NPP chuan` (đã unicode-normalize + trim + dedupe). Dùng cho hiển thị, **vẫn không phải key**.
- **Key duy nhất:** `NPP Code`.

### 2.3 Tọa độ NPP

- `Lat`, `Lon` trong `npp_health_scores.csv`: **mức tỉnh** (centroid tỉnh BHL gán), KHÔNG phải địa chỉ giao thực tế.
- Để VRP chạy chính xác: **cần** join với `customers.address_geocoded` của OMS Core khi NPP đã onboard.

### 2.4 Phân khúc NPP (Health Score)

| Field | Giá trị | Ý nghĩa |
|---|---|---|
| `Health_score_0_100` | 0–100 | Tổng hợp RFM (Recency × Frequency × Monetary) |
| `Segment` | `Champion`, `Loyal`, `At Risk`, `Lost`, ... | Phân khúc McKinsey-style |
| `Risk_band` | `GREEN` / `YELLOW` / `RED` | UI banner: GREEN=khỏe, YELLOW=watch, RED=churn risk |
| `recency_days` | int | Số ngày từ `last_order` đến `2023-12-31` (ngày cutoff dữ liệu lịch sử) |

> ⚠️ Health score được tính trên **cutoff `2023-12-31`** — khi import vào OMS phải re-compute với `now()` thực tế (cron pg_cron hàng đêm).

---

## 3. Xe & Biển số — **NGUỒN MISMATCH NGHIÊM TRỌNG**

Đây là phát hiện quan trọng nhất từ Sprint 0 — cần **BHL confirm** trước khi triển khai bất kỳ feature ML nào liên quan fleet.

### 3.1 Hai bộ biển số không trùng nhau

| Nguồn | Format ví dụ | Số lượng unique | Khoảng thời gian |
|---|---|---|---|
| **LENH lịch sử (2022–2023)** | `14C-19245`, `14H-00904`, `34M-8012` | ~120 plates | 2022-01-01 → 2023-12-31 |
| **GPS raw (2024)** | `26F-xxxxx`, `27A-xxxxx`, `30A-xxxxx` | 71 plates | 2024-Q1 → 2024-Q4 (zero overlap với LENH) |

### 3.2 Nguyên nhân khả dĩ

1. BHL **đổi đội xe** giữa 2023 và 2024 (thuê ngoài hoặc mua mới).
2. Hai hệ thống GPS khác nhau (cũ vs mới), data cũ đã mất.
3. Camera GPS Stream chỉ cover nhóm xe specific (long-haul Cẩm Tài/Cẩm Giàng?).

### 3.3 Implication cho strategy

| Feature | Bị ảnh hưởng | Cách xử lý |
|---|---|---|
| F1 Demand Forecast | KHÔNG (chỉ cần SKU + NPP + ngày) | OK, không phụ thuộc plate |
| F4 GPS-Calibrated VRP | **CÓ** | `travel_time_matrix.csv` derive từ GPS 2024 → vẫn dùng được vì matrix là **route-level** không phải plate-level |
| F6 Driver Performance | **CÓ** | Chỉ dùng được driver-name baseline từ LENH, KHÔNG ghép GPS chi tiết |
| F7 GPS Anomaly | **CÓ** | Threshold tuning từ GPS 2024 → áp dụng cho fleet 2024+ (không backfill 2022–2023) |

### 3.4 Quy ước xử lý (locked)

- **Không cố force-match** plate giữa LENH và GPS.
- Schema: `ml_features.vehicle_history` lưu LENH plates (analytics), `vehicles` Core table lưu fleet hiện hành (live ops).
- **Ngày D-Day BHL confirm fleet structure → cập nhật DECISIONS.md DEC-NEW.**

---

## 4. SKU — Sản phẩm

### 4.1 Tên SKU chuẩn

`sku_column_map_5y.csv` chứa map từ tên cột Excel raw (5 năm có thay đổi) → `SKU chuan` thống nhất.

VD: `Vỉ Sapphire`, `Bia hơi 30L (Keg)`, `Lon Sapphire 330ml`, `Bia tươi 2L (Bom)`, `Gông 5 keg 2L`, ...

### 4.2 Phân loại Forecastability

`sku_forecastability.csv` chia SKU theo `forecast_method`:

| Method | Số SKU | Tiêu chí | Áp dụng |
|---|---|---|---|
| `Prophet (good)` | **21** | `n_active_days ≥ 100` | F1 Demand Intelligence — train Prophet riêng từng SKU |
| `Croston (intermittent)` | ~8 | `tet_share > 0.3` hoặc sparse | Croston/SBA cho SKU bán theo Tết |
| `Naive (rare)` | còn lại | `n_active_days < 30` | Bỏ qua hoặc dùng moving average 4-tuần |

### 4.3 Đơn vị

- LENH lịch sử: số nguyên (vỉ, keg, lon, chai, gông).
- OMS Core: `order_items.qty` + `unit` (text). **KHÔNG** convert qua kg/lít — giữ nguyên đơn vị xuất kho.

---

## 5. Tuyến đường (Route)

### 5.1 Route Library

| File | Số tuyến | Status |
|---|---|---|
| `routes_official.csv` | **39** | Tuyến chính BHL chạy thường xuyên — sẽ import vào `route_templates` table |
| `routes_archive_longtail.csv` | ~hàng nghìn | Long-tail (chạy < 5 lần/5 năm) — archive only, không hiển thị UI |

### 5.2 Cấu trúc tuyến

- 1 route = chuỗi `(warehouse → npp_1 → npp_2 → ... → npp_N → warehouse)`.
- Định danh: `route_code` BHL nội bộ (chưa thống nhất, Sprint 0 tạm dùng auto-gen `R-<hash>`).

---

## 6. Travel Time Matrix

`travel_time_matrix.csv`:

- Cấu trúc: `(origin_node, dest_node, time_bucket, travel_seconds, distance_m, n_observations)`.
- `time_bucket`: `morning_peak` (6–9h), `midday` (9–16h), `evening_peak` (16–19h), `night` (19–6h).
- Nguồn: derive từ GPS 2024 → áp dụng cho VRP **route-level** (không cần plate match).
- **Fallback:** nếu cặp `(origin, dest)` không có trong matrix → dùng OSRM live (current behavior).

---

## 7. Basket / Recommendation Rules

`basket_rules.csv` (Apriori output):

| Cột | Ý nghĩa | Threshold dùng cho F3 |
|---|---|---|
| `Antecedent` | SKU đã có trong giỏ | — |
| `Consequent` | SKU đề xuất thêm | — |
| `Support` | Tỉ lệ đồng xuất hiện trên tổng đơn | ≥ 0.05 |
| `Confidence` | P(Consequent \| Antecedent) | ≥ 0.60 (UI chỉ hiện rule confidence ≥ 60%) |
| `Lift` | Confidence / P(Consequent) | ≥ 1.20 |

> Rules `Confidence ≥ 0.985` (như `Gông 5 keg 2L → Bia tươi 2L`) là **bundle bắt buộc nghiệp vụ** — UI nên auto-add thay vì gợi ý.

---

## 8. Driver KPI Baseline

`driver_kpi_baseline.csv`:

- 1 row = 1 lái xe (name + nickname).
- `KPI_efficiency_0_100`: composite score (trips/day, on-time, fuel/100km, ...) **trên dữ liệu 2022 lương + LENH 5 năm**.
- **Lưu ý NĐ13:** dữ liệu cá nhân hóa lái xe phải có **consent flow EC-06** trước khi hiển thị cho dispatcher/BGĐ. Sprint 0 import vào `ml_features.driver_baseline_2022` chỉ cho **read-only analytics**, KHÔNG link tới `users` table cho đến khi consent done.

---

## 9. Seed Scenarios (test data)

`seed_scenarios.json`:

| Scenario | Ngày | Mô tả |
|---|---|---|
| `SC-PEAK` | 2022-07-27 | Ngày peak full fleet (79 NPP, 308 lines, 21 xe, 2 kho) |
| `SC-LOW` | 2022-01-31 | Ngày thấp partial fleet (1 NPP, 3 lines, 0 xe) |
| `SC-DUAL` | 2022-07-27 | Dual-warehouse high load (alias của PEAK) |

> ⚠️ Số liệu hiện tại của `SC-PEAK` (79/308/21) **không khớp** với critique trong `BHL_WorldClass_Strategy.html` (67/627/46). Nguyên nhân: critique dựa trên ETL phiên bản trước, đã được sửa bộ lọc `km_gps<500` + dedupe lines. **Số liệu hiện tại là số được lock cho Sprint 1.**

---

## 10. Naming Convention — bắt buộc

| Layer | Convention | Ví dụ |
|---|---|---|
| Schema lịch sử (read-only ML) | `ml_features.*` | `ml_features.npp_health_scores` |
| Bảng forecast output | `ml_features.demand_forecast_<sku_method>` | `ml_features.demand_forecast_prophet` |
| Bảng feedback loop | `ml_features.forecast_actuals` | — |
| Mapping bridge | `ml_features.<entity>_code_map` | `ml_features.npp_code_map (npp_code TEXT, customer_id UUID)` |
| Cột date trong analytics | `*_date DATE` (KHÔNG `timestamp` cho ngày nghiệp vụ) | `order_date DATE` |
| Tiền | `NUMERIC(15,2)` | per [`CLAUDE.md`](../../CLAUDE.md ) rule #1 |

---

## 11. Lock & Update Policy

- **File này = source of truth** cho mọi định nghĩa data cross-source.
- Mỗi khi có schema mới hoặc mapping mới: **PR phải update file này trong cùng commit** với code.
- Kiểm tra trong PR review: nếu sửa `ml_features.*` mà không sửa file này → **block merge**.

---

*Tạo: 23/04/2026 — Sprint 0 World-Class Strategy. Trigger: `BHL_WorldClass_Strategy.html` H10 prerequisite.*
