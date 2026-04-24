-- ===================================================================
-- PHASE 2A: CONSOLIDATE TRIPS — gộp stops thành 6-9 stops/trip
-- ===================================================================
-- Strategy:
--   1. Resequence all trip_stops by (warehouse, planned_date), batch size = 8
--   2. Create NEW trip per batch with assigned driver+vehicle from same warehouse
--   3. Re-point trip_stops to new trip + new stop_order 1..8
--   4. Recompute trip totals from stops/shipments
--   5. Delete old (now empty) trips
-- Result: ~22K trips → ~4-5K trips, 6-9 stops/trip
-- ===================================================================

BEGIN;

SET LOCAL statement_timeout = 0;

-- 1. Build assignment table: each old stop -> (warehouse, planned_date, batch_no, new_order)
CREATE TEMP TABLE _assign AS
WITH seq AS (
    SELECT ts.id AS stop_id, ts.shipment_id, ts.customer_id,
           t.warehouse_id, t.planned_date,
           ts.actual_arrival, ts.actual_departure,
           COALESCE(s.total_weight_kg, 0) AS w,
           ROW_NUMBER() OVER (
               PARTITION BY t.warehouse_id, t.planned_date
               ORDER BY ts.estimated_arrival NULLS LAST, ts.id
           ) AS rn
    FROM trip_stops ts
    JOIN trips t ON t.id = ts.trip_id
    LEFT JOIN shipments s ON s.id = ts.shipment_id
)
SELECT stop_id, shipment_id, customer_id, warehouse_id, planned_date,
       actual_arrival, actual_departure, w,
       ((rn - 1) / 8 + 1)::int AS batch_no,
       ((rn - 1) % 8 + 1)::int AS new_order
FROM seq;

CREATE INDEX ON _assign (warehouse_id, planned_date, batch_no);
CREATE INDEX ON _assign (stop_id);

-- 2. Build new trip headers (one row per (warehouse, planned_date, batch))
CREATE TEMP TABLE _new_trips AS
SELECT
    gen_random_uuid() AS new_trip_id,
    warehouse_id, planned_date, batch_no,
    SUM(w)::numeric(10,2) AS total_w,
    COUNT(*)::int AS stop_count,
    MIN(actual_arrival) AS first_arr,
    MAX(actual_departure) AS last_dep,
    ROW_NUMBER() OVER (ORDER BY planned_date, warehouse_id, batch_no) AS global_no
FROM _assign
GROUP BY warehouse_id, planned_date, batch_no;

CREATE INDEX ON _new_trips (warehouse_id, planned_date, batch_no);

-- 3. Driver / vehicle pools per warehouse
CREATE TEMP TABLE _drv AS
SELECT id AS driver_id, warehouse_id,
       (ROW_NUMBER() OVER (PARTITION BY warehouse_id ORDER BY full_name))::int AS rn,
       (COUNT(*) OVER (PARTITION BY warehouse_id))::int AS tot
FROM drivers;

CREATE TEMP TABLE _veh AS
SELECT id AS vehicle_id, warehouse_id,
       (ROW_NUMBER() OVER (PARTITION BY warehouse_id ORDER BY plate_number))::int AS rn,
       (COUNT(*) OVER (PARTITION BY warehouse_id))::int AS tot
FROM vehicles WHERE status='active';

-- 4. Insert new consolidated trips
INSERT INTO trips (
    id, trip_number, warehouse_id, vehicle_id, driver_id, status,
    planned_date, total_stops, total_weight_kg, total_distance_km,
    total_duration_min, started_at, completed_at, created_at, updated_at
)
SELECT
    nt.new_trip_id,
    'CT-' || TO_CHAR(nt.planned_date,'YYYYMMDD') || '-' || LPAD(nt.global_no::text, 6, '0'),
    nt.warehouse_id,
    v.vehicle_id,
    d.driver_id,
    'completed'::trip_status,
    nt.planned_date,
    nt.stop_count,
    nt.total_w,
    ROUND((20 + nt.stop_count * 6 + (RANDOM() * 25))::numeric, 1),
    (nt.stop_count * 25 + 30)::int,
    COALESCE(nt.first_arr, (nt.planned_date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') + INTERVAL '7 hours'),
    COALESCE(nt.last_dep,  (nt.planned_date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') + INTERVAL '16 hours'),
    (nt.planned_date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '12 hours',
    NOW()
FROM _new_trips nt
JOIN _drv d ON d.warehouse_id = nt.warehouse_id
            AND d.rn = ((nt.batch_no - 1) % d.tot) + 1
JOIN _veh v ON v.warehouse_id = nt.warehouse_id
            AND v.rn = ((nt.batch_no - 1) % v.tot) + 1;

\echo '--- New trips inserted ---'
SELECT COUNT(*) FROM _new_trips;

-- 5. Re-point trip_stops to new trip + new stop_order
-- NOTE: must avoid temporary unique-constraint violations.
-- Use a 2-step UPDATE: shift all stop_order to negative first, then assign final.

UPDATE trip_stops ts SET stop_order = -stop_order WHERE EXISTS (SELECT 1 FROM _assign a WHERE a.stop_id=ts.id);

UPDATE trip_stops ts
SET trip_id = nt.new_trip_id,
    stop_order = a.new_order
FROM _assign a
JOIN _new_trips nt
  ON nt.warehouse_id=a.warehouse_id AND nt.planned_date=a.planned_date AND nt.batch_no=a.batch_no
WHERE ts.id = a.stop_id;

-- 6. Delete old empty trips
DELETE FROM trips t
WHERE NOT EXISTS (SELECT 1 FROM trip_stops ts WHERE ts.trip_id = t.id);

\echo '--- Verification ---'
SELECT 'total trips' lbl, COUNT(*)::text v FROM trips
UNION ALL SELECT 'total stops', COUNT(*)::text FROM trip_stops
UNION ALL SELECT 'avg stops/trip', ROUND(AVG(c)::numeric,2)::text FROM (SELECT trip_id, COUNT(*) c FROM trip_stops GROUP BY trip_id) x
UNION ALL SELECT 'min stops/trip', MIN(c)::text FROM (SELECT trip_id, COUNT(*) c FROM trip_stops GROUP BY trip_id) x
UNION ALL SELECT 'max stops/trip', MAX(c)::text FROM (SELECT trip_id, COUNT(*) c FROM trip_stops GROUP BY trip_id) x
UNION ALL SELECT 'trips no driver', COUNT(*)::text FROM trips WHERE driver_id IS NULL
UNION ALL SELECT 'trips no vehicle', COUNT(*)::text FROM trips WHERE vehicle_id IS NULL;

COMMIT;

ANALYZE trips;
ANALYZE trip_stops;
