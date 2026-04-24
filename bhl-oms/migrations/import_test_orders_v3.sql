BEGIN;
-- Import 105 orders from Don hang test.xlsx (13/06 data)
-- Each order = 1 product. Heavy orders split into shipments <= 7500kg.

-- DH-001 | BG-112 | BHL-CHAI-450 x140 = 1960kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'BG-112';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'BG-112'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-001',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    35000000, 0, 1960.00, 3.9, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 140, 250000, 35000000 FROM products WHERE sku = 'BHL-CHAI-450';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-001',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 1960.00, 3.9, '[{"product_sku":"BHL-CHAI-450","quantity":140,"weight_kg":1960}]'::jsonb);
END $$;

-- DH-002 | BN-24 | BHL-DRAFT-30 x352 = 11264kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'BN-24';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'BN-24'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-002',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    281600000, 0, 11264.00, 22.5, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 352, 800000, 281600000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-002',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5632.00, 11.3, '[{"product_sku":"BHL-DRAFT-30","quantity":176,"weight_kg":5632}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-003',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5632.00, 11.3, '[{"product_sku":"BHL-DRAFT-30","quantity":176,"weight_kg":5632}]'::jsonb);
END $$;

-- DH-003 | QY-121 | BHL-CHAI-355 x130 = 1950kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QY-121';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QY-121'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-003',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    32500000, 0, 1950.00, 3.9, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 130, 250000, 32500000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-004',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 1950.00, 3.9, '[{"product_sku":"BHL-CHAI-355","quantity":130,"weight_kg":1950}]'::jsonb);
END $$;

-- DH-004 | HD-54 | BHL-LON-330 x600 = 5100kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HD-54';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HD-54'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-004',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    108000000, 0, 5100.00, 10.2, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 600, 180000, 108000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-005',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5100.00, 10.2, '[{"product_sku":"BHL-LON-330","quantity":600,"weight_kg":5100}]'::jsonb);
END $$;

-- DH-005 | QN-HH | BHL-DRAFT-30 x220 = 7040kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QN-HH'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-005',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    176000000, 0, 7040.00, 14.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 220, 800000, 176000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-006',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 7040.00, 14.1, '[{"product_sku":"BHL-DRAFT-30","quantity":220,"weight_kg":7040}]'::jsonb);
END $$;

-- DH-006 | TY-122 | BHL-DRAFT-30 x130 = 4160kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TY-122';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'TY-122'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-006',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    104000000, 0, 4160.00, 8.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 130, 800000, 104000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-007',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4160.00, 8.3, '[{"product_sku":"BHL-DRAFT-30","quantity":130,"weight_kg":4160}]'::jsonb);
END $$;

-- DH-007 | VD2-143 | BHL-DRAFT-30 x105 = 3360kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'VD2-143';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'VD2-143'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-007',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    84000000, 0, 3360.00, 6.7, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 105, 800000, 84000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-008',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3360.00, 6.7, '[{"product_sku":"BHL-DRAFT-30","quantity":105,"weight_kg":3360}]'::jsonb);
END $$;

-- DH-008 | NT1-3-110 | BHL-DRAFT-30 x50 = 1600kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NT1-3-110';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NT1-3-110'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-008',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    40000000, 0, 1600.00, 3.2, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 50, 800000, 40000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-009',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 1600.00, 3.2, '[{"product_sku":"BHL-DRAFT-30","quantity":50,"weight_kg":1600}]'::jsonb);
END $$;

-- DH-009 | HD-70 | BHL-DRAFT-30 x845 = 27040kg → 4 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HD-70';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HD-70'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-009',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    676000000, 0, 27040.00, 54.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 845, 800000, 676000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-010',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6752.00, 13.5, '[{"product_sku":"BHL-DRAFT-30","quantity":211,"weight_kg":6752}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-011',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6752.00, 13.5, '[{"product_sku":"BHL-DRAFT-30","quantity":211,"weight_kg":6752}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-012',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6752.00, 13.5, '[{"product_sku":"BHL-DRAFT-30","quantity":211,"weight_kg":6752}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-013',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6784.00, 13.6, '[{"product_sku":"BHL-DRAFT-30","quantity":212,"weight_kg":6784}]'::jsonb);
END $$;

-- DH-010 | HP-4745 | BHL-DRAFT-30 x320 = 10240kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HP-4745';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HP-4745'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-010',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    256000000, 0, 10240.00, 20.5, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 320, 800000, 256000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-014',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5120.00, 10.2, '[{"product_sku":"BHL-DRAFT-30","quantity":160,"weight_kg":5120}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-015',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5120.00, 10.2, '[{"product_sku":"BHL-DRAFT-30","quantity":160,"weight_kg":5120}]'::jsonb);
END $$;

-- DH-011 | MC4-93 | BHL-LON-330 x1900 = 16150kg → 3 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'MC4-93';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'MC4-93'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-011',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    342000000, 0, 16150.00, 32.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 1900, 180000, 342000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-016',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5380.50, 10.8, '[{"product_sku":"BHL-LON-330","quantity":633,"weight_kg":5380.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-017',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5380.50, 10.8, '[{"product_sku":"BHL-LON-330","quantity":633,"weight_kg":5380.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-018',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5389.00, 10.8, '[{"product_sku":"BHL-LON-330","quantity":634,"weight_kg":5389}]'::jsonb);
END $$;

