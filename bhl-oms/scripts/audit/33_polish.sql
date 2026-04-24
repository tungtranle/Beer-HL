-- ===================================================================
-- POLISH: Redistribute trips across all 50 drivers + regenerate
--         driver_scores, driver_score_snapshots, driver_checkins
-- ===================================================================

BEGIN;
SET LOCAL statement_timeout = 0;

-- Reassign drivers + vehicles using stable hash so all drivers get work
WITH drv AS (
    SELECT id, warehouse_id,
           (ROW_NUMBER() OVER (PARTITION BY warehouse_id ORDER BY full_name) - 1)::int AS idx,
           (COUNT(*) OVER (PARTITION BY warehouse_id))::int AS tot
    FROM drivers
)
UPDATE trips t
SET driver_id = drv.id
FROM drv
WHERE t.warehouse_id = drv.warehouse_id
  AND drv.idx = (ABS(hashtext(t.id::text || 'drv2')) % drv.tot);

WITH veh AS (
    SELECT id, warehouse_id,
           (ROW_NUMBER() OVER (PARTITION BY warehouse_id ORDER BY plate_number) - 1)::int AS idx,
           (COUNT(*) OVER (PARTITION BY warehouse_id))::int AS tot
    FROM vehicles WHERE status='active'
)
UPDATE trips t
SET vehicle_id = veh.id
FROM veh
WHERE t.warehouse_id = veh.warehouse_id
  AND veh.idx = (ABS(hashtext(t.id::text || 'veh2')) % veh.tot);

-- Reassign EOD sessions driver_id, payments driver_id, ePOD driver_id to match
UPDATE eod_sessions es SET driver_id = t.driver_id FROM trips t WHERE t.id = es.trip_id;
UPDATE payments p SET driver_id = t.driver_id FROM trip_stops ts JOIN trips t ON t.id=ts.trip_id WHERE ts.id=p.trip_stop_id;
UPDATE epod e SET driver_id = t.driver_id FROM trip_stops ts JOIN trips t ON t.id=ts.trip_id WHERE ts.id=e.trip_stop_id;

\echo 'Drivers used now:'
SELECT COUNT(DISTINCT driver_id) FROM trips WHERE driver_id IS NOT NULL;

-- Regenerate driver_scores from scratch
TRUNCATE driver_scores CASCADE;
TRUNCATE driver_score_snapshots;

INSERT INTO driver_scores (
    driver_id, score_date, total_score, otd_score, delivery_score,
    safety_score, compliance_score, customer_score,
    trips_count, stops_count, on_time_count, delivered_count, failed_count,
    speed_violations, checklist_completions, epod_completions, model_version
)
SELECT
    driver_id, planned_date,
    ROUND( (otd*0.3 + dlv*0.3 + sf*0.15 + cmp*0.15 + cust*0.1)::numeric, 1),
    otd, dlv, sf, cmp, cust,
    trip_cnt, stop_cnt, on_time, delivered_cnt, failed_cnt,
    speed_v, ck_cnt, ep_cnt, 'rule_v1'
FROM (
    SELECT
        t.driver_id, t.planned_date,
        COUNT(DISTINCT t.id)::int trip_cnt,
        COUNT(ts.id)::int stop_cnt,
        COUNT(ts.id) FILTER (WHERE ts.status='delivered')::int delivered_cnt,
        COUNT(ts.id) FILTER (WHERE ts.status IN ('failed','skipped'))::int failed_cnt,
        COUNT(ts.id) FILTER (WHERE ts.actual_arrival <= ts.estimated_arrival + INTERVAL '15 minutes')::int on_time,
        COUNT(ts.id) FILTER (WHERE ts.status IN ('delivered','partially_delivered'))::int ep_cnt,
        COUNT(DISTINCT t.id)::int ck_cnt,
        ROUND( 85 + (RANDOM() * 13)::numeric, 1) otd,
        ROUND( 80 + (RANDOM() * 18)::numeric, 1) dlv,
        ROUND( 80 + (RANDOM() * 19)::numeric, 1) sf,
        ROUND( 88 + (RANDOM() * 11)::numeric, 1) cmp,
        ROUND( 80 + (RANDOM() * 18)::numeric, 1) cust,
        (RANDOM() * 2)::int speed_v
    FROM trips t LEFT JOIN trip_stops ts ON ts.trip_id=t.id
    WHERE t.driver_id IS NOT NULL AND t.status='completed'
    GROUP BY t.driver_id, t.planned_date
) x;

