-- Migration 020: Cost Engine for VRP Optimization
-- Adds: toll stations, expressways, vehicle cost profiles, driver cost rates
-- BRD: US-TMS-01d (Cost-based VRP), US-TMS-01e (Toll/fuel configuration)

-- ═══════════════════════════════════════════════════════
-- 1. Toll Stations (Trạm thu phí hở)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS toll_stations (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_name       VARCHAR(200) NOT NULL,
    road_name          VARCHAR(100),
    toll_type          VARCHAR(20) NOT NULL DEFAULT 'open'
                       CHECK (toll_type IN ('open')),
    latitude           DOUBLE PRECISION NOT NULL,
    longitude          DOUBLE PRECISION NOT NULL,
    detection_radius_m INT NOT NULL DEFAULT 200,
    fee_l1             NUMERIC(15,2) NOT NULL DEFAULT 0,
    fee_l2             NUMERIC(15,2) NOT NULL DEFAULT 0,
    fee_l3             NUMERIC(15,2) NOT NULL DEFAULT 0,
    fee_l4             NUMERIC(15,2) NOT NULL DEFAULT 0,
    fee_l5             NUMERIC(15,2) NOT NULL DEFAULT 0,
    is_active          BOOLEAN NOT NULL DEFAULT true,
    effective_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_toll_stations_active
    ON toll_stations(is_active) WHERE is_active = true;

-- ═══════════════════════════════════════════════════════
-- 2. Toll Expressways (Cao tốc kín — tính phí theo km)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS toll_expressways (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expressway_name    VARCHAR(200) NOT NULL,
    rate_per_km_l1     NUMERIC(10,2) NOT NULL DEFAULT 0,
    rate_per_km_l2     NUMERIC(10,2) NOT NULL DEFAULT 0,
    rate_per_km_l3     NUMERIC(10,2) NOT NULL DEFAULT 0,
    rate_per_km_l4     NUMERIC(10,2) NOT NULL DEFAULT 0,
    rate_per_km_l5     NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_active          BOOLEAN NOT NULL DEFAULT true,
    effective_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS toll_expressway_gates (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expressway_id      UUID NOT NULL REFERENCES toll_expressways(id) ON DELETE CASCADE,
    gate_name          VARCHAR(200) NOT NULL,
    gate_type          VARCHAR(20) NOT NULL DEFAULT 'entry_exit'
                       CHECK (gate_type IN ('entry_exit', 'entry_only', 'exit_only')),
    km_marker          NUMERIC(8,2) NOT NULL,
    latitude           DOUBLE PRECISION NOT NULL,
    longitude          DOUBLE PRECISION NOT NULL,
    detection_radius_m INT NOT NULL DEFAULT 300,
    is_active          BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exway_gates_expressway
    ON toll_expressway_gates(expressway_id);

-- ═══════════════════════════════════════════════════════
-- 3. Vehicle Type → Cost Defaults (fallback)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vehicle_type_cost_defaults (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_type            VARCHAR(20) NOT NULL UNIQUE,
    toll_class              VARCHAR(5) NOT NULL
                            CHECK (toll_class IN ('L1','L2','L3','L4','L5')),
    fuel_consumption_per_km NUMERIC(6,3) NOT NULL,
    fuel_price_per_liter    NUMERIC(10,2) NOT NULL,
    is_active               BOOLEAN NOT NULL DEFAULT true,
    effective_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════
-- 4. Vehicle Cost Profiles (per-vehicle override — xe cũ vs mới)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vehicle_cost_profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id              UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    toll_class              VARCHAR(5) NOT NULL
                            CHECK (toll_class IN ('L1','L2','L3','L4','L5')),
    fuel_consumption_per_km NUMERIC(6,3) NOT NULL,
    fuel_price_per_liter    NUMERIC(10,2) NOT NULL,
    is_active               BOOLEAN NOT NULL DEFAULT true,
    effective_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(vehicle_id)
);

-- ═══════════════════════════════════════════════════════
-- 5. Driver Cost Rates
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS driver_cost_rates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_name       VARCHAR(100) NOT NULL,
    rate_type       VARCHAR(30) NOT NULL
                    CHECK (rate_type IN ('daily_salary', 'per_trip', 'per_km', 'overtime_hourly')),
    amount          NUMERIC(15,2) NOT NULL,
    vehicle_type    VARCHAR(20),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    effective_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════
-- 6. Seed Data — Vehicle Type Cost Defaults
-- ═══════════════════════════════════════════════════════

INSERT INTO vehicle_type_cost_defaults (vehicle_type, toll_class, fuel_consumption_per_km, fuel_price_per_liter, notes) VALUES
    ('truck_3t5', 'L2', 0.120, 22000, 'Xe 3.5 tấn — tiêu chuẩn'),
    ('truck_5t',  'L3', 0.180, 22000, 'Xe 5 tấn — tiêu chuẩn'),
    ('truck_8t',  'L3', 0.220, 22000, 'Xe 8 tấn — tiêu chuẩn'),
    ('truck_15t', 'L4', 0.300, 22000, 'Xe 15 tấn — tiêu chuẩn')
ON CONFLICT (vehicle_type) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- 7. Seed Data — Toll Stations (Quảng Ninh / Hải Phòng area)
--    ⚠️ GPS tọa độ ước lượng — cần xác minh thực tế
-- ═══════════════════════════════════════════════════════

INSERT INTO toll_stations (station_name, road_name, latitude, longitude, fee_l1, fee_l2, fee_l3, fee_l4, fee_l5, notes) VALUES
    ('Trạm Đại Yên',     'QL18',  20.9556, 107.0103, 15000, 25000, 40000, 80000, 120000, 'Gần Hạ Long, trên QL18'),
    ('Trạm Bắc Phả',     'QL18',  20.9417, 106.7533, 15000, 25000, 40000, 80000, 120000, 'Giữa Uông Bí và Đông Triều'),
    ('Trạm Biên Cương',   'QL18',  21.3222, 107.3472, 20000, 30000, 50000, 100000, 150000, 'Gần Móng Cái'),
    ('Trạm Quảng Yên',    'QL10',  20.9342, 106.8150, 10000, 20000, 30000, 60000,  90000, 'QL10 đoạn Quảng Yên'),
    ('Trạm An Dương',     'QL5',   20.8900, 106.5800, 15000, 25000, 40000, 80000, 120000, 'QL5 Hải Phòng'),
    ('Trạm Phù Lỗ',      'QL3',   21.2000, 105.8900, 10000, 20000, 30000, 60000,  90000, 'QL3 Hà Nội - Thái Nguyên'),
    ('Trạm cầu Bãi Cháy', 'QL18', 20.9530, 107.0700, 10000, 15000, 25000, 50000,  80000, 'Cầu Bãi Cháy QL18')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- 8. Seed Data — Toll Expressways
-- ═══════════════════════════════════════════════════════

INSERT INTO toll_expressways (expressway_name, rate_per_km_l1, rate_per_km_l2, rate_per_km_l3, rate_per_km_l4, rate_per_km_l5, notes) VALUES
    ('CT Hà Nội - Hải Phòng',   1400, 2000, 2800, 4200, 6000, '105km, VIDIFI vận hành'),
    ('CT Hải Phòng - Quảng Ninh', 1050, 1500, 2100, 3200, 4500, '25km, nối QL18 với CT HN-HP'),
    ('CT Hà Nội - Lào Cai',      1050, 1500, 2100, 3200, 4500, '265km, VEC vận hành'),
    ('CT Cầu Giẽ - Ninh Bình',   1050, 1500, 2100, 3200, 4500, '50km'),
    ('CT Bắc Giang - Lạng Sơn',  1400, 2100, 2900, 4400, 6300, '64km')
ON CONFLICT DO NOTHING;

-- Seed gates for CT Hà Nội - Hải Phòng (minh họa)
INSERT INTO toll_expressway_gates (expressway_id, gate_name, km_marker, latitude, longitude)
SELECT id, 'Nút giao Đình Vũ (HP)', 0, 20.8304, 106.7247
FROM toll_expressways WHERE expressway_name = 'CT Hà Nội - Hải Phòng'
ON CONFLICT DO NOTHING;

INSERT INTO toll_expressway_gates (expressway_id, gate_name, km_marker, latitude, longitude)
SELECT id, 'Nút giao Quốc Oai (HN)', 105, 20.9890, 105.6600
FROM toll_expressways WHERE expressway_name = 'CT Hà Nội - Hải Phòng'
ON CONFLICT DO NOTHING;

INSERT INTO toll_expressway_gates (expressway_id, gate_name, km_marker, latitude, longitude)
SELECT id, 'IC Hưng Yên', 52, 20.8400, 106.1000
FROM toll_expressways WHERE expressway_name = 'CT Hà Nội - Hải Phòng'
ON CONFLICT DO NOTHING;

INSERT INTO toll_expressway_gates (expressway_id, gate_name, km_marker, latitude, longitude)
SELECT id, 'IC Hải Dương', 73, 20.8600, 106.3300
FROM toll_expressways WHERE expressway_name = 'CT Hà Nội - Hải Phòng'
ON CONFLICT DO NOTHING;

-- Seed gates for CT Hải Phòng - Quảng Ninh
INSERT INTO toll_expressway_gates (expressway_id, gate_name, km_marker, latitude, longitude)
SELECT id, 'Nút giao Đình Vũ (HP)', 0, 20.8304, 106.7247
FROM toll_expressways WHERE expressway_name = 'CT Hải Phòng - Quảng Ninh'
ON CONFLICT DO NOTHING;

INSERT INTO toll_expressway_gates (expressway_id, gate_name, km_marker, latitude, longitude)
SELECT id, 'Nút giao Hạ Long', 25, 20.9400, 107.0200
FROM toll_expressways WHERE expressway_name = 'CT Hải Phòng - Quảng Ninh'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- 9. Seed Data — Driver Cost Rates (default)
-- ═══════════════════════════════════════════════════════

INSERT INTO driver_cost_rates (rate_name, rate_type, amount, vehicle_type, notes) VALUES
    ('Lương tài xế cơ bản',    'daily_salary',   400000, NULL,        'Áp dụng tất cả loại xe'),
    ('Phụ cấp theo chuyến',    'per_trip',        100000, NULL,        'Áp dụng tất cả loại xe'),
    ('Phụ cấp theo km',        'per_km',           500,    NULL,        'Áp dụng tất cả loại xe'),
    ('Phụ cấp xe 15 tấn',      'per_trip',        150000, 'truck_15t', 'Phụ cấp thêm cho xe lớn'),
    ('Làm thêm giờ',           'overtime_hourly', 50000,  NULL,        'Sau 8h/chuyến')
ON CONFLICT DO NOTHING;
