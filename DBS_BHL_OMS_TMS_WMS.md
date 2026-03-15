# DATABASE SCHEMA DESIGN — BHL OMS-TMS-WMS

| Thông tin | Giá trị |
|-----------|---------|
| Phiên bản | **v1.0** |
| Dựa trên | SAD v2.1, BRD v2.0 Final |
| Database | PostgreSQL 16 |
| Encoding | UTF-8 |
| Timezone | Tất cả `timestamptz` lưu UTC. App convert Asia/Ho_Chi_Minh |
| Naming | snake_case, singular (trừ `stock_quants`), UUID v7 cho PK |
| DB Access | sqlc + pgx v5 (type-safe generated Go code) |

---

# MỤC LỤC

1. [Quy ước & Convention](#1-quy-ước--convention)
2. [Extensions & Types](#2-extensions--types)
3. [Master Data Tables](#3-master-data-tables)
4. [OMS Tables](#4-oms-tables)
5. [TMS Tables](#5-tms-tables)
6. [WMS Tables](#6-wms-tables)
7. [Finance Tables](#7-finance-tables)
8. [Reconciliation Tables](#8-reconciliation-tables)
9. [System Tables](#9-system-tables)
10. [Partitioning Strategy](#10-partitioning-strategy)
11. [Migration Plan](#11-migration-plan)
12. [Performance Notes](#12-performance-notes)

---

# 1. QUY ƯỚC & CONVENTION

| Quy ước | Chi tiết |
|---------|---------|
| Primary Key | `id UUID DEFAULT gen_random_uuid()` — UUID v7 preferred (sortable) |
| Timestamps | `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` |
| Soft delete | **Không dùng.** Hard delete + audit_logs giữ history |
| Foreign Key | `{table}_id UUID NOT NULL REFERENCES {table}(id)` |
| Enum | PostgreSQL ENUM type. Thay đổi chỉ `ADD VALUE`, không remove |
| JSONB | Chỉ cho flexible data (addresses, checklist items, metadata). Không cho quan hệ chính |
| Index naming | `idx_{table}_{columns}`, unique: `unq_{table}_{columns}` |
| Check constraints | `chk_{table}_{description}` |
| NOT NULL | Mặc định NOT NULL trừ khi nghiệp vụ cho phép null |
| Text | `VARCHAR(n)` cho bounded data, `TEXT` cho unbounded |
| Money | `NUMERIC(15,2)` — không dùng `money` type hay `float` |
| Quantity | `INTEGER` cho số lượng nguyên, `NUMERIC(12,3)` cho trọng lượng/thể tích |

---

# 2. EXTENSIONS & TYPES

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "ltree";       -- Warehouse hierarchy
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- Fuzzy search customers

-- Custom ENUM types
CREATE TYPE order_status AS ENUM (
    'draft', 'pending_approval', 'confirmed', 'planned', 'picking',
    'loaded', 'in_transit', 'delivered', 'partial_delivered',
    'rejected', 're_delivery', 'on_credit', 'cancelled'
);

CREATE TYPE trip_status AS ENUM (
    'created', 'assigned', 'checked', 'loading', 'gate_checked',
    'in_transit', 'at_stop', 'returning', 'unloading_returns',
    'settling', 'reconciled', 'completed', 'cancelled'
);

CREATE TYPE stop_status AS ENUM (
    'pending', 'arrived', 'delivering', 'delivered', 'partial',
    'rejected', 're_delivery', 'skipped'
);

CREATE TYPE payment_type AS ENUM ('cash', 'transfer', 'credit');
CREATE TYPE payment_status AS ENUM ('pending', 'confirmed', 'rejected', 'timeout');

CREATE TYPE stock_move_type AS ENUM ('inbound', 'outbound', 'transfer', 'adjustment', 'return_inbound');

CREATE TYPE asset_type AS ENUM ('bottle', 'crate', 'keg', 'pallet', 'ccdc');
CREATE TYPE asset_condition AS ENUM ('good', 'damaged', 'lost');
CREATE TYPE asset_direction AS ENUM ('out', 'in');

CREATE TYPE ledger_type AS ENUM ('debit', 'credit');  -- debit=ghi nợ, credit=thu tiền
CREATE TYPE sync_status AS ENUM ('pending', 'synced', 'failed', 'skipped');

CREATE TYPE discrepancy_type AS ENUM ('goods', 'money', 'assets');
CREATE TYPE discrepancy_status AS ENUM ('open', 'in_progress', 'closed');

CREATE TYPE vehicle_ownership AS ENUM ('internal', 'hired');
CREATE TYPE vehicle_status AS ENUM ('active', 'maintenance', 'suspended');
CREATE TYPE driver_status AS ENUM ('active', 'on_leave', 'resigned');

CREATE TYPE notification_channel AS ENUM ('web', 'fcm', 'zalo');
CREATE TYPE zalo_confirm_status AS ENUM ('sent', 'confirmed', 'disputed', 'auto_confirmed', 'expired');

CREATE TYPE gate_check_result AS ENUM ('pass', 'fail');
CREATE TYPE picking_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
```

---

# 3. MASTER DATA TABLES

## 3.1 products

```sql
CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(20) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    category        VARCHAR(50) NOT NULL,        -- 'bia_chai', 'bia_hoi', 'keg', 'ngk'
    unit            VARCHAR(20) NOT NULL,         -- 'thung', 'keg', 'cai'
    weight_kg       NUMERIC(8,3) NOT NULL,
    volume_m3       NUMERIC(8,5) NOT NULL,
    shelf_life_days INTEGER,                      -- HSD tiêu chuẩn (ngày)
    expiry_threshold_pct INTEGER DEFAULT 33,      -- Ngưỡng cận hạn (% HSD), BRD WMS-02
    barcode_prefix  VARCHAR(20),                  -- 'BHL-{code}'
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_products_code UNIQUE (code)
);

CREATE INDEX idx_products_category ON products (category) WHERE is_active = true;
```

## 3.2 customers (NPP)

```sql
CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(20) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    phone           VARCHAR(20),
    zalo_uid        VARCHAR(100),                -- Zalo OA user ID (cho gửi ZNS)
    addresses       JSONB NOT NULL DEFAULT '[]',  -- [{label, address, lat, lng, is_default}]
    deposit_policy  JSONB,                        -- Chính sách cược vỏ
    notes           TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_customers_code UNIQUE (code)
);

CREATE INDEX idx_customers_name_trgm ON customers USING gin (name gin_trgm_ops);
CREATE INDEX idx_customers_phone ON customers (phone) WHERE phone IS NOT NULL;
```

## 3.3 credit_limits

```sql
CREATE TABLE credit_limits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    amount          NUMERIC(15,2) NOT NULL,       -- Hạn mức (VND)
    from_date       DATE NOT NULL,
    to_date         DATE NOT NULL,
    approved_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_credit_limits_dates CHECK (to_date >= from_date),
    CONSTRAINT chk_credit_limits_amount CHECK (amount > 0)
);

CREATE INDEX idx_credit_limits_customer_active ON credit_limits (customer_id, from_date, to_date);
```

## 3.4 deposit_prices (Đơn giá cược/bồi hoàn vỏ)

```sql
CREATE TABLE deposit_prices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_type      asset_type NOT NULL,
    price           NUMERIC(15,2) NOT NULL,       -- Đơn giá bồi hoàn (VND)
    from_date       DATE NOT NULL,
    to_date         DATE NOT NULL,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_deposit_prices_dates CHECK (to_date >= from_date),
    CONSTRAINT chk_deposit_prices_amount CHECK (price > 0)
);

CREATE INDEX idx_deposit_prices_type_dates ON deposit_prices (asset_type, from_date, to_date);
```

## 3.5 delivery_routes

```sql
CREATE TABLE delivery_routes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(20) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    route_type      VARCHAR(20) NOT NULL DEFAULT 'fixed',  -- 'fixed' | 'dynamic'
    waypoints       JSONB NOT NULL DEFAULT '[]',           -- [{customer_id, order, lat, lng}]
    distance_km     NUMERIC(8,2),
    estimated_hours NUMERIC(4,2),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_delivery_routes_code UNIQUE (code)
);
```

## 3.6 vehicles

```sql
CREATE TABLE vehicles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_number    VARCHAR(20) NOT NULL,
    vehicle_type    VARCHAR(50) NOT NULL,
    capacity_kg     NUMERIC(10,2) NOT NULL,
    capacity_m3     NUMERIC(8,3) NOT NULL,
    ownership       vehicle_ownership NOT NULL DEFAULT 'internal',
    supplier_name   VARCHAR(200),                 -- Nhà cung cấp (xe thuê)
    status          vehicle_status NOT NULL DEFAULT 'active',
    documents       JSONB DEFAULT '{}',           -- {registration_expiry, inspection_expiry, insurance_expiry}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_vehicles_plate UNIQUE (plate_number),
    CONSTRAINT chk_vehicles_capacity CHECK (capacity_kg > 0 AND capacity_m3 > 0)
);

CREATE INDEX idx_vehicles_status ON vehicles (status) WHERE status = 'active';
```

## 3.7 drivers

```sql
CREATE TABLE drivers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),     -- Link to login account
    full_name       VARCHAR(100) NOT NULL,
    id_card         VARCHAR(20),                   -- CCCD
    phone           VARCHAR(20) NOT NULL,
    license_type    VARCHAR(10),                   -- B2, C, etc.
    license_expiry  DATE,
    status          driver_status NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_drivers_user ON drivers (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_drivers_status ON drivers (status) WHERE status = 'active';
```

## 3.8 warehouses

```sql
CREATE TABLE warehouses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(20) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    address         TEXT,
    lat             NUMERIC(10,7),
    lng             NUMERIC(10,7),
    path            LTREE NOT NULL,               -- Hierarchy: 'hl' | 'hl.zone_a' | 'hl.zone_a.aisle_1.bin_01'
    location_type   VARCHAR(20) NOT NULL DEFAULT 'warehouse',  -- 'warehouse' | 'zone' | 'aisle' | 'bin'
    max_capacity    INTEGER,                       -- Sức chứa (nếu bin)
    asset_types     VARCHAR(50)[],                 -- ['thanh_pham', 'vo', 'keg', 'pallet']
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_warehouses_code UNIQUE (code),
    CONSTRAINT unq_warehouses_path UNIQUE (path)
);

CREATE INDEX idx_warehouses_path_gist ON warehouses USING gist (path);
CREATE INDEX idx_warehouses_parent ON warehouses USING gist (path) WHERE location_type = 'warehouse';
```

## 3.9 delivery_windows

```sql
CREATE TABLE delivery_windows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    window_minutes  INTEGER NOT NULL DEFAULT 60,   -- R07: 1 giờ mặc định
    from_date       DATE NOT NULL,
    to_date         DATE NOT NULL,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_delivery_windows_dates CHECK (to_date >= from_date),
    CONSTRAINT chk_delivery_windows_minutes CHECK (window_minutes > 0)
);
```

## 3.10 priority_rules

```sql
CREATE TABLE priority_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    criteria        JSONB NOT NULL,                -- {field: 'capacity_kg', direction: 'desc', weight: 10}
    sort_order      INTEGER NOT NULL DEFAULT 0,    -- R12: thứ tự ưu tiên cấu hình được
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 3.11 forbidden_zones

```sql
CREATE TABLE forbidden_zones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_name       VARCHAR(200) NOT NULL,
    description     TEXT,
    from_time       TIME NOT NULL,                 -- Giờ cấm bắt đầu
    to_time         TIME NOT NULL,                 -- Giờ cấm kết thúc
    vehicle_types   VARCHAR(50)[] NOT NULL,        -- Loại xe bị cấm
    geofence        JSONB,                         -- {lat, lng, radius_m} hoặc polygon
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 3.12 system_configs

```sql
CREATE TABLE system_configs (
    key             VARCHAR(100) PRIMARY KEY,
    value           JSONB NOT NULL,
    description     TEXT,
    updated_by      UUID REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed data
INSERT INTO system_configs (key, value, description) VALUES
    ('order_cutoff_hour', '16', 'Mốc chốt đơn (R08)'),
    ('ck_timeout_minutes', '30', 'Timeout xác nhận chuyển khoản'),
    ('gps_interval_seconds', '30', 'Tần suất gửi GPS'),
    ('gps_idle_threshold_minutes', '15', 'Ngưỡng cảnh báo xe dừng'),
    ('zalo_auto_confirm_hours', '24', 'Silent consent 24h (R13)'),
    ('max_file_size_mb', '5', 'Max file upload (ảnh)'),
    ('planning_solver_timeout_seconds', '120', 'VRP solver timeout');
```

---

# 4. OMS TABLES

## 4.1 sales_orders

```sql
CREATE TABLE sales_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number    VARCHAR(30) NOT NULL,          -- Auto-generated: SO-YYYYMMDD-XXXX
    customer_id     UUID NOT NULL REFERENCES customers(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    status          order_status NOT NULL DEFAULT 'draft',
    delivery_date   DATE NOT NULL,
    delivery_address JSONB NOT NULL,               -- {label, address, lat, lng}
    time_window     VARCHAR(20),                   -- 'morning' | 'afternoon' | 'evening'
    cutoff_group    VARCHAR(20) NOT NULL,           -- 'before_16h' | 'after_16h' (R08)
    total_weight_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_volume_m3 NUMERIC(8,3) NOT NULL DEFAULT 0,
    total_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
    deposit_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,  -- Tiền cược vỏ
    notes           TEXT,
    approved_by     UUID REFERENCES users(id),     -- Kế toán duyệt (nếu vượt hạn mức)
    approved_at     TIMESTAMPTZ,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_sales_orders_number UNIQUE (order_number)
);

-- Active orders (most queries)
CREATE INDEX idx_sales_orders_customer_status ON sales_orders (customer_id, status, created_at);
-- Partial index: chỉ đơn đang xử lý
CREATE INDEX idx_sales_orders_active ON sales_orders (status, delivery_date)
    WHERE status IN ('draft', 'confirmed', 'planned', 'picking', 'loaded', 'in_transit', 'pending_approval');
-- Cutoff group for batch processing
CREATE INDEX idx_sales_orders_cutoff ON sales_orders (cutoff_group, delivery_date, status);
```

## 4.2 order_items

```sql
CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    quantity        INTEGER NOT NULL,
    unit_price      NUMERIC(15,2) NOT NULL,
    line_total      NUMERIC(15,2) NOT NULL,        -- quantity × unit_price
    deposit_qty     INTEGER NOT NULL DEFAULT 0,     -- Số vỏ cược
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_order_items_qty CHECK (quantity > 0),
    CONSTRAINT chk_order_items_price CHECK (unit_price >= 0)
);

CREATE INDEX idx_order_items_order ON order_items (order_id);
CREATE INDEX idx_order_items_product ON order_items (product_id);
```

## 4.3 shipments

```sql
CREATE TABLE shipments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_number VARCHAR(30) NOT NULL,
    order_ids       UUID[] NOT NULL,               -- Gom từ nhiều SO (US-OMS-03)
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    total_weight_kg NUMERIC(10,2) NOT NULL,
    total_volume_m3 NUMERIC(8,3) NOT NULL,
    delivery_date   DATE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'assigned', 'picked', 'completed'
    is_urgent       BOOLEAN NOT NULL DEFAULT false,          -- Ưu tiên giao hàng gấp (009)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_shipments_number UNIQUE (shipment_number)
);

CREATE INDEX idx_shipments_status_date ON shipments (status, delivery_date);
CREATE INDEX idx_shipments_urgent ON shipments (is_urgent DESC, delivery_date);
```

---

# 5. TMS TABLES

## 5.1 trips

```sql
CREATE TABLE trips (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_number     VARCHAR(30) NOT NULL,           -- TRIP-YYYYMMDD-XXXX
    vehicle_id      UUID REFERENCES vehicles(id),
    driver_id       UUID REFERENCES drivers(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    status          trip_status NOT NULL DEFAULT 'created',
    planned_date    DATE NOT NULL,
    started_at      TIMESTAMPTZ,                    -- Xe xuất phát
    completed_at    TIMESTAMPTZ,                    -- Trip hoàn tất
    total_distance_km NUMERIC(8,2),                 -- Từ VRP output
    total_stops     INTEGER NOT NULL DEFAULT 0,
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_trips_number UNIQUE (trip_number)
);

CREATE INDEX idx_trips_status_date ON trips (status, planned_date);
CREATE INDEX idx_trips_vehicle ON trips (vehicle_id, status);
CREATE INDEX idx_trips_driver ON trips (driver_id, planned_date);
```

## 5.2 trip_stops

```sql
CREATE TABLE trip_stops (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id         UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    shipment_id     UUID NOT NULL REFERENCES shipments(id),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    stop_order      INTEGER NOT NULL,               -- Thứ tự điểm dừng từ VRP
    status          stop_status NOT NULL DEFAULT 'pending',
    delivery_address JSONB NOT NULL,
    estimated_arrival TIMESTAMPTZ,                  -- Từ VRP output
    actual_arrival  TIMESTAMPTZ,                    -- GPS auto-detect
    estimated_departure TIMESTAMPTZ,
    actual_departure TIMESTAMPTZ,
    service_time_min INTEGER,                       -- Thời gian dỡ hàng thực tế
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_stops_trip ON trip_stops (trip_id, stop_order);
CREATE INDEX idx_trip_stops_shipment ON trip_stops (shipment_id);
```

## 5.3 delivery_attempts

```sql
CREATE TABLE delivery_attempts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_stop_id    UUID NOT NULL REFERENCES trip_stops(id),
    order_id        UUID NOT NULL REFERENCES sales_orders(id),
    attempt_number  INTEGER NOT NULL DEFAULT 1,     -- R05: không giới hạn số lần
    status          VARCHAR(20) NOT NULL,            -- 'delivered', 'partial', 'rejected', 'failed'
    failure_reason  TEXT,                            -- Lý do thất bại (R05)
    delivered_items JSONB,                           -- [{product_id, qty_ordered, qty_delivered}]
    notes           TEXT,
    created_by      UUID REFERENCES users(id),       -- Driver
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_delivery_attempts_number CHECK (attempt_number > 0)
);

CREATE INDEX idx_delivery_attempts_stop ON delivery_attempts (trip_stop_id);
CREATE INDEX idx_delivery_attempts_order ON delivery_attempts (order_id, attempt_number);
```

## 5.4 epods

```sql
CREATE TABLE epods (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_attempt_id UUID NOT NULL REFERENCES delivery_attempts(id),
    photo_urls      TEXT[] NOT NULL,                 -- S3 pre-signed URL keys
    gps_lat         NUMERIC(10,7) NOT NULL,
    gps_lng         NUMERIC(10,7) NOT NULL,
    gps_accuracy_m  NUMERIC(6,1),
    recorded_at     TIMESTAMPTZ NOT NULL,            -- Thời điểm tài xế xác nhận
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_epods_photos CHECK (array_length(photo_urls, 1) >= 1)
);

CREATE INDEX idx_epods_attempt ON epods (delivery_attempt_id);
```

## 5.5 payments

```sql
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_attempt_id UUID NOT NULL REFERENCES delivery_attempts(id),
    order_id        UUID NOT NULL REFERENCES sales_orders(id),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    payment_type    payment_type NOT NULL,
    amount          NUMERIC(15,2) NOT NULL,
    status          payment_status NOT NULL DEFAULT 'pending',
    confirmed_by    UUID REFERENCES users(id),       -- Điều vận xác nhận CK
    confirmed_at    TIMESTAMPTZ,
    photo_url       TEXT,                            -- Ảnh biên lai
    notes           TEXT,
    created_by      UUID REFERENCES users(id),       -- Driver
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_payments_amount CHECK (amount >= 0)
);

CREATE INDEX idx_payments_order ON payments (order_id);
CREATE INDEX idx_payments_customer ON payments (customer_id, created_at DESC);
CREATE INDEX idx_payments_status ON payments (status) WHERE status = 'pending';
```

## 5.6 gps_locations (Partitioned)

```sql
CREATE TABLE gps_locations (
    id              UUID NOT NULL DEFAULT gen_random_uuid(),
    vehicle_id      UUID NOT NULL,
    driver_id       UUID,
    lat             NUMERIC(10,7) NOT NULL,
    lng             NUMERIC(10,7) NOT NULL,
    speed_kmh       NUMERIC(6,1),
    heading         NUMERIC(5,1),                   -- 0-360 degrees
    accuracy_m      NUMERIC(6,1),
    recorded_at     TIMESTAMPTZ NOT NULL,

    PRIMARY KEY (recorded_at, id)                    -- Partition key must be in PK
) PARTITION BY RANGE (recorded_at);

-- Tạo partition mỗi tháng (6 tháng online, archive sau)
-- Tự động tạo bằng pg_partman hoặc migration job
CREATE TABLE gps_locations_2026_03 PARTITION OF gps_locations
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE gps_locations_2026_04 PARTITION OF gps_locations
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE gps_locations_2026_05 PARTITION OF gps_locations
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE INDEX idx_gps_locations_vehicle_time ON gps_locations (vehicle_id, recorded_at DESC);
```

## 5.7 checklists

```sql
CREATE TABLE checklists (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id         UUID NOT NULL REFERENCES trips(id),
    driver_id       UUID NOT NULL REFERENCES drivers(id),
    checklist_type  VARCHAR(20) NOT NULL,            -- 'pre_trip' | 'post_trip'
    items           JSONB NOT NULL,                  -- [{name, passed: bool, notes, photo_url}]
    photo_urls      TEXT[],                          -- Ảnh tổng quát xe
    all_passed      BOOLEAN NOT NULL,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklists_trip ON checklists (trip_id, checklist_type);
```

---

# 6. WMS TABLES

## 6.1 lots

```sql
CREATE TABLE lots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id),
    batch_number    VARCHAR(50) NOT NULL,
    production_date DATE NOT NULL,
    expiry_date     DATE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_lots_batch UNIQUE (product_id, batch_number),
    CONSTRAINT chk_lots_dates CHECK (expiry_date > production_date)
);

CREATE INDEX idx_lots_product_expiry ON lots (product_id, expiry_date);
```

## 6.2 stock_quants (Tồn kho thực tế)

```sql
CREATE TABLE stock_quants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id),
    lot_id          UUID NOT NULL REFERENCES lots(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),    -- Kho (top-level)
    location_id     UUID NOT NULL REFERENCES warehouses(id),    -- Bin/Slot (leaf in LTREE)
    quantity        INTEGER NOT NULL DEFAULT 0,                  -- Tồn thực tế
    reserved_qty    INTEGER NOT NULL DEFAULT 0,                  -- Đã reserved (ATP)

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- ATP = quantity - reserved_qty
    CONSTRAINT unq_stock_quants UNIQUE (product_id, lot_id, location_id),
    CONSTRAINT chk_stock_quants_qty CHECK (quantity >= 0),
    CONSTRAINT chk_stock_quants_reserved CHECK (reserved_qty >= 0 AND reserved_qty <= quantity)
);

