-- Direct GPS seed script
-- Insert sample GPS traces for demonstration and AI testing
-- Covers 200 trips with 50-150 points per trip

BEGIN;

-- Get sample trips and vehicles
WITH trip_sample AS (
    SELECT id, vehicle_id, driver_id, created_at
    FROM trips
    WHERE status::text IN ('in_transit', 'at_stop', 'completed', 'settled', 'reconciled')
      AND created_at > NOW() - INTERVAL '90 days'
    ORDER BY created_at DESC
    LIMIT 200
),
-- Generate 100 GPS points per trip for demonstration
points_to_insert AS (
    SELECT 
        gen_random_uuid() as id,
        ts.vehicle_id,
        ts.driver_id,
        -- Simulate realistic paths within Hanoi coordinates
        20.8::numeric + (random() * 0.3)::numeric as lat,
        105.8::numeric + (random() * 0.3)::numeric as lng,
        (10.0 + random() * 50.0)::numeric as speed_kmh,
        (random() * 360.0)::numeric as heading,
        (5.0 + random() * 15.0)::numeric as accuracy_m,
        -- Spread timestamps across the trip duration
        ts.created_at + (generate_series(0, 49) * INTERVAL '30 seconds') as recorded_at
    FROM trip_sample ts
)
INSERT INTO gps_locations (id, vehicle_id, driver_id, lat, lng, speed_kmh, heading, accuracy_m, recorded_at)
SELECT id, vehicle_id, driver_id, lat, lng, speed_kmh, heading, accuracy_m, recorded_at
FROM points_to_insert;

COMMIT;

-- Verify insertion
SELECT 
    COUNT(*) as total_gps_points,
    COUNT(DISTINCT vehicle_id) as vehicles_with_gps,
    MIN(recorded_at) as earliest_gps,
    MAX(recorded_at) as latest_gps,
    ROUND(AVG(speed_kmh::numeric)::numeric, 2) as avg_speed
FROM gps_locations;
