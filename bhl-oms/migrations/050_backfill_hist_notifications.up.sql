-- 050_backfill_hist_notifications.up.sql
-- Backfill notifications for historical E2E events (last 60 days of hist data).
-- All backfilled notifications: is_read = TRUE, group_key prefix 'hist-bf-'.
-- Scope: trips/payments/recon/eod with planned_date >= '2026-03-01'.

BEGIN;

-- ============================================================
-- 1) DISPATCHER notifications: trip planned -> started -> completed
-- ============================================================
WITH disp AS (
  SELECT id FROM users WHERE role = 'dispatcher'
),
trip_events AS (
  SELECT
    t.id              AS trip_id,
    t.trip_number,
    t.planned_date,
    t.status,
    t.total_stops,
    t.total_weight_kg,
    t.started_at,
    t.completed_at,
    t.warehouse_id,
    w.code            AS wh_code
  FROM trips t
  JOIN warehouses w ON w.id = t.warehouse_id
  WHERE t.planned_date >= DATE '2026-03-01'
)
INSERT INTO notifications (user_id, title, body, category, link, priority, entity_type, entity_id, actions, group_key, is_read, created_at)
SELECT
  d.id,
  'Chuyến ' || te.trip_number || ' đã được lập lịch',
  'Kho ' || te.wh_code || ' • ' || te.total_stops || ' điểm dừng • ' || ROUND(te.total_weight_kg/1000.0, 2) || ' tấn',
  'trip',
  '/dashboard/trips/' || te.trip_id,
  'normal',
  'trip',
  te.trip_id,
  NULL,
  'hist-bf-trip-planned-' || te.trip_id::text,
  TRUE,
  (te.planned_date::timestamp + TIME '07:00:00') AT TIME ZONE 'Asia/Ho_Chi_Minh'
FROM trip_events te
CROSS JOIN disp d
ON CONFLICT DO NOTHING;

WITH disp AS (
  SELECT id FROM users WHERE role = 'dispatcher'
),
trip_started AS (
  SELECT t.id AS trip_id, t.trip_number, t.started_at, t.warehouse_id, w.code AS wh_code, t.total_stops
  FROM trips t JOIN warehouses w ON w.id = t.warehouse_id
  WHERE t.planned_date >= DATE '2026-03-01' AND t.started_at IS NOT NULL
)
INSERT INTO notifications (user_id, title, body, category, link, priority, entity_type, entity_id, group_key, is_read, created_at)
SELECT
  d.id,
  'Chuyến ' || ts.trip_number || ' đã xuất phát',
  'Kho ' || ts.wh_code || ' • ' || ts.total_stops || ' điểm dừng',
  'trip',
  '/dashboard/trips/' || ts.trip_id,
  'normal',
  'trip',
  ts.trip_id,
  'hist-bf-trip-started-' || ts.trip_id::text,
  TRUE,
  ts.started_at
FROM trip_started ts CROSS JOIN disp d
ON CONFLICT DO NOTHING;

WITH disp AS (
  SELECT id FROM users WHERE role = 'dispatcher'
),
trip_done AS (
  SELECT t.id AS trip_id, t.trip_number, t.completed_at, t.total_stops, t.total_weight_kg
  FROM trips t
  WHERE t.planned_date >= DATE '2026-03-01' AND t.completed_at IS NOT NULL AND t.status = 'completed'
)
INSERT INTO notifications (user_id, title, body, category, link, priority, entity_type, entity_id, group_key, is_read, created_at)
SELECT
  d.id,
  'Chuyến ' || td.trip_number || ' hoàn tất',
  td.total_stops || ' điểm dừng • ' || ROUND(td.total_weight_kg/1000.0, 2) || ' tấn đã giao',
  'trip',
  '/dashboard/trips/' || td.trip_id,
  'normal',
  'trip',
  td.trip_id,
  'hist-bf-trip-completed-' || td.trip_id::text,
  TRUE,
  td.completed_at
FROM trip_done td CROSS JOIN disp d
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2) DRIVER notifications: trip assigned + their stops completed
-- ============================================================
WITH driver_users AS (
  SELECT d.id AS driver_id, d.user_id FROM drivers d WHERE d.user_id IS NOT NULL
),
trip_assigned AS (
  SELECT t.id AS trip_id, t.trip_number, t.driver_id, t.planned_date, t.total_stops
  FROM trips t
  WHERE t.planned_date >= DATE '2026-03-01' AND t.driver_id IS NOT NULL
)
INSERT INTO notifications (user_id, title, body, category, link, priority, entity_type, entity_id, group_key, is_read, created_at)
SELECT
  du.user_id,
  'Bạn được phân công chuyến ' || ta.trip_number,
  'Ngày ' || TO_CHAR(ta.planned_date, 'DD/MM/YYYY') || ' • ' || ta.total_stops || ' điểm dừng',
  'trip',
  '/dashboard/driver/trips/' || ta.trip_id,
  'normal',
  'trip',
  ta.trip_id,
  'hist-bf-trip-assigned-' || ta.trip_id::text,
  TRUE,
  (ta.planned_date::timestamp + TIME '06:30:00') AT TIME ZONE 'Asia/Ho_Chi_Minh'
