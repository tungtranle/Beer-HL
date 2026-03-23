-- Show current dates for debugging
SELECT CURRENT_DATE as pg_current_date, 
       (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date as vietnam_date;

-- Show delivery dates in orders
SELECT DISTINCT delivery_date FROM sales_orders ORDER BY delivery_date DESC LIMIT 5;

-- Insert check-in for BOTH dates (PostgreSQL CURRENT_DATE + Vietnam date)
-- This handles the timezone mismatch
INSERT INTO driver_checkins (driver_id, checkin_date, status, checked_in_at)
SELECT d.id, CURRENT_DATE, 'available', NOW() - INTERVAL '1 hour'
FROM drivers d
WHERE d.status = 'active'
ORDER BY d.full_name
LIMIT 15
ON CONFLICT (driver_id, checkin_date) DO UPDATE SET status = 'available';

-- Also insert for Vietnam date in case it differs
INSERT INTO driver_checkins (driver_id, checkin_date, status, checked_in_at)
SELECT d.id, (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'available', NOW() - INTERVAL '1 hour'
FROM drivers d
WHERE d.status = 'active'
ORDER BY d.full_name
LIMIT 15
ON CONFLICT (driver_id, checkin_date) DO UPDATE SET status = 'available';

-- Also insert for whatever delivery date exists in orders today
INSERT INTO driver_checkins (driver_id, checkin_date, status, checked_in_at)
SELECT d.id, so.delivery_date, 'available', NOW() - INTERVAL '1 hour'
FROM drivers d
CROSS JOIN (SELECT DISTINCT delivery_date FROM sales_orders WHERE delivery_date >= CURRENT_DATE - 1 LIMIT 1) so
WHERE d.status = 'active'
ORDER BY d.full_name
LIMIT 15
ON CONFLICT (driver_id, checkin_date) DO UPDATE SET status = 'available';

-- Final verification
SELECT checkin_date, COUNT(*) as available 
FROM driver_checkins 
WHERE status = 'available' 
GROUP BY checkin_date 
ORDER BY checkin_date DESC;