-- ATP query: SUM(quantity - reserved_qty) WHERE product_id = $1 AND warehouse_id = $2
CREATE INDEX idx_stock_quants_product_wh ON stock_quants (product_id, warehouse_id);
-- FEFO picking: ORDER BY expiry_date ASC
CREATE INDEX idx_stock_quants_fefo ON stock_quants (product_id, warehouse_id, lot_id);
```

## 6.3 stock_moves

```sql
CREATE TABLE stock_moves (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    move_number     VARCHAR(30) NOT NULL,
    move_type       stock_move_type NOT NULL,
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    reference_type  VARCHAR(30),                     -- 'shipment', 'return', 'adjustment'
    reference_id    UUID,                            -- FK linh hoạt
    items           JSONB NOT NULL,                  -- [{product_id, lot_id, location_id, qty}]
    total_items     INTEGER NOT NULL,
    notes           TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_stock_moves_number UNIQUE (move_number)
);

CREATE INDEX idx_stock_moves_reference ON stock_moves (reference_type, reference_id);
CREATE INDEX idx_stock_moves_wh_date ON stock_moves (warehouse_id, created_at DESC);
```

## 6.4 picking_orders

```sql
CREATE TABLE picking_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pick_number     VARCHAR(30) NOT NULL,
    shipment_id     UUID NOT NULL REFERENCES shipments(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    status          picking_status NOT NULL DEFAULT 'pending',
    items           JSONB NOT NULL,                  -- [{product_id, lot_id, location_id, qty, picked_qty}]
    assigned_to     UUID REFERENCES users(id),       -- Thủ kho
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_picking_orders_number UNIQUE (pick_number)
);

