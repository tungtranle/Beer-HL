-- ============================================================
-- BHL OMS — RESET TEST DATA
-- Xóa toàn bộ dữ liệu test (đơn hàng, trips, payments...)
-- GIỮ LẠI: NPP, sản phẩm, kho, tồn kho, xe, tài xế
--
-- Cách chạy:
--   docker cp ./migrations/reset_test_data.sql bhl-oms-postgres-1:/tmp/
--   docker exec bhl-oms-postgres-1 psql -U bhl -d bhl_dev -f /tmp/reset_test_data.sql
-- ============================================================

BEGIN;

-- Level 1: Leaf tables (no other table references these)
DELETE FROM discrepancies;
DELETE FROM payments;
DELETE FROM return_collections;
DELETE FROM zalo_confirmations;
DELETE FROM order_confirmations;
DELETE FROM audit_logs;
DELETE FROM notifications;
DELETE FROM daily_kpi_snapshots;
DELETE FROM daily_close_summaries;
DELETE FROM integration_dlq;
DELETE FROM driver_checkins;
DELETE FROM asset_ledger;
DELETE FROM delivery_routes;

-- Level 2: Referenced by level 1
DELETE FROM epod;
DELETE FROM gate_checks;
DELETE FROM picking_orders;
DELETE FROM reconciliations;
DELETE FROM trip_checklists;

-- Level 3+: Parent tables
DELETE FROM trip_stops;
DELETE FROM trips;
DELETE FROM shipments;
DELETE FROM order_items;
DELETE FROM receivable_ledger;
DELETE FROM stock_moves;
DELETE FROM sales_orders;

-- 9. Reset reserved_qty về 0
UPDATE stock_quants SET reserved_qty = 0;

COMMIT;

-- Kiểm tra kết quả
SELECT 'sales_orders' AS tbl, count(*) FROM sales_orders
UNION ALL SELECT 'trips', count(*) FROM trips
UNION ALL SELECT 'order_confirmations', count(*) FROM order_confirmations
UNION ALL SELECT 'stock_quants', count(*) FROM stock_quants
UNION ALL SELECT 'customers', count(*) FROM customers
UNION ALL SELECT 'products', count(*) FROM products;
