-- =============================================================================
-- SEED: GPS từ tọa độ thực tế của trip_stops/customers (có OSRM fallback)
-- Logic: Mỗi trip → interpolate GPS waypoints giữa warehouse → stops → warehouse
-- Warehouse HL: (20.958296, 107.075554)  |  Warehouse HP: (21.009180, 106.839860)
-- =============================================================================

-- Xóa GPS cũ (random không dựa logic)
DELETE FROM gps_locations;

-- GPS seed: Từ trip started_at → completed_at, di chuyển qua từng stop theo lat/lng thực tế.
-- Với mỗi đoạn (segment) giữa 2 điểm, tạo N waypoints nội suy tuyến tính + jitter ±0.00005°
-- Tốc độ tính từ khoảng cách / thời gian di chuyển ước tính, cộng noise ±15%

WITH
-- 1. Warehouse coords
warehouses_geo AS (
  SELECT id,
    CASE name WHEN 'Kho Ha Long' THEN 20.958296 ELSE 21.009180 END AS lat,
    CASE name WHEN 'Kho Ha Long' THEN 107.075554 ELSE 106.839860 END AS lng
  FROM warehouses
),

-- 2. Lấy trip + stops + customer coords, filter completed trips có started_at
trip_waypoints AS (
  SELECT
    t.id                       AS trip_id,
    t.vehicle_id,
    t.driver_id,
    t.started_at,
    t.completed_at,
    t.warehouse_id,
    ts.stop_order,
    c.latitude::float          AS stop_lat,
    c.longitude::float         AS stop_lng,
    ts.estimated_arrival,
    COUNT(*) OVER(PARTITION BY t.id)  AS total_stops
  FROM trips t
  JOIN trip_stops ts ON ts.trip_id = t.id
  JOIN customers c   ON c.id = ts.customer_id
  WHERE t.status::text IN ('completed', 'reconciled', 'settling')
    AND t.started_at IS NOT NULL
    AND t.vehicle_id IS NOT NULL
    AND c.latitude IS NOT NULL
),

-- 3. Thêm điểm xuất phát (stop_order = 0 = warehouse)
all_waypoints AS (
  -- Điểm warehouse (xuất phát)
  SELECT
    tw.trip_id, tw.vehicle_id, tw.driver_id, tw.started_at, tw.completed_at,
    0 AS stop_order,
    wg.lat AS stop_lat, wg.lng AS stop_lng,
    tw.started_at AS estimated_arrival
  FROM trip_waypoints tw
  JOIN warehouses_geo wg ON wg.id = tw.warehouse_id
  GROUP BY tw.trip_id, tw.vehicle_id, tw.driver_id, tw.started_at, tw.completed_at, tw.warehouse_id, wg.lat, wg.lng

  UNION ALL

  -- Các stop thực tế
  SELECT trip_id, vehicle_id, driver_id, started_at, completed_at,
    stop_order, stop_lat, stop_lng, estimated_arrival
  FROM trip_waypoints
),

-- 4. Với mỗi segment (stop N → stop N+1), tạo 10 interpolated GPS points
segments AS (
  SELECT
    a.trip_id,
    a.vehicle_id,
    a.driver_id,
    a.stop_order                          AS seg_from,
    b.stop_order                          AS seg_to,
    a.stop_lat                            AS lat_from,
    a.stop_lng                            AS lng_from,
    b.stop_lat                            AS lat_to,
    b.stop_lng                            AS lng_to,
    COALESCE(a.estimated_arrival, a.started_at) AS t_from,
    COALESCE(b.estimated_arrival, a.started_at + INTERVAL '1 hour') AS t_to
  FROM all_waypoints a
  JOIN all_waypoints b
    ON b.trip_id = a.trip_id
   AND b.stop_order = a.stop_order + 1
),

-- 5. Sinh 10 waypoints nội suy cho mỗi segment
gps_raw AS (
  SELECT
    gen_random_uuid()           AS id,
    s.vehicle_id,
    s.driver_id,

    -- Nội suy lat/lng tuyến tính (fraction 0..1)
    (s.lat_from + (s.lat_to - s.lat_from) * (step::float/10))
      -- Thêm jitter ±0.00005° (≈±5m) dùng sin/cos pseudo-random từ row
      + sin(extract(epoch FROM s.t_from) + step * 17) * 0.00005
      AS lat,

    (s.lng_from + (s.lng_to - s.lng_from) * (step::float/10))
      + cos(extract(epoch FROM s.t_from) + step * 13) * 0.00005
      AS lng,

    -- Tốc độ = khoảng cách Haversine (km) / thời gian (h) × noise 0.85–1.15
    LEAST(GREATEST(
      (SQRT(
        POW((s.lat_to - s.lat_from) * 110.574, 2) +
        POW((s.lng_to - s.lng_from) * 111.320 * COS(RADIANS(s.lat_from)), 2)
      ) / NULLIF(EXTRACT(EPOCH FROM (s.t_to - s.t_from)) / 3600.0, 0))
      * (0.85 + (ABS(SIN(extract(epoch FROM s.t_from) + step)) * 0.30)),
      5.0), 120.0)   AS speed_kmh,          -- clamp 5..120

    -- Heading: từ hướng của segment
    DEGREES(ATAN2(
      (s.lng_to - s.lng_from) * 111320 * COS(RADIANS(s.lat_from)),
      (s.lat_to - s.lat_from) * 110574
    ))                          AS heading,

    -- Độ chính xác GPS: 5–15m thường, 20–50m nếu signal yếu (5% xác suất)
    CASE WHEN MOD(ABS(hashtext(s.trip_id::text || step::text)), 100) < 5
         THEN 20 + MOD(ABS(hashtext(s.trip_id::text)), 30)
         ELSE 5  + MOD(ABS(hashtext(s.vehicle_id::text || step::text)), 10)
    END::numeric                AS accuracy_m,

    -- Thời gian: nội suy giữa t_from và t_to
    s.t_from + (s.t_to - s.t_from) * (step::float/10) AS recorded_at

  FROM segments s
  CROSS JOIN generate_series(0, 9) AS step
  WHERE s.t_from IS NOT NULL
    AND s.lat_from <> s.lat_to   -- bỏ segment không dịch chuyển
)

-- 6. Insert vào GPS table (chỉ lấy các chuyến gần đây để table không quá lớn)
INSERT INTO gps_locations (id, vehicle_id, driver_id, lat, lng, speed_kmh, heading, accuracy_m, recorded_at)
SELECT
  gen_random_uuid(),
  vehicle_id,
  driver_id,
  ROUND(lat::numeric, 7),
  ROUND(lng::numeric, 7),
  ROUND(speed_kmh::numeric, 1),
  ROUND(((heading + 360)::numeric % 360), 1),
  accuracy_m,
  recorded_at
FROM gps_raw
WHERE recorded_at >= '2024-01-01'
  AND recorded_at <= NOW() + INTERVAL '1 day'
  AND lat BETWEEN 18.0 AND 24.0     -- Vietnam bounds
  AND lng BETWEEN 102.0 AND 110.0
ORDER BY vehicle_id, recorded_at;

-- Kết quả
SELECT
  COUNT(*)                                  AS total_points,
  COUNT(DISTINCT vehicle_id)                AS vehicles,
  ROUND(AVG(speed_kmh::numeric), 1)         AS avg_speed_kmh,
  MIN(recorded_at)::date                    AS earliest,
  MAX(recorded_at)::date                    AS latest
FROM gps_locations;
