-- ============================================================
-- PATCH: Fix missing demo data (reconciliations, driver checkins, discrepancies, pending orders)
-- Run AFTER seed_demo_comprehensive.sql
-- Uses actual DB UUIDs (0000-0000-0000 pattern)
-- ============================================================

BEGIN;

-- ============================================================
-- 1) MORE DRIVER CHECKINS  (target: ~63 available = 80% of 79)
--    Already checked in: f0000000-001..010, f1000000-041..045 (13 avail, 2 off)
--    Adding remaining drivers
-- ============================================================

INSERT INTO driver_checkins (id, driver_id, checkin_date, status, checked_in_at)
VALUES
  -- f0000000 drivers 11-12
  (gen_random_uuid(), 'f0000000-0000-0000-0000-000000000011', CURRENT_DATE, 'available', NOW() - interval '3 hours'),
  (gen_random_uuid(), 'f0000000-0000-0000-0000-000000000012', CURRENT_DATE, 'available', NOW() - interval '3 hours'),
  -- f1000000 drivers 4-40 (37 drivers: 35 available + 2 off_duty)
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000004', CURRENT_DATE, 'available', NOW() - interval '4 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000005', CURRENT_DATE, 'available', NOW() - interval '4 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000006', CURRENT_DATE, 'available', NOW() - interval '4 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000007', CURRENT_DATE, 'available', NOW() - interval '3 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000008', CURRENT_DATE, 'available', NOW() - interval '3 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000009', CURRENT_DATE, 'available', NOW() - interval '3 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000010', CURRENT_DATE, 'available', NOW() - interval '3 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000011', CURRENT_DATE, 'available', NOW() - interval '3 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000012', CURRENT_DATE, 'available', NOW() - interval '2 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000013', CURRENT_DATE, 'available', NOW() - interval '2 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000014', CURRENT_DATE, 'available', NOW() - interval '2 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000015', CURRENT_DATE, 'available', NOW() - interval '2 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000016', CURRENT_DATE, 'available', NOW() - interval '2 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000017', CURRENT_DATE, 'available', NOW() - interval '2 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000018', CURRENT_DATE, 'available', NOW() - interval '2 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000019', CURRENT_DATE, 'available', NOW() - interval '2 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000020', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000021', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000022', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000023', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000024', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000025', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000026', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000027', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000028', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000029', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000030', CURRENT_DATE, 'available', NOW() - interval '30 minutes'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000031', CURRENT_DATE, 'available', NOW() - interval '30 minutes'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000032', CURRENT_DATE, 'available', NOW() - interval '30 minutes'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000033', CURRENT_DATE, 'available', NOW() - interval '30 minutes'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000034', CURRENT_DATE, 'available', NOW() - interval '30 minutes'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000035', CURRENT_DATE, 'available', NOW() - interval '30 minutes'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000036', CURRENT_DATE, 'available', NOW() - interval '30 minutes'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000037', CURRENT_DATE, 'available', NOW() - interval '30 minutes'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000038', CURRENT_DATE, 'available', NOW() - interval '30 minutes'),
  -- 2 off_duty
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000039', CURRENT_DATE, 'off_duty', NOW() - interval '4 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000040', CURRENT_DATE, 'off_duty', NOW() - interval '4 hours'),
  -- f1000000 drivers 46-60 (13 available + 2 off_duty)
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000046', CURRENT_DATE, 'available', NOW() - interval '2 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000047', CURRENT_DATE, 'available', NOW() - interval '2 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000048', CURRENT_DATE, 'available', NOW() - interval '2 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000049', CURRENT_DATE, 'available', NOW() - interval '2 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000050', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000051', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000052', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000053', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000054', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000055', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000056', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000057', CURRENT_DATE, 'available', NOW() - interval '1 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000058', CURRENT_DATE, 'available', NOW() - interval '30 minutes'),
  -- 2 off_duty
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000059', CURRENT_DATE, 'off_duty', NOW() - interval '3 hours'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000060', CURRENT_DATE, 'off_duty', NOW() - interval '3 hours')
ON CONFLICT (driver_id, checkin_date) DO NOTHING;

