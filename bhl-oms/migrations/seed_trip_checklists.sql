-- =============================================================================
-- SEED: trip_checklists dựa trên logic thực tế
-- Rule:
--   - Mỗi trip → 1 checklist, 30–60 phút trước started_at
--   - 95% all-pass (xe tốt), 4% có 1-2 hạng mục cảnh báo nhỏ, 1% fail
--   - fuel_level (1-10): phân phối thực tế 6-10 (xe xuất phát đủ xăng)
--   - Nếu trip có nhiều stops và tải nặng → coolant/tire check kỹ hơn
-- =============================================================================

-- Xóa seed cũ nếu có
TRUNCATE TABLE trip_checklists;

INSERT INTO trip_checklists (
  id, trip_id, driver_id, vehicle_id,
  tires_ok, brakes_ok, lights_ok, mirrors_ok, horn_ok,
  coolant_ok, oil_ok, fuel_level,
  fire_extinguisher_ok, first_aid_ok, documents_ok, cargo_secured,
  is_passed, notes, checked_at
)
WITH trip_data AS (
  SELECT
    t.id           AS trip_id,
    t.driver_id,
    t.vehicle_id,
    t.started_at,
    t.total_stops,
    t.total_distance_km,
    -- Hash để tạo pattern deterministic (dùng bigint để tránh int4 overflow)
    (hashtext(t.id::text)::bigint & 2147483647)                   AS h,
    (hashtext(t.id::text || 'v2')::bigint & 2147483647)            AS h2,
    (hashtext(t.id::text || 'fuel')::bigint & 2147483647)          AS hf
  FROM trips t
  WHERE t.driver_id IS NOT NULL
    AND t.vehicle_id IS NOT NULL
    AND t.started_at IS NOT NULL
),
classified AS (
  SELECT *,
    -- Phân loại: 0–94 = all_pass, 95–98 = warning (1-2 items nhỏ), 99 = fail
    MOD(h, 100) AS trip_class,
    -- fuel_level: hầu hết 7-10 (xe mới xăng), xe đường xa (>100km) đôi khi 6
    CASE
      WHEN total_distance_km > 100 AND MOD(hf, 10) < 2 THEN 6
      WHEN MOD(hf, 10) < 4 THEN 7
      WHEN MOD(hf, 10) < 7 THEN 8
      WHEN MOD(hf, 10) < 9 THEN 9
      ELSE 10
    END AS fuel_val
  FROM trip_data
)
SELECT
  gen_random_uuid()      AS id,
  trip_id,
  driver_id,
  vehicle_id,

  -- Tires: OK trừ 1% fail trips (thường là xe cũ, simulated)
  CASE WHEN trip_class = 99 AND MOD(h2, 3) = 0 THEN false ELSE true END AS tires_ok,

  -- Brakes: rất ít fail (safety critical)
  CASE WHEN trip_class = 99 AND MOD(h2, 5) = 0 THEN false ELSE true END AS brakes_ok,

  -- Lights: warning trips có thể bị 1 đèn lỗi nhỏ
  CASE WHEN trip_class >= 97 AND MOD(h2, 4) = 0 THEN false ELSE true END AS lights_ok,

  -- Mirrors: tương tự lights
  CASE WHEN trip_class >= 98 AND MOD(h2, 3) = 1 THEN false ELSE true END AS mirrors_ok,

  -- Horn: hiếm khi lỗi
  CASE WHEN trip_class = 99 AND MOD(h2, 7) = 0 THEN false ELSE true END AS horn_ok,

  -- Coolant: xe đường dài hay warning
  CASE WHEN trip_class >= 96 AND total_distance_km > 80 AND MOD(h, 3) = 0 THEN false ELSE true END AS coolant_ok,

  -- Oil: ít lỗi trừ xe cần bảo dưỡng
  CASE WHEN trip_class = 99 AND MOD(h2, 4) = 1 THEN false ELSE true END AS oil_ok,

  fuel_val AS fuel_level,

  -- Safety equipment: rất ít thiếu (quy định bắt buộc)
  CASE WHEN trip_class = 99 AND MOD(h, 9) = 0 THEN false ELSE true END AS fire_extinguisher_ok,
  true AS first_aid_ok,    -- first aid luôn có (kiểm tra nghiêm)
  true AS documents_ok,    -- giấy tờ luôn đủ

  -- Cargo: warning nếu chuyến nhiều stops và tải nặng
  CASE WHEN trip_class >= 96 AND total_stops > 8 AND MOD(h2, 5) = 2 THEN false ELSE true END AS cargo_secured,

  -- is_passed: fail nếu bất kỳ critical item fail
  CASE
    WHEN trip_class = 99 THEN false
    WHEN trip_class >= 97 AND MOD(h2 + h, 5) = 0 THEN false  -- 1 số warning trip cũng không đạt
    ELSE true
  END AS is_passed,

  -- Notes: ghi chú thực tế
  CASE
    WHEN trip_class = 99 THEN
      CASE MOD(h2, 4)
        WHEN 0 THEN 'Lốp trước bên trái áp suất thấp, cần bơm'
        WHEN 1 THEN 'Mức dầu gần vạch MIN, cần bổ sung trước khi xuất phát'
        WHEN 2 THEN 'Hàng hóa chưa được cố định đúng quy cách'
        ELSE 'Đèn hậu bên phải không sáng, cần kiểm tra bóng đèn'
      END
    WHEN trip_class >= 96 THEN
      CASE MOD(h, 3)
        WHEN 0 THEN 'Mực nước làm mát cần bổ sung nhẹ'
        WHEN 1 THEN 'Đèn xi-nhan bên trái nhấp nháy không đều'
        ELSE 'Gương chiếu hậu cần chỉnh lại'
      END
    ELSE NULL
  END AS notes,

  -- checked_at: 30–60 phút trước khi xe xuất phát (thực tế lái xe kiểm tra trước)
  started_at - ((30 + MOD(h, 30)) * INTERVAL '1 minute') AS checked_at

FROM classified;

-- Kết quả kiểm tra
SELECT
  COUNT(*)                                        AS total_checklists,
  COUNT(DISTINCT trip_id)                         AS trips_covered,
  SUM(CASE WHEN is_passed THEN 1 ELSE 0 END)      AS passed,
  SUM(CASE WHEN NOT is_passed THEN 1 ELSE 0 END)  AS failed,
  ROUND(AVG(fuel_level)::numeric, 1)              AS avg_fuel_level,
  ROUND(100.0 * SUM(CASE WHEN is_passed THEN 1 ELSE 0 END) / COUNT(*), 1) AS pass_rate_pct
FROM trip_checklists;
