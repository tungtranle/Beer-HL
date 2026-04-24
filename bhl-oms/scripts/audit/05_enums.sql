\pset pager off
\echo '=== ENUM VALUES ==='
SELECT t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) vals
FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname IN ('order_status','shipment_status','trip_status','stop_status',
                    'payment_method','payment_status','recon_type','recon_status',
                    'ledger_type','asset_type','asset_direction','asset_condition',
                    'sync_status','gate_check_result','vehicle_type')
GROUP BY t.typname ORDER BY t.typname;

\echo ''
\echo '=== CUSTOMERS distribution by route_code ==='
SELECT route_code, COUNT(*) FROM customers GROUP BY route_code ORDER BY 2 DESC LIMIT 20;

\echo ''
\echo '=== Customers used in orders by warehouse ==='
SELECT o.warehouse_id::text, COUNT(DISTINCT o.customer_id) customers, COUNT(*) orders
FROM sales_orders o GROUP BY o.warehouse_id;

\echo ''
\echo '=== Drivers by warehouse ==='
SELECT warehouse_id::text, COUNT(*) FROM drivers GROUP BY warehouse_id;

\echo ''
\echo '=== Vehicles by warehouse ==='
SELECT warehouse_id::text, COUNT(*) FROM vehicles GROUP BY warehouse_id;

\echo ''
\echo '=== Sample 2025 same period (Apr 1-23) vs missing 2026 period ==='
SELECT 'orders 2025-04-01..23' lbl, COUNT(*) n, SUM(total_amount)::text rev
FROM sales_orders WHERE delivery_date BETWEEN '2025-04-01' AND '2025-04-23'
UNION ALL SELECT 'orders 2026-04-01..23', COUNT(*), SUM(total_amount)::text
FROM sales_orders WHERE delivery_date BETWEEN '2026-04-01' AND '2026-04-23'
UNION ALL SELECT 'trips 2025-04-01..23', COUNT(*), NULL FROM trips WHERE planned_date BETWEEN '2025-04-01' AND '2025-04-23'
UNION ALL SELECT 'trips 2026-04-01..23', COUNT(*), NULL FROM trips WHERE planned_date BETWEEN '2026-04-01' AND '2026-04-23';

\echo ''
\echo '=== Sample order detail ==='
SELECT * FROM sales_orders WHERE delivery_date='2025-04-01' LIMIT 1;

\echo ''
\echo '=== users dispatcher/wh.handler/accountant id ==='
SELECT id::text, username, role::text FROM users WHERE role IN ('dispatcher','warehouse_handler','accountant','security');

\echo ''
\echo '=== drivers user_id mapping ==='
SELECT COUNT(*) total, COUNT(*) FILTER (WHERE user_id IS NOT NULL) with_user FROM drivers;
