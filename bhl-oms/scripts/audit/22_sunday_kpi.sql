-- ===================================================================
-- PHASE 2C: Reduce Sunday trips â€” shift 80% to Sat/Mon
-- PHASE 2B-fix: Sync shipment status from stop status
-- PHASE 2D: Regenerate daily_kpi_snapshots
-- ===================================================================

BEGIN;
SET LOCAL statement_timeout = 0;

-- 2B-fix: Sync shipments status from related stop
WITH s_stat AS (
    SELECT s.id, ts.status::text AS sst
    FROM shipments s LEFT JOIN trip_stops ts ON ts.shipment_id = s.id
)
UPDATE shipments sh
SET status = CASE s_stat.sst
    WHEN 'delivered'           THEN 'delivered'::shipment_status
    WHEN 'partially_delivered' THEN 'partially_delivered'::shipment_status
    WHEN 'failed'              THEN 'returned'::shipment_status
    WHEN 'skipped'             THEN 'cancelled'::shipment_status
    ELSE 'in_transit'::shipment_status
END
FROM s_stat WHERE sh.id = s_stat.id;

-- 2C: Shift Sunday trips
-- Build shift map for Sunday trips
CREATE TEMP TABLE _sun_shift AS
SELECT id AS trip_id,
       planned_date,
       (ABS(hashtext(id::text || 'sun')) % 10) AS h
FROM trips
WHERE EXTRACT(DOW FROM planned_date) = 0;  -- Sunday=0

CREATE TEMP TABLE _shift_map AS
SELECT trip_id, planned_date AS old_date,
       CASE
           WHEN h < 5 THEN planned_date - INTERVAL '1 day'
           WHEN h < 8 THEN planned_date + INTERVAL '1 day'
           ELSE planned_date
       END :: date AS new_date
FROM _sun_shift;

-- Update trips
UPDATE trips t
SET planned_date = sm.new_date,
    started_at   = CASE WHEN started_at IS NOT NULL THEN started_at + ((sm.new_date - sm.old_date) || ' days')::interval ELSE NULL END,
    completed_at = CASE WHEN completed_at IS NOT NULL THEN completed_at + ((sm.new_date - sm.old_date) || ' days')::interval ELSE NULL END
FROM _shift_map sm
WHERE t.id = sm.trip_id AND sm.new_date <> sm.old_date;

-- Update trip_stops timestamps + estimated_arrival shift for shifted trips
UPDATE trip_stops ts
SET estimated_arrival   = CASE WHEN ts.estimated_arrival IS NOT NULL THEN ts.estimated_arrival + ((sm.new_date - sm.old_date) || ' days')::interval ELSE NULL END,
    estimated_departure = CASE WHEN ts.estimated_departure IS NOT NULL THEN ts.estimated_departure + ((sm.new_date - sm.old_date) || ' days')::interval ELSE NULL END,
    actual_arrival      = CASE WHEN ts.actual_arrival IS NOT NULL THEN ts.actual_arrival + ((sm.new_date - sm.old_date) || ' days')::interval ELSE NULL END,
    actual_departure    = CASE WHEN ts.actual_departure IS NOT NULL THEN ts.actual_departure + ((sm.new_date - sm.old_date) || ' days')::interval ELSE NULL END
FROM _shift_map sm
WHERE ts.trip_id = sm.trip_id AND sm.new_date <> sm.old_date;

-- Update shipments delivery_date
UPDATE shipments sh
SET delivery_date = sm.new_date
FROM trip_stops ts
JOIN _shift_map sm ON sm.trip_id = ts.trip_id
WHERE ts.shipment_id = sh.id AND sm.new_date <> sm.old_date;

-- Update sales_orders delivery_date
UPDATE sales_orders o
SET delivery_date = sm.new_date
FROM shipments s
JOIN trip_stops ts ON ts.shipment_id = s.id
JOIN _shift_map sm ON sm.trip_id = ts.trip_id
WHERE o.id = s.order_id AND sm.new_date <> sm.old_date;

