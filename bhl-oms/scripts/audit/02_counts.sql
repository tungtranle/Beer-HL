\pset pager off
ANALYZE;

\echo '=== 1. ACTUAL ROW COUNTS (post-ANALYZE) ==='
SELECT 'users' tbl, COUNT(*) n FROM users
UNION ALL SELECT 'drivers', COUNT(*) FROM drivers
UNION ALL SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL SELECT 'warehouses', COUNT(*) FROM warehouses
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'sales_orders', COUNT(*) FROM sales_orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'shipments', COUNT(*) FROM shipments
UNION ALL SELECT 'trips', COUNT(*) FROM trips
UNION ALL SELECT 'trip_stops', COUNT(*) FROM trip_stops
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'delivery_attempts', COUNT(*) FROM delivery_attempts
UNION ALL SELECT 'epod', COUNT(*) FROM epod
UNION ALL SELECT 'driver_checkins', COUNT(*) FROM driver_checkins
UNION ALL SELECT 'eod_sessions', COUNT(*) FROM eod_sessions
UNION ALL SELECT 'reconciliations', COUNT(*) FROM reconciliations
UNION ALL SELECT 'return_collections', COUNT(*) FROM return_collections
UNION ALL SELECT 'daily_kpi_snapshots', COUNT(*) FROM daily_kpi_snapshots
UNION ALL SELECT 'driver_scores', COUNT(*) FROM driver_scores
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'driver_cost_rates', COUNT(*) FROM driver_cost_rates
UNION ALL SELECT 'vehicle_cost_profiles', COUNT(*) FROM vehicle_cost_profiles
UNION ALL SELECT 'vehicle_type_cost_defaults', COUNT(*) FROM vehicle_type_cost_defaults
UNION ALL SELECT 'driver_documents', COUNT(*) FROM driver_documents
UNION ALL SELECT 'vehicle_documents', COUNT(*) FROM vehicle_documents
UNION ALL SELECT 'asset_ledger', COUNT(*) FROM asset_ledger
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
ORDER BY n DESC;

\echo ''
\echo '=== 2. ORDER STATUS DISTRIBUTION ==='
SELECT status::text, COUNT(*) n FROM sales_orders GROUP BY status ORDER BY n DESC;

\echo ''
\echo '=== 3. TRIP STATUS DISTRIBUTION ==='
SELECT status::text, COUNT(*) n FROM trips GROUP BY status ORDER BY n DESC;

\echo ''
\echo '=== 4. TRIPS NOT COMPLETED BEFORE 2026-04-24 (RED FLAG if any) ==='
SELECT status::text, COUNT(*) n,
       MIN(planned_date)::text mn, MAX(planned_date)::text mx
FROM trips
WHERE planned_date < '2026-04-24' AND status::text NOT IN ('completed','cancelled','reconciled')
GROUP BY status ORDER BY n DESC;

\echo ''
\echo '=== 5. SHIPMENT STATUS ==='
SELECT status::text, COUNT(*) n FROM shipments GROUP BY status ORDER BY n DESC;

\echo ''
\echo '=== 6. TRIP_STOPS STATUS ==='
SELECT status::text, COUNT(*) n FROM trip_stops GROUP BY status ORDER BY n DESC;

\echo ''
\echo '=== 7. USERS BY ROLE ==='
SELECT role::text, COUNT(*) n, COUNT(*) FILTER (WHERE is_active) act FROM users GROUP BY role ORDER BY n DESC;

\echo ''
\echo '=== 8. DATA GAPS — last 30 days of trips ==='
SELECT planned_date::text, COUNT(*) trips FROM trips
WHERE planned_date >= '2026-03-25'
GROUP BY planned_date ORDER BY planned_date;

\echo ''
\echo '=== 9. DATA GAPS — last KPI snapshot dates ==='
SELECT snapshot_date::text, COUNT(*) snaps FROM daily_kpi_snapshots
WHERE snapshot_date >= '2026-03-20'
GROUP BY snapshot_date ORDER BY snapshot_date;

\echo ''
\echo '=== 10. WEEKEND CHECK — trips on Sat/Sun ==='
SELECT EXTRACT(DOW FROM planned_date)::int dow, COUNT(*) n
FROM trips GROUP BY dow ORDER BY dow;
