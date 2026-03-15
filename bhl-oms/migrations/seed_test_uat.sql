-- ==========================================================
-- BHL OMS — Full UAT Test Data for Driver Mobile App Testing
-- ==========================================================
-- Creates:
--   • 5 bảo vệ (security guards)
--   • 70 xe tải (vehicles) — mix truck_3t5/5t/8t/15t
--   • 70 tài xế (drivers) — driver01 through driver70
--   • 700 đơn hàng (orders) — status: approved, delivery: 2026-03-15
--   • 700 lô hàng (shipments) — status: loaded
--   • 70 chuyến xe (trips) — status: assigned, 10 stops each
--
-- All user passwords: demo123
-- Idempotent: safe to run multiple times
-- ==========================================================

BEGIN;

-- ========================
-- CLEANUP PREVIOUS RUN
-- ========================
DO $cleanup$
BEGIN
  DELETE FROM payments WHERE trip_stop_id IN (
    SELECT id FROM trip_stops WHERE trip_id IN (
      SELECT id FROM trips WHERE trip_number LIKE 'TR-20260315-%'));
  DELETE FROM epod WHERE trip_stop_id IN (
    SELECT id FROM trip_stops WHERE trip_id IN (
      SELECT id FROM trips WHERE trip_number LIKE 'TR-20260315-%'));
  DELETE FROM trip_stops WHERE trip_id IN (
    SELECT id FROM trips WHERE trip_number LIKE 'TR-20260315-%');
  DELETE FROM trips WHERE trip_number LIKE 'TR-20260315-%';
  DELETE FROM shipments WHERE shipment_number LIKE 'SH-20260315-%';
  DELETE FROM receivable_ledger WHERE order_id IN (
    SELECT id FROM sales_orders WHERE order_number LIKE 'SO-20260315-%');
  DELETE FROM sales_orders WHERE order_number LIKE 'SO-20260315-%';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Cleanup notice: %', SQLERRM;
END $cleanup$;


-- ========================
-- 1. WAREHOUSE LOCATION FOR HAI PHONG
-- ========================
INSERT INTO warehouses (id, name, code, path, latitude, longitude)
VALUES ('a0000000-0000-0000-0000-000000000021', 'Khu A - Hải Phòng', 'WH-HP-A', 'wh_hp.zone_a', 20.8449, 106.6881)
ON CONFLICT (code) DO NOTHING;


