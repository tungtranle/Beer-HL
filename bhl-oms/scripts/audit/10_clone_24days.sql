-- ===================================================================
-- PHASE 1B: Clone 2025-04-01..23 -> 2026-04-01..23 (shift +365 days)
-- ===================================================================
-- Strategy: Use mapping CTE to remap UUIDs old -> new in single transaction
-- Date shift: 2025-04-01 → 2026-04-01 = +365 days (2026 is NOT leap, 2025 is NOT leap)

BEGIN;

-- 1. Map old order IDs to new
CREATE TEMP TABLE _ord_map AS
SELECT id AS old_id, gen_random_uuid() AS new_id, order_number AS old_num
FROM sales_orders
WHERE delivery_date BETWEEN '2025-04-01' AND '2025-04-23';

-- 2. Map shipments
CREATE TEMP TABLE _ship_map AS
SELECT s.id AS old_id, gen_random_uuid() AS new_id, s.shipment_number AS old_num
FROM shipments s JOIN _ord_map om ON om.old_id = s.order_id;

-- 3. Map trips
CREATE TEMP TABLE _trip_map AS
SELECT id AS old_id, gen_random_uuid() AS new_id, trip_number AS old_num
FROM trips
WHERE planned_date BETWEEN '2025-04-01' AND '2025-04-23';

-- 4. Insert sales_orders (clone)
INSERT INTO sales_orders (
    id, order_number, customer_id, warehouse_id, status, delivery_date,
    delivery_address, time_window, total_amount, deposit_amount,
    total_weight_kg, total_volume_m3, atp_status, credit_status, notes,
    created_by, approved_by, approved_at, created_at, updated_at,
    cutoff_group, re_delivery_count, original_order_id, is_urgent
)
SELECT
    om.new_id,
    REPLACE(o.order_number, 'ORD-2025-', 'ORD-2026-'),
    o.customer_id, o.warehouse_id, o.status,
    o.delivery_date + INTERVAL '365 days',
    o.delivery_address, o.time_window, o.total_amount, o.deposit_amount,
    o.total_weight_kg, o.total_volume_m3, o.atp_status, o.credit_status, o.notes,
    o.created_by, o.approved_by,
    o.approved_at + INTERVAL '365 days',
    o.created_at + INTERVAL '365 days',
    o.updated_at + INTERVAL '365 days',
    o.cutoff_group, o.re_delivery_count, NULL, o.is_urgent
FROM sales_orders o JOIN _ord_map om ON om.old_id = o.id;

-- 5. Insert order_items (clone)
INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, amount, deposit_amount, created_at)
SELECT
    gen_random_uuid(), om.new_id, oi.product_id, oi.quantity,
    oi.unit_price, oi.amount, oi.deposit_amount,
    oi.created_at + INTERVAL '365 days'
FROM order_items oi JOIN _ord_map om ON om.old_id = oi.order_id;

-- 6. Insert shipments
INSERT INTO shipments (
    id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date,
    total_weight_kg, total_volume_m3, items, created_at, updated_at, is_urgent
)
SELECT
    sm.new_id,
    REPLACE(s.shipment_number, '-2025-', '-2026-'),
    om.new_id,
    s.customer_id, s.warehouse_id, s.status,
    s.delivery_date + INTERVAL '365 days',
    s.total_weight_kg, s.total_volume_m3, s.items,
    s.created_at + INTERVAL '365 days',
    s.updated_at + INTERVAL '365 days',
    s.is_urgent
FROM shipments s
JOIN _ship_map sm ON sm.old_id = s.id
JOIN _ord_map om ON om.old_id = s.order_id;

-- 7. Insert trips (clone)
INSERT INTO trips (
    id, trip_number, warehouse_id, vehicle_id, driver_id, status, planned_date,
    total_stops, total_weight_kg, total_distance_km, total_duration_min,
    started_at, completed_at, created_at, updated_at
)
SELECT
    tm.new_id,
    REPLACE(t.trip_number, '-2025-', '-2026-'),
    t.warehouse_id, t.vehicle_id, t.driver_id, t.status,
    t.planned_date + INTERVAL '365 days',
    t.total_stops, t.total_weight_kg, t.total_distance_km, t.total_duration_min,
    t.started_at + INTERVAL '365 days',
    t.completed_at + INTERVAL '365 days',
    t.created_at + INTERVAL '365 days',
    t.updated_at + INTERVAL '365 days'
FROM trips t JOIN _trip_map tm ON tm.old_id = t.id;

-- 8. Insert trip_stops (clone, remap trip_id and shipment_id)
INSERT INTO trip_stops (
    id, trip_id, shipment_id, customer_id, stop_order, status,
    estimated_arrival, estimated_departure, actual_arrival, actual_departure,
    distance_from_prev_km, cumulative_load_kg, notes, created_at
)
SELECT
    gen_random_uuid(),
    tm.new_id,
    sm.new_id,
    ts.customer_id, ts.stop_order, ts.status,
    ts.estimated_arrival + INTERVAL '365 days',
    ts.estimated_departure + INTERVAL '365 days',
    ts.actual_arrival + INTERVAL '365 days',
    ts.actual_departure + INTERVAL '365 days',
    ts.distance_from_prev_km, ts.cumulative_load_kg, ts.notes,
    ts.created_at + INTERVAL '365 days'
FROM trip_stops ts
JOIN _trip_map tm ON tm.old_id = ts.trip_id
LEFT JOIN _ship_map sm ON sm.old_id = ts.shipment_id;

-- Verify
SELECT 'orders cloned' lbl, COUNT(*) n FROM sales_orders WHERE delivery_date BETWEEN '2026-04-01' AND '2026-04-23'
UNION ALL SELECT 'shipments cloned', COUNT(*) FROM shipments WHERE delivery_date BETWEEN '2026-04-01' AND '2026-04-23'
UNION ALL SELECT 'trips cloned', COUNT(*) FROM trips WHERE planned_date BETWEEN '2026-04-01' AND '2026-04-23'
UNION ALL SELECT 'trip_stops cloned', COUNT(*) FROM trip_stops ts JOIN trips t ON t.id=ts.trip_id WHERE t.planned_date BETWEEN '2026-04-01' AND '2026-04-23';

COMMIT;
