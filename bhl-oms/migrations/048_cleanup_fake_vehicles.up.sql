-- Migration 048: Dọn xe fake QA + hoàn thiện mapping tài xế-xe
-- Mốc tham chiếu: 23/04/2026
--
-- Thực tế BHL (đã xác nhận từ DB):
--   Kho Hạ Long  (WH-HL): 50 xe thực (14C/14M/14N/14P biển QN), 50 tài xế
--   Kho Đông Mai (WH-DM):  8 xe (14H00904V + 15C-21001..21007), 9 tài xế
--
-- Vấn đề cần xử lý:
--   1. 55 xe test QA8T-VRP-01..55 còn sót sau khi DEMO-VRP scenario chưa cleanup đúng
--   2. Một số xe thực chưa có default_driver_id ↔ default_vehicle_id

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Deactivate 55 xe fake QA test (biển không hợp lệ: QA8T-VRP-xx)
--    Soft-delete (status=inactive) thay vì DELETE để tránh vi phạm FK
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE vehicles
   SET status = 'inactive'
 WHERE plate_number LIKE 'QA8T-VRP-%';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Hoàn thiện default_driver ↔ default_vehicle mapping cho Kho Hạ Long
--    Ghép tài xế chưa có xe ↔ xe chưa có tài xế (theo thứ tự alphabet)
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. Cập nhật vehicles.default_driver_id
WITH
  unassigned_v AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY plate_number) AS rn
      FROM vehicles
     WHERE warehouse_id = 'a0000000-0000-0000-0000-000000000001'
       AND status = 'active'
       AND default_driver_id IS NULL
       AND plate_number NOT LIKE 'QA8T-VRP-%'
  ),
  unassigned_d AS (
    SELECT d.id AS did, ROW_NUMBER() OVER (ORDER BY u.username) AS rn
      FROM drivers d
      JOIN users u ON u.id = d.user_id
     WHERE d.warehouse_id = 'a0000000-0000-0000-0000-000000000001'
       AND d.default_vehicle_id IS NULL
       AND d.status = 'active'
  )
UPDATE vehicles v
   SET default_driver_id = m.did
  FROM (SELECT uv.id AS vid, ud.did
          FROM unassigned_v uv
          JOIN unassigned_d ud ON ud.rn = uv.rn) m
 WHERE v.id = m.vid;

-- 2b. Đồng bộ lại drivers.default_vehicle_id từ mapping vừa set
UPDATE drivers d
   SET default_vehicle_id = v.id
  FROM vehicles v
 WHERE v.default_driver_id = d.id
   AND v.warehouse_id  = 'a0000000-0000-0000-0000-000000000001'
   AND v.status        = 'active'
   AND d.default_vehicle_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Hoàn thiện mapping cho Kho Đông Mai
-- ─────────────────────────────────────────────────────────────────────────────

-- 3a. vehicles.default_driver_id cho WH-DM
--     Chỉ ghép xe chưa có default_driver_id VÀ chưa được driver nào reference
WITH
  unassigned_v_dm AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY plate_number) AS rn
      FROM vehicles
     WHERE warehouse_id = 'a0000000-0000-0000-0000-000000000002'
       AND status = 'active'
       AND default_driver_id IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM drivers d2 WHERE d2.default_vehicle_id = vehicles.id
       )
  ),
  unassigned_d_dm AS (
    SELECT d.id AS did, ROW_NUMBER() OVER (ORDER BY u.username) AS rn
      FROM drivers d
      JOIN users u ON u.id = d.user_id
     WHERE d.warehouse_id = 'a0000000-0000-0000-0000-000000000002'
       AND d.default_vehicle_id IS NULL
       AND d.status = 'active'
  )
UPDATE vehicles v
   SET default_driver_id = m.did
  FROM (SELECT uv.id AS vid, ud.did
          FROM unassigned_v_dm uv
          JOIN unassigned_d_dm ud ON ud.rn = uv.rn) m
 WHERE v.id = m.vid;

-- 3b. drivers.default_vehicle_id cho WH-DM
UPDATE drivers d
  SET default_vehicle_id = v.id
  FROM vehicles v
 WHERE v.default_driver_id = d.id
   AND v.warehouse_id  = 'a0000000-0000-0000-0000-000000000002'
   AND v.status        = 'active'
   AND d.default_vehicle_id IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM drivers d2
      WHERE d2.default_vehicle_id = v.id AND d2.id != d.id
   );

COMMIT;
