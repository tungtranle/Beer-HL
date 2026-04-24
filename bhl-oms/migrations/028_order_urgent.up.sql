-- Migration 028: Add is_urgent to sales_orders
-- Propagate urgent flag from order creation through to shipment

ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_orders_urgent ON sales_orders (is_urgent DESC, delivery_date);
