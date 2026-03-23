-- Migration 010: Phase 6 — Workshop role + bottle classification + chief accountant flag
-- Task 6.4: Workshop role for phân xưởng
-- Task 6.5: Bottle reconciliation per trip
-- Task 6.16: Chief accountant flag

-- Add workshop to valid roles (role is stored as text, no enum to alter)
-- Add is_chief_accountant flag for KT Trưởng (Task 6.16)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_chief_accountant BOOLEAN NOT NULL DEFAULT false;

-- Bottle classification table for workshop
CREATE TABLE IF NOT EXISTS bottle_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id),
    trip_number TEXT NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL DEFAULT '',
    bottles_sent INT NOT NULL DEFAULT 0,
    bottles_returned_good INT NOT NULL DEFAULT 0,
    bottles_returned_damaged INT NOT NULL DEFAULT 0,
    bottles_missing INT NOT NULL DEFAULT 0,
    notes TEXT,
    classified_by UUID REFERENCES users(id),
    classified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bottle_class_trip ON bottle_classifications(trip_id);
CREATE INDEX IF NOT EXISTS idx_bottle_class_product ON bottle_classifications(product_id);