-- DH-012 | QN-HH2 | BHL-LON-330 x800 = 6800kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH2';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QN-HH2'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-012',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    144000000, 0, 6800.00, 13.6, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 800, 180000, 144000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-019',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6800.00, 13.6, '[{"product_sku":"BHL-LON-330","quantity":800,"weight_kg":6800}]'::jsonb);
END $$;

-- DH-013 | QN-HH | BHL-LON-330 x1900 = 16150kg → 3 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QN-HH'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-013',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    342000000, 0, 16150.00, 32.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 1900, 180000, 342000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-020',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5380.50, 10.8, '[{"product_sku":"BHL-LON-330","quantity":633,"weight_kg":5380.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-021',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5380.50, 10.8, '[{"product_sku":"BHL-LON-330","quantity":633,"weight_kg":5380.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-022',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5389.00, 10.8, '[{"product_sku":"BHL-LON-330","quantity":634,"weight_kg":5389}]'::jsonb);
END $$;

-- DH-014 | TB-133 | BHL-DRAFT-30 x1180 = 37760kg → 6 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TB-133';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'TB-133'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-014',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    944000000, 0, 37760.00, 75.5, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 1180, 800000, 944000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-023',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6272.00, 12.5, '[{"product_sku":"BHL-DRAFT-30","quantity":196,"weight_kg":6272}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-024',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6272.00, 12.5, '[{"product_sku":"BHL-DRAFT-30","quantity":196,"weight_kg":6272}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-025',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6272.00, 12.5, '[{"product_sku":"BHL-DRAFT-30","quantity":196,"weight_kg":6272}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-026',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6272.00, 12.5, '[{"product_sku":"BHL-DRAFT-30","quantity":196,"weight_kg":6272}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-027',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6272.00, 12.5, '[{"product_sku":"BHL-DRAFT-30","quantity":196,"weight_kg":6272}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-028',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6400.00, 12.8, '[{"product_sku":"BHL-DRAFT-30","quantity":200,"weight_kg":6400}]'::jsonb);
END $$;

-- DH-015 | NG-109 | BHL-DRAFT-30 x360 = 11520kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NG-109';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NG-109'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-015',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    288000000, 0, 11520.00, 23.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 360, 800000, 288000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-029',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5760.00, 11.5, '[{"product_sku":"BHL-DRAFT-30","quantity":180,"weight_kg":5760}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-030',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5760.00, 11.5, '[{"product_sku":"BHL-DRAFT-30","quantity":180,"weight_kg":5760}]'::jsonb);
END $$;

-- DH-016 | NT6BC-115 | BHL-DRAFT-30 x76 = 2432kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NT6BC-115';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NT6BC-115'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-016',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    60800000, 0, 2432.00, 4.9, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 76, 800000, 60800000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-031',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 2432.00, 4.9, '[{"product_sku":"BHL-DRAFT-30","quantity":76,"weight_kg":2432}]'::jsonb);
END $$;

-- DH-017 | HH2-70 | BHL-CHAI-355 x400 = 6000kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HH2-70';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HH2-70'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-017',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    100000000, 0, 6000.00, 12.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 400, 250000, 100000000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-032',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6000.00, 12.0, '[{"product_sku":"BHL-CHAI-355","quantity":400,"weight_kg":6000}]'::jsonb);
END $$;

-- DH-018 | CP2-29 | BHL-CHAI-355 x150 = 2250kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'CP2-29';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'CP2-29'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-018',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    37500000, 0, 2250.00, 4.5, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 150, 250000, 37500000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-033',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 2250.00, 4.5, '[{"product_sku":"BHL-CHAI-355","quantity":150,"weight_kg":2250}]'::jsonb);
END $$;

-- DH-019 | NĐ-4766 | BHL-CHAI-355 x25 = 375kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NĐ-4766';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NĐ-4766'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-019',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    6250000, 0, 375.00, 0.8, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 25, 250000, 6250000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-034',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 375.00, 0.8, '[{"product_sku":"BHL-CHAI-355","quantity":25,"weight_kg":375}]'::jsonb);
END $$;

-- DH-020 | NĐ-4767 | BHL-DRAFT-30 x90 = 2880kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NĐ-4767';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NĐ-4767'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-020',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    72000000, 0, 2880.00, 5.8, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 90, 800000, 72000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-035',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 2880.00, 5.8, '[{"product_sku":"BHL-DRAFT-30","quantity":90,"weight_kg":2880}]'::jsonb);
END $$;

-- DH-021 | HB-73 | BHL-LON-330 x1800 = 15300kg → 3 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HB-73';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HB-73'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-021',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    324000000, 0, 15300.00, 30.6, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 1800, 180000, 324000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-036',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5100.00, 10.2, '[{"product_sku":"BHL-LON-330","quantity":600,"weight_kg":5100}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-037',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5100.00, 10.2, '[{"product_sku":"BHL-LON-330","quantity":600,"weight_kg":5100}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-038',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5100.00, 10.2, '[{"product_sku":"BHL-LON-330","quantity":600,"weight_kg":5100}]'::jsonb);
END $$;

-- DH-022 | TB-125 | BHL-DRAFT-30 x670 = 21440kg → 3 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TB-125';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'TB-125'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-022',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    536000000, 0, 21440.00, 42.9, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 670, 800000, 536000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-039',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 7136.00, 14.3, '[{"product_sku":"BHL-DRAFT-30","quantity":223,"weight_kg":7136}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-040',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 7136.00, 14.3, '[{"product_sku":"BHL-DRAFT-30","quantity":223,"weight_kg":7136}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-041',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 7168.00, 14.3, '[{"product_sku":"BHL-DRAFT-30","quantity":224,"weight_kg":7168}]'::jsonb);
END $$;

-- DH-023 | QN-TN | BHL-DRAFT-30 x140 = 4480kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-TN';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QN-TN'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-023',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    112000000, 0, 4480.00, 9.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 140, 800000, 112000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-042',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4480.00, 9.0, '[{"product_sku":"BHL-DRAFT-30","quantity":140,"weight_kg":4480}]'::jsonb);
END $$;

-- DH-024 | HH1-35 | BHL-DRAFT-30 x110 = 3520kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HH1-35';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HH1-35'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-024',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    88000000, 0, 3520.00, 7.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 110, 800000, 88000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-043',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3520.00, 7.0, '[{"product_sku":"BHL-DRAFT-30","quantity":110,"weight_kg":3520}]'::jsonb);
END $$;

-- DH-025 | HNI-48 | BHL-LON-330 x3600 = 30600kg → 5 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HNI-48';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HNI-48'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-025',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    648000000, 0, 30600.00, 61.2, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 3600, 180000, 648000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-044',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6120.00, 12.2, '[{"product_sku":"BHL-LON-330","quantity":720,"weight_kg":6120}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-045',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6120.00, 12.2, '[{"product_sku":"BHL-LON-330","quantity":720,"weight_kg":6120}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-046',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6120.00, 12.2, '[{"product_sku":"BHL-LON-330","quantity":720,"weight_kg":6120}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-047',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6120.00, 12.2, '[{"product_sku":"BHL-LON-330","quantity":720,"weight_kg":6120}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-048',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6120.00, 12.2, '[{"product_sku":"BHL-LON-330","quantity":720,"weight_kg":6120}]'::jsonb);
END $$;

-- DH-026 | TN-4793 | BHL-DRAFT-30 x360 = 11520kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TN-4793';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'TN-4793'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-026',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    288000000, 0, 11520.00, 23.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 360, 800000, 288000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-049',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5760.00, 11.5, '[{"product_sku":"BHL-DRAFT-30","quantity":180,"weight_kg":5760}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-050',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5760.00, 11.5, '[{"product_sku":"BHL-DRAFT-30","quantity":180,"weight_kg":5760}]'::jsonb);
END $$;

-- DH-027 | HH2-69 | BHL-LON-330 x1900 = 16150kg → 3 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HH2-69';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HH2-69'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-027',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    342000000, 0, 16150.00, 32.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 1900, 180000, 342000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-051',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5380.50, 10.8, '[{"product_sku":"BHL-LON-330","quantity":633,"weight_kg":5380.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-052',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5380.50, 10.8, '[{"product_sku":"BHL-LON-330","quantity":633,"weight_kg":5380.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-053',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5389.00, 10.8, '[{"product_sku":"BHL-LON-330","quantity":634,"weight_kg":5389}]'::jsonb);
END $$;

-- DH-028 | DT1-34 | BHL-LON-330 x3520 = 29920kg → 4 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'DT1-34';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'DT1-34'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-028',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    633600000, 0, 29920.00, 59.8, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 3520, 180000, 633600000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-054',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 7480.00, 15.0, '[{"product_sku":"BHL-LON-330","quantity":880,"weight_kg":7480}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-055',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 7480.00, 15.0, '[{"product_sku":"BHL-LON-330","quantity":880,"weight_kg":7480}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-056',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 7480.00, 15.0, '[{"product_sku":"BHL-LON-330","quantity":880,"weight_kg":7480}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-057',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 7480.00, 15.0, '[{"product_sku":"BHL-LON-330","quantity":880,"weight_kg":7480}]'::jsonb);
END $$;