CREATE INDEX idx_picking_orders_shipment ON picking_orders (shipment_id);
CREATE INDEX idx_picking_orders_status ON picking_orders (status, warehouse_id) WHERE status IN ('pending', 'in_progress');
```

## 6.5 gate_checks

```sql
CREATE TABLE gate_checks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id         UUID NOT NULL REFERENCES trips(id),
    shipment_id     UUID NOT NULL REFERENCES shipments(id),
    expected_items  JSONB NOT NULL,                  -- [{product_id, lot_id, qty}]
    scanned_items   JSONB NOT NULL,                  -- [{product_id, lot_id, qty, barcode}]
    result          gate_check_result NOT NULL,       -- R01: sai lệch = 0
    discrepancy_details JSONB,                       -- Chi tiết sai lệch (nếu fail)
    checked_by      UUID NOT NULL REFERENCES users(id),  -- Bảo vệ/Kế toán
    exit_time       TIMESTAMPTZ,                     -- Thời gian xe ra cổng
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_gate_checks_trip_shipment UNIQUE (trip_id, shipment_id)
);

CREATE INDEX idx_gate_checks_trip ON gate_checks (trip_id);
```

## 6.6 asset_ledger (Sổ cái tài sản quay vòng vỏ)

```sql
CREATE TABLE asset_ledger (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    asset_type      asset_type NOT NULL,
    direction       asset_direction NOT NULL,        -- 'out' = phát ra, 'in' = thu về
    quantity        INTEGER NOT NULL,
    condition       asset_condition NOT NULL DEFAULT 'good',
    reference_type  VARCHAR(30) NOT NULL,            -- 'delivery', 'return', 'compensation'
    reference_id    UUID NOT NULL,
    notes           TEXT,
    bravo_sync_status sync_status NOT NULL DEFAULT 'pending',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_asset_ledger_qty CHECK (quantity > 0)
);

