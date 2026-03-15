-- WMS Migration: Inbound, Picking, Gate Check, Assets
-- Tables: stock_moves, picking_orders, gate_checks, asset_ledger, return_collections
-- Also: warehouses upgrades, products WMS columns, new enum types

-- ===== WMS ENUM TYPES =====
DO $$ BEGIN CREATE TYPE stock_move_type AS ENUM ('inbound', 'outbound', 'transfer', 'adjustment', 'return_inbound');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE asset_type AS ENUM ('bottle', 'crate', 'keg', 'pallet', 'ccdc');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE asset_condition AS ENUM ('good', 'damaged', 'lost');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE asset_direction AS ENUM ('out', 'in');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE gate_check_result AS ENUM ('pass', 'fail');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE picking_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE sync_status AS ENUM ('pending', 'synced', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ===== WAREHOUSES: add WMS columns =====
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS location_type VARCHAR(20) NOT NULL DEFAULT 'warehouse';
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS max_capacity INTEGER;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS asset_types VARCHAR(50)[];
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add GIST index for LTREE hierarchy queries
CREATE INDEX IF NOT EXISTS idx_warehouses_path_gist ON warehouses USING gist (path);

-- ===== PRODUCTS: add WMS columns =====
ALTER TABLE products ADD COLUMN IF NOT EXISTS shelf_life_days INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_threshold_pct NUMERIC(5,2) NOT NULL DEFAULT 33;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode_prefix VARCHAR(20);

-- ===== STOCK MOVES (inbound/outbound receipts) =====
CREATE TABLE IF NOT EXISTS stock_moves (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    move_number     VARCHAR(30) NOT NULL,
    move_type       stock_move_type NOT NULL,
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    reference_type  VARCHAR(30),
    reference_id    UUID,
    items           JSONB NOT NULL,
    total_items     INTEGER NOT NULL,
    notes           TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_stock_moves_number UNIQUE (move_number)
);

CREATE INDEX IF NOT EXISTS idx_stock_moves_reference ON stock_moves (reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_moves_wh_date ON stock_moves (warehouse_id, created_at DESC);

-- ===== PICKING ORDERS =====
CREATE TABLE IF NOT EXISTS picking_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pick_number     VARCHAR(30) NOT NULL,
    shipment_id     UUID NOT NULL REFERENCES shipments(id),
    warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
    status          picking_status NOT NULL DEFAULT 'pending',
    items           JSONB NOT NULL,
    assigned_to     UUID REFERENCES users(id),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_picking_orders_number UNIQUE (pick_number)
);

CREATE INDEX IF NOT EXISTS idx_picking_orders_shipment ON picking_orders (shipment_id);
CREATE INDEX IF NOT EXISTS idx_picking_orders_status ON picking_orders (status, warehouse_id) WHERE status IN ('pending', 'in_progress');

-- ===== GATE CHECKS =====
CREATE TABLE IF NOT EXISTS gate_checks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id         UUID NOT NULL REFERENCES trips(id),
    shipment_id     UUID NOT NULL REFERENCES shipments(id),
    expected_items  JSONB NOT NULL,
    scanned_items   JSONB NOT NULL,
    result          gate_check_result NOT NULL,
    discrepancy_details JSONB,
    checked_by      UUID NOT NULL REFERENCES users(id),
    exit_time       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_gate_checks_trip_shipment UNIQUE (trip_id, shipment_id)
);

CREATE INDEX IF NOT EXISTS idx_gate_checks_trip ON gate_checks (trip_id);

-- ===== ASSET LEDGER =====
CREATE TABLE IF NOT EXISTS asset_ledger (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    asset_type      asset_type NOT NULL,
    direction       asset_direction NOT NULL,
    quantity        INTEGER NOT NULL,
    condition       asset_condition NOT NULL DEFAULT 'good',
    reference_type  VARCHAR(30) NOT NULL,
    reference_id    UUID NOT NULL,
    notes           TEXT,
    bravo_sync_status sync_status NOT NULL DEFAULT 'pending',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_asset_ledger_qty CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_asset_ledger_customer ON asset_ledger (customer_id, asset_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_ledger_sync ON asset_ledger (bravo_sync_status) WHERE bravo_sync_status = 'pending';

-- ===== RETURN COLLECTIONS =====
CREATE TABLE IF NOT EXISTS return_collections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_stop_id    UUID NOT NULL REFERENCES trip_stops(id),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    asset_type      asset_type NOT NULL,
    quantity        INTEGER NOT NULL,
    condition       asset_condition NOT NULL,
    photo_url       TEXT,
    workshop_confirmed_qty INTEGER,
    workshop_confirmed_by UUID REFERENCES users(id),
    workshop_confirmed_at TIMESTAMPTZ,
    discrepancy_qty INTEGER GENERATED ALWAYS AS (
        CASE WHEN workshop_confirmed_qty IS NOT NULL
             THEN quantity - workshop_confirmed_qty
             ELSE NULL
        END
    ) STORED,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_return_collections_qty CHECK (quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_return_collections_stop ON return_collections (trip_stop_id);
CREATE INDEX IF NOT EXISTS idx_return_collections_customer ON return_collections (customer_id, created_at DESC);