-- DH-029 | TY-122 | BHL-DRAFT-30 x130 = 4160kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TY-122';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'TY-122'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-029',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    104000000, 0, 4160.00, 8.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 130, 800000, 104000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-058',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4160.00, 8.3, '[{"product_sku":"BHL-DRAFT-30","quantity":130,"weight_kg":4160}]'::jsonb);
END $$;

-- DH-030 | QN-HH2 | BHL-LON-330 x800 = 6800kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH2';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QN-HH2'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-030',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    144000000, 0, 6800.00, 13.6, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 800, 180000, 144000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-059',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6800.00, 13.6, '[{"product_sku":"BHL-LON-330","quantity":800,"weight_kg":6800}]'::jsonb);
END $$;

-- DH-031 | HD-70 | BHL-CHAI-355 x5 = 75kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HD-70';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HD-70'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-031',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    1250000, 0, 75.00, 0.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 5, 250000, 1250000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-060',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 75.00, 0.1, '[{"product_sku":"BHL-CHAI-355","quantity":5,"weight_kg":75}]'::jsonb);
END $$;

-- DH-032 | HD-54 | BHL-LON-330 x600 = 5100kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HD-54';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HD-54'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-032',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    108000000, 0, 5100.00, 10.2, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 600, 180000, 108000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-061',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5100.00, 10.2, '[{"product_sku":"BHL-LON-330","quantity":600,"weight_kg":5100}]'::jsonb);
END $$;

