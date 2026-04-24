DROP INDEX IF EXISTS idx_orders_urgent;
ALTER TABLE sales_orders DROP COLUMN IF EXISTS is_urgent;
