\pset pager off
\echo '=== 1. ALL TABLES & ROW COUNT ==='
SELECT tablename,
       COALESCE((SELECT n_live_tup FROM pg_stat_user_tables WHERE schemaname='public' AND relname=tablename),0) AS rows
FROM pg_tables WHERE schemaname='public' ORDER BY rows DESC;

\echo ''
\echo '=== 2. TIMELINE per main table ==='
SELECT 'sales_orders' tbl, MIN(created_at)::date mn, MAX(created_at)::date mx, COUNT(*) n FROM sales_orders
UNION ALL SELECT 'shipments', MIN(created_at)::date, MAX(created_at)::date, COUNT(*) FROM shipments
UNION ALL SELECT 'trips(planned)', MIN(planned_date)::date, MAX(planned_date)::date, COUNT(*) FROM trips
UNION ALL SELECT 'trip_stops', MIN(created_at)::date, MAX(created_at)::date, COUNT(*) FROM trip_stops
UNION ALL SELECT 'payments', MIN(created_at)::date, MAX(created_at)::date, COUNT(*) FROM payments
UNION ALL SELECT 'daily_kpi_snapshots', MIN(snapshot_date)::date, MAX(snapshot_date)::date, COUNT(*) FROM daily_kpi_snapshots;
