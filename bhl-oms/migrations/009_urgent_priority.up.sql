-- 009: Add urgent delivery priority flag to shipments
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT false;

-- Index for priority-aware queries (urgent first)
CREATE INDEX IF NOT EXISTS idx_shipments_urgent ON shipments (is_urgent DESC, delivery_date);