CREATE INDEX idx_asset_ledger_customer ON asset_ledger (customer_id, asset_type, created_at DESC);
CREATE INDEX idx_asset_ledger_sync ON asset_ledger (bravo_sync_status) WHERE bravo_sync_status = 'pending';
```

## 6.7 return_collections

```sql
CREATE TABLE return_collections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_stop_id    UUID NOT NULL REFERENCES trip_stops(id),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    asset_type      asset_type NOT NULL,
    quantity        INTEGER NOT NULL,
    condition       asset_condition NOT NULL,
    photo_url       TEXT,                            -- Bắt buộc nếu damaged (R02)
    workshop_confirmed_qty INTEGER,                  -- Phân xưởng đếm thực tế
    workshop_confirmed_by UUID REFERENCES users(id),
    workshop_confirmed_at TIMESTAMPTZ,
    discrepancy_qty INTEGER GENERATED ALWAYS AS (
        CASE WHEN workshop_confirmed_qty IS NOT NULL
             THEN quantity - workshop_confirmed_qty
             ELSE NULL
        END
    ) STORED,                                        -- R02: chênh lệch → lái xe chịu
    created_by      UUID REFERENCES users(id),       -- Driver
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_return_collections_qty CHECK (quantity >= 0)
);

CREATE INDEX idx_return_collections_stop ON return_collections (trip_stop_id);
CREATE INDEX idx_return_collections_customer ON return_collections (customer_id, created_at DESC);
```

---

# 7. FINANCE TABLES

## 7.1 receivable_ledger (Source of Truth cho Credit Check)

```sql
CREATE TABLE receivable_ledger (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    order_id        UUID REFERENCES sales_orders(id),
    payment_id      UUID REFERENCES payments(id),
    ledger_type     ledger_type NOT NULL,            -- 'debit' = ghi nợ, 'credit' = thu tiền
    amount          NUMERIC(15,2) NOT NULL,
    running_balance NUMERIC(15,2),                   -- Calculated trigger hoặc app-level
    description     TEXT,
    bravo_sync_status sync_status NOT NULL DEFAULT 'pending',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_receivable_ledger_amount CHECK (amount > 0)
);

