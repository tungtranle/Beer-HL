-- Rollback migration 003
DROP INDEX IF EXISTS idx_sales_orders_cutoff;
ALTER TABLE sales_orders DROP COLUMN IF EXISTS cutoff_group;
DROP TABLE IF EXISTS system_settings;
