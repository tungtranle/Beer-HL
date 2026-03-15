-- ==========================================================
-- BHL OMS — Planning Page Test Data
-- Creates pending orders/shipments for VRP planning testing
-- Run AFTER seed_production.sql
-- ==========================================================
-- Creates:
--   • 50 orders for WH-HL (tomorrow) status: confirmed
--   • 50 shipments for WH-HL status: pending
--   • 30 orders for WH-HP (tomorrow) status: confirmed
--   • 30 shipments for WH-HP status: pending
-- ==========================================================

BEGIN;

-- ========================
-- CLEANUP PREVIOUS RUN
-- ========================
DELETE FROM shipments WHERE shipment_number LIKE 'SH-PLAN-%';
DELETE FROM sales_orders WHERE order_number LIKE 'SO-PLAN-%';

-- ========================
-- 1. CONFIRMED ORDERS for WH-HL (Kho Hạ Long) — tomorrow
-- ========================
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_amount, deposit_amount, total_weight_kg, atp_status, credit_status, created_at)
SELECT
  ('aa000000-0000-0000-0000-' || LPAD(n::text, 12, '0'))::uuid,
  'SO-PLAN-HL-' || LPAD(n::text, 3, '0'),
  -- Pick from first 100 NPPs in QN (WH-HL territory): n%100 + 1
  (SELECT id FROM customers WHERE code = 'NPP-' || LPAD(((n-1) % 100 + 1)::text, 3, '0') LIMIT 1),
  'a0000000-0000-0000-0000-000000000001'::uuid,  -- WH-HL
  'confirmed',
  (CURRENT_DATE + 1)::date,  -- tomorrow
  (ARRAY[1850000, 2450000, 1950000, 1750000, 2250000, 6500000, 1250000, 2100000])[1 + (n % 8)],
  (ARRAY[50000, 100000, 200000, 0, 50000, 400000, 0, 100000])[1 + (n % 8)],
  (ARRAY[85.0, 128.0, 140.0, 125.0, 85.0, 320.0, 82.0, 150.0])[1 + (n % 8)],
  true,  -- atp_status
  true,  -- credit_status
  NOW() - interval '2 hours'
FROM generate_series(1, 50) AS n
ON CONFLICT DO NOTHING;

-- ========================
-- 2. PENDING SHIPMENTS for WH-HL — tomorrow
-- ========================
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3)
SELECT
  ('ab000000-0000-0000-0000-' || LPAD(n::text, 12, '0'))::uuid,
  'SH-PLAN-HL-' || LPAD(n::text, 3, '0'),
  ('aa000000-0000-0000-0000-' || LPAD(n::text, 12, '0'))::uuid,  -- order_id
  (SELECT customer_id FROM sales_orders WHERE id = ('aa000000-0000-0000-0000-' || LPAD(n::text, 12, '0'))::uuid),
  'a0000000-0000-0000-0000-000000000001'::uuid,  -- WH-HL
  'pending',
  (CURRENT_DATE + 1)::date,
  (ARRAY[85.0, 128.0, 140.0, 125.0, 85.0, 320.0, 82.0, 150.0])[1 + (n % 8)],
  (ARRAY[0.15, 0.20, 0.25, 0.22, 0.15, 0.35, 0.15, 0.26])[1 + (n % 8)]
FROM generate_series(1, 50) AS n
ON CONFLICT DO NOTHING;

-- ========================
-- 3. CONFIRMED ORDERS for WH-HP (Kho Hải Phòng) — tomorrow
-- ========================
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_amount, deposit_amount, total_weight_kg, atp_status, credit_status, created_at)
SELECT
  ('ac000000-0000-0000-0000-' || LPAD(n::text, 12, '0'))::uuid,
  'SO-PLAN-HP-' || LPAD(n::text, 3, '0'),
  -- Pick from HP NPPs: codes 008,009,010,014,015,020 + range
  (SELECT id FROM customers WHERE code = 'NPP-' || LPAD(((n-1) % 100 + 101)::text, 3, '0') LIMIT 1),
  'a0000000-0000-0000-0000-000000000002'::uuid,  -- WH-HP
  'confirmed',
  (CURRENT_DATE + 1)::date,
  (ARRAY[1850000, 2450000, 1950000, 1750000, 2250000, 6500000, 1250000, 2100000])[1 + (n % 8)],
  (ARRAY[50000, 100000, 200000, 0, 50000, 400000, 0, 100000])[1 + (n % 8)],
  (ARRAY[85.0, 128.0, 140.0, 125.0, 85.0, 320.0, 82.0, 150.0])[1 + (n % 8)],
  true,
  true,
  NOW() - interval '1 hour'
FROM generate_series(1, 30) AS n
ON CONFLICT DO NOTHING;

-- ========================
-- 4. PENDING SHIPMENTS for WH-HP — tomorrow
-- ========================
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3)
SELECT
  ('ad000000-0000-0000-0000-' || LPAD(n::text, 12, '0'))::uuid,
  'SH-PLAN-HP-' || LPAD(n::text, 3, '0'),
  ('ac000000-0000-0000-0000-' || LPAD(n::text, 12, '0'))::uuid,
  (SELECT customer_id FROM sales_orders WHERE id = ('ac000000-0000-0000-0000-' || LPAD(n::text, 12, '0'))::uuid),
  'a0000000-0000-0000-0000-000000000002'::uuid,  -- WH-HP
  'pending',
  (CURRENT_DATE + 1)::date,
  (ARRAY[85.0, 128.0, 140.0, 125.0, 85.0, 320.0, 82.0, 150.0])[1 + (n % 8)],
  (ARRAY[0.15, 0.20, 0.25, 0.22, 0.15, 0.35, 0.15, 0.26])[1 + (n % 8)]
FROM generate_series(1, 30) AS n
ON CONFLICT DO NOTHING;

COMMIT;

-- Summary
DO $$
DECLARE
  v_orders bigint;
  v_shipments bigint;
BEGIN
  SELECT count(*) INTO v_orders FROM sales_orders WHERE order_number LIKE 'SO-PLAN-%';
  SELECT count(*) INTO v_shipments FROM shipments WHERE shipment_number LIKE 'SH-PLAN-%' AND status = 'pending';
  RAISE NOTICE '=== PLANNING TEST DATA ===';
  RAISE NOTICE 'Planning Orders: %', v_orders;
  RAISE NOTICE 'Pending Shipments: %', v_shipments;
  RAISE NOTICE 'Delivery date: % (tomorrow)', (CURRENT_DATE + 1)::text;
END $$;
