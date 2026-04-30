-- Migration 049: M\u1edf r\u1ed9ng dữ liệu lịch sử
-- Clone+shift dữ liệu 2025-04-24..28 → 2026-04-24..28 (5 ngày)
-- Lý do: hist data BHL kết thúc ngày 2026-04-23, demo seeds chỉ có 2026-04-29
-- → còn gap 24..28/04/2026 cần extend bằng pattern thực 2025
-- Mốc tham chiếu: 23/04/2026

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Mapping tables (sales_orders cũ → mới, shipments, trips, stops, epod)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE _map_so (old_id uuid PRIMARY KEY, new_id uuid NOT NULL DEFAULT gen_random_uuid()) ON COMMIT DROP;
CREATE TEMP TABLE _map_ship (old_id uuid PRIMARY KEY, new_id uuid NOT NULL DEFAULT gen_random_uuid()) ON COMMIT DROP;
CREATE TEMP TABLE _map_trip (old_id uuid PRIMARY KEY, new_id uuid NOT NULL DEFAULT gen_random_uuid()) ON COMMIT DROP;
CREATE TEMP TABLE _map_stop (old_id uuid PRIMARY KEY, new_id uuid NOT NULL DEFAULT gen_random_uuid()) ON COMMIT DROP;
CREATE TEMP TABLE _map_epod (old_id uuid PRIMARY KEY, new_id uuid NOT NULL DEFAULT gen_random_uuid()) ON COMMIT DROP;

-- Populate maps
INSERT INTO _map_so(old_id) SELECT id FROM sales_orders WHERE delivery_date BETWEEN '2025-04-24' AND '2025-04-28';
INSERT INTO _map_ship(old_id) SELECT s.id FROM shipments s JOIN _map_so m ON m.old_id = s.order_id;
INSERT INTO _map_trip(old_id) SELECT id FROM trips WHERE planned_date BETWEEN '2025-04-24' AND '2025-04-28';
INSERT INTO _map_stop(old_id) SELECT ts.id FROM trip_stops ts JOIN _map_trip m ON m.old_id = ts.trip_id;
INSERT INTO _map_epod(old_id) SELECT e.id FROM epod e JOIN _map_stop m ON m.old_id = e.trip_stop_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INSERT sales_orders mới (delivery_date + 1 year, order_number prefix EXT)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO sales_orders (
  id, order_number, customer_id, warehouse_id, status,
  delivery_date, delivery_address, time_window,
  total_amount, deposit_amount, total_weight_kg, total_volume_m3,
  atp_status, credit_status, notes,
  created_by, approved_by, approved_at, created_at, updated_at,
  cutoff_group, re_delivery_count, original_order_id, is_urgent
)
SELECT
  m.new_id,
  'SO-EXT-' || replace(o.order_number, 'SO-', ''),
  o.customer_id, o.warehouse_id, o.status,
  o.delivery_date + INTERVAL '1 year',
  o.delivery_address, o.time_window,
  o.total_amount, o.deposit_amount, o.total_weight_kg, o.total_volume_m3,
  o.atp_status, o.credit_status, o.notes,
  o.created_by, o.approved_by,
  o.approved_at + INTERVAL '1 year',
  o.created_at + INTERVAL '1 year',
  o.updated_at + INTERVAL '1 year',
  o.cutoff_group, o.re_delivery_count, NULL, o.is_urgent
FROM sales_orders o
JOIN _map_so m ON m.old_id = o.id;

-- 2b. order_items
INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, amount, deposit_amount, created_at)
SELECT gen_random_uuid(), m.new_id, oi.product_id, oi.quantity, oi.unit_price, oi.amount, oi.deposit_amount,
       oi.created_at + INTERVAL '1 year'
FROM order_items oi
JOIN _map_so m ON m.old_id = oi.order_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. shipments
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO shipments (
  id, shipment_number, order_id, customer_id, warehouse_id, status,
  delivery_date, total_weight_kg, total_volume_m3, items, created_at, updated_at, is_urgent
)
SELECT
  ms.new_id,
  'SHP-EXT-' || replace(s.shipment_number, 'SHP-', ''),
  mo.new_id, s.customer_id, s.warehouse_id, s.status,
  s.delivery_date + INTERVAL '1 year',
  s.total_weight_kg, s.total_volume_m3, s.items,
  s.created_at + INTERVAL '1 year',
  s.updated_at + INTERVAL '1 year',
  s.is_urgent