-- Credit check query: SUM(CASE WHEN type='debit' THEN amount ELSE -amount END) WHERE customer_id = $1
CREATE INDEX idx_receivable_ledger_customer ON receivable_ledger (customer_id, created_at DESC);
-- Bravo sync batch
CREATE INDEX idx_receivable_ledger_sync ON receivable_ledger (bravo_sync_status)
    WHERE bravo_sync_status = 'pending';
```

---

# 8. RECONCILIATION TABLES

## 8.1 reconciliation_records

```sql
CREATE TABLE reconciliation_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id         UUID NOT NULL REFERENCES trips(id),
    reconciliation_date DATE NOT NULL,
    -- Hàng
    goods_expected  JSONB NOT NULL,                  -- [{product_id, qty}]
    goods_delivered JSONB NOT NULL,
    goods_returned  JSONB,
    goods_match     BOOLEAN NOT NULL,
    -- Tiền
    money_expected  NUMERIC(15,2) NOT NULL,
    money_collected NUMERIC(15,2) NOT NULL,
    money_credit    NUMERIC(15,2) NOT NULL DEFAULT 0,
    money_match     BOOLEAN NOT NULL,
    -- Vỏ
    assets_expected JSONB,
    assets_actual   JSONB,
    assets_match    BOOLEAN NOT NULL,
    -- Kết quả
    status          VARCHAR(20) NOT NULL DEFAULT 'reconciled',  -- 'reconciled' | 'discrepancy'
    reconciled_by   UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_reconciliation_trip UNIQUE (trip_id)
);