-- Result: 13 existing + 50 new available = 63 available (79.7%)
--         2 existing + 4 new off_duty = 6 off_duty
--         Total checked in: 69 out of 79

-- ============================================================
-- 2) RECONCILIATION DATA for completed trips
--    Trip 1: 44444444-...-01 (TR-20260310-001) - 4 stops
--    Trip 2: 44444444-...-02 (TR-20260311-001) - 2 stops
--    Trip 3: 44444444-...-03 (TR-20260312-001) - 3 stops
--    Trip 4: 44444444-...-04 (TR-20260313-001) - 2 stops
-- ============================================================

-- Goods reconciliation (all 4 trips)
INSERT INTO reconciliations (id, trip_id, recon_type, status, expected_value, actual_value, variance, details, reconciled_by, reconciled_at, created_at)
VALUES
  ('aaa00001-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', 'goods',   'matched',     150, 150,   0, '{"note":"Đối soát hàng hóa hoàn tất - khớp 100%"}',     'b0000000-0000-0000-0000-000000000008', NOW() - interval '5 days', NOW() - interval '5 days'),
  ('aaa00001-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000002', 'goods',   'matched',      80,  80,   0, '{"note":"Đối soát hàng hóa hoàn tất - khớp 100%"}',     'b0000000-0000-0000-0000-000000000008', NOW() - interval '4 days', NOW() - interval '4 days'),
  ('aaa00001-0000-0000-0000-000000000003', '44444444-0000-0000-0000-000000000003', 'goods',   'discrepancy', 120, 115,  -5, '{"note":"Thiếu 5 thùng bia tại điểm giao thứ 2"}',      'b0000000-0000-0000-0000-000000000008', NOW() - interval '3 days', NOW() - interval '3 days'),
  ('aaa00001-0000-0000-0000-000000000004', '44444444-0000-0000-0000-000000000004', 'goods',   'matched',      90,  90,   0, '{"note":"Đối soát hàng hóa hoàn tất - khớp 100%"}',     'b0000000-0000-0000-0000-000000000008', NOW() - interval '2 days', NOW() - interval '2 days'),
  -- Payment reconciliation (all 4 trips)
  ('aaa00002-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', 'payment', 'matched',   45000000, 45000000,       0, '{"note":"Thanh toán khớp - tiền mặt + chuyển khoản"}', 'b0000000-0000-0000-0000-000000000008', NOW() - interval '5 days', NOW() - interval '5 days'),
  ('aaa00002-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000002', 'payment', 'matched',   24000000, 24000000,       0, '{"note":"Thanh toán khớp"}',                            'b0000000-0000-0000-0000-000000000008', NOW() - interval '4 days', NOW() - interval '4 days'),
  ('aaa00002-0000-0000-0000-000000000003', '44444444-0000-0000-0000-000000000003', 'payment', 'discrepancy', 36000000, 34500000, -1500000, '{"note":"Thiếu 1.5 triệu tại Khách hàng C"}',          'b0000000-0000-0000-0000-000000000008', NOW() - interval '3 days', NOW() - interval '3 days'),
  ('aaa00002-0000-0000-0000-000000000004', '44444444-0000-0000-0000-000000000004', 'payment', 'resolved',  27000000, 26500000,  -500000, '{"note":"Đã xác nhận bù trừ công nợ 500k"}',            'b0000000-0000-0000-0000-000000000008', NOW() - interval '2 days', NOW() - interval '2 days'),
  -- Asset reconciliation (all 4 trips)
  ('aaa00003-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', 'asset',   'matched',      20,  20,   0, '{"note":"Két đầy đủ, xe sạch"}',                         'b0000000-0000-0000-0000-000000000008', NOW() - interval '5 days', NOW() - interval '5 days'),
  ('aaa00003-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000002', 'asset',   'matched',      15,  15,   0, '{"note":"Két đầy đủ"}',                                  'b0000000-0000-0000-0000-000000000008', NOW() - interval '4 days', NOW() - interval '4 days'),
  ('aaa00003-0000-0000-0000-000000000003', '44444444-0000-0000-0000-000000000003', 'asset',   'discrepancy',  18,  16,  -2, '{"note":"Thiếu 2 két trả lại"}',                         'b0000000-0000-0000-0000-000000000008', NOW() - interval '3 days', NOW() - interval '3 days'),
  ('aaa00003-0000-0000-0000-000000000004', '44444444-0000-0000-0000-000000000004', 'asset',   'matched',      12,  12,   0, '{"note":"Tài sản đầy đủ"}',                              'b0000000-0000-0000-0000-000000000008', NOW() - interval '2 days', NOW() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3) DISCREPANCIES for trips with discrepancy status
