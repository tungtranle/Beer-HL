\pset pager off

\echo '=== 1. STOPS PER TRIP DISTRIBUTION ==='
SELECT
  MIN(c) min_stops, MAX(c) max_stops,
  ROUND(AVG(c)::numeric,2) avg_stops,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c) p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY c) p95
FROM (SELECT trip_id, COUNT(*) c FROM trip_stops GROUP BY trip_id) x;

\echo ''
\echo '=== 2. TOTAL REVENUE in sales_orders ==='
SELECT COUNT(*) orders,
       SUM(total_amount)::text grand_total,
       ROUND(AVG(total_amount)::numeric,0)::text avg_order,
       MIN(total_amount)::text min_order,
       MAX(total_amount)::text max_order
FROM sales_orders;

\echo ''
\echo '=== 3. KPI SNAPSHOTS METRIC REALISM ==='
SELECT
  ROUND(AVG(otd_rate)::numeric,2) avg_otd,
  MIN(otd_rate) min_otd, MAX(otd_rate) max_otd,
  ROUND(AVG(vehicle_utilization)::numeric,2) avg_veh_util,
  ROUND(AVG(total_revenue)::numeric,0)::text avg_revenue,
  ROUND(AVG(cash_collected)::numeric,0)::text avg_cash,
  COUNT(*) FILTER (WHERE failed_deliveries > 0) days_with_failures,
  COUNT(*) total_snaps
FROM daily_kpi_snapshots;

\echo ''
\echo '=== 4. SALES_ORDER DAILY DISTRIBUTION (last 14 days) ==='
SELECT created_at::date d, COUNT(*) n, SUM(total_amount)::text revenue
FROM sales_orders WHERE created_at >= '2026-03-17'
GROUP BY d ORDER BY d;

\echo ''
\echo '=== 5. ORPHAN CHECKS ==='
SELECT 'orders w/o shipment' label,
       (SELECT COUNT(*) FROM sales_orders o LEFT JOIN shipments s ON s.order_id=o.id WHERE s.id IS NULL) n
UNION ALL
SELECT 'shipments w/o trip_stop',
       (SELECT COUNT(*) FROM shipments s LEFT JOIN trip_stops ts ON ts.shipment_id=s.id WHERE ts.id IS NULL)
UNION ALL
SELECT 'trips w/o stops',
       (SELECT COUNT(*) FROM trips t LEFT JOIN trip_stops ts ON ts.trip_id=t.id WHERE ts.id IS NULL)
UNION ALL
SELECT 'trips w/o driver',
       (SELECT COUNT(*) FROM trips WHERE driver_id IS NULL)
UNION ALL
SELECT 'trips w/o vehicle',
       (SELECT COUNT(*) FROM trips WHERE vehicle_id IS NULL);

\echo ''
\echo '=== 6. NEGATIVE / ZERO VALUE CHECKS ==='
SELECT 'trips distance=0' label, COUNT(*) FROM trips WHERE total_distance_km = 0
UNION ALL SELECT 'trips weight=0', COUNT(*) FROM trips WHERE total_weight_kg = 0
UNION ALL SELECT 'orders amount<=0', COUNT(*) FROM sales_orders WHERE total_amount <= 0
UNION ALL SELECT 'trips negative dist', COUNT(*) FROM trips WHERE total_distance_km < 0;

\echo ''
\echo '=== 7. CUSTOMERS lat/lon completeness ==='
SELECT COUNT(*) total,
       COUNT(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL) with_coords,
       COUNT(*) FILTER (WHERE warehouse_id IS NOT NULL) with_warehouse
FROM customers;

\echo ''
\echo '=== 8. WAREHOUSE LIST ==='
SELECT id::text, name FROM warehouses;

\echo ''
\echo '=== 9. TRIPS BY DRIVER (top 10 + p95) ==='
SELECT d.full_name, d.code, COUNT(t.*) trips
FROM drivers d LEFT JOIN trips t ON t.driver_id = d.id
GROUP BY d.id, d.full_name, d.code ORDER BY trips DESC LIMIT 10;

\echo ''
\echo '=== 10. trips_per_driver_per_day p95/max ==='
SELECT MAX(c) max_per_day,
       PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY c) p95
FROM (SELECT driver_id, planned_date, COUNT(*) c FROM trips WHERE driver_id IS NOT NULL GROUP BY 1,2) x;