FROM trip_assigned ta
JOIN driver_users du ON du.driver_id = ta.driver_id
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3) ACCOUNTANT notifications: payments collected
-- ============================================================
WITH acct AS (
  SELECT id FROM users WHERE role = 'accountant'
),
pmt AS (
  SELECT p.id, p.amount, p.payment_method, p.collected_at, p.customer_id, c.name AS customer_name
  FROM payments p
  JOIN customers c ON c.id = p.customer_id
  WHERE p.collected_at >= TIMESTAMPTZ '2026-03-01' AND p.status = 'collected'
)
INSERT INTO notifications (user_id, title, body, category, link, priority, entity_type, entity_id, group_key, is_read, created_at)
SELECT
  a.id,
  'Thu tiền: ' || TO_CHAR(pmt.amount, 'FM999,999,999') || 'đ',
  pmt.customer_name || ' • ' || pmt.payment_method::text,
  'finance',
  '/dashboard/finance/payments',
  CASE WHEN pmt.amount >= 5000000 THEN 'high' ELSE 'normal' END,
  'payment',
  pmt.id,
  'hist-bf-payment-' || pmt.id::text,
  TRUE,
  pmt.collected_at
FROM pmt CROSS JOIN acct a
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4) ACCOUNTANT notifications: reconciliation closed
-- ============================================================
WITH acct AS (
  SELECT id FROM users WHERE role = 'accountant'
),
rec AS (
  SELECT r.id, r.trip_id, t.trip_number, r.recon_type, r.variance, r.reconciled_at, r.status
  FROM reconciliations r
  JOIN trips t ON t.id = r.trip_id
  WHERE r.reconciled_at >= TIMESTAMPTZ '2026-03-01'
)
INSERT INTO notifications (user_id, title, body, category, link, priority, entity_type, entity_id, group_key, is_read, created_at)
SELECT
  a.id,
  'Đối soát ' || rec.recon_type::text || ' chuyến ' || rec.trip_number,
  CASE WHEN rec.variance = 0 THEN 'Khớp 100%' ELSE 'Lệch ' || TO_CHAR(rec.variance, 'FM999,999,999') || 'đ' END,
  'reconciliation',
  '/dashboard/finance/reconciliation/' || rec.id,
  CASE WHEN ABS(rec.variance) >= 100000 THEN 'high' ELSE 'normal' END,
  'reconciliation',
  rec.id,
  'hist-bf-recon-' || rec.id::text,
  TRUE,
  rec.reconciled_at
FROM rec CROSS JOIN acct a
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5) DISPATCHER notifications: EOD completed
-- ============================================================
WITH disp AS (
  SELECT id FROM users WHERE role = 'dispatcher'
),
eod AS (
  SELECT e.id, e.trip_id, t.trip_number, e.total_stops_delivered, e.total_stops_failed,
         e.total_cash_collected, e.completed_at
  FROM eod_sessions e
  JOIN trips t ON t.id = e.trip_id
  WHERE e.completed_at >= TIMESTAMPTZ '2026-03-01' AND e.status = 'completed'
)
INSERT INTO notifications (user_id, title, body, category, link, priority, entity_type, entity_id, group_key, is_read, created_at)
SELECT
  d.id,
  'EoD chuyến ' || eod.trip_number,
  eod.total_stops_delivered || ' giao ✓ / ' || eod.total_stops_failed || ' thất bại • Thu ' || TO_CHAR(eod.total_cash_collected, 'FM999,999,999') || 'đ',
  'eod',
  '/dashboard/eod/' || eod.id,
  'normal',
  'eod_session',
  eod.id,
  'hist-bf-eod-' || eod.id::text,
  TRUE,
  eod.completed_at
FROM eod CROSS JOIN disp d
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6) DVKH notifications: order created (sample - cap to last 30 days to avoid bloat)
-- ============================================================
WITH dvkh AS (
  SELECT id FROM users WHERE role = 'dvkh'
),
so AS (
  SELECT s.id, s.order_number, s.customer_id, s.created_at, c.name AS customer_name, s.total_amount
  FROM sales_orders s
  JOIN customers c ON c.id = s.customer_id
  WHERE s.created_at >= TIMESTAMPTZ '2026-03-30'
)
INSERT INTO notifications (user_id, title, body, category, link, priority, entity_type, entity_id, group_key, is_read, created_at)
SELECT
  d.id,
  'Đơn mới ' || so.order_number,
  so.customer_name || ' • ' || TO_CHAR(so.total_amount, 'FM999,999,999') || 'đ',
  'order',
  '/dashboard/orders/' || so.id,
  'normal',
  'sales_order',
  so.id,
  'hist-bf-order-' || so.id::text,
  TRUE,
  so.created_at
FROM so CROSS JOIN dvkh d
ON CONFLICT DO NOTHING;

COMMIT;