-- DH-033 | QN-HH | BHL-DRAFT-30 x100 = 3200kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QN-HH'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-033',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    80000000, 0, 3200.00, 6.4, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 100, 800000, 80000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-062',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3200.00, 6.4, '[{"product_sku":"BHL-DRAFT-30","quantity":100,"weight_kg":3200}]'::jsonb);
END $$;

-- DH-034 | HH1-35 | BHL-DRAFT-30 x110 = 3520kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HH1-35';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HH1-35'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-034',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    88000000, 0, 3520.00, 7.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 110, 800000, 88000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-063',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3520.00, 7.0, '[{"product_sku":"BHL-DRAFT-30","quantity":110,"weight_kg":3520}]'::jsonb);
END $$;

-- DH-035 | QY-121 | BHL-CHAI-355 x130 = 1950kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QY-121';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QY-121'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-035',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    32500000, 0, 1950.00, 3.9, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 130, 250000, 32500000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-064',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 1950.00, 3.9, '[{"product_sku":"BHL-CHAI-355","quantity":130,"weight_kg":1950}]'::jsonb);
END $$;

-- DH-036 | HD-70 | BHL-DRAFT-30 x110 = 3520kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HD-70';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HD-70'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-036',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    88000000, 0, 3520.00, 7.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 110, 800000, 88000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-065',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3520.00, 7.0, '[{"product_sku":"BHL-DRAFT-30","quantity":110,"weight_kg":3520}]'::jsonb);
END $$;

-- DH-037 | HD-70 | BHL-DRAFT-30 x165 = 5280kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HD-70';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HD-70'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-037',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    132000000, 0, 5280.00, 10.6, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 165, 800000, 132000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-066',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5280.00, 10.6, '[{"product_sku":"BHL-DRAFT-30","quantity":165,"weight_kg":5280}]'::jsonb);
END $$;

-- DH-038 | BG-112 | BHL-CHAI-450 x140 = 1960kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'BG-112';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'BG-112'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-038',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    35000000, 0, 1960.00, 3.9, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 140, 250000, 35000000 FROM products WHERE sku = 'BHL-CHAI-450';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-067',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 1960.00, 3.9, '[{"product_sku":"BHL-CHAI-450","quantity":140,"weight_kg":1960}]'::jsonb);
END $$;

-- DH-039 | CP2-29 | BHL-LON-330 x850 = 7225kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'CP2-29';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'CP2-29'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-039',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    153000000, 0, 7225.00, 14.4, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 850, 180000, 153000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-068',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 7225.00, 14.4, '[{"product_sku":"BHL-LON-330","quantity":850,"weight_kg":7225}]'::jsonb);
END $$;

-- DH-040 | CP2-29 | BHL-CHAI-355 x150 = 2250kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'CP2-29';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'CP2-29'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-040',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    37500000, 0, 2250.00, 4.5, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 150, 250000, 37500000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-069',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 2250.00, 4.5, '[{"product_sku":"BHL-CHAI-355","quantity":150,"weight_kg":2250}]'::jsonb);
END $$;

-- DH-041 | HNI-48 | BHL-LON-330 x900 = 7650kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HNI-48';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HNI-48'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-041',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    162000000, 0, 7650.00, 15.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 900, 180000, 162000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-070',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-071',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
END $$;

-- DH-042 | HNI-48 | BHL-LON-330 x900 = 7650kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HNI-48';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HNI-48'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-042',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    162000000, 0, 7650.00, 15.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 900, 180000, 162000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-072',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-073',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
END $$;

-- DH-043 | HNI-48 | BHL-LON-330 x900 = 7650kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HNI-48';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HNI-48'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-043',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    162000000, 0, 7650.00, 15.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 900, 180000, 162000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-074',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-075',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
END $$;

-- DH-044 | HNI-48 | BHL-LON-330 x900 = 7650kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HNI-48';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HNI-48'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-044',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    162000000, 0, 7650.00, 15.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 900, 180000, 162000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-076',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-077',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
END $$;

-- DH-045 | VD2-143 | BHL-LON-330 x300 = 2550kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'VD2-143';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'VD2-143'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-045',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    54000000, 0, 2550.00, 5.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 300, 180000, 54000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-078',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 2550.00, 5.1, '[{"product_sku":"BHL-LON-330","quantity":300,"weight_kg":2550}]'::jsonb);
END $$;

-- DH-046 | VD2-143 | BHL-DRAFT-30 x105 = 3360kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'VD2-143';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'VD2-143'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-046',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    84000000, 0, 3360.00, 6.7, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 105, 800000, 84000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-079',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3360.00, 6.7, '[{"product_sku":"BHL-DRAFT-30","quantity":105,"weight_kg":3360}]'::jsonb);
END $$;

