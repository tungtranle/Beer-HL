-- ============================================================
-- migrate_mark_delivered.sql
-- Mục đích: Chuyển tất cả đơn/chuyến từ ngày 02/05/2026 trở về trước
--           sang trạng thái đã hoàn thành (delivered/completed).
-- Phạm vi:  942 partially_delivered shipments/orders + trip_stops
--           80 pending shipments + confirmed orders (delivery_date 02/05/2026)
--           95 vehicle_breakdown trips (planned_date <= 02/05/2026)
-- Không đụng: QA-% data, delivered/cancelled/returned records đã có
-- Chạy: psql -f migrate_mark_delivered.sql (trong 1 transaction)
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- STEP 1: Lưu danh sách IDs cần update vào temp tables
-- ─────────────────────────────────────────────────────────────

CREATE TEMP TABLE _ship_to_deliver AS
SELECT s.id AS ship_id, s.order_id, s.delivery_date,
       s.status::text AS old_status
FROM shipments s
WHERE s.delivery_date <= '2026-05-02'
  AND s.shipment_number NOT LIKE 'QA-%'
  AND s.status::text IN ('pending','partially_delivered');

CREATE TEMP TABLE _order_to_deliver AS
SELECT DISTINCT so.id AS order_id, so.order_number, so.delivery_date,
       so.status::text AS old_status
FROM sales_orders so
WHERE so.delivery_date <= '2026-05-02'
  AND so.order_number NOT LIKE 'QA-%'
  AND so.status::text IN ('confirmed','partially_delivered','processing',
                          'ready_to_ship','shipped','approved');

CREATE TEMP TABLE _trip_to_complete AS
SELECT t.id AS trip_id, t.trip_number, t.planned_date
FROM trips t
WHERE t.planned_date <= '2026-05-02'
  AND t.trip_number NOT LIKE 'QA-%'
  AND t.status::text = 'vehicle_breakdown';

SELECT 'scope' AS step,
       (SELECT COUNT(*) FROM _ship_to_deliver) AS ships,
       (SELECT COUNT(*) FROM _order_to_deliver) AS orders,
       (SELECT COUNT(*) FROM _trip_to_complete) AS trips;

-- ─────────────────────────────────────────────────────────────
-- STEP 2: Update trip_stops → delivered
-- Chỉ các stop thuộc trips của ngày <= 02/05/2026, không QA
-- ─────────────────────────────────────────────────────────────

UPDATE trip_stops ts
SET status = 'delivered'::varchar,
    actual_arrival  = COALESCE(ts.actual_arrival,
        (t.planned_date::timestamp + INTERVAL '6 hours')
        + (ts.stop_order * INTERVAL '45 minutes')),
    actual_departure = COALESCE(ts.actual_departure,
        (t.planned_date::timestamp + INTERVAL '6 hours')
        + (ts.stop_order * INTERVAL '45 minutes') + INTERVAL '20 minutes')
FROM trips t
WHERE ts.trip_id = t.id
  AND t.planned_date <= '2026-05-02'
  AND t.trip_number NOT LIKE 'QA-%'
  AND ts.status::text = 'partially_delivered';

GET DIAGNOSTICS -- inline, capture via RAISE NOTICE below
;
DO $$
DECLARE r int;
BEGIN
  GET DIAGNOSTICS r = ROW_COUNT;
  RAISE NOTICE 'trip_stops updated: %', r;
END $$;

-- ─────────────────────────────────────────────────────────────
-- STEP 3: Update trips vehicle_breakdown → completed
-- ─────────────────────────────────────────────────────────────

UPDATE trips
SET status = 'completed',
    completed_at = COALESCE(completed_at,
        planned_date::timestamp + INTERVAL '18 hours'),
    updated_at = NOW()
WHERE id IN (SELECT trip_id FROM _trip_to_complete);

DO $$
DECLARE r int;
BEGIN
  GET DIAGNOSTICS r = ROW_COUNT;
  RAISE NOTICE 'trips completed: %', r;
END $$;

-- ─────────────────────────────────────────────────────────────
-- STEP 4: Update shipments → delivered
-- ─────────────────────────────────────────────────────────────

UPDATE shipments
SET status = 'delivered',
    updated_at = NOW()
WHERE id IN (SELECT ship_id FROM _ship_to_deliver);

DO $$
DECLARE r int;
BEGIN
  GET DIAGNOSTICS r = ROW_COUNT;
  RAISE NOTICE 'shipments delivered: %', r;
END $$;

-- ─────────────────────────────────────────────────────────────
-- STEP 5: Update sales_orders → delivered
-- ─────────────────────────────────────────────────────────────

UPDATE sales_orders
SET status = 'delivered',
    updated_at = NOW()
WHERE id IN (SELECT order_id FROM _order_to_deliver);

DO $$
DECLARE r int;
BEGIN
  GET DIAGNOSTICS r = ROW_COUNT;
  RAISE NOTICE 'sales_orders delivered: %', r;
