-- Rollback: Remove urgent delivery priority flag
DROP INDEX IF EXISTS idx_shipments_urgent;
ALTER TABLE shipments DROP COLUMN IF EXISTS is_urgent;
