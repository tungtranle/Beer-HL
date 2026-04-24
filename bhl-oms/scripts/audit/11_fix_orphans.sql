-- ===================================================================
-- PHASE 1C: Fix orphan trips
-- ===================================================================
BEGIN;

-- Check HP vehicle situation: only 1 vehicle for 9 drivers — add more if needed
-- Add 7 more vehicles to HP warehouse (truck_5t and truck_8t mix, realistic for distribution)
INSERT INTO vehicles (plate_number, vehicle_type, capacity_kg, capacity_m3, status, warehouse_id, year_of_manufacture, fuel_type, current_km)
SELECT
    plate, vt::vehicle_type, cap, cap/650.0, 'active',
    'a0000000-0000-0000-0000-000000000002'::uuid,
    yom, 'diesel', km
FROM (VALUES
    ('15C-21001', 'truck_5t',  5000.0, 2018, 185000),
    ('15C-21002', 'truck_5t',  5000.0, 2019, 162000),
    ('15C-21003', 'truck_5t',  5000.0, 2020, 138000),
    ('15C-21004', 'truck_8t',  8000.0, 2017, 215000),
    ('15C-21005', 'truck_8t',  8000.0, 2019, 178000),
    ('15C-21006', 'truck_3t5', 3500.0, 2021, 95000),
    ('15C-21007', 'truck_3t5', 3500.0, 2022, 62000)
) AS v(plate, vt, cap, yom, km)
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE plate_number = v.plate);

-- Fix trips with NULL driver_id: random assign driver from same warehouse
WITH drv_pool AS (
    SELECT id, warehouse_id,
           ROW_NUMBER() OVER (PARTITION BY warehouse_id ORDER BY random()) - 1 AS rn,
           COUNT(*) OVER (PARTITION BY warehouse_id) AS total
    FROM drivers
), trip_fix AS (
    SELECT t.id AS trip_id, t.warehouse_id,
           ABS(hashtext(t.id::text || t.planned_date::text)) AS h
    FROM trips t WHERE t.driver_id IS NULL
)
UPDATE trips t
SET driver_id = dp.id
FROM trip_fix tf
JOIN drv_pool dp ON dp.warehouse_id = tf.warehouse_id AND dp.rn = (tf.h % dp.total)
WHERE t.id = tf.trip_id;

-- Fix trips with NULL vehicle_id: random assign vehicle from same warehouse
WITH veh_pool AS (
    SELECT id, warehouse_id,
           ROW_NUMBER() OVER (PARTITION BY warehouse_id ORDER BY random()) - 1 AS rn,
           COUNT(*) OVER (PARTITION BY warehouse_id) AS total
    FROM vehicles WHERE status = 'active'
), trip_fix AS (
    SELECT t.id AS trip_id, t.warehouse_id,
           ABS(hashtext(t.id::text || 'veh' || t.planned_date::text)) AS h
    FROM trips t WHERE t.vehicle_id IS NULL
)
UPDATE trips t
SET vehicle_id = vp.id
FROM trip_fix tf
JOIN veh_pool vp ON vp.warehouse_id = tf.warehouse_id AND vp.rn = (tf.h % vp.total)
WHERE t.id = tf.trip_id;

-- Assign default_vehicle_id only for drivers without one,
-- excluding vehicles already taken as default by another driver.
WITH free_vehicles AS (
    SELECT v.id, v.warehouse_id,
           ROW_NUMBER() OVER (PARTITION BY v.warehouse_id ORDER BY v.plate_number) AS rn
    FROM vehicles v
    WHERE v.status='active'
      AND NOT EXISTS (SELECT 1 FROM drivers d WHERE d.default_vehicle_id = v.id)
), free_drivers AS (
    SELECT id, warehouse_id,
           ROW_NUMBER() OVER (PARTITION BY warehouse_id ORDER BY full_name) AS rn
    FROM drivers WHERE default_vehicle_id IS NULL
)
UPDATE drivers d SET default_vehicle_id = fv.id
FROM free_drivers fd
JOIN free_vehicles fv ON fv.warehouse_id = fd.warehouse_id AND fv.rn = fd.rn
WHERE d.id = fd.id;

-- Verify
SELECT 'trips no driver' lbl, COUNT(*) FROM trips WHERE driver_id IS NULL
UNION ALL SELECT 'trips no vehicle', COUNT(*) FROM trips WHERE vehicle_id IS NULL
UNION ALL SELECT 'vehicles total', COUNT(*) FROM vehicles
UNION ALL SELECT 'vehicles HP', COUNT(*) FROM vehicles WHERE warehouse_id='a0000000-0000-0000-0000-000000000002'
UNION ALL SELECT 'drivers no default vehicle', COUNT(*) FROM drivers WHERE default_vehicle_id IS NULL;

COMMIT;
