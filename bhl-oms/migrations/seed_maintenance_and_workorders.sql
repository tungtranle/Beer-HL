-- =============================================================================
-- SEED: vehicle_maintenance_records + work_orders
-- Logic bảo dưỡng thực tế:
--   - Oil change: mỗi 5,000–8,000 km (diesel truck)
--   - Tire rotation: 20,000 km
--   - Major service: 40,000 km
--   - Brake check: 15,000 km
--   - 58 xe, mỗi xe trung bình 15-25 chuyến/tháng
-- Xe truck_8t (43 chiếc) là chủ yếu → bảo dưỡng dày hơn
-- work_orders: sinh từ trip_checklists fail + scheduled maintenance
-- =============================================================================

-- PART 1: vehicle_maintenance_records
INSERT INTO vehicle_maintenance_records (
  id, vehicle_id, schedule_id,
  maintenance_type, last_maintenance_date, last_maintenance_km,
  next_due_date, next_due_km,
  alert_days_before, status, notes,
  completed_at, completed_by, created_at, updated_at
)
WITH vehicle_km AS (
  -- Tổng km mỗi xe từ trips
  SELECT
    v.id AS vehicle_id,
    v.vehicle_type::text,
    COALESCE(SUM(t.total_distance_km), 0)::int AS total_km,
    (hashtext(v.id::text)::bigint & 2147483647) AS h
  FROM vehicles v
  LEFT JOIN trips t ON t.vehicle_id = v.id AND t.total_distance_km > 0
  WHERE v.status = 'active'
  GROUP BY v.id, v.vehicle_type
),
-- Mỗi xe có nhiều loại bảo dưỡng
maint_types AS (
  SELECT * FROM (VALUES
    ('Thay dầu động cơ', 6000,  7),   -- interval_km, alert_days
    ('Kiểm tra phanh',  15000, 14),
    ('Đảo lốp',         20000, 14),
    ('Bảo dưỡng định kỳ lớn', 40000, 30)
  ) AS t(mtype, interval_km, alert_d)
),
-- Cross join xe × loại bảo dưỡng, tính last/next
maint_schedule AS (
  SELECT
    vk.vehicle_id,
    vk.total_km,
    vk.h,
    mt.mtype,
    mt.interval_km,
    mt.alert_d,
    -- Last maintenance tại km nào
    (vk.total_km / mt.interval_km) * mt.interval_km AS last_km,
    -- Next due
    ((vk.total_km / mt.interval_km) + 1) * mt.interval_km AS next_km,
    -- Ngày hoàn thành (ước tính từ số km và thời gian hoạt động)
    CURRENT_DATE - ((vk.total_km - (vk.total_km / mt.interval_km) * mt.interval_km) / 200)::int * INTERVAL '1 day' AS last_date,
    -- Status: overdue nếu đã qua km, due_soon nếu trong 1000km, ok nếu còn xa
    CASE
      WHEN vk.total_km > ((vk.total_km / mt.interval_km) + 1) * mt.interval_km THEN 'overdue'
      WHEN vk.total_km > ((vk.total_km / mt.interval_km) + 1) * mt.interval_km - 1000 THEN 'due_soon'
      ELSE 'ok'
    END AS maint_status,
    -- completed_by: fleet manager (dùng admin id)
    'eb57be3f-e8a3-4b4e-d806-3e7863d25eb4'::uuid AS mgr_id
  FROM vehicle_km vk
  CROSS JOIN maint_types mt
  WHERE vk.total_km > 0  -- chỉ xe đã chạy
    AND mt.interval_km <= vk.total_km + mt.interval_km  -- ít nhất đến lần 1
)
SELECT
  gen_random_uuid()   AS id,
  vehicle_id,
  NULL::uuid          AS schedule_id,  -- schedule sẽ tạo sau nếu cần
  mtype               AS maintenance_type,
  last_date           AS last_maintenance_date,
  GREATEST(last_km, 0) AS last_maintenance_km,
  (last_date + (alert_d * 4 + 30) * INTERVAL '1 day')::date AS next_due_date,
  next_km             AS next_due_km,
  alert_d             AS alert_days_before,
  maint_status        AS status,
  CASE maint_status
    WHEN 'overdue'   THEN 'Quá hạn bảo dưỡng, cần sắp xếp ngay'
    WHEN 'due_soon'  THEN 'Sắp đến hạn, liên hệ garage đặt lịch'
    ELSE NULL
  END AS notes,
  last_date::timestamp WITH TIME ZONE + INTERVAL '8 hours' AS completed_at,
  mgr_id              AS completed_by,
  last_date::timestamp WITH TIME ZONE AS created_at,
  last_date::timestamp WITH TIME ZONE AS updated_at
FROM maint_schedule
WHERE last_km >= 0;