-- DH-047 | NT6BC-115 | BHL-LON-330 x350 = 2975kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NT6BC-115';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NT6BC-115'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-047',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    63000000, 0, 2975.00, 6.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 350, 180000, 63000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-080',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 2975.00, 6.0, '[{"product_sku":"BHL-LON-330","quantity":350,"weight_kg":2975}]'::jsonb);
END $$;

-- DH-048 | NT6BC-115 | BHL-DRAFT-30 x30 = 960kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NT6BC-115';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NT6BC-115'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-048',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    24000000, 0, 960.00, 1.9, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 30, 800000, 24000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-081',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 960.00, 1.9, '[{"product_sku":"BHL-DRAFT-30","quantity":30,"weight_kg":960}]'::jsonb);
END $$;

-- DH-049 | NT6BC-115 | BHL-LON-330 x250 = 2125kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NT6BC-115';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NT6BC-115'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-049',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    45000000, 0, 2125.00, 4.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 250, 180000, 45000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-082',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 2125.00, 4.3, '[{"product_sku":"BHL-LON-330","quantity":250,"weight_kg":2125}]'::jsonb);
END $$;

-- DH-050 | NT6BC-115 | NGK-CHANH-330 x46 = 1159kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NT6BC-115';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NT6BC-115'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-050',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    8280000, 0, 1159.20, 2.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 46, 180000, 8280000 FROM products WHERE sku = 'NGK-CHANH-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-083',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 1159.20, 2.3, '[{"product_sku":"NGK-CHANH-330","quantity":46,"weight_kg":1159.2}]'::jsonb);
END $$;

-- DH-051 | NT1-3-110 | BHL-LON-330 x800 = 6800kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NT1-3-110';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NT1-3-110'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-051',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    144000000, 0, 6800.00, 13.6, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 800, 180000, 144000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-084',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6800.00, 13.6, '[{"product_sku":"BHL-LON-330","quantity":800,"weight_kg":6800}]'::jsonb);
END $$;

-- DH-052 | NT1-3-110 | BHL-CHAI-355 x100 = 1500kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NT1-3-110';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NT1-3-110'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-052',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    25000000, 0, 1500.00, 3.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 100, 250000, 25000000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-085',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 1500.00, 3.0, '[{"product_sku":"BHL-CHAI-355","quantity":100,"weight_kg":1500}]'::jsonb);
END $$;

-- DH-053 | NT1-3-110 | BHL-CHAI-355 x200 = 3000kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NT1-3-110';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NT1-3-110'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-053',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    50000000, 0, 3000.00, 6.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 200, 250000, 50000000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-086',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3000.00, 6.0, '[{"product_sku":"BHL-CHAI-355","quantity":200,"weight_kg":3000}]'::jsonb);
END $$;

-- DH-054 | NT1-3-110 | BHL-LON-330 x800 = 6800kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NT1-3-110';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NT1-3-110'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-054',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    144000000, 0, 6800.00, 13.6, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 800, 180000, 144000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-087',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6800.00, 13.6, '[{"product_sku":"BHL-LON-330","quantity":800,"weight_kg":6800}]'::jsonb);
END $$;

-- DH-055 | NT1-3-110 | BHL-DRAFT-30 x50 = 1600kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NT1-3-110';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NT1-3-110'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-055',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    40000000, 0, 1600.00, 3.2, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 50, 800000, 40000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-088',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 1600.00, 3.2, '[{"product_sku":"BHL-DRAFT-30","quantity":50,"weight_kg":1600}]'::jsonb);
END $$;

-- DH-056 | QN-HH | BHL-LON-330 x300 = 2550kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QN-HH'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-056',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    54000000, 0, 2550.00, 5.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 300, 180000, 54000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-089',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 2550.00, 5.1, '[{"product_sku":"BHL-LON-330","quantity":300,"weight_kg":2550}]'::jsonb);
END $$;

-- DH-057 | QN-HH | BHL-LON-330 x700 = 5950kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QN-HH'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-057',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    126000000, 0, 5950.00, 11.9, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 700, 180000, 126000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-090',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5950.00, 11.9, '[{"product_sku":"BHL-LON-330","quantity":700,"weight_kg":5950}]'::jsonb);
END $$;

-- DH-058 | HP-4745 | BHL-DRAFT-30 x130 = 4160kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HP-4745';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HP-4745'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-058',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    104000000, 0, 4160.00, 8.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 130, 800000, 104000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-091',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4160.00, 8.3, '[{"product_sku":"BHL-DRAFT-30","quantity":130,"weight_kg":4160}]'::jsonb);
END $$;

-- DH-059 | HP-4745 | BHL-DRAFT-30 x190 = 6080kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HP-4745';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HP-4745'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-059',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    152000000, 0, 6080.00, 12.2, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 190, 800000, 152000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-092',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6080.00, 12.2, '[{"product_sku":"BHL-DRAFT-30","quantity":190,"weight_kg":6080}]'::jsonb);
END $$;

-- DH-060 | QN-HH | BHL-CHAI-355 x50 = 750kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QN-HH'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-060',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    12500000, 0, 750.00, 1.5, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 50, 250000, 12500000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-093',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 750.00, 1.5, '[{"product_sku":"BHL-CHAI-355","quantity":50,"weight_kg":750}]'::jsonb);
END $$;