--    Trip 3 (TR-20260312-001) has goods + payment + asset discrepancies
--    Trip 4 (TR-20260313-001) has payment resolved
-- ============================================================

INSERT INTO discrepancies (id, recon_id, trip_id, stop_id, disc_type, status, description, expected_value, actual_value, variance, resolution, assigned_to, deadline, resolved_at, resolved_by, created_at)
VALUES
  -- Trip 3: goods discrepancy (open) at stop 2
  ('bbb00001-0000-0000-0000-000000000001',
   'aaa00001-0000-0000-0000-000000000003', '44444444-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000008',
   'goods', 'open',
   'Thiếu 5 thùng Bia Hạ Long Premium tại điểm giao 2 - Quán Biển Xanh',
   120, 115, -5,
   NULL, 'b0000000-0000-0000-0000-000000000008', NOW() + interval '2 days', NULL, NULL,
   NOW() - interval '3 days'),

  -- Trip 3: payment discrepancy (investigating) 
  ('bbb00001-0000-0000-0000-000000000002',
   'aaa00002-0000-0000-0000-000000000003', '44444444-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000009',
   'payment', 'investigating',
   'Thiếu 1.5 triệu VNĐ tiền thu hộ tại Khách hàng C - đang xác minh với tài xế',
   36000000, 34500000, -1500000,
   NULL, 'b0000000-0000-0000-0000-000000000008', NOW() + interval '1 day', NULL, NULL,
   NOW() - interval '3 days'),

  -- Trip 3: asset discrepancy (escalated)
  ('bbb00001-0000-0000-0000-000000000003',
   'aaa00003-0000-0000-0000-000000000003', '44444444-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000007',
   'asset', 'escalated',
   'Thiếu 2 két bia trả lại - khách hàng không xác nhận nhận hàng',
   18, 16, -2,
   NULL, 'b0000000-0000-0000-0000-000000000004', NOW() + interval '3 days', NULL, NULL,
   NOW() - interval '3 days'),

  -- Trip 4: payment discrepancy (resolved)
  ('bbb00001-0000-0000-0000-000000000004',
   'aaa00002-0000-0000-0000-000000000004', '44444444-0000-0000-0000-000000000004', '55555555-0000-0000-0000-000000000010',
   'payment', 'resolved',
   'Thiếu 500k do khách hàng bù trừ công nợ cũ - đã xác nhận',
   27000000, 26500000, -500000,
   'Đã xác nhận với KH và kế toán - bù trừ công nợ hợp lệ',
   'b0000000-0000-0000-0000-000000000008', NOW() + interval '1 day',
   NOW() - interval '1 day', 'b0000000-0000-0000-0000-000000000008',
   NOW() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4) ADDITIONAL PENDING_APPROVAL ORDERS (unique order numbers)
-- ============================================================

INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, total_amount, notes, delivery_date, created_at)
VALUES
  ('11111111-0000-0000-0000-000000000098', 'SO-20260317-0001', 'd0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'pending_approval', 85000000, 'Đơn hàng lớn - vượt hạn mức tín dụng 20%', CURRENT_DATE + 1, NOW() - interval '1 day'),
  ('11111111-0000-0000-0000-000000000099', 'SO-20260317-0002', 'c51dfd15-2741-4a1c-a252-ee470473b268', 'a0000000-0000-0000-0000-000000000002',
   'pending_approval', 120000000, 'Đơn hàng đặc biệt - cần phê duyệt giám đốc', CURRENT_DATE + 1, NOW() - interval '12 hours')
ON CONFLICT (id) DO NOTHING;

COMMIT;
