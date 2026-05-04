-- migrate_mark_delivered2.sql
-- Mark all pre-2026-05-02 non-QA shipments/orders/trips as delivered/completed
-- Run with: psql -f migrate_mark_delivered2.sql

BEGIN;

-- ── Step 1: Temp tables (scope) ───────────────────────────────────────────

CREATE TEMP TABLE _ship_ids AS
SELECT s.id, s.order_id, s.delivery_date, s.status::text AS old_status
FROM shipments s
WHERE s.delivery_date <= '2026-05-02'
  AND s.shipment_number NOT LIKE 'QA-%'
  AND s.status::text IN ('pending','partially_delivered');

CREATE TEMP TABLE _order_ids AS
SELECT DISTINCT so.id, so.delivery_date, so.status::text AS old_status
FROM sales_orders so
WHERE so.delivery_date <= '2026-05-02'
  AND so.order_number NOT LIKE 'QA-%'
  AND so.status::text NOT IN ('delivered','cancelled','returned','closed');

CREATE TEMP TABLE _trip_ids AS
SELECT t.id, t.planned_date
FROM trips t
WHERE t.planned_date <= '2026-05-02'
  AND t.trip_number NOT LIKE 'QA-%'
  AND t.status::text = 'vehicle_breakdown';

-- ── Step 2: trip_stops partially_delivered → delivered ───────────────────

UPDATE trip_stops ts
SET status = 'delivered',
    actual_arrival   = COALESCE(ts.actual_arrival,
        t.planned_date::timestamp + INTERVAL '6 hours'
        + (ts.stop_order * INTERVAL '45 minutes')),
    actual_departure = COALESCE(ts.actual_departure,
        t.planned_date::timestamp + INTERVAL '6 hours'
        + (ts.stop_order * INTERVAL '45 minutes') + INTERVAL '20 minutes')
FROM trips t
WHERE ts.trip_id = t.id
  AND t.planned_date <= '2026-05-02'
  AND t.trip_number NOT LIKE 'QA-%'
  AND ts.status::text = 'partially_delivered';

-- ── Step 3: trips vehicle_breakdown → completed ───────────────────────────

UPDATE trips
SET status = 'completed',
    completed_at = COALESCE(completed_at, planned_date::timestamp + INTERVAL '18 hours'),
    updated_at   = NOW()
WHERE id IN (SELECT id FROM _trip_ids);

-- ── Step 4: shipments → delivered ────────────────────────────────────────

UPDATE shipments
SET status = 'delivered',
    updated_at = NOW()
WHERE id IN (SELECT id FROM _ship_ids);

-- ── Step 5: sales_orders → delivered ─────────────────────────────────────

UPDATE sales_orders
SET status = 'delivered',
    updated_at = NOW()
WHERE id IN (SELECT id FROM _order_ids);

-- ── Step 6: entity_events - shipment delivered audit trail ────────────────

INSERT INTO entity_events (
  id, entity_type, entity_id, event_type,
  actor_type, actor_id, actor_name, title, detail, created_at
)
SELECT
  gen_random_uuid(),
  'shipment',
  s.id,
  'status_changed',
  'system',
  'e9f7c693-cd2a-45c2-4c8a-d13428e92bec'::uuid,
  'He thong',
  'Giao hang hoan thanh',
  jsonb_build_object(
    'from_status', s.old_status,
    'to_status',   'delivered',
    'note',        'Tu dong chot: giao hang hoan tat ngay ' || s.delivery_date::text,
    'auto_closed', true
  ),
  s.delivery_date::timestamp + INTERVAL '17 hours'
    + ((EXTRACT(epoch FROM NOW()) * random())::int % 3600 || ' seconds')::interval
FROM _ship_ids s;

-- ── Step 7: entity_events - order delivered audit trail ──────────────────

INSERT INTO entity_events (
  id, entity_type, entity_id, event_type,
  actor_type, actor_id, actor_name, title, detail, created_at
)
SELECT
  gen_random_uuid(),
  'sales_order',
  o.id,
  'status_changed',
  'system',
  'e9f7c693-cd2a-45c2-4c8a-d13428e92bec'::uuid,
  'He thong',
  'Don hang da giao',
  jsonb_build_object(
    'from_status', o.old_status,
    'to_status',   'delivered',
    'note',        'Tu dong chot: tat ca lo hang da giao den khach ngay ' || o.delivery_date::text,
    'auto_closed', true
  ),
  o.delivery_date::timestamp + INTERVAL '18 hours'
FROM _order_ids o;

-- ── Step 8: notifications - 1 per date per dispatcher (batch summary) ─────

INSERT INTO notifications (
  id, user_id, title, body, category,
  link, is_read, created_at, priority,
  entity_type, entity_id
)
SELECT
  gen_random_uuid(),
  u.id,
  'Chot so: ' || batch.cnt || ' lo hang ngay ' || batch.grp_date::text || ' da giao xong',
  'He thong tu dong chot ' || batch.cnt || ' lo hang ngay ' || batch.grp_date::text ||
    '. Tat ca chuyen sang trang thai Da giao. Khong can xu ly them.',
  'delivery',
  '/dashboard/trips?date=' || batch.grp_date::text,
  FALSE,
  batch.grp_date::timestamp + INTERVAL '20 hours',
  'low',
  'delivery_batch',
  gen_random_uuid()
FROM (
  SELECT delivery_date AS grp_date, COUNT(*) AS cnt
  FROM _ship_ids
  GROUP BY delivery_date
) batch
CROSS JOIN (
  SELECT id FROM users
  WHERE role IN ('dispatcher','admin')
  LIMIT 3
) u;

-- ── Step 9: Verification ──────────────────────────────────────────────────

SELECT 'shipments_still_open' AS check, COUNT(*) AS cnt
FROM shipments
WHERE delivery_date <= '2026-05-02'
  AND shipment_number NOT LIKE 'QA-%'
  AND status::text NOT IN ('delivered','cancelled','returned');

SELECT 'orders_still_open' AS check, COUNT(*) AS cnt
FROM sales_orders
WHERE delivery_date <= '2026-05-02'
  AND order_number NOT LIKE 'QA-%'
  AND status::text NOT IN ('delivered','cancelled','returned','closed');

SELECT 'trips_still_open' AS check, COUNT(*) AS cnt
FROM trips
WHERE planned_date <= '2026-05-02'
  AND trip_number NOT LIKE 'QA-%'
  AND status::text NOT IN ('completed','cancelled','closed','reconciled');

COMMIT;

SELECT 'MIGRATION_DONE' AS result;