\echo '--- TRIPS BY DOW (after shift) ---'
SELECT EXTRACT(DOW FROM planned_date)::int dow, COUNT(*) FROM trips GROUP BY dow ORDER BY dow;

COMMIT;

-- ====================================================================
-- PHASE 2D: Regenerate daily_kpi_snapshots from new realistic data
-- ====================================================================
BEGIN;
SET LOCAL statement_timeout = 0;

TRUNCATE daily_kpi_snapshots;

INSERT INTO daily_kpi_snapshots (
    snapshot_date, warehouse_id, otd_rate, delivery_success_rate,
    total_orders, delivered_orders, failed_orders,
    avg_vehicle_utilization, total_trips, total_distance_km,
    total_revenue, total_collected, outstanding_receivable,
    recon_match_rate, total_discrepancies, details
)
SELECT
    o.delivery_date,
    o.warehouse_id,
    -- OTD rate = on-time-delivered / total delivered (assume 92% on time of delivered)
    CASE WHEN COUNT(*) FILTER (WHERE o.status='delivered') > 0
         THEN ROUND(92.0 + (RANDOM() * 6 - 3)::numeric, 2)  -- 89-95%
         ELSE 0 END,
    -- Delivery success = delivered+partial / total
    ROUND(100.0 * COUNT(*) FILTER (WHERE o.status IN ('delivered','partially_delivered'))::numeric
                / NULLIF(COUNT(*),0), 2),
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE o.status='delivered')::int,
    COUNT(*) FILTER (WHERE o.status IN ('returned','cancelled'))::int,
    -- Avg vehicle utilization from trips (random 60-85%)
    ROUND(60 + (RANDOM() * 25)::numeric, 2),
    -- total trips for this date+warehouse
    (SELECT COUNT(*) FROM trips t WHERE t.planned_date=o.delivery_date AND t.warehouse_id=o.warehouse_id),
    COALESCE((SELECT SUM(total_distance_km) FROM trips t WHERE t.planned_date=o.delivery_date AND t.warehouse_id=o.warehouse_id), 0),
    SUM(o.total_amount)::numeric(15,2),
    -- Cash collected = ~60% of revenue from delivered orders
    ROUND((SUM(CASE WHEN o.status='delivered' THEN o.total_amount ELSE 0 END) * (0.55 + RANDOM()*0.2))::numeric, 2),
    -- Outstanding = revenue from non-delivered
    ROUND(SUM(CASE WHEN o.status<>'delivered' THEN o.total_amount ELSE 0 END)::numeric, 2),
    -- Recon match rate 92-99%
    ROUND(92 + (RANDOM() * 7)::numeric, 2),
    -- Discrepancies
    (RANDOM() * 3)::int,
    '{}'::jsonb
FROM sales_orders o
GROUP BY o.delivery_date, o.warehouse_id;

\echo '--- KPI SNAPSHOTS GENERATED ---'
SELECT COUNT(*) total, MIN(snapshot_date) mn, MAX(snapshot_date) mx,
       ROUND(AVG(otd_rate)::numeric,2) avg_otd,
       ROUND(AVG(avg_vehicle_utilization)::numeric,2) avg_util,
       ROUND(AVG(total_revenue)::numeric,0)::text avg_rev
FROM daily_kpi_snapshots;

\echo '--- LAST 7 SNAPSHOTS ---'
SELECT snapshot_date, warehouse_id::text, total_orders, delivered_orders, failed_orders,
       otd_rate, total_revenue::text, total_collected::text
FROM daily_kpi_snapshots ORDER BY snapshot_date DESC LIMIT 14;

COMMIT;

ANALYZE daily_kpi_snapshots;
ANALYZE trips;
ANALYZE trip_stops;
ANALYZE sales_orders;
ANALYZE shipments;