-- DH-061 | QN-HH | BHL-DRAFT-30 x120 = 3840kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QN-HH'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-061',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    96000000, 0, 3840.00, 7.7, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 120, 800000, 96000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-094',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3840.00, 7.7, '[{"product_sku":"BHL-DRAFT-30","quantity":120,"weight_kg":3840}]'::jsonb);
END $$;

-- DH-062 | TB-125 | BHL-DRAFT-30 x170 = 5440kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TB-125';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'TB-125'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-062',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    136000000, 0, 5440.00, 10.9, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 170, 800000, 136000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-095',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5440.00, 10.9, '[{"product_sku":"BHL-DRAFT-30","quantity":170,"weight_kg":5440}]'::jsonb);
END $$;

-- DH-063 | TB-125 | BHL-DRAFT-30 x120 = 3840kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TB-125';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'TB-125'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-063',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    96000000, 0, 3840.00, 7.7, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 120, 800000, 96000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-096',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3840.00, 7.7, '[{"product_sku":"BHL-DRAFT-30","quantity":120,"weight_kg":3840}]'::jsonb);
END $$;

-- DH-064 | HD-70 | BHL-DRAFT-30 x170 = 5440kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HD-70';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HD-70'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-064',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    136000000, 0, 5440.00, 10.9, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 170, 800000, 136000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-097',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5440.00, 10.9, '[{"product_sku":"BHL-DRAFT-30","quantity":170,"weight_kg":5440}]'::jsonb);
END $$;

-- DH-065 | NĐ-4766 | BHL-CHAI-355 x25 = 375kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NĐ-4766';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NĐ-4766'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-065',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    6250000, 0, 375.00, 0.8, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 25, 250000, 6250000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-098',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 375.00, 0.8, '[{"product_sku":"BHL-CHAI-355","quantity":25,"weight_kg":375}]'::jsonb);
END $$;

-- DH-066 | QN-TN | BHL-DRAFT-30 x140 = 4480kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-TN';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QN-TN'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-066',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    112000000, 0, 4480.00, 9.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 140, 800000, 112000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-099',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4480.00, 9.0, '[{"product_sku":"BHL-DRAFT-30","quantity":140,"weight_kg":4480}]'::jsonb);
END $$;

-- DH-067 | VD2-143 | BHL-LON-330 x700 = 5950kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'VD2-143';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'VD2-143'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-067',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    126000000, 0, 5950.00, 11.9, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 700, 180000, 126000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-100',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5950.00, 11.9, '[{"product_sku":"BHL-LON-330","quantity":700,"weight_kg":5950}]'::jsonb);
END $$;

-- DH-068 | NĐ-4767 | BHL-DRAFT-30 x90 = 2880kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NĐ-4767';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NĐ-4767'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-068',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    72000000, 0, 2880.00, 5.8, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 90, 800000, 72000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-101',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 2880.00, 5.8, '[{"product_sku":"BHL-DRAFT-30","quantity":90,"weight_kg":2880}]'::jsonb);
END $$;

-- DH-069 | CP2-29 | BHL-LON-330 x800 = 6800kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'CP2-29';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'CP2-29'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-069',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    144000000, 0, 6800.00, 13.6, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 800, 180000, 144000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-102',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6800.00, 13.6, '[{"product_sku":"BHL-LON-330","quantity":800,"weight_kg":6800}]'::jsonb);
END $$;

-- DH-070 | CP2-29 | BHL-LON-330 x650 = 5525kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'CP2-29';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'CP2-29'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-070',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    117000000, 0, 5525.00, 11.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 650, 180000, 117000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-103',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5525.00, 11.1, '[{"product_sku":"BHL-LON-330","quantity":650,"weight_kg":5525}]'::jsonb);
END $$;

-- DH-071 | QN-HH | BHL-LON-330 x900 = 7650kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QN-HH'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-071',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    162000000, 0, 7650.00, 15.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 900, 180000, 162000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-104',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-105',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
END $$;

-- DH-072 | HH2-70 | BHL-CHAI-355 x200 = 3000kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HH2-70';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HH2-70'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-072',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    50000000, 0, 3000.00, 6.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 200, 250000, 50000000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-106',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3000.00, 6.0, '[{"product_sku":"BHL-CHAI-355","quantity":200,"weight_kg":3000}]'::jsonb);
END $$;

-- DH-073 | HB-73 | BHL-LON-330 x900 = 7650kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HB-73';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HB-73'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-073',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    162000000, 0, 7650.00, 15.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 900, 180000, 162000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-107',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-108',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
END $$;

-- DH-074 | DT1-34 | BHL-LON-330 x1760 = 14960kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'DT1-34';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'DT1-34'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-074',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    316800000, 0, 14960.00, 29.9, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 1760, 180000, 316800000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-109',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 7480.00, 15.0, '[{"product_sku":"BHL-LON-330","quantity":880,"weight_kg":7480}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-110',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 7480.00, 15.0, '[{"product_sku":"BHL-LON-330","quantity":880,"weight_kg":7480}]'::jsonb);
END $$;

-- DH-075 | TB-133 | BHL-DRAFT-30 x200 = 6400kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TB-133';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'TB-133'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-075',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    160000000, 0, 6400.00, 12.8, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 200, 800000, 160000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-111',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6400.00, 12.8, '[{"product_sku":"BHL-DRAFT-30","quantity":200,"weight_kg":6400}]'::jsonb);
END $$;