CREATE INDEX idx_reconciliation_date_status ON reconciliation_records (reconciliation_date, status);
```

## 8.2 discrepancy_tickets

```sql
CREATE TABLE discrepancy_tickets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number   VARCHAR(30) NOT NULL,
    reconciliation_id UUID NOT NULL REFERENCES reconciliation_records(id),
    trip_id         UUID NOT NULL REFERENCES trips(id),
    discrepancy_type discrepancy_type NOT NULL,       -- R06: hàng/tiền/vỏ
    status          discrepancy_status NOT NULL DEFAULT 'open',
    description     TEXT NOT NULL,
    amount          NUMERIC(15,2),                    -- Số tiền chênh lệch (nếu có)
    quantity        INTEGER,                          -- Số lượng chênh lệch
    responsible_party TEXT,                           -- Người chịu trách nhiệm
    deadline        DATE NOT NULL,                    -- R06: T+1
    resolved_notes  TEXT,
    resolved_by     UUID REFERENCES users(id),
    resolved_at     TIMESTAMPTZ,
    created_by      UUID NOT NULL REFERENCES users(id),  -- Kế toán mở
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_discrepancy_number UNIQUE (ticket_number)
);

-- T+1 deadline alerts
CREATE INDEX idx_discrepancy_open ON discrepancy_tickets (status, deadline)
    WHERE status IN ('open', 'in_progress');
