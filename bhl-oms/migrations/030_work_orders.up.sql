-- Migration 030: Work Orders (Repair Order Management)
-- US-TMS-31: Repair Order CRUD + approval workflow
-- ALTER vehicles: add health_score, last_health_check

-- Work Order status enum
DO $$ BEGIN
    CREATE TYPE work_order_status AS ENUM (
        'draft', 'quoted', 'approved', 'in_progress', 'completed', 'verified', 'cancelled'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Work Order trigger type
DO $$ BEGIN
    CREATE TYPE wo_trigger_type AS ENUM (
        'driver_report', 'predictive', 'scheduled', 'breakdown', 'inspection'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Work Order category
DO $$ BEGIN
    CREATE TYPE wo_category AS ENUM (
        'engine', 'brake', 'tyre', 'electrical', 'body', 'ac', 'transmission', 'other'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Work Order priority
DO $$ BEGIN
    CREATE TYPE wo_priority AS ENUM (
        'low', 'normal', 'high', 'emergency'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS work_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wo_number           VARCHAR(20)     NOT NULL UNIQUE,
    vehicle_id          UUID            NOT NULL REFERENCES vehicles(id),
    driver_id           UUID            REFERENCES drivers(id),
    garage_id           UUID,           -- FK added in migration 031
    trigger_type        wo_trigger_type NOT NULL DEFAULT 'driver_report',
    category            wo_category     NOT NULL DEFAULT 'other',
    priority            wo_priority     NOT NULL DEFAULT 'normal',
    description         TEXT,
    symptom_voice_url   TEXT,           -- voice-to-text mô tả
    status              work_order_status NOT NULL DEFAULT 'draft',
    quoted_amount       NUMERIC(15,2)   DEFAULT 0,
    actual_amount       NUMERIC(15,2)   DEFAULT 0,
    approved_by         UUID            REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    eta_completion      TIMESTAMPTZ,
    actual_completion   TIMESTAMPTZ,
    km_at_repair        INT,
    invoice_url         TEXT,
    is_emergency        BOOLEAN         NOT NULL DEFAULT false,
    is_recurring        BOOLEAN         NOT NULL DEFAULT false,
    rejection_reason    TEXT,
    created_by          UUID            NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_orders_vehicle ON work_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status) WHERE status NOT IN ('completed', 'verified', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_work_orders_created ON work_orders(created_at DESC);

-- Work Order line items
CREATE TABLE IF NOT EXISTS repair_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id   UUID            NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    item_type       VARCHAR(50)     NOT NULL DEFAULT 'labor', -- labor, part, consumable
    description     VARCHAR(500)    NOT NULL,
    quantity        INT             NOT NULL DEFAULT 1,
    unit_price      NUMERIC(15,2)  NOT NULL DEFAULT 0,
    total_price     NUMERIC(15,2)  NOT NULL DEFAULT 0,
    part_number     VARCHAR(100),
    warranty_km     INT,
    warranty_days   INT,
    spare_part_id   UUID,           -- future FK to spare_parts
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repair_items_wo ON repair_items(work_order_id);

-- Work Order attachments (photos, videos, invoices)
CREATE TABLE IF NOT EXISTS repair_attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id   UUID            NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    attachment_type VARCHAR(20)     NOT NULL DEFAULT 'photo', -- photo, video, invoice
    url             TEXT            NOT NULL,
    file_name       VARCHAR(255),
    file_size       INT,
    ocr_confidence  FLOAT,
    uploaded_by     UUID            NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repair_attach_wo ON repair_attachments(work_order_id);

-- ALTER vehicles: add health fields
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS health_score INT NOT NULL DEFAULT 100;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMPTZ;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_km INT DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS year_of_manufacture INT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(20) DEFAULT 'diesel';

-- Sequence for WO numbers
CREATE SEQUENCE IF NOT EXISTS wo_number_seq START 1;