-- DH-076 | MC4-93 | BHL-LON-330 x950 = 8075kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'MC4-93';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'MC4-93'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-076',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    171000000, 0, 8075.00, 16.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 950, 180000, 171000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-112',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-113',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
END $$;

-- DH-077 | QN-HH | BHL-LON-330 x950 = 8075kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QN-HH'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-077',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    171000000, 0, 8075.00, 16.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 950, 180000, 171000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-114',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-115',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
END $$;

-- DH-078 | HD-70 | BHL-DRAFT-30 x200 = 6400kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HD-70';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HD-70'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-078',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    160000000, 0, 6400.00, 12.8, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 200, 800000, 160000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-116',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6400.00, 12.8, '[{"product_sku":"BHL-DRAFT-30","quantity":200,"weight_kg":6400}]'::jsonb);
END $$;

-- DH-079 | BN-24 | BHL-DRAFT-30 x176 = 5632kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'BN-24';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'BN-24'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-079',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    140800000, 0, 5632.00, 11.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 176, 800000, 140800000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-117',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5632.00, 11.3, '[{"product_sku":"BHL-DRAFT-30","quantity":176,"weight_kg":5632}]'::jsonb);
END $$;

-- DH-080 | TN-4793 | BHL-DRAFT-30 x180 = 5760kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TN-4793';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'TN-4793'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-080',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    144000000, 0, 5760.00, 11.5, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 180, 800000, 144000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-118',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5760.00, 11.5, '[{"product_sku":"BHL-DRAFT-30","quantity":180,"weight_kg":5760}]'::jsonb);
END $$;

-- DH-081 | NT6BC-115 | BHL-LON-330 x950 = 8075kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NT6BC-115';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NT6BC-115'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-081',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    171000000, 0, 8075.00, 16.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 950, 180000, 171000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-119',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-120',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
END $$;

-- DH-082 | MC4-93 | BHL-LON-330 x950 = 8075kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'MC4-93';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'MC4-93'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-082',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    171000000, 0, 8075.00, 16.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 950, 180000, 171000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-121',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-122',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
END $$;

-- DH-083 | QN-HH | BHL-LON-330 x950 = 8075kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QN-HH'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-083',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    171000000, 0, 8075.00, 16.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 950, 180000, 171000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-123',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-124',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
END $$;

-- DH-084 | HH2-69 | BHL-LON-330 x950 = 8075kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HH2-69';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HH2-69'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-084',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    171000000, 0, 8075.00, 16.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 950, 180000, 171000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-125',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-126',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
END $$;

-- DH-085 | HH2-70 | BHL-CHAI-355 x200 = 3000kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HH2-70';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HH2-70'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-085',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    50000000, 0, 3000.00, 6.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 200, 250000, 50000000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-127',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3000.00, 6.0, '[{"product_sku":"BHL-CHAI-355","quantity":200,"weight_kg":3000}]'::jsonb);
END $$;

-- DH-086 | HB-73 | BHL-LON-330 x900 = 7650kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HB-73';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HB-73'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-086',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    162000000, 0, 7650.00, 15.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 900, 180000, 162000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-128',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-129',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
END $$;

-- DH-087 | DT1-34 | BHL-LON-330 x1760 = 14960kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'DT1-34';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'DT1-34'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-087',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    316800000, 0, 14960.00, 29.9, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 1760, 180000, 316800000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-130',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 7480.00, 15.0, '[{"product_sku":"BHL-LON-330","quantity":880,"weight_kg":7480}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-131',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 7480.00, 15.0, '[{"product_sku":"BHL-LON-330","quantity":880,"weight_kg":7480}]'::jsonb);
END $$;

-- DH-088 | TB-133 | BHL-DRAFT-30 x200 = 6400kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TB-133';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'TB-133'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-088',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    160000000, 0, 6400.00, 12.8, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 200, 800000, 160000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-132',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6400.00, 12.8, '[{"product_sku":"BHL-DRAFT-30","quantity":200,"weight_kg":6400}]'::jsonb);
END $$;

-- DH-089 | TB-133 | BHL-DRAFT-30 x190 = 6080kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TB-133';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'TB-133'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-089',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    152000000, 0, 6080.00, 12.2, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 190, 800000, 152000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-133',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6080.00, 12.2, '[{"product_sku":"BHL-DRAFT-30","quantity":190,"weight_kg":6080}]'::jsonb);
END $$;

-- DH-090 | TB-133 | BHL-DRAFT-30 x200 = 6400kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TB-133';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'TB-133'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-090',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    160000000, 0, 6400.00, 12.8, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 200, 800000, 160000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-134',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6400.00, 12.8, '[{"product_sku":"BHL-DRAFT-30","quantity":200,"weight_kg":6400}]'::jsonb);
END $$;

-- DH-091 | NG-109 | BHL-DRAFT-30 x180 = 5760kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NG-109';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NG-109'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-091',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    144000000, 0, 5760.00, 11.5, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 180, 800000, 144000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-135',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5760.00, 11.5, '[{"product_sku":"BHL-DRAFT-30","quantity":180,"weight_kg":5760}]'::jsonb);
END $$;