CREATE INDEX idx_discrepancy_trip ON discrepancy_tickets (trip_id);
```

---

# 9. SYSTEM TABLES

## 9.1 users

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(50) NOT NULL,
    email           VARCHAR(200),
    password_hash   VARCHAR(200) NOT NULL,           -- bcrypt cost 12
    full_name       VARCHAR(100) NOT NULL,
    role            VARCHAR(30) NOT NULL,             -- admin, dvkh, dispatcher, fleet_manager, driver, warehouse, gate_guard, accountant, workshop, management
    permissions     TEXT[] NOT NULL DEFAULT '{}',
    warehouse_ids   UUID[] NOT NULL DEFAULT '{}',    -- Kho được phân quyền
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_users_username UNIQUE (username)
);

CREATE INDEX idx_users_role ON users (role) WHERE is_active = true;
```

## 9.2 devices (FCM tokens)

```sql
CREATE TABLE devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform        VARCHAR(10) NOT NULL,            -- 'ios' | 'android'
    fcm_token       TEXT NOT NULL,
    app_version     VARCHAR(20),
    last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_devices_token UNIQUE (fcm_token)
);

CREATE INDEX idx_devices_user ON devices (user_id);
```

## 9.3 notifications

```sql
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel         notification_channel NOT NULL DEFAULT 'web',
    type            VARCHAR(50) NOT NULL,            -- 'order_approval', 'ck_timeout', 'trip_completed', etc.
    title           VARCHAR(200) NOT NULL,
    body            TEXT NOT NULL,
    data            JSONB,                           -- Extra payload: {orderId, tripId, ...}
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unread count query
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user_all ON notifications (user_id, created_at DESC);
```

## 9.4 audit_logs (Append-only)

```sql
CREATE TABLE audit_logs (
    id              UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id         UUID,
    action          VARCHAR(50) NOT NULL,            -- 'create', 'update', 'delete', 'login', 'approve'
    entity          VARCHAR(50) NOT NULL,            -- 'sales_order', 'trip', 'payment', ...
    entity_id       UUID,
    old_data        JSONB,
    new_data        JSONB,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (created_at, id)
) PARTITION BY RANGE (created_at);

-- Monthly partitions (tương tự gps_locations)
CREATE TABLE audit_logs_2026_03 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE audit_logs_2026_04 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE audit_logs_2026_05 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE INDEX idx_audit_logs_entity ON audit_logs (entity, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs (user_id, created_at DESC);

-- Enforce append-only: block UPDATE/DELETE via trigger
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only. UPDATE and DELETE are forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
```

## 9.5 zalo_confirmations

```sql
CREATE TABLE zalo_confirmations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_attempt_id UUID NOT NULL REFERENCES delivery_attempts(id),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    token           UUID NOT NULL DEFAULT gen_random_uuid(),    -- Unique link token
    status          zalo_confirm_status NOT NULL DEFAULT 'sent',
    zns_message_id  VARCHAR(100),                    -- Zalo API response ID
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at    TIMESTAMPTZ,                     -- NPP bấm link
    auto_confirm_at TIMESTAMPTZ,                     -- sent_at + 24h
    dispute_items   JSONB,                           -- NPP báo sai lệch: [{product_id, expected, actual}]
    expires_at      TIMESTAMPTZ NOT NULL,            -- TTL 24h

    CONSTRAINT unq_zalo_token UNIQUE (token)
);

CREATE INDEX idx_zalo_confirmations_token ON zalo_confirmations (token) WHERE status = 'sent';
-- Auto-confirm cron: scan tokens hết 24h chưa phản hồi
CREATE INDEX idx_zalo_confirmations_auto ON zalo_confirmations (expires_at)
    WHERE status = 'sent';
```

## 9.6 integration_logs