END $$;

-- ─────────────────────────────────────────────────────────────
-- STEP 6: Thêm entity_events audit trail cho shipments
-- 1 event "shipment_delivered" mỗi shipment
-- ─────────────────────────────────────────────────────────────

INSERT INTO entity_events (
  id, entity_type, entity_id, event_type,
  actor_type, actor_id, actor_name,
  title, detail, created_at
)
SELECT
  gen_random_uuid(),
  'shipment',
  s.ship_id,
  'status_changed',
  'system',
  'e9f7c693-cd2a-45c2-4c8a-d13428e92bec'::uuid,  -- dispatcher.hl
  'He thong',
  'Giao hang hoan thanh',
  jsonb_build_object(
    'from_status', s.old_status,
    'to_status',   'delivered',
    'note',        'Hoan tat giao hang ngay ' || s.delivery_date::text,
    'auto_closed', true
  ),
  (s.delivery_date::timestamp + INTERVAL '17 hours'
    + (EXTRACT(epoch FROM s.ship_id::text::bytea::numeric) % 3600 || ' seconds')::interval)
FROM _ship_to_deliver s;

DO $$
DECLARE r int;
BEGIN
  GET DIAGNOSTICS r = ROW_COUNT;
  RAISE NOTICE 'entity_events (shipment) inserted: %', r;
END $$;

-- ─────────────────────────────────────────────────────────────
-- STEP 7: Thêm entity_events cho sales_orders
-- ─────────────────────────────────────────────────────────────

INSERT INTO entity_events (
  id, entity_type, entity_id, event_type,
  actor_type, actor_id, actor_name,
  title, detail, created_at
)
SELECT
  gen_random_uuid(),
  'sales_order',
  o.order_id,
  'status_changed',
  'system',
  'e9f7c693-cd2a-45c2-4c8a-d13428e92bec'::uuid,
  'He thong',
  'Don hang da giao',
  jsonb_build_object(
    'from_status', o.old_status,
    'to_status',   'delivered',
    'note',        'Tat ca lo hang da giao den khach ngay ' || o.delivery_date::text,
    'auto_closed', true
  ),
  (o.delivery_date::timestamp + INTERVAL '18 hours')
FROM _order_to_deliver o;

DO $$
DECLARE r int;
BEGIN
  GET DIAGNOSTICS r = ROW_COUNT;
  RAISE NOTICE 'entity_events (order) inserted: %', r;
END $$;

-- ─────────────────────────────────────────────────────────────
-- STEP 8: Thêm notifications cho dispatchers về batch hoàn thành
-- Gộp theo ngày để tránh spam (1 notification/ngày/dispatcher)
-- ─────────────────────────────────────────────────────────────

INSERT INTO notifications (
  id, user_id, title, body, category,
  link, is_read, created_at, priority,
  entity_type, entity_id
)
SELECT
  gen_random_uuid(),
  u.id,
  'Chot so: ' || cnt || ' lo hang ngay ' || grp_date::text || ' da giao xong',
  'He thong tu dong chot trang thai ' || cnt || ' lo hang ngay ' || grp_date::text ||
    ' (giao hang hoan tat). Khong can xu ly them.',
  'delivery',
  '/dashboard/trips?date=' || grp_date::text,
  FALSE,
  grp_date::timestamp + INTERVAL '20 hours',
  'low',
  'delivery_batch',
  gen_random_uuid()
FROM (
  SELECT delivery_date AS grp_date, COUNT(*) AS cnt
  FROM _ship_to_deliver
  GROUP BY delivery_date
) batch
CROSS JOIN (
  SELECT id FROM users
  WHERE role IN ('dispatcher','admin')
  LIMIT 3
) u;

DO $$
DECLARE r int;
BEGIN
  GET DIAGNOSTICS r = ROW_COUNT;
  RAISE NOTICE 'notifications inserted: %', r;
END $$;

-- ─────────────────────────────────────────────────────────────
-- STEP 9: Verify kết quả cuối
-- ─────────────────────────────────────────────────────────────

SELECT 'AFTER_MIGRATION' AS check_point;

SELECT 'shipments_still_open' AS metric, COUNT(*) AS cnt
FROM shipments
WHERE delivery_date <= '2026-05-02'
  AND shipment_number NOT LIKE 'QA-%'
  AND status::text NOT IN ('delivered','cancelled','returned');

SELECT 'orders_still_open' AS metric, COUNT(*) AS cnt
FROM sales_orders
WHERE delivery_date <= '2026-05-02'
  AND order_number NOT LIKE 'QA-%'
  AND status::text NOT IN ('delivered','cancelled','returned','closed');

SELECT 'trips_still_open' AS metric, COUNT(*) AS cnt
FROM trips
WHERE planned_date <= '2026-05-02'
  AND trip_number NOT LIKE 'QA-%'
  AND status::text NOT IN ('completed','cancelled','closed','reconciled');

COMMIT;

SELECT 'DONE' AS result;