-- DH-092 | NT6BC-115 | BHL-LON-330 x950 = 8075kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NT6BC-115';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'NT6BC-115'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-092',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    171000000, 0, 8075.00, 16.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 950, 180000, 171000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-136',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-137',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
END $$;

-- DH-093 | TB-125 | BHL-CHAI-355 x130 = 1950kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TB-125';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'TB-125'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-093',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    32500000, 0, 1950.00, 3.9, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 130, 250000, 32500000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-138',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 1950.00, 3.9, '[{"product_sku":"BHL-CHAI-355","quantity":130,"weight_kg":1950}]'::jsonb);
END $$;

-- DH-094 | TB-125 | BHL-DRAFT-30 x190 = 6080kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TB-125';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'TB-125'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-094',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    152000000, 0, 6080.00, 12.2, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 190, 800000, 152000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-139',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6080.00, 12.2, '[{"product_sku":"BHL-DRAFT-30","quantity":190,"weight_kg":6080}]'::jsonb);
END $$;

-- DH-095 | QN-HH | BHL-LON-330 x950 = 8075kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QN-HH'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-095',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    171000000, 0, 8075.00, 16.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 950, 180000, 171000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-140',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-141',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
END $$;

-- DH-096 | HH2-69 | BHL-LON-330 x950 = 8075kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HH2-69';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HH2-69'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-096',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    171000000, 0, 8075.00, 16.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 950, 180000, 171000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-142',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-143',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
END $$;

-- DH-097 | HH2-70 | BHL-CHAI-355 x200 = 3000kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HH2-70';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HH2-70'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-097',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    50000000, 0, 3000.00, 6.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 200, 250000, 50000000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-144',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3000.00, 6.0, '[{"product_sku":"BHL-CHAI-355","quantity":200,"weight_kg":3000}]'::jsonb);
END $$;

-- DH-098 | HB-73 | BHL-LON-330 x900 = 7650kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HB-73';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HB-73'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-098',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    162000000, 0, 7650.00, 15.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 900, 180000, 162000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-145',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-146',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
END $$;

-- DH-099 | DT1-34 | BHL-LON-330 x1760 = 14960kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'DT1-34';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'DT1-34'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-099',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    316800000, 0, 14960.00, 29.9, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 1760, 180000, 316800000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-147',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 7480.00, 15.0, '[{"product_sku":"BHL-LON-330","quantity":880,"weight_kg":7480}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-148',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 7480.00, 15.0, '[{"product_sku":"BHL-LON-330","quantity":880,"weight_kg":7480}]'::jsonb);
END $$;

-- DH-100 | TB-133 | BHL-DRAFT-30 x200 = 6400kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TB-133';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'TB-133'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-100',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    160000000, 0, 6400.00, 12.8, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 200, 800000, 160000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-149',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6400.00, 12.8, '[{"product_sku":"BHL-DRAFT-30","quantity":200,"weight_kg":6400}]'::jsonb);
END $$;

-- DH-101 | MC4-93 | BHL-LON-330 x950 = 8075kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'MC4-93';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'MC4-93'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-101',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    171000000, 0, 8075.00, 16.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 950, 180000, 171000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-150',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-151',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
END $$;

-- DH-102 | QN-HH | BHL-LON-330 x950 = 8075kg → 2 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'QN-HH'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-102',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    171000000, 0, 8075.00, 16.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 950, 180000, 171000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-152',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-153',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
END $$;

-- DH-103 | HD-70 | BHL-DRAFT-30 x200 = 6400kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HD-70';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'HD-70'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-103',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    160000000, 0, 6400.00, 12.8, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 200, 800000, 160000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-154',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 6400.00, 12.8, '[{"product_sku":"BHL-DRAFT-30","quantity":200,"weight_kg":6400}]'::jsonb);
END $$;

-- DH-104 | BN-24 | BHL-DRAFT-30 x176 = 5632kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'BN-24';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'BN-24'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-104',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    140800000, 0, 5632.00, 11.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 176, 800000, 140800000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-155',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5632.00, 11.3, '[{"product_sku":"BHL-DRAFT-30","quantity":176,"weight_kg":5632}]'::jsonb);
END $$;

-- DH-105 | TN-4793 | BHL-DRAFT-30 x180 = 5760kg → 1 ship
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TN-4793';
  IF v_cid IS NULL THEN RAISE EXCEPTION 'Customer not found: %', 'TN-4793'; END IF;
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-105',
    v_cid, v_wid, 'confirmed', CURRENT_DATE,
    144000000, 0, 5760.00, 11.5, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 180, 800000, 144000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-156',
    v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 5760.00, 11.5, '[{"product_sku":"BHL-DRAFT-30","quantity":180,"weight_kg":5760}]'::jsonb);
END $$;

UPDATE stock_quants SET quantity = 500000, reserved_qty = 0;
INSERT INTO driver_checkins (driver_id, checkin_date, status, checked_in_at)
SELECT d.id, CURRENT_DATE, 'available', NOW() - INTERVAL '1 hour'
FROM drivers d WHERE d.status = 'active'
ON CONFLICT (driver_id, checkin_date) DO UPDATE SET status = 'available';
COMMIT;
-- Total: 105 orders, 156 shipments (max 7500kg each)