-- ========================
-- 2. SECURITY GUARDS (Bảo vệ)
-- ========================
INSERT INTO users (id, username, password_hash, full_name, role, permissions, warehouse_ids) VALUES
('00780000-0000-0000-0000-000000000001', 'baove01',
 '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK',
 'Nguyễn Văn Bảo', 'security', ARRAY['gate:check','trip:view','vehicle:view'],
 ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
('00780000-0000-0000-0000-000000000002', 'baove02',
 '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK',
 'Trần Văn Cường', 'security', ARRAY['gate:check','trip:view','vehicle:view'],
 ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
('00780000-0000-0000-0000-000000000003', 'baove03',
 '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK',
 'Lê Đình Dũng', 'security', ARRAY['gate:check','trip:view','vehicle:view'],
 ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
('00780000-0000-0000-0000-000000000004', 'baove04',
 '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK',
 'Phạm Văn Thắng', 'security', ARRAY['gate:check','trip:view','vehicle:view'],
 ARRAY['a0000000-0000-0000-0000-000000000002']::uuid[]),
('00780000-0000-0000-0000-000000000005', 'baove05',
 '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK',
 'Hoàng Văn Trung', 'security', ARRAY['gate:check','trip:view','vehicle:view'],
 ARRAY['a0000000-0000-0000-0000-000000000002']::uuid[])
ON CONFLICT (username) DO NOTHING;


-- ========================
-- 3. VEHICLES (70 total)
-- ========================
-- Mix: truck_3t5 (3.5 tấn), truck_5t, truck_8t, truck_15t
-- 50 xe Quảng Ninh (14C), 20 xe Hải Phòng (15C)
INSERT INTO vehicles (id, plate_number, vehicle_type, capacity_kg, capacity_m3, status, warehouse_id)
SELECT
  ('00770000-0000-0000-0000-' || LPAD(i::TEXT, 12, '0'))::uuid,
  CASE WHEN i <= 50 THEN '14C-' ELSE '15C-' END || LPAD((50000 + i)::TEXT, 5, '0'),
  (ARRAY['truck_3t5','truck_5t','truck_8t','truck_15t']::vehicle_type[])[ 1 + ((i-1) % 4) ],
  (ARRAY[3500, 5000, 8000, 15000])[ 1 + ((i-1) % 4) ]::numeric,
  (ARRAY[12.00, 18.00, 28.00, 45.00])[ 1 + ((i-1) % 4) ]::numeric,
  'active',
  CASE WHEN i <= 50
    THEN 'a0000000-0000-0000-0000-000000000001'
    ELSE 'a0000000-0000-0000-0000-000000000002'
  END::uuid
FROM generate_series(1, 70) AS i
ON CONFLICT (plate_number) DO NOTHING;


-- ========================
-- 4. DRIVER USERS (driver09 through driver70)
-- ========================
-- driver01-08 already exist from seed.sql — only adds new ones
INSERT INTO users (id, username, password_hash, full_name, role, permissions, warehouse_ids)
SELECT
  ('00750000-0000-0000-0000-' || LPAD(i::TEXT, 12, '0'))::uuid,
  'driver' || LPAD(i::TEXT, 2, '0'),
  '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK',
  n.names[ i - 8 ],
  'driver',
  ARRAY['trip:view','epod:create'],
  ARRAY[ CASE WHEN i <= 50
    THEN 'a0000000-0000-0000-0000-000000000001'
    ELSE 'a0000000-0000-0000-0000-000000000002'
  END ]::uuid[]
FROM generate_series(9, 70) AS i
CROSS JOIN (SELECT ARRAY[
  'Nguyễn Văn An',      'Trần Văn Bình',     'Lê Văn Cường',      'Phạm Văn Dũng',
  'Hoàng Văn Đông',     'Vũ Văn Phúc',       'Đỗ Văn Giang',      'Bùi Văn Hiệp',
  'Ngô Văn Kiên',       'Dương Văn Lâm',     'Tạ Văn Minh',       'Lý Văn Nghĩa',
  'Phan Văn Phong',     'Đinh Văn Quân',     'Trịnh Văn Sơn',     'Hồ Văn Tùng',
  'Đặng Văn Uy',        'Mai Văn Việt',      'Chu Văn Xuân',      'Cao Văn Bằng',
  'Nguyễn Đức Bảo',     'Trần Đức Cảnh',     'Lê Đức Đạt',        'Phạm Đức Hải',
  'Hoàng Đức Khánh',    'Vũ Đức Lợi',        'Đỗ Đức Mạnh',       'Bùi Đức Nam',
  'Ngô Đức Phú',        'Dương Đức Quang',   'Tạ Đức Sáng',       'Lý Đức Thành',
  'Phan Đức Trung',     'Đinh Đức Vinh',     'Trịnh Đức Anh',     'Hồ Đức Bách',
  'Đặng Đức Công',      'Mai Đức Dương',     'Chu Đức Giang',     'Cao Đức Hà',
  'Nguyễn Hoàng Kiệt',  'Trần Hoàng Long',   'Lê Hoàng Minh',     'Phạm Hoàng Nam',
  'Hoàng Hữu Phát',     'Vũ Hoàng Quốc',     'Đỗ Hoàng Sơn',      'Bùi Hoàng Tâm',
  'Ngô Hoàng Vinh',     'Dương Hoàng Huy',   'Tạ Hoàng Bách',     'Lý Hoàng Chiến',
  'Phan Hoàng Đạo',     'Đinh Hoàng Em',     'Trịnh Hoàng Hải',   'Hồ Hoàng Khoa',
  'Đặng Hoàng Lâm',     'Mai Hoàng Nghĩa',   'Chu Hoàng Phong',   'Cao Hoàng Quân',
  'Nguyễn Thành Đạt',   'Trần Thành Công'
] AS names) n
ON CONFLICT (username) DO NOTHING;


-- ========================
-- 5. DRIVER RECORDS
-- ========================
-- Creates driver records for any driver user (01-70) that doesn't have one yet
INSERT INTO drivers (id, user_id, full_name, phone, license_number, status, warehouse_id)
SELECT
  gen_random_uuid(),
  u.id,
  u.full_name,
  '0982' || LPAD(i::TEXT, 6, '0'),
  CASE WHEN i % 2 = 0 THEN 'B2-' ELSE 'C-' END || LPAD((100000 + i)::TEXT, 6, '0'),
  'active',
  u.warehouse_ids[1]
FROM generate_series(1, 70) AS i
JOIN users u ON u.username = 'driver' || LPAD(i::TEXT, 2, '0') AND u.role = 'driver'
WHERE NOT EXISTS (SELECT 1 FROM drivers d WHERE d.user_id = u.id);


-- ========================
-- 6. ORDERS + ITEMS + SHIPMENTS + TRIPS + STOPS
-- ========================
DO $$
DECLARE
  -- Metadata arrays
  cust_ids   UUID[];
  cust_count INT;
  prod_ids   UUID[];
  prod_names TEXT[];
  prod_prices   NUMERIC[];
  prod_weights  NUMERIC[];
  prod_volumes  NUMERIC[];
  prod_deposits NUMERIC[];
  prod_count INT;
  drv_ids    UUID[];
  drv_count  INT;
  veh_ids    UUID[];
  veh_count  INT;

  -- Constants
  wh1     UUID := 'a0000000-0000-0000-0000-000000000001';
  wh2     UUID := 'a0000000-0000-0000-0000-000000000002';
  dvkh_id UUID := 'b0000000-0000-0000-0000-000000000002';
  acct_id UUID := 'b0000000-0000-0000-0000-000000000004';

  -- Loop variables
  i INT; j INT;
  o_id UUID; s_id UUID; t_id UUID;
  c_id UUID; w_id UUID;
  p_idx INT; qty INT; item_cnt INT;
  tot_amt NUMERIC; tot_dep NUMERIC;
  tot_wt  NUMERIC; tot_vol NUMERIC;
  ship_items JSONB;

  -- Trip/stop variables
  order_idx    INT;
  stop_ship_id UUID;
  stop_cust_id UUID;
  num_trips    INT;

  time_windows TEXT[] := ARRAY[
    '08:00-12:00', '09:00-13:00', '13:00-17:00', '14:00-18:00', '08:00-17:00'
  ];
BEGIN
  -- ─── Load customer IDs ───
  SELECT array_agg(id), COUNT(*)
  INTO cust_ids, cust_count
  FROM (SELECT id FROM customers WHERE is_active = true ORDER BY code LIMIT 700) sub;

  IF cust_count IS NULL OR cust_count = 0 THEN
    RAISE EXCEPTION 'No customers found! Run seed.sql or seed_production.sql first.';
  END IF;

  -- ─── Load product info ───
  SELECT array_agg(id ORDER BY sku),
         array_agg(name ORDER BY sku),
         array_agg(price ORDER BY sku),
         array_agg(weight_kg ORDER BY sku),
         array_agg(volume_m3 ORDER BY sku),
         array_agg(deposit_price ORDER BY sku),
         COUNT(*)
  INTO prod_ids, prod_names, prod_prices, prod_weights, prod_volumes, prod_deposits, prod_count
  FROM products WHERE is_active = true;

  IF prod_count IS NULL OR prod_count = 0 THEN
    RAISE EXCEPTION 'No products found! Run seed.sql first.';
  END IF;

  -- ─── Load driver & vehicle IDs ───
  SELECT array_agg(id ORDER BY id), COUNT(*)
  INTO drv_ids, drv_count
  FROM (SELECT id FROM drivers WHERE status = 'active' ORDER BY id LIMIT 70) sub;

  SELECT array_agg(id ORDER BY id), COUNT(*)
  INTO veh_ids, veh_count
  FROM (SELECT id FROM vehicles WHERE status = 'active' ORDER BY id LIMIT 70) sub;

  RAISE NOTICE 'Metadata: % customers, % products, % drivers, % vehicles',
    cust_count, prod_count, drv_count, veh_count;

  -- ══════════════════════════════════════════
  -- CREATE 700 ORDERS + ORDER ITEMS + SHIPMENTS
  -- ══════════════════════════════════════════
  FOR i IN 1..700 LOOP
    o_id := gen_random_uuid();
    s_id := gen_random_uuid();
    c_id := cust_ids[ 1 + ((i - 1) % cust_count) ];
    w_id := CASE WHEN i <= 500 THEN wh1 ELSE wh2 END;
    item_cnt := 2 + (i % 3);   -- 2, 3, or 4 items per order
    tot_amt := 0; tot_dep := 0; tot_wt := 0; tot_vol := 0;
    ship_items := '[]'::jsonb;

    -- Create the order (approved status — ready for trip assignment)
    INSERT INTO sales_orders (
      id, order_number, customer_id, warehouse_id, status,
      delivery_date, time_window,
      total_amount, deposit_amount, total_weight_kg, total_volume_m3,
      atp_status, credit_status,
      created_by, approved_by, approved_at,
      created_at, updated_at
    ) VALUES (
      o_id,
      'SO-20260315-' || LPAD(i::TEXT, 4, '0'),
      c_id, w_id, 'approved',
      '2026-03-15',
      time_windows[ 1 + ((i - 1) % 5) ],
      0, 0, 0, 0,
      'passed', 'passed',
      dvkh_id, acct_id, now() - interval '1 hour',
      now() - interval '3 hours', now() - interval '1 hour'
    );

    -- Create order items (2-4 per order)
    FOR j IN 1..item_cnt LOOP
      p_idx := 1 + ((i + j - 1) % prod_count);
      qty   := 10 + ((i * 7 + j * 13) % 91);   -- 10..100

      INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount, deposit_amount)
      VALUES (
        o_id, prod_ids[p_idx], qty,
        prod_prices[p_idx],
        prod_prices[p_idx] * qty,
        prod_deposits[p_idx] * qty
      );

      tot_amt := tot_amt + prod_prices[p_idx] * qty;
      tot_dep := tot_dep + prod_deposits[p_idx] * qty;
      tot_wt  := tot_wt  + prod_weights[p_idx] * qty;
      tot_vol := tot_vol  + prod_volumes[p_idx] * qty;

      ship_items := ship_items || jsonb_build_array(jsonb_build_object(
        'product_id',   prod_ids[p_idx],
        'product_name', prod_names[p_idx],
        'quantity',     qty,
        'weight_kg',    ROUND(prod_weights[p_idx] * qty, 2)
      ));
    END LOOP;

    -- Update order totals
    UPDATE sales_orders
    SET total_amount = tot_amt, deposit_amount = tot_dep,
        total_weight_kg = tot_wt, total_volume_m3 = tot_vol
    WHERE id = o_id;

    -- Create shipment (loaded = on vehicle, ready for delivery)
    INSERT INTO shipments (
      id, shipment_number, order_id, customer_id, warehouse_id,
      status, delivery_date, total_weight_kg, total_volume_m3, items
    ) VALUES (
      s_id,
      'SH-20260315-' || LPAD(i::TEXT, 4, '0'),
      o_id, c_id, w_id,
      'loaded', '2026-03-15',
      tot_wt, tot_vol, ship_items
    );

    IF i % 100 = 0 THEN
      RAISE NOTICE '  Orders created: %/700', i;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Created 700 orders with items and shipments';

  -- ══════════════════════════════════════════
  -- CREATE TRIPS + TRIP STOPS (10 stops each)
  -- ══════════════════════════════════════════
  num_trips := LEAST(COALESCE(drv_count, 0), COALESCE(veh_count, 0), 70);

  IF num_trips < 70 THEN
    RAISE NOTICE '⚠️  Only % drivers/vehicles available → creating % trips', num_trips, num_trips;
  END IF;

  FOR i IN 1..num_trips LOOP
    t_id := gen_random_uuid();
    w_id := CASE WHEN i <= 50 THEN wh1 ELSE wh2 END;

    INSERT INTO trips (
      id, trip_number, warehouse_id, vehicle_id, driver_id,
      status, planned_date, total_stops,
      total_weight_kg, total_distance_km, total_duration_min
    ) VALUES (
      t_id,
      'TR-20260315-' || LPAD(i::TEXT, 4, '0'),
      w_id, veh_ids[i], drv_ids[i],
      'assigned', '2026-03-15', 10,
      0,
      ROUND((15.0 + random() * 80)::numeric, 1),    -- 15–95 km
      (60 + (random() * 120)::INT)                      -- 60–180 min
    );

    -- Create 10 stops per trip (orders (i-1)*10+1 through i*10)
    FOR j IN 1..10 LOOP
      order_idx := (i - 1) * 10 + j;

      SELECT s.id, s.customer_id
      INTO stop_ship_id, stop_cust_id
      FROM shipments s
      WHERE s.shipment_number = 'SH-20260315-' || LPAD(order_idx::TEXT, 4, '0');

      IF stop_ship_id IS NOT NULL THEN
        INSERT INTO trip_stops (
          trip_id, shipment_id, customer_id, stop_order, status,
          estimated_arrival, distance_from_prev_km, cumulative_load_kg
        ) VALUES (
          t_id, stop_ship_id, stop_cust_id, j, 'pending',
          '2026-03-15 07:00:00+07'::timestamptz + (j * interval '25 minutes'),
          ROUND((1.5 + random() * 12)::numeric, 1),  -- 1.5–13.5 km from prev
          0
        );

        -- Mark shipment as in_transit (loaded on truck)
        UPDATE shipments SET status = 'in_transit' WHERE id = stop_ship_id;
      END IF;
    END LOOP;

    -- Update trip total weight from its actual stops
    UPDATE trips SET total_weight_kg = (
      SELECT COALESCE(SUM(sh.total_weight_kg), 0)
      FROM trip_stops ts
      JOIN shipments sh ON sh.id = ts.shipment_id
      WHERE ts.trip_id = t_id
    ) WHERE id = t_id;

  END LOOP;

  RAISE NOTICE '✅ Created % trips with 10 stops each (% total stops)', num_trips, num_trips * 10;
  RAISE NOTICE '';
  RAISE NOTICE '╔═══════════════════════════════════════════════════╗';
  RAISE NOTICE '║  UAT Test Data Created Successfully!              ║';
  RAISE NOTICE '║                                                   ║';
  RAISE NOTICE '║  🚗 Drivers:  driver01..driver70 / demo123       ║';
  RAISE NOTICE '║  🛡️  Guards:   baove01..baove05  / demo123       ║';
  RAISE NOTICE '║  📦 Orders:   700 (SO-20260315-0001..0700)       ║';
  RAISE NOTICE '║  🚛 Trips:    70  (TR-20260315-0001..0070)       ║';
  RAISE NOTICE '║  📍 Stops:    700 (10 per trip)                  ║';
  RAISE NOTICE '╚═══════════════════════════════════════════════════╝';
END $$;

COMMIT;
