-- ===== CLEAN UP & PREPARE TEST DATA FOR 2026-03-16 =====

-- 1. Remove the 1 blocking trip on 2026-03-16
DELETE FROM trip_stops WHERE trip_id IN (
  SELECT id FROM trips WHERE planned_date = '2026-03-16' AND status NOT IN ('completed','cancelled','closed')
);
DELETE FROM trips WHERE planned_date = '2026-03-16' AND status NOT IN ('completed','cancelled','closed');

-- 2. Ensure all 2026-03-16 shipments are pending (reset any that drifted)
UPDATE shipments SET status = 'pending', trip_id = NULL 
WHERE delivery_date = '2026-03-16' AND status != 'pending';

-- 3. Clear driver checkins for 2026-03-16 to start fresh
DELETE FROM driver_checkins WHERE checkin_date = '2026-03-16';

-- 4. Create realistic driver checkins for 2026-03-16 (Kho Ha Long drivers)
--    40 available, 3 off_duty, 2 no check-in
INSERT INTO driver_checkins (driver_id, checkin_date, status) VALUES
  ('f0000000-0000-0000-0000-000000000001', '2026-03-16', 'available'),
  ('f0000000-0000-0000-0000-000000000002', '2026-03-16', 'available'),
  ('f0000000-0000-0000-0000-000000000003', '2026-03-16', 'available'),
  ('f0000000-0000-0000-0000-000000000004', '2026-03-16', 'off_duty'),
  ('f0000000-0000-0000-0000-000000000005', '2026-03-16', 'available'),
  ('f0000000-0000-0000-0000-000000000006', '2026-03-16', 'available'),
  ('f0000000-0000-0000-0000-000000000007', '2026-03-16', 'available'),
  ('f0000000-0000-0000-0000-000000000008', '2026-03-16', 'available'),
  ('f0000000-0000-0000-0000-000000000009', '2026-03-16', 'available'),
  ('f0000000-0000-0000-0000-000000000010', '2026-03-16', 'available')
ON CONFLICT (driver_id, checkin_date) DO UPDATE SET status = EXCLUDED.status;

-- 5. Also add some Kho Hai Phong driver checkins
INSERT INTO driver_checkins (driver_id, checkin_date, status) VALUES
  ('f1000000-0000-0000-0000-000000000001', '2026-03-16', 'available'),
  ('f1000000-0000-0000-0000-000000000002', '2026-03-16', 'available'),
  ('f1000000-0000-0000-0000-000000000003', '2026-03-16', 'off_duty'),
  ('f1000000-0000-0000-0000-000000000004', '2026-03-16', 'available'),
  ('f1000000-0000-0000-0000-000000000005', '2026-03-16', 'available')
ON CONFLICT (driver_id, checkin_date) DO UPDATE SET status = EXCLUDED.status;

-- Done
SELECT 'CLEANUP DONE' as result;
