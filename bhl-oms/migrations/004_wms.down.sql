-- Rollback WMS migration 004

DROP TABLE IF EXISTS return_collections CASCADE;
DROP TABLE IF EXISTS asset_ledger CASCADE;
DROP TABLE IF EXISTS gate_checks CASCADE;
DROP TABLE IF EXISTS picking_orders CASCADE;
DROP TABLE IF EXISTS stock_moves CASCADE;

-- Remove products WMS columns
ALTER TABLE products DROP COLUMN IF EXISTS shelf_life_days;
ALTER TABLE products DROP COLUMN IF EXISTS expiry_threshold_pct;
ALTER TABLE products DROP COLUMN IF EXISTS barcode_prefix;

-- Remove warehouses WMS columns
ALTER TABLE warehouses DROP COLUMN IF EXISTS updated_at;
ALTER TABLE warehouses DROP COLUMN IF EXISTS asset_types;
ALTER TABLE warehouses DROP COLUMN IF EXISTS max_capacity;
ALTER TABLE warehouses DROP COLUMN IF EXISTS location_type;

DROP INDEX IF EXISTS idx_warehouses_path_gist;

-- Drop WMS enum types
DROP TYPE IF EXISTS sync_status;
DROP TYPE IF EXISTS picking_status;
DROP TYPE IF EXISTS gate_check_result;
DROP TYPE IF EXISTS asset_direction;
DROP TYPE IF EXISTS asset_condition;
DROP TYPE IF EXISTS asset_type;
DROP TYPE IF EXISTS stock_move_type;
