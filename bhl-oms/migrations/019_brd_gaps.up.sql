-- Migration 019: BRD Gap Closure
-- Adds: compensation_prices, forbidden_load_hours, delivery_window_configs, vehicle_maintenance

-- ═══════════════════════════════════════════════════════
-- 1. Compensation Price Table (GAP-04, BRD R10)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS asset_compensation_prices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_type      VARCHAR(50)     NOT NULL,  -- 'chai', 'ket', 'pallet', 'bom'
    unit_price      NUMERIC(15,2)   NOT NULL,
    effective_from  DATE            NOT NULL,
    effective_until DATE,
    notes           TEXT,
    created_by      UUID            REFERENCES users(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_prices_type_date
    ON asset_compensation_prices(asset_type, effective_from, effective_until);

-- Seed default prices
INSERT INTO asset_compensation_prices (asset_type, unit_price, effective_from, notes) VALUES
    ('chai', 5000, '2024-01-01', 'Default bottle compensation'),
    ('ket', 50000, '2024-01-01', 'Default crate compensation'),
    ('pallet', 200000, '2024-01-01', 'Default pallet compensation'),
    ('bom', 500000, '2024-01-01', 'Default keg compensation')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- 2. Load Forbidden Hours (GAP-06, BRD US-TMS-03)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS forbidden_load_hours (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_name       VARCHAR(100)    NOT NULL,  -- 'Khu vực A', 'Nội thành HL'
    day_of_week     INT,                       -- 0=Sun..6=Sat, NULL=every day
    start_time      TIME            NOT NULL,
    end_time        TIME            NOT NULL,
    vehicle_types   TEXT[],                    -- ['2.5T','5T'] or NULL=all
    reason          VARCHAR(255),
    is_active       BOOLEAN         NOT NULL DEFAULT true,
    created_by      UUID            REFERENCES users(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════
-- 3. Delivery Window Configs (GAP-07, BRD US-TMS-05)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS delivery_window_configs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    window_name         VARCHAR(50)     NOT NULL,  -- 'standard', 'peak_season'
    duration_minutes    INT             NOT NULL DEFAULT 60,
    effective_from      DATE            NOT NULL,
    effective_until     DATE,
    description         VARCHAR(500),
    created_by          UUID            REFERENCES users(id),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE(window_name, effective_from)
);

-- Seed default window
INSERT INTO delivery_window_configs (window_name, duration_minutes, effective_from, description) VALUES
    ('standard', 60, '2024-01-01', 'Default 1h delivery window')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- 4. Vehicle Maintenance Schedule (GAP-08, BRD US-TMS-21)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vehicle_maintenance_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id      UUID            NOT NULL REFERENCES vehicles(id),
    schedule_type   VARCHAR(50)     NOT NULL,  -- 'km_based', 'month_based'
    interval_km     INT,                       -- every 10000km
    interval_months INT,                       -- every 6 months
    description     VARCHAR(255),
    is_active       BOOLEAN         NOT NULL DEFAULT true,
    created_by      UUID            REFERENCES users(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_maintenance_records (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id              UUID            NOT NULL REFERENCES vehicles(id),
    schedule_id             UUID            REFERENCES vehicle_maintenance_schedules(id),
    maintenance_type        VARCHAR(100)    NOT NULL,  -- 'oil_change', 'tire_rotation', 'inspection'
    last_maintenance_date   DATE,
    last_maintenance_km     INT,
    next_due_date           DATE,
    next_due_km             INT,
    alert_days_before       INT             NOT NULL DEFAULT 7,
    status                  VARCHAR(20)     NOT NULL DEFAULT 'pending',  -- pending, completed, overdue
    notes                   TEXT,
    completed_at            TIMESTAMPTZ,
    completed_by            UUID            REFERENCES users(id),
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maint_records_vehicle ON vehicle_maintenance_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maint_records_due ON vehicle_maintenance_records(next_due_date) WHERE status = 'pending';