FROM shipments s
JOIN _map_ship ms ON ms.old_id = s.id
JOIN _map_so   mo ON mo.old_id = s.order_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. trips
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO trips (
  id, trip_number, warehouse_id, vehicle_id, driver_id, status,
  planned_date, total_stops, total_weight_kg, total_distance_km, total_duration_min,
  started_at, completed_at, created_at, updated_at
)
SELECT
  mt.new_id,
  'TRP-EXT-' || replace(t.trip_number, 'TRP-', ''),
  t.warehouse_id, t.vehicle_id, t.driver_id, t.status,
  t.planned_date + INTERVAL '1 year',
  t.total_stops, t.total_weight_kg, t.total_distance_km, t.total_duration_min,
  t.started_at + INTERVAL '1 year',
  t.completed_at + INTERVAL '1 year',
  t.created_at + INTERVAL '1 year',
  t.updated_at + INTERVAL '1 year'
FROM trips t
JOIN _map_trip mt ON mt.old_id = t.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. trip_stops
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO trip_stops (
  id, trip_id, shipment_id, customer_id, stop_order, status,
  estimated_arrival, estimated_departure, actual_arrival, actual_departure,
  distance_from_prev_km, cumulative_load_kg, notes, created_at
)
SELECT
  msp.new_id,
  mt.new_id,
  msh.new_id,
  ts.customer_id, ts.stop_order, ts.status,
  ts.estimated_arrival   + INTERVAL '1 year',
  ts.estimated_departure + INTERVAL '1 year',
  ts.actual_arrival      + INTERVAL '1 year',
  ts.actual_departure    + INTERVAL '1 year',
  ts.distance_from_prev_km, ts.cumulative_load_kg, ts.notes,
  ts.created_at + INTERVAL '1 year'
FROM trip_stops ts
JOIN _map_stop msp ON msp.old_id = ts.id
JOIN _map_trip mt  ON mt.old_id  = ts.trip_id
LEFT JOIN _map_ship msh ON msh.old_id = ts.shipment_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. epod
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO epod (
  id, trip_stop_id, driver_id, customer_id, delivered_items,
  receiver_name, receiver_phone, signature_url, photo_urls,
  total_amount, deposit_amount, delivery_status, notes,
  created_at, updated_at, reject_reason, reject_detail, reject_photos
)
SELECT
  me.new_id,
  msp.new_id,
  e.driver_id, e.customer_id, e.delivered_items,
  e.receiver_name, e.receiver_phone, e.signature_url, e.photo_urls,
  e.total_amount, e.deposit_amount, e.delivery_status, e.notes,
  e.created_at + INTERVAL '1 year',
  e.updated_at + INTERVAL '1 year',
  e.reject_reason, e.reject_detail, e.reject_photos
FROM epod e
JOIN _map_epod me  ON me.old_id  = e.id
JOIN _map_stop msp ON msp.old_id = e.trip_stop_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. payments  (link via trip_stop_id, optional epod_id, optional order_id)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO payments (
  id, trip_stop_id, epod_id, customer_id, driver_id, order_id,
  payment_method, amount, status, reference_number, notes,
  collected_at, confirmed_at, confirmed_by, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  msp.new_id,
  me.new_id,
  p.customer_id, p.driver_id,
  mo.new_id,
  p.payment_method, p.amount, p.status, p.reference_number, p.notes,
  p.collected_at + INTERVAL '1 year',
  p.confirmed_at + INTERVAL '1 year',
  p.confirmed_by,
  p.created_at + INTERVAL '1 year',
  p.updated_at + INTERVAL '1 year'
FROM payments p
JOIN _map_stop msp ON msp.old_id = p.trip_stop_id
LEFT JOIN _map_epod me ON me.old_id = p.epod_id
LEFT JOIN _map_so   mo ON mo.old_id = p.order_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. reconciliations  (1 per trip, unique key trip_id+recon_type)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO reconciliations (
  id, trip_id, recon_type, status, expected_value, actual_value, variance, details,
  reconciled_by, reconciled_at, created_at, updated_at
)
SELECT
  gen_random_uuid(), mt.new_id, r.recon_type, r.status,
  r.expected_value, r.actual_value, r.variance, r.details,
  r.reconciled_by,
  r.reconciled_at + INTERVAL '1 year',
  r.created_at  + INTERVAL '1 year',
  r.updated_at  + INTERVAL '1 year'
FROM reconciliations r
JOIN _map_trip mt ON mt.old_id = r.trip_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. eod_sessions  (1 per trip)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO eod_sessions (
  id, trip_id, driver_id, status,
  total_stops_delivered, total_stops_failed,
  total_cash_collected, total_transfer_collected, total_credit_amount,
  started_at, completed_at, created_at, updated_at
)
SELECT
  gen_random_uuid(), mt.new_id, es.driver_id, es.status,
  es.total_stops_delivered, es.total_stops_failed,
  es.total_cash_collected, es.total_transfer_collected, es.total_credit_amount,
  es.started_at   + INTERVAL '1 year',
  es.completed_at + INTERVAL '1 year',
  es.created_at   + INTERVAL '1 year',
  es.updated_at   + INTERVAL '1 year'
FROM eod_sessions es
JOIN _map_trip mt ON mt.old_id = es.trip_id;

COMMIT;
