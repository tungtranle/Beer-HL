-- Migration 037: WMS Phase 9 — Pallet (LPN) · Bin · QR Scan Log · Cycle Count
-- Decisions: DEC-WMS-01 (LPN layer), DEC-WMS-02 (FEFO-only), DEC-WMS-03 (Hybrid PDA+PWA),
--            DEC-WMS-04 (Bravo PENDING — KHÔNG có sync_status field)
-- Scope: chỉ quản lý số lượng vật lý, không cost/accounting.

-- ===== ENUM TYPES =====
DO $$ BEGIN CREATE TYPE pallet_status AS ENUM ('in_stock', 'reserved', 'picked', 'loaded', 'shipped', 'empty');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE bin_type AS ENUM ('storage', 'staging', 'dock', 'quarantine');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE cycle_count_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ===== BIN LOCATIONS (vị trí kho cụ thể, có QR cố định) =====
CREATE TABLE IF NOT EXISTS bin_locations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id            UUID NOT NULL REFERENCES warehouses(id),
    bin_code                VARCHAR(40) NOT NULL,
    zone                    VARCHAR(10),
    row_code                VARCHAR(10),
    level_code              VARCHAR(10),
    bin_type                bin_type NOT NULL DEFAULT 'storage',
    capacity_pallets        INTEGER NOT NULL DEFAULT 1 CHECK (capacity_pallets > 0),
    allowed_sku_categories  TEXT[],
    is_pickable             BOOLEAN NOT NULL DEFAULT true,
    velocity_class          CHAR(1) CHECK (velocity_class IS NULL OR velocity_class IN ('A','B','C')),
    qr_payload              TEXT NOT NULL,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_bin_locations_code UNIQUE (bin_code)
);

CREATE INDEX IF NOT EXISTS idx_bin_locations_warehouse ON bin_locations (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_bin_locations_pickable ON bin_locations (warehouse_id, is_pickable) WHERE is_pickable = true;

-- ===== PALLETS (License Plate Number) =====
-- WMS-05: 1 pallet = 1 lot duy nhất (không trộn) — đảm bảo FEFO chính xác
CREATE TABLE IF NOT EXISTS pallets (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lpn_code                VARCHAR(40) NOT NULL,
    warehouse_id            UUID NOT NULL REFERENCES warehouses(id),
    current_bin_id          UUID REFERENCES bin_locations(id),
    lot_id                  UUID NOT NULL REFERENCES lots(id),
    product_id              UUID NOT NULL REFERENCES products(id),
    qty                     INTEGER NOT NULL CHECK (qty >= 0),
    initial_qty             INTEGER NOT NULL CHECK (initial_qty > 0),
    status                  pallet_status NOT NULL DEFAULT 'in_stock',
    reserved_for_picking_id UUID REFERENCES picking_orders(id),
    qr_payload              TEXT NOT NULL,           -- GS1 SSCC string
    received_at             TIMESTAMPTZ NOT NULL,    -- audit / FIFO secondary key
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_pallets_lpn UNIQUE (lpn_code)
);

-- FEFO-friendly index: query in_stock pallets ordered by lot expiry via JOIN
CREATE INDEX IF NOT EXISTS idx_pallets_lot_status ON pallets (lot_id, status);
CREATE INDEX IF NOT EXISTS idx_pallets_warehouse_status ON pallets (warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_pallets_current_bin ON pallets (current_bin_id);
CREATE INDEX IF NOT EXISTS idx_pallets_received ON pallets (received_at DESC);

-- ===== QR SCAN LOG (immutable, append-only audit) =====
CREATE TABLE IF NOT EXISTS qr_scan_log (
    id              BIGSERIAL PRIMARY KEY,
    scan_type       VARCHAR(20) NOT NULL,   -- pallet | bin | asset | product
    qr_code         TEXT NOT NULL,
    action          VARCHAR(30) NOT NULL,   -- putaway | pick | load | count | gate_check | lookup
    context_type    VARCHAR(30),            -- picking_order | trip | cycle_count | inbound
    context_id      UUID,
    user_id         UUID NOT NULL REFERENCES users(id),
    warehouse_id    UUID REFERENCES warehouses(id),
    device_info     JSONB,                  -- {device_type: pda|phone, ua, ...}
    result          VARCHAR(20) NOT NULL,   -- ok | error_invalid | error_duplicate | error_mismatch
    error_msg       TEXT,
    scanned_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_scan_log_user_date ON qr_scan_log (user_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_scan_log_qr ON qr_scan_log (qr_code, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_scan_log_context ON qr_scan_log (context_type, context_id) WHERE context_id IS NOT NULL;

-- ===== CYCLE COUNT TASKS (ABC velocity-based) =====
CREATE TABLE IF NOT EXISTS cycle_count_tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id        UUID NOT NULL REFERENCES warehouses(id),
    bin_id              UUID NOT NULL REFERENCES bin_locations(id),
    scheduled_date      DATE NOT NULL,
    assigned_to         UUID REFERENCES users(id),
    status              cycle_count_status NOT NULL DEFAULT 'pending',
    expected_snapshot   JSONB,    -- snapshot LPNs + qty when task created
    counted_snapshot    JSONB,    -- LPNs + qty actually scanned
    variance            JSONB,    -- {missing: [...], extra: [...], qty_diff: [...]}
    discrepancy_id      UUID,     -- link to discrepancies table when variance != 0
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cycle_count_tasks_today ON cycle_count_tasks (warehouse_id, scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_cycle_count_tasks_assignee ON cycle_count_tasks (assigned_to, status) WHERE assigned_to IS NOT NULL;