-- Update drivers.current_score
UPDATE drivers d
SET current_score = sub.s
FROM (
    SELECT DISTINCT ON (driver_id) driver_id, total_score AS s
    FROM driver_scores ORDER BY driver_id, score_date DESC
) sub WHERE d.id = sub.driver_id;

-- Regenerate monthly snapshots
INSERT INTO driver_score_snapshots (
    driver_id, snapshot_month, avg_total_score,
    avg_otd, avg_delivery, avg_safety, avg_compliance, avg_customer,
    total_trips, total_stops, rank_position, rank_total
)
SELECT
    driver_id, mth,
    ROUND(AVG(total_score)::numeric,1),
    ROUND(AVG(otd_score)::numeric,1), ROUND(AVG(delivery_score)::numeric,1),
    ROUND(AVG(safety_score)::numeric,1), ROUND(AVG(compliance_score)::numeric,1),
    ROUND(AVG(customer_score)::numeric,1),
    SUM(trips_count)::int, SUM(stops_count)::int, NULL, NULL
FROM (
    SELECT driver_id, date_trunc('month', score_date)::date mth,
           total_score, otd_score, delivery_score, safety_score, compliance_score, customer_score,
           trips_count, stops_count
    FROM driver_scores
) x
GROUP BY driver_id, mth;

WITH ranked AS (
    SELECT id, RANK() OVER (PARTITION BY snapshot_month ORDER BY avg_total_score DESC) rnk,
                COUNT(*) OVER (PARTITION BY snapshot_month) tot
    FROM driver_score_snapshots
)
UPDATE driver_score_snapshots dss SET rank_position=r.rnk, rank_total=r.tot
FROM ranked r WHERE dss.id = r.id;

-- Backfill driver_checkins for working days where they have trips
INSERT INTO driver_checkins (driver_id, checkin_date, status, checked_in_at)
SELECT DISTINCT t.driver_id, t.planned_date, 'available',
       t.planned_date::timestamptz + INTERVAL '6 hours' + (ABS(hashtext(t.driver_id::text||t.planned_date::text)) % 60 || ' minutes')::interval
FROM trips t
WHERE t.driver_id IS NOT NULL AND t.status='completed'
ON CONFLICT (driver_id, checkin_date) DO UPDATE SET status='available';

\echo '--- VERIFY ---'
SELECT 'drivers with trips' lbl, COUNT(DISTINCT driver_id)::text v FROM trips WHERE driver_id IS NOT NULL
UNION ALL SELECT 'drivers with scores', COUNT(DISTINCT driver_id)::text FROM driver_scores
UNION ALL SELECT 'driver_scores total', COUNT(*)::text FROM driver_scores
UNION ALL SELECT 'driver_score_snapshots', COUNT(*)::text FROM driver_score_snapshots
UNION ALL SELECT 'driver_checkins available', (COUNT(*) FILTER (WHERE status='available'))::text FROM driver_checkins
UNION ALL SELECT 'drivers w/ current_score>0', COUNT(*)::text FROM drivers WHERE current_score > 0;

\echo '--- TOP 10 DRIVERS BY SCORE ---'
SELECT d.full_name, ROUND(d.current_score::numeric,1) score,
       (SELECT COUNT(*) FROM trips WHERE driver_id=d.id) trips
FROM drivers d WHERE d.current_score > 0
ORDER BY d.current_score DESC LIMIT 10;

COMMIT;
ANALYZE;
