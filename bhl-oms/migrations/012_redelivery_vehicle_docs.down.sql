-- Migration 012 down: Remove re-delivery and vehicle document tables

ALTER TABLE sales_orders DROP COLUMN IF EXISTS original_order_id;
ALTER TABLE sales_orders DROP COLUMN IF EXISTS re_delivery_count;
ALTER TABLE vehicles DROP COLUMN IF EXISTS supplier_name;
ALTER TABLE vehicles DROP COLUMN IF EXISTS is_external;

DROP TABLE IF EXISTS driver_documents;
DROP TABLE IF EXISTS vehicle_documents;
DROP TABLE IF EXISTS delivery_attempts;
