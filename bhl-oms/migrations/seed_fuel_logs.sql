-- =============================================================================
-- SEED: fuel_logs - chi phí nhiên liệu thực tế từng chuyến
-- Logic:
--   - Mỗi trip → 1 fuel log (xe đổ dầu trước/sau chuyến)
--   - Xe dài > 150km → 2 logs (đổ 2 lần)
--   - Consumption = distance_km × (base_rate/100) × urban_factor (đường đô thị)
--   - Giá dầu diesel: 21,000–23,500 VND/L (2024-2026, dao động nhẹ)
--   - 5% anomaly flag: liters_filled > expected × 1.2 (nghi thất thoát)
--   - channel: 70% fleet_card, 25% app, 5% web
-- =============================================================================

INSERT INTO fuel_logs (
  id, vehicle_id, driver_id, log_date,
  km_odometer, liters_filled, amount_vnd, fuel_type,
  station_name, invoice_photo_url, channel,
  expected_liters, anomaly_ratio, anomaly_flag,
  created_by, created_at
)
WITH
-- Tỷ lệ tiêu hao theo loại xe (L/100km đường nội thị, hơn highway ~15%)
vehicle_fuel_rate AS (
  SELECT
    v.id AS vehicle_id,
    v.default_driver_id AS driver_id,
    v.vehicle_type::text,
    CASE v.vehicle_type::text
      WHEN 'truck_3t5' THEN 13.0 * 1.12   -- 14.6 L/100km thực tế đô thị
      WHEN 'truck_5t'  THEN 14.5 * 1.12   -- 16.2 L/100km
      ELSE                  20.0 * 1.10   -- 22.0 L/100km (truck_8t)
    END AS rate_per_100km
  FROM vehicles v
  WHERE v.status = 'active'
),
-- Cumulative odometer: mỗi xe tăng dần theo trips
trip_with_km AS (
  SELECT
    t.id AS trip_id,
    t.vehicle_id,
    t.driver_id,
    t.planned_date,
    t.started_at,
    t.completed_at,
    t.total_distance_km,
    t.warehouse_id,
    -- Odometer giả lập: 30000 + tổng km các trips trước của xe này
    30000 + COALESCE(SUM(t.total_distance_km) OVER (
      PARTITION BY t.vehicle_id
      ORDER BY t.planned_date, t.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ), 0)::int AS km_start,
    vfr.rate_per_100km,
    (hashtext(t.id::text)::bigint & 2147483647) AS h
  FROM trips t
  JOIN vehicle_fuel_rate vfr ON vfr.vehicle_id = t.vehicle_id
  WHERE t.total_distance_km > 5
    AND t.started_at IS NOT NULL
    AND t.status::text NOT IN ('cancelled','draft')
),
-- Giá dầu dao động theo tháng (VND/L)
diesel_price AS (
  SELECT
    mon,
    -- Năm 2024: ~22,200; 2025: ~22,800; 2026: ~23,100 (tăng nhẹ)
    CASE
      WHEN mon < '2025-01-01' THEN 21500 + (EXTRACT(MONTH FROM mon)::int * 100)  -- 21,600–22,700
      WHEN mon < '2026-01-01' THEN 22000 + (EXTRACT(MONTH FROM mon)::int * 80)   -- 22,080–22,960
      ELSE                         22500 + (EXTRACT(MONTH FROM mon)::int * 50)   -- 22,550–23,100
    END AS price_per_liter
  FROM generate_series('2024-01-01'::date, '2026-06-01'::date, '1 month'::interval) mon
),
-- Tên cây xăng thực tế theo vùng
station_names AS (
  SELECT unnest(ARRAY[
    'Petrolimex Hạ Long','Petrolimex Bãi Cháy','PVOIL Hòn Gai',
    'Petrolimex Cẩm Phả','Xăng dầu Vân Đồn','PVOIL Móng Cái',
    'Petrolimex Hải Phòng','PVOIL Đình Vũ','Petrolimex Kiến An',
    'Xăng dầu An Dương','Petrolimex Đồ Sơn','PVOIL Thủy Nguyên'
  ]) AS name,
  generate_series(0, 11) AS idx
),
-- Tính fuel logs cho mỗi trip
fuel_calc AS (
  SELECT
    t.*,
    dp.price_per_liter,
    -- Expected liters theo consumption rate
    ROUND((t.total_distance_km * t.rate_per_100km / 100)::numeric, 1) AS expected_L,
    -- Actual liters: ±8% variation thực tế + 5% anomaly cases
    CASE
      WHEN MOD(t.h, 100) < 5 THEN  -- 5% anomaly: đổ nhiều hơn 20-40%
        ROUND((t.total_distance_km * t.rate_per_100km / 100 * (1.2 + MOD(t.h, 20)::float/100))::numeric, 1)
      WHEN MOD(t.h, 100) < 30 THEN  -- tiết kiệm nhẹ (tài xế kinh nghiệm)
        ROUND((t.total_distance_km * t.rate_per_100km / 100 * (0.92 + MOD(t.h, 8)::float/100))::numeric, 1)
      ELSE  -- bình thường ±8%
        ROUND((t.total_distance_km * t.rate_per_100km / 100 * (0.96 + MOD(t.h, 12)::float/100))::numeric, 1)
    END AS actual_L
  FROM trip_with_km t
  JOIN diesel_price dp ON dp.mon = date_trunc('month', t.planned_date)::date
)
SELECT
  gen_random_uuid() AS id,
  fc.vehicle_id,
  COALESCE(fc.driver_id, (SELECT driver_id FROM trips WHERE id = fc.trip_id)) AS driver_id,
  fc.planned_date AS log_date,
  (fc.km_start + fc.total_distance_km)::int AS km_odometer,
  fc.actual_L AS liters_filled,
  ROUND((fc.actual_L * fc.price_per_liter)::numeric, 0) AS amount_vnd,
  'diesel' AS fuel_type,

  -- Cây xăng: hash theo vehicle để xe hay đổ cùng cây
  (SELECT name FROM station_names WHERE idx = MOD(fc.h, 12)) AS station_name,

  -- Invoice photo: 70% có ảnh (fleet card tự động, app có upload)
  CASE WHEN MOD(fc.h, 10) < 7
    THEN 'https://cdn.beerhl.vn/fuel/' || fc.trip_id::text || '_receipt.jpg'
    ELSE NULL
  END AS invoice_photo_url,

  -- Channel: 70% fleet_card, 25% app, 5% web
  CASE
    WHEN MOD(fc.h, 100) < 70 THEN 'fleet_card'::fuel_channel
    WHEN MOD(fc.h, 100) < 95 THEN 'app'::fuel_channel
    ELSE 'web'::fuel_channel
  END AS channel,

  fc.expected_L AS expected_liters,
  ROUND((fc.actual_L / NULLIF(fc.expected_L, 0))::numeric, 3) AS anomaly_ratio,
  (fc.actual_L > fc.expected_L * 1.15) AS anomaly_flag,

  'eb57be3f-e8a3-4b4e-d806-3e7863d25eb4'::uuid AS created_by,  -- admin

  -- Thời gian log: cuối chuyến hoặc sau khi về kho
  COALESCE(fc.completed_at, fc.started_at + INTERVAL '4 hours') + INTERVAL '30 minutes' AS created_at

FROM fuel_calc fc;

-- Kết quả
SELECT
  COUNT(*)                                                       AS total_logs,
  COUNT(DISTINCT vehicle_id)                                     AS vehicles,
  ROUND(SUM(liters_filled)::numeric / 1000, 0)                  AS total_liters_k,
  ROUND(SUM(amount_vnd)::numeric / 1000000, 1)                  AS total_cost_m_vnd,
  ROUND(AVG(amount_vnd)::numeric / 1000, 0)                     AS avg_cost_k_vnd,
  SUM(CASE WHEN anomaly_flag THEN 1 ELSE 0 END)                 AS anomalies,
  COUNT(DISTINCT channel::text)                                  AS channels_used
FROM fuel_logs;
