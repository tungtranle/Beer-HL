-- Migration 012: Re-delivery tracking + Vehicle document management
-- Adds delivery attempt tracking and vehicle/driver document expiry management

-- ===== DELIVERY ATTEMPTS — Track re-deliveries per order =====
CREATE TABLE IF NOT EXISTS delivery_attempts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id         UUID NOT NULL REFERENCES sales_orders(id),
    attempt_number   INT NOT NULL DEFAULT 1,
    shipment_id      UUID REFERENCES shipments(id),
    previous_stop_id UUID REFERENCES trip_stops(id),
    previous_status  VARCHAR(30),              -- 'rejected', 'failed', 'partial'
    previous_reason  TEXT,                      -- reason from last failure
    status           VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, assigned, delivered, failed
    created_by       UUID REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ
);

CREATE INDEX idx_delivery_attempts_order ON delivery_attempts (order_id, attempt_number);
CREATE INDEX idx_delivery_attempts_status ON delivery_attempts (status) WHERE status = 'pending';

COMMENT ON TABLE delivery_attempts IS 'Tracks each delivery attempt for re-delivery orders (R05, US-TMS-14b)';

-- ===== VEHICLE DOCUMENTS — Track registration, inspection, insurance =====
CREATE TABLE IF NOT EXISTS vehicle_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id      UUID NOT NULL REFERENCES vehicles(id),
    doc_type        VARCHAR(30) NOT NULL,       -- 'registration', 'inspection', 'insurance'
    doc_number      VARCHAR(100),
    issued_date     DATE,
    expiry_date     DATE NOT NULL,
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicle_docs_vehicle ON vehicle_documents (vehicle_id);
CREATE INDEX idx_vehicle_docs_expiry ON vehicle_documents (expiry_date) WHERE expiry_date IS NOT NULL;
CREATE UNIQUE INDEX idx_vehicle_docs_unique_type ON vehicle_documents (vehicle_id, doc_type);

COMMENT ON TABLE vehicle_documents IS 'Vehicle document tracking: registration, inspection, insurance with expiry dates';

-- ===== DRIVER DOCUMENTS — Track license expiry =====
CREATE TABLE IF NOT EXISTS driver_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id       UUID NOT NULL REFERENCES drivers(id),
    doc_type        VARCHAR(30) NOT NULL,       -- 'license', 'health_check'
    doc_number      VARCHAR(100),
    issued_date     DATE,
    expiry_date     DATE NOT NULL,
    license_class   VARCHAR(10),                -- 'B2', 'C', 'D', 'E'
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_driver_docs_driver ON driver_documents (driver_id);
CREATE INDEX idx_driver_docs_expiry ON driver_documents (expiry_date) WHERE expiry_date IS NOT NULL;
CREATE UNIQUE INDEX idx_driver_docs_unique_type ON driver_documents (driver_id, doc_type);

COMMENT ON TABLE driver_documents IS 'Driver document tracking: license, health check with expiry dates';

-- Add is_external flag to vehicles for thuê ngoài
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_external BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(200);

-- Add re_delivery_count to sales_orders for quick lookup
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS re_delivery_count INT NOT NULL DEFAULT 0;
-- Track the original order for re-deliveries
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS original_order_id UUID REFERENCES sales_orders(id);