```sql
CREATE TABLE integration_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name      VARCHAR(50) NOT NULL,            -- 'bravo:delivery', 'dms:status', 'zalo:confirm'
    job_id          VARCHAR(100),                    -- Asynq job ID
    reference_type  VARCHAR(30),                     -- 'order', 'trip', 'payment'
    reference_id    UUID,
    attempt         INTEGER NOT NULL DEFAULT 1,
    status          VARCHAR(20) NOT NULL,            -- 'success', 'failed', 'dlq'
    request_payload JSONB,
    response_payload JSONB,
    error_message   TEXT,
    duration_ms     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_logs_queue ON integration_logs (queue_name, status, created_at DESC);
CREATE INDEX idx_integration_logs_reference ON integration_logs (reference_type, reference_id);
CREATE INDEX idx_integration_logs_dlq ON integration_logs (status) WHERE status = 'dlq';
```

## 9.7 daily_kpi_snapshots

```sql
CREATE TABLE daily_kpi_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date   DATE NOT NULL,
    warehouse_id    UUID REFERENCES warehouses(id),  -- NULL = all warehouses
    kpi_type        VARCHAR(50) NOT NULL,            -- 'otd', 'empty_run', 'vehicle_utilization', etc.
    value           JSONB NOT NULL,                  -- {value: 95.5, unit: '%', breakdown: {...}}
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_kpi_snapshot UNIQUE (snapshot_date, warehouse_id, kpi_type)
);

CREATE INDEX idx_kpi_snapshots_date ON daily_kpi_snapshots (snapshot_date DESC, kpi_type);
```

---

# 10. PARTITIONING STRATEGY

| Table | Partition Key | Strategy | Retention |
|-------|-------------|----------|-----------|
| `gps_locations` | `recorded_at` | RANGE by month | 6 tháng online, archive 3 năm S3 |
| `audit_logs` | `created_at` | RANGE by month | 12 tháng online, archive 5 năm |
| `integration_logs` | — | Không partition (volume thấp) | 6 tháng |
| `notifications` | — | Không partition | 3 tháng, purge read > 3 tháng |

**Auto-partition (pg_partman hoặc cron job):**

```sql
-- Chạy đầu mỗi tháng: tạo partition tháng sau
-- Chạy cuối mỗi tháng: detach partition cũ > 6 tháng → pg_dump → upload S3 → DROP
```

---

# 11. MIGRATION PLAN

```
migrations/
├── 000001_create_extensions.up.sql
├── 000001_create_extensions.down.sql
├── 000002_create_enums.up.sql
├── 000002_create_enums.down.sql
├── 000003_create_master_data.up.sql          -- products, customers, vehicles, drivers, warehouses, routes
├── 000003_create_master_data.down.sql
├── 000004_create_system.up.sql               -- users, devices, notifications, audit_logs, system_configs
├── 000004_create_system.down.sql
├── 000005_create_oms.up.sql                  -- sales_orders, order_items, shipments
├── 000005_create_oms.down.sql
├── 000006_create_tms.up.sql                  -- trips, trip_stops, delivery_attempts, epods, payments, gps
├── 000006_create_tms.down.sql
├── 000007_create_wms.up.sql                  -- lots, stock_quants, stock_moves, picking, gate_checks, assets, returns
├── 000007_create_wms.down.sql
├── 000008_create_finance.up.sql              -- receivable_ledger, credit_limits, deposit_prices
├── 000008_create_finance.down.sql
├── 000009_create_reconciliation.up.sql       -- reconciliation_records, discrepancy_tickets
├── 000009_create_reconciliation.down.sql
├── 000010_create_integration.up.sql          -- zalo_confirmations, integration_logs, daily_kpi_snapshots
├── 000010_create_integration.down.sql
├── 000011_create_triggers.up.sql             -- audit_logs immutable trigger
├── 000011_create_triggers.down.sql
└── 000012_seed_system_configs.up.sql         -- Seed data
```

**Tool:** `golang-migrate` v4.x. CLI: `migrate -path migrations -database $DATABASE_URL up`

---

# 12. PERFORMANCE NOTES

| Concern | Solution |
|---------|----------|
| ATP query (realtime) | Cache Redis 30s. DB: composite index `(product_id, warehouse_id)` trên `stock_quants` |
| Credit check | Simple SUM query trên `receivable_ledger` — index `(customer_id)` đủ nhanh cho 800 NPP |
| GPS insert 200K/ngày | Partitioned table + batch insert (10 points/batch từ driver app) |
| Dashboard KPI | Pre-computed `daily_kpi_snapshots` — không aggregate realtime |
| Full-text search NPP | `pg_trgm` GIN index trên `customers.name` |
| Audit logs | Partitioned append-only. INSERT-only trigger. Không ảnh hưởng write performance |
| Order listing | Partial index trên active statuses. Avoid full table scan |
| VRP distance matrix | Pre-compute từ OSRM, cache trong Redis `osrm:matrix:{hash}` TTL 1 ngày |

---

**=== HẾT TÀI LIỆU DBS v1.0 ===**

*Database Schema Design v1.0 — 35+ tables, PostgreSQL 16, optimized for sqlc code generation.*