-- PART 2: work_orders - từ checklist fail + scheduled + driver report
INSERT INTO work_orders (
  id, wo_number, vehicle_id, driver_id, garage_id,
  trigger_type, category, priority, description,
  status, quoted_amount, actual_amount,
  approved_by, approved_at, eta_completion, actual_completion,
  km_at_repair, is_emergency, is_recurring,
  created_by, created_at, updated_at
)
WITH failed_checklists AS (
  SELECT
    tc.vehicle_id,
    tc.driver_id,
    tc.trip_id,
    tc.checked_at,
    tc.notes,
    -- Xác định loại lỗi từ notes
    CASE
      WHEN tc.notes ILIKE '%lốp%' OR tc.notes ILIKE '%lốp%' THEN 'tyre'
      WHEN tc.notes ILIKE '%dầu%' THEN 'engine'
      WHEN tc.notes ILIKE '%phanh%' THEN 'brake'
      WHEN tc.notes ILIKE '%đèn%' THEN 'electrical'
      WHEN tc.notes ILIKE '%gương%' THEN 'body'
      WHEN tc.notes ILIKE '%hàng%' THEN 'other'
      ELSE 'other'
    END AS wo_cat,
    (hashtext(tc.trip_id::text)::bigint & 2147483647) AS h,
    ROW_NUMBER() OVER (ORDER BY tc.checked_at) AS rn
  FROM trip_checklists tc
  WHERE tc.is_passed = false
    AND tc.notes IS NOT NULL
),
wo_data AS (
  SELECT
    fc.*,
    -- Tổng km xe tại thời điểm WO
    COALESCE((
      SELECT 30000 + SUM(t2.total_distance_km)::int
      FROM trips t2
      WHERE t2.vehicle_id = fc.vehicle_id AND t2.planned_date <= fc.checked_at::date
    ), 30000) AS km_at_wo,
    CASE
      WHEN wo_cat IN ('brake','engine') THEN 'high'::wo_priority
      WHEN wo_cat = 'tyre' AND MOD(h,3)=0 THEN 'high'::wo_priority
      ELSE 'normal'::wo_priority
    END AS wo_priority
  FROM failed_checklists fc
)
SELECT
  gen_random_uuid() AS id,
  'WO-' || TO_CHAR(checked_at, 'YYYYMMDD') || '-' || LPAD(rn::text, 4, '0') AS wo_number,
  vehicle_id,
  driver_id,
  NULL::uuid AS garage_id,  -- chưa assign garage
  'driver_report'::wo_trigger_type AS trigger_type,
  wo_cat::wo_category AS category,
  wo_priority,
  notes AS description,
  -- Status: 80% completed, 15% verified, 5% in_progress (WO gần đây)
  CASE
    WHEN checked_at < NOW() - INTERVAL '30 days' THEN
      CASE WHEN MOD(h,5)=0 THEN 'verified'::work_order_status ELSE 'completed'::work_order_status END
    ELSE 'in_progress'::work_order_status
  END AS status,
  -- Chi phí ước tính theo loại sửa chữa
  CASE wo_cat
    WHEN 'tyre'       THEN (800000  + MOD(h, 800000))::numeric   -- 800K–1.6M
    WHEN 'brake'      THEN (600000  + MOD(h, 600000))::numeric   -- 600K–1.2M
    WHEN 'engine'     THEN (1500000 + MOD(h, 1500000))::numeric  -- 1.5M–3M
    WHEN 'electrical' THEN (300000  + MOD(h, 400000))::numeric   -- 300K–700K
    WHEN 'body'       THEN (200000  + MOD(h, 300000))::numeric   -- 200K–500K
    ELSE                   (400000  + MOD(h, 400000))::numeric   -- 400K–800K
  END AS quoted_amount,
  CASE wo_cat
    WHEN 'tyre'       THEN (750000  + MOD(h, 900000))::numeric
    WHEN 'brake'      THEN (550000  + MOD(h, 700000))::numeric
    WHEN 'engine'     THEN (1400000 + MOD(h, 1800000))::numeric
    WHEN 'electrical' THEN (280000  + MOD(h, 450000))::numeric
    WHEN 'body'       THEN (180000  + MOD(h, 320000))::numeric
    ELSE                   (380000  + MOD(h, 450000))::numeric
  END AS actual_amount,
  'eb57be3f-e8a3-4b4e-d806-3e7863d25eb4'::uuid AS approved_by,
  checked_at + INTERVAL '4 hours' AS approved_at,
  checked_at + INTERVAL '3 days'  AS eta_completion,
  CASE WHEN checked_at < NOW() - INTERVAL '30 days'
    THEN checked_at + INTERVAL '2 days'
    ELSE NULL
  END AS actual_completion,
  km_at_wo AS km_at_repair,
  (wo_priority::text = 'high' AND MOD(h,5)=0) AS is_emergency,
  (MOD(h, 5) = 1) AS is_recurring,
  'eb57be3f-e8a3-4b4e-d806-3e7863d25eb4'::uuid AS created_by,
  checked_at AS created_at,
  checked_at + INTERVAL '2 days' AS updated_at
FROM wo_data;

-- Kết quả
SELECT 'maintenance_records' AS tbl, COUNT(*) AS cnt FROM vehicle_maintenance_records
UNION ALL
SELECT 'work_orders', COUNT(*) FROM work_orders;

SELECT category::text, status::text, COUNT(*), ROUND(AVG(actual_amount)/1000,0) AS avg_k_vnd
FROM work_orders GROUP BY 1, 2 ORDER BY 1, 3 DESC;
