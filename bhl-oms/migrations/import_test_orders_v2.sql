BEGIN;
-- Re-import with max 4800kg per shipment

-- DH-001 | BG-112 | 6210kg | 2 trips (orig: 1)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'BG-112';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-001', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    125000000, 0, 6210.00, 12.4, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 140, 250000, 35000000 FROM products WHERE sku = 'BHL-CHAI-450';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 500, 180000, 90000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-001', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3105.00, 6.2, '[{"product_sku":"BHL-CHAI-450","quantity":70,"weight_kg":980},{"product_sku":"BHL-LON-330","quantity":250,"weight_kg":2125}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-002', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3105.00, 6.2, '[{"product_sku":"BHL-CHAI-450","quantity":70,"weight_kg":980},{"product_sku":"BHL-LON-330","quantity":250,"weight_kg":2125}]'::jsonb);
END $$;

-- DH-002 | BN-24 | 20336kg | 5 trips (orig: 2)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'BN-24';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-002', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    346400000, 0, 20336.00, 40.7, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 352, 800000, 281600000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 360, 180000, 64800000 FROM products WHERE sku = 'NGK-CHANH-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-003', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4067.20, 8.1, '[{"product_sku":"BHL-DRAFT-30","quantity":70,"weight_kg":2240},{"product_sku":"NGK-CHANH-330","quantity":72,"weight_kg":1814.4}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-004', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4067.20, 8.1, '[{"product_sku":"BHL-DRAFT-30","quantity":70,"weight_kg":2240},{"product_sku":"NGK-CHANH-330","quantity":72,"weight_kg":1814.4}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-005', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4067.20, 8.1, '[{"product_sku":"BHL-DRAFT-30","quantity":70,"weight_kg":2240},{"product_sku":"NGK-CHANH-330","quantity":72,"weight_kg":1814.4}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-006', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4067.20, 8.1, '[{"product_sku":"BHL-DRAFT-30","quantity":70,"weight_kg":2240},{"product_sku":"NGK-CHANH-330","quantity":72,"weight_kg":1814.4}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-007', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4067.20, 8.1, '[{"product_sku":"BHL-DRAFT-30","quantity":72,"weight_kg":2304},{"product_sku":"NGK-CHANH-330","quantity":72,"weight_kg":1814.4}]'::jsonb);
END $$;

-- DH-003 | QY-121 | 6234kg | 2 trips (orig: 1)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QY-121';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-003', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    123220000, 0, 6234.00, 12.5, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 130, 250000, 32500000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 504, 180000, 90720000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-008', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3117.00, 6.2, '[{"product_sku":"BHL-CHAI-355","quantity":65,"weight_kg":975},{"product_sku":"BHL-LON-330","quantity":252,"weight_kg":2142}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-009', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3117.00, 6.2, '[{"product_sku":"BHL-CHAI-355","quantity":65,"weight_kg":975},{"product_sku":"BHL-LON-330","quantity":252,"weight_kg":2142}]'::jsonb);
END $$;

-- DH-004 | HD-54 | 5100kg | 2 trips (orig: 1)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HD-54';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-004', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    108000000, 0, 5100.00, 10.2, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 600, 180000, 108000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-010', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 2550.00, 5.1, '[{"product_sku":"BHL-LON-330","quantity":300,"weight_kg":2550}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-011', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 2550.00, 5.1, '[{"product_sku":"BHL-LON-330","quantity":300,"weight_kg":2550}]'::jsonb);
END $$;

-- DH-005 | QN-HH | 48217kg | 11 trips (orig: 7)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-005', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    1034300000, 0, 48217.00, 96.4, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 220, 800000, 176000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 10, 180000, 1800000 FROM products WHERE sku = 'NGK-CHANH-330';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 150, 250000, 37500000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 4550, 180000, 819000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-012', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4383.36, 8.8, '[{"product_sku":"BHL-DRAFT-30","quantity":20,"weight_kg":640},{"product_sku":"NGK-CHANH-330","quantity":0,"weight_kg":0},{"product_sku":"BHL-CHAI-355","quantity":13,"weight_kg":195},{"product_sku":"BHL-LON-330","quantity":413,"weight_kg":3510.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-013', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4383.36, 8.8, '[{"product_sku":"BHL-DRAFT-30","quantity":20,"weight_kg":640},{"product_sku":"NGK-CHANH-330","quantity":0,"weight_kg":0},{"product_sku":"BHL-CHAI-355","quantity":13,"weight_kg":195},{"product_sku":"BHL-LON-330","quantity":413,"weight_kg":3510.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-014', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4383.36, 8.8, '[{"product_sku":"BHL-DRAFT-30","quantity":20,"weight_kg":640},{"product_sku":"NGK-CHANH-330","quantity":0,"weight_kg":0},{"product_sku":"BHL-CHAI-355","quantity":13,"weight_kg":195},{"product_sku":"BHL-LON-330","quantity":413,"weight_kg":3510.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-015', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4383.36, 8.8, '[{"product_sku":"BHL-DRAFT-30","quantity":20,"weight_kg":640},{"product_sku":"NGK-CHANH-330","quantity":0,"weight_kg":0},{"product_sku":"BHL-CHAI-355","quantity":13,"weight_kg":195},{"product_sku":"BHL-LON-330","quantity":413,"weight_kg":3510.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-016', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4383.36, 8.8, '[{"product_sku":"BHL-DRAFT-30","quantity":20,"weight_kg":640},{"product_sku":"NGK-CHANH-330","quantity":0,"weight_kg":0},{"product_sku":"BHL-CHAI-355","quantity":13,"weight_kg":195},{"product_sku":"BHL-LON-330","quantity":413,"weight_kg":3510.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-017', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4383.36, 8.8, '[{"product_sku":"BHL-DRAFT-30","quantity":20,"weight_kg":640},{"product_sku":"NGK-CHANH-330","quantity":0,"weight_kg":0},{"product_sku":"BHL-CHAI-355","quantity":13,"weight_kg":195},{"product_sku":"BHL-LON-330","quantity":413,"weight_kg":3510.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-018', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4383.36, 8.8, '[{"product_sku":"BHL-DRAFT-30","quantity":20,"weight_kg":640},{"product_sku":"NGK-CHANH-330","quantity":0,"weight_kg":0},{"product_sku":"BHL-CHAI-355","quantity":13,"weight_kg":195},{"product_sku":"BHL-LON-330","quantity":413,"weight_kg":3510.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-019', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4383.36, 8.8, '[{"product_sku":"BHL-DRAFT-30","quantity":20,"weight_kg":640},{"product_sku":"NGK-CHANH-330","quantity":0,"weight_kg":0},{"product_sku":"BHL-CHAI-355","quantity":13,"weight_kg":195},{"product_sku":"BHL-LON-330","quantity":413,"weight_kg":3510.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-020', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4383.36, 8.8, '[{"product_sku":"BHL-DRAFT-30","quantity":20,"weight_kg":640},{"product_sku":"NGK-CHANH-330","quantity":0,"weight_kg":0},{"product_sku":"BHL-CHAI-355","quantity":13,"weight_kg":195},{"product_sku":"BHL-LON-330","quantity":413,"weight_kg":3510.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-021', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4383.36, 8.8, '[{"product_sku":"BHL-DRAFT-30","quantity":20,"weight_kg":640},{"product_sku":"NGK-CHANH-330","quantity":0,"weight_kg":0},{"product_sku":"BHL-CHAI-355","quantity":13,"weight_kg":195},{"product_sku":"BHL-LON-330","quantity":413,"weight_kg":3510.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-022', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4383.36, 8.8, '[{"product_sku":"BHL-DRAFT-30","quantity":20,"weight_kg":640},{"product_sku":"NGK-CHANH-330","quantity":10,"weight_kg":252},{"product_sku":"BHL-CHAI-355","quantity":20,"weight_kg":300},{"product_sku":"BHL-LON-330","quantity":420,"weight_kg":3570}]'::jsonb);
END $$;

-- DH-006 | TY-122 | 5585kg | 2 trips (orig: 1)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TY-122';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-006', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    127750000, 0, 5585.00, 11.2, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 130, 800000, 104000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 95, 250000, 23750000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-023', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 2792.50, 5.6, '[{"product_sku":"BHL-DRAFT-30","quantity":65,"weight_kg":2080},{"product_sku":"BHL-CHAI-355","quantity":47,"weight_kg":705}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-024', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 2792.50, 5.6, '[{"product_sku":"BHL-DRAFT-30","quantity":65,"weight_kg":2080},{"product_sku":"BHL-CHAI-355","quantity":48,"weight_kg":720}]'::jsonb);
END $$;

-- DH-007 | VD2-143 | 13985kg | 3 trips (orig: 3)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'VD2-143';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-007', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    309000000, 0, 13985.00, 28.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 105, 800000, 84000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 1250, 180000, 225000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-025', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4661.67, 9.3, '[{"product_sku":"BHL-DRAFT-30","quantity":35,"weight_kg":1120},{"product_sku":"BHL-LON-330","quantity":416,"weight_kg":3536}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-026', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4661.67, 9.3, '[{"product_sku":"BHL-DRAFT-30","quantity":35,"weight_kg":1120},{"product_sku":"BHL-LON-330","quantity":416,"weight_kg":3536}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-027', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4661.67, 9.3, '[{"product_sku":"BHL-DRAFT-30","quantity":35,"weight_kg":1120},{"product_sku":"BHL-LON-330","quantity":418,"weight_kg":3553}]'::jsonb);
END $$;

-- DH-008 | NT1-3-110 | 27375kg | 6 trips (orig: 5)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NT1-3-110';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-008', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    563500000, 0, 27375.00, 54.8, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 50, 800000, 40000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 330, 250000, 82500000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 2450, 180000, 441000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-028', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4562.50, 9.1, '[{"product_sku":"BHL-DRAFT-30","quantity":8,"weight_kg":256},{"product_sku":"BHL-CHAI-355","quantity":55,"weight_kg":825},{"product_sku":"BHL-LON-330","quantity":408,"weight_kg":3468}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-029', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4562.50, 9.1, '[{"product_sku":"BHL-DRAFT-30","quantity":8,"weight_kg":256},{"product_sku":"BHL-CHAI-355","quantity":55,"weight_kg":825},{"product_sku":"BHL-LON-330","quantity":408,"weight_kg":3468}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-030', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4562.50, 9.1, '[{"product_sku":"BHL-DRAFT-30","quantity":8,"weight_kg":256},{"product_sku":"BHL-CHAI-355","quantity":55,"weight_kg":825},{"product_sku":"BHL-LON-330","quantity":408,"weight_kg":3468}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-031', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4562.50, 9.1, '[{"product_sku":"BHL-DRAFT-30","quantity":8,"weight_kg":256},{"product_sku":"BHL-CHAI-355","quantity":55,"weight_kg":825},{"product_sku":"BHL-LON-330","quantity":408,"weight_kg":3468}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-032', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4562.50, 9.1, '[{"product_sku":"BHL-DRAFT-30","quantity":8,"weight_kg":256},{"product_sku":"BHL-CHAI-355","quantity":55,"weight_kg":825},{"product_sku":"BHL-LON-330","quantity":408,"weight_kg":3468}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-033', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4562.50, 9.1, '[{"product_sku":"BHL-DRAFT-30","quantity":10,"weight_kg":320},{"product_sku":"BHL-CHAI-355","quantity":55,"weight_kg":825},{"product_sku":"BHL-LON-330","quantity":410,"weight_kg":3485}]'::jsonb);
END $$;

-- DH-009 | HD-70 | 41488kg | 9 trips (orig: 6)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HD-70';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-009', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    868100000, 0, 41487.50, 83.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 845, 800000, 676000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 300, 180000, 54000000 FROM products WHERE sku = 'NGK-CHANH-330';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 15, 250000, 3750000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 145, 250000, 36250000 FROM products WHERE sku = 'BHL-CHAI-450';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 545, 180000, 98100000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-034', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4609.72, 9.2, '[{"product_sku":"BHL-DRAFT-30","quantity":93,"weight_kg":2976},{"product_sku":"NGK-CHANH-330","quantity":33,"weight_kg":831.6},{"product_sku":"BHL-CHAI-355","quantity":1,"weight_kg":15},{"product_sku":"BHL-CHAI-450","quantity":16,"weight_kg":224},{"product_sku":"BHL-LON-330","quantity":60,"weight_kg":510}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-035', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4609.72, 9.2, '[{"product_sku":"BHL-DRAFT-30","quantity":93,"weight_kg":2976},{"product_sku":"NGK-CHANH-330","quantity":33,"weight_kg":831.6},{"product_sku":"BHL-CHAI-355","quantity":1,"weight_kg":15},{"product_sku":"BHL-CHAI-450","quantity":16,"weight_kg":224},{"product_sku":"BHL-LON-330","quantity":60,"weight_kg":510}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-036', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4609.72, 9.2, '[{"product_sku":"BHL-DRAFT-30","quantity":93,"weight_kg":2976},{"product_sku":"NGK-CHANH-330","quantity":33,"weight_kg":831.6},{"product_sku":"BHL-CHAI-355","quantity":1,"weight_kg":15},{"product_sku":"BHL-CHAI-450","quantity":16,"weight_kg":224},{"product_sku":"BHL-LON-330","quantity":60,"weight_kg":510}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-037', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4609.72, 9.2, '[{"product_sku":"BHL-DRAFT-30","quantity":93,"weight_kg":2976},{"product_sku":"NGK-CHANH-330","quantity":33,"weight_kg":831.6},{"product_sku":"BHL-CHAI-355","quantity":1,"weight_kg":15},{"product_sku":"BHL-CHAI-450","quantity":16,"weight_kg":224},{"product_sku":"BHL-LON-330","quantity":60,"weight_kg":510}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-038', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4609.72, 9.2, '[{"product_sku":"BHL-DRAFT-30","quantity":93,"weight_kg":2976},{"product_sku":"NGK-CHANH-330","quantity":33,"weight_kg":831.6},{"product_sku":"BHL-CHAI-355","quantity":1,"weight_kg":15},{"product_sku":"BHL-CHAI-450","quantity":16,"weight_kg":224},{"product_sku":"BHL-LON-330","quantity":60,"weight_kg":510}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-039', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4609.72, 9.2, '[{"product_sku":"BHL-DRAFT-30","quantity":93,"weight_kg":2976},{"product_sku":"NGK-CHANH-330","quantity":33,"weight_kg":831.6},{"product_sku":"BHL-CHAI-355","quantity":1,"weight_kg":15},{"product_sku":"BHL-CHAI-450","quantity":16,"weight_kg":224},{"product_sku":"BHL-LON-330","quantity":60,"weight_kg":510}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-040', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4609.72, 9.2, '[{"product_sku":"BHL-DRAFT-30","quantity":93,"weight_kg":2976},{"product_sku":"NGK-CHANH-330","quantity":33,"weight_kg":831.6},{"product_sku":"BHL-CHAI-355","quantity":1,"weight_kg":15},{"product_sku":"BHL-CHAI-450","quantity":16,"weight_kg":224},{"product_sku":"BHL-LON-330","quantity":60,"weight_kg":510}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-041', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4609.72, 9.2, '[{"product_sku":"BHL-DRAFT-30","quantity":93,"weight_kg":2976},{"product_sku":"NGK-CHANH-330","quantity":33,"weight_kg":831.6},{"product_sku":"BHL-CHAI-355","quantity":1,"weight_kg":15},{"product_sku":"BHL-CHAI-450","quantity":16,"weight_kg":224},{"product_sku":"BHL-LON-330","quantity":60,"weight_kg":510}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-042', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4609.72, 9.2, '[{"product_sku":"BHL-DRAFT-30","quantity":101,"weight_kg":3232},{"product_sku":"NGK-CHANH-330","quantity":36,"weight_kg":907.2},{"product_sku":"BHL-CHAI-355","quantity":7,"weight_kg":105},{"product_sku":"BHL-CHAI-450","quantity":17,"weight_kg":238},{"product_sku":"BHL-LON-330","quantity":65,"weight_kg":552.5}]'::jsonb);
END $$;

-- DH-010 | HP-4745 | 14902kg | 4 trips (orig: 2)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HP-4745';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-010', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    313500000, 0, 14902.00, 29.8, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 320, 800000, 256000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 110, 180000, 19800000 FROM products WHERE sku = 'NGK-CHANH-330';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 50, 250000, 12500000 FROM products WHERE sku = 'BHL-CHAI-450';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 140, 180000, 25200000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-043', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3725.50, 7.5, '[{"product_sku":"BHL-DRAFT-30","quantity":80,"weight_kg":2560},{"product_sku":"NGK-CHANH-330","quantity":27,"weight_kg":680.4},{"product_sku":"BHL-CHAI-450","quantity":12,"weight_kg":168},{"product_sku":"BHL-LON-330","quantity":35,"weight_kg":297.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-044', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3725.50, 7.5, '[{"product_sku":"BHL-DRAFT-30","quantity":80,"weight_kg":2560},{"product_sku":"NGK-CHANH-330","quantity":27,"weight_kg":680.4},{"product_sku":"BHL-CHAI-450","quantity":12,"weight_kg":168},{"product_sku":"BHL-LON-330","quantity":35,"weight_kg":297.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-045', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3725.50, 7.5, '[{"product_sku":"BHL-DRAFT-30","quantity":80,"weight_kg":2560},{"product_sku":"NGK-CHANH-330","quantity":27,"weight_kg":680.4},{"product_sku":"BHL-CHAI-450","quantity":12,"weight_kg":168},{"product_sku":"BHL-LON-330","quantity":35,"weight_kg":297.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-046', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3725.50, 7.5, '[{"product_sku":"BHL-DRAFT-30","quantity":80,"weight_kg":2560},{"product_sku":"NGK-CHANH-330","quantity":29,"weight_kg":730.8},{"product_sku":"BHL-CHAI-450","quantity":14,"weight_kg":196},{"product_sku":"BHL-LON-330","quantity":35,"weight_kg":297.5}]'::jsonb);
END $$;

-- DH-011 | MC4-93 | 16150kg | 4 trips (orig: 2)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'MC4-93';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-011', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    342000000, 0, 16150.00, 32.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 1900, 180000, 342000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-047', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-048', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-049', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-050', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
END $$;

-- DH-012 | QN-HH2 | 6800kg | 2 trips (orig: 1)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH2';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-012', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    144000000, 0, 6800.00, 13.6, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 800, 180000, 144000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-051', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3400.00, 6.8, '[{"product_sku":"BHL-LON-330","quantity":400,"weight_kg":3400}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-052', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3400.00, 6.8, '[{"product_sku":"BHL-LON-330","quantity":400,"weight_kg":3400}]'::jsonb);
END $$;

-- DH-013 | QN-HH | 16150kg | 4 trips (orig: 3)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-013', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    342000000, 0, 16150.00, 32.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 1900, 180000, 342000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-053', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-054', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-055', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-056', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
END $$;

-- DH-014 | TB-133 | 45320kg | 10 trips (orig: 6)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TB-133';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-014', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    998000000, 0, 45320.00, 90.6, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 1180, 800000, 944000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 300, 180000, 54000000 FROM products WHERE sku = 'NGK-CHANH-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-057', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4532.00, 9.1, '[{"product_sku":"BHL-DRAFT-30","quantity":118,"weight_kg":3776},{"product_sku":"NGK-CHANH-330","quantity":30,"weight_kg":756}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-058', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4532.00, 9.1, '[{"product_sku":"BHL-DRAFT-30","quantity":118,"weight_kg":3776},{"product_sku":"NGK-CHANH-330","quantity":30,"weight_kg":756}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-059', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4532.00, 9.1, '[{"product_sku":"BHL-DRAFT-30","quantity":118,"weight_kg":3776},{"product_sku":"NGK-CHANH-330","quantity":30,"weight_kg":756}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-060', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4532.00, 9.1, '[{"product_sku":"BHL-DRAFT-30","quantity":118,"weight_kg":3776},{"product_sku":"NGK-CHANH-330","quantity":30,"weight_kg":756}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-061', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4532.00, 9.1, '[{"product_sku":"BHL-DRAFT-30","quantity":118,"weight_kg":3776},{"product_sku":"NGK-CHANH-330","quantity":30,"weight_kg":756}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-062', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4532.00, 9.1, '[{"product_sku":"BHL-DRAFT-30","quantity":118,"weight_kg":3776},{"product_sku":"NGK-CHANH-330","quantity":30,"weight_kg":756}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-063', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4532.00, 9.1, '[{"product_sku":"BHL-DRAFT-30","quantity":118,"weight_kg":3776},{"product_sku":"NGK-CHANH-330","quantity":30,"weight_kg":756}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-064', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4532.00, 9.1, '[{"product_sku":"BHL-DRAFT-30","quantity":118,"weight_kg":3776},{"product_sku":"NGK-CHANH-330","quantity":30,"weight_kg":756}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-065', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4532.00, 9.1, '[{"product_sku":"BHL-DRAFT-30","quantity":118,"weight_kg":3776},{"product_sku":"NGK-CHANH-330","quantity":30,"weight_kg":756}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-066', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4532.00, 9.1, '[{"product_sku":"BHL-DRAFT-30","quantity":118,"weight_kg":3776},{"product_sku":"NGK-CHANH-330","quantity":30,"weight_kg":756}]'::jsonb);
END $$;

-- DH-015 | NG-109 | 14386kg | 3 trips (orig: 2)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NG-109';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-015', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    320400000, 0, 14386.00, 28.8, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 360, 800000, 288000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 80, 180000, 14400000 FROM products WHERE sku = 'NGK-CHANH-330';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 100, 180000, 18000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-067', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4795.33, 9.6, '[{"product_sku":"BHL-DRAFT-30","quantity":120,"weight_kg":3840},{"product_sku":"NGK-CHANH-330","quantity":26,"weight_kg":655.2},{"product_sku":"BHL-LON-330","quantity":33,"weight_kg":280.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-068', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4795.33, 9.6, '[{"product_sku":"BHL-DRAFT-30","quantity":120,"weight_kg":3840},{"product_sku":"NGK-CHANH-330","quantity":26,"weight_kg":655.2},{"product_sku":"BHL-LON-330","quantity":33,"weight_kg":280.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-069', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4795.33, 9.6, '[{"product_sku":"BHL-DRAFT-30","quantity":120,"weight_kg":3840},{"product_sku":"NGK-CHANH-330","quantity":28,"weight_kg":705.6},{"product_sku":"BHL-LON-330","quantity":34,"weight_kg":289}]'::jsonb);
END $$;

-- DH-016 | QN-HH | 26628kg | 6 trips (orig: 6)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-HH';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-016', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    534700000, 0, 26628.00, 53.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 76, 800000, 60800000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 105, 180000, 18900000 FROM products WHERE sku = 'NGK-CHANH-330';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 20, 250000, 5000000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 2500, 180000, 450000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-070', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4438.00, 8.9, '[{"product_sku":"BHL-DRAFT-30","quantity":12,"weight_kg":384},{"product_sku":"NGK-CHANH-330","quantity":17,"weight_kg":428.4},{"product_sku":"BHL-CHAI-355","quantity":3,"weight_kg":45},{"product_sku":"BHL-LON-330","quantity":416,"weight_kg":3536}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-071', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4438.00, 8.9, '[{"product_sku":"BHL-DRAFT-30","quantity":12,"weight_kg":384},{"product_sku":"NGK-CHANH-330","quantity":17,"weight_kg":428.4},{"product_sku":"BHL-CHAI-355","quantity":3,"weight_kg":45},{"product_sku":"BHL-LON-330","quantity":416,"weight_kg":3536}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-072', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4438.00, 8.9, '[{"product_sku":"BHL-DRAFT-30","quantity":12,"weight_kg":384},{"product_sku":"NGK-CHANH-330","quantity":17,"weight_kg":428.4},{"product_sku":"BHL-CHAI-355","quantity":3,"weight_kg":45},{"product_sku":"BHL-LON-330","quantity":416,"weight_kg":3536}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-073', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4438.00, 8.9, '[{"product_sku":"BHL-DRAFT-30","quantity":12,"weight_kg":384},{"product_sku":"NGK-CHANH-330","quantity":17,"weight_kg":428.4},{"product_sku":"BHL-CHAI-355","quantity":3,"weight_kg":45},{"product_sku":"BHL-LON-330","quantity":416,"weight_kg":3536}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-074', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4438.00, 8.9, '[{"product_sku":"BHL-DRAFT-30","quantity":12,"weight_kg":384},{"product_sku":"NGK-CHANH-330","quantity":17,"weight_kg":428.4},{"product_sku":"BHL-CHAI-355","quantity":3,"weight_kg":45},{"product_sku":"BHL-LON-330","quantity":416,"weight_kg":3536}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-075', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4438.00, 8.9, '[{"product_sku":"BHL-DRAFT-30","quantity":16,"weight_kg":512},{"product_sku":"NGK-CHANH-330","quantity":20,"weight_kg":504},{"product_sku":"BHL-CHAI-355","quantity":5,"weight_kg":75},{"product_sku":"BHL-LON-330","quantity":420,"weight_kg":3570}]'::jsonb);
END $$;

-- DH-017 | HH2-70 | 14500kg | 4 trips (orig: 2)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HH2-70';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-017', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    280000000, 0, 14500.00, 29.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 400, 250000, 100000000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 1000, 180000, 180000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-076', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3625.00, 7.3, '[{"product_sku":"BHL-CHAI-355","quantity":100,"weight_kg":1500},{"product_sku":"BHL-LON-330","quantity":250,"weight_kg":2125}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-077', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3625.00, 7.3, '[{"product_sku":"BHL-CHAI-355","quantity":100,"weight_kg":1500},{"product_sku":"BHL-LON-330","quantity":250,"weight_kg":2125}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-078', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3625.00, 7.3, '[{"product_sku":"BHL-CHAI-355","quantity":100,"weight_kg":1500},{"product_sku":"BHL-LON-330","quantity":250,"weight_kg":2125}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-079', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3625.00, 7.3, '[{"product_sku":"BHL-CHAI-355","quantity":100,"weight_kg":1500},{"product_sku":"BHL-LON-330","quantity":250,"weight_kg":2125}]'::jsonb);
END $$;

-- DH-018 | CP2-29 | 25450kg | 6 trips (orig: 4)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'CP2-29';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-018', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    519500000, 0, 25450.00, 50.9, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 150, 250000, 37500000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 200, 250000, 50000000 FROM products WHERE sku = 'BHL-CHAI-450';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 2400, 180000, 432000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-080', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4241.67, 8.5, '[{"product_sku":"BHL-CHAI-355","quantity":25,"weight_kg":375},{"product_sku":"BHL-CHAI-450","quantity":33,"weight_kg":462},{"product_sku":"BHL-LON-330","quantity":400,"weight_kg":3400}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-081', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4241.67, 8.5, '[{"product_sku":"BHL-CHAI-355","quantity":25,"weight_kg":375},{"product_sku":"BHL-CHAI-450","quantity":33,"weight_kg":462},{"product_sku":"BHL-LON-330","quantity":400,"weight_kg":3400}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-082', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4241.67, 8.5, '[{"product_sku":"BHL-CHAI-355","quantity":25,"weight_kg":375},{"product_sku":"BHL-CHAI-450","quantity":33,"weight_kg":462},{"product_sku":"BHL-LON-330","quantity":400,"weight_kg":3400}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-083', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4241.67, 8.5, '[{"product_sku":"BHL-CHAI-355","quantity":25,"weight_kg":375},{"product_sku":"BHL-CHAI-450","quantity":33,"weight_kg":462},{"product_sku":"BHL-LON-330","quantity":400,"weight_kg":3400}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-084', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4241.67, 8.5, '[{"product_sku":"BHL-CHAI-355","quantity":25,"weight_kg":375},{"product_sku":"BHL-CHAI-450","quantity":33,"weight_kg":462},{"product_sku":"BHL-LON-330","quantity":400,"weight_kg":3400}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-085', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4241.67, 8.5, '[{"product_sku":"BHL-CHAI-355","quantity":25,"weight_kg":375},{"product_sku":"BHL-CHAI-450","quantity":35,"weight_kg":490},{"product_sku":"BHL-LON-330","quantity":400,"weight_kg":3400}]'::jsonb);
END $$;

-- DH-019 | NĐ-4766 | 5825kg | 2 trips (orig: 1)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NĐ-4766';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-019', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    120500000, 0, 5825.00, 11.7, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 25, 250000, 6250000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 25, 250000, 6250000 FROM products WHERE sku = 'BHL-CHAI-450';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 600, 180000, 108000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-086', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 2912.50, 5.8, '[{"product_sku":"BHL-CHAI-355","quantity":12,"weight_kg":180},{"product_sku":"BHL-CHAI-450","quantity":12,"weight_kg":168},{"product_sku":"BHL-LON-330","quantity":300,"weight_kg":2550}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-087', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 2912.50, 5.8, '[{"product_sku":"BHL-CHAI-355","quantity":13,"weight_kg":195},{"product_sku":"BHL-CHAI-450","quantity":13,"weight_kg":182},{"product_sku":"BHL-LON-330","quantity":300,"weight_kg":2550}]'::jsonb);
END $$;

-- DH-020 | NĐ-4767 | 11560kg | 3 trips (orig: 1)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'NĐ-4767';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-020', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    146000000, 0, 11560.00, 23.1, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 90, 800000, 72000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 300, 180000, 54000000 FROM products WHERE sku = 'NGK-CHANH-330';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 80, 250000, 20000000 FROM products WHERE sku = 'BHL-CHAI-450';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-088', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3853.33, 7.7, '[{"product_sku":"BHL-DRAFT-30","quantity":30,"weight_kg":960},{"product_sku":"NGK-CHANH-330","quantity":100,"weight_kg":2520},{"product_sku":"BHL-CHAI-450","quantity":26,"weight_kg":364}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-089', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3853.33, 7.7, '[{"product_sku":"BHL-DRAFT-30","quantity":30,"weight_kg":960},{"product_sku":"NGK-CHANH-330","quantity":100,"weight_kg":2520},{"product_sku":"BHL-CHAI-450","quantity":26,"weight_kg":364}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-090', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3853.33, 7.7, '[{"product_sku":"BHL-DRAFT-30","quantity":30,"weight_kg":960},{"product_sku":"NGK-CHANH-330","quantity":100,"weight_kg":2520},{"product_sku":"BHL-CHAI-450","quantity":28,"weight_kg":392}]'::jsonb);
END $$;

-- DH-021 | HB-73 | 15300kg | 4 trips (orig: 2)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HB-73';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-021', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    324000000, 0, 15300.00, 30.6, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 1800, 180000, 324000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-091', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-092', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-093', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-094', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 3825.00, 7.7, '[{"product_sku":"BHL-LON-330","quantity":450,"weight_kg":3825}]'::jsonb);
END $$;

-- DH-022 | TB-125 | 45118kg | 10 trips (orig: 6)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TB-125';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-022', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    902050000, 0, 45118.00, 90.2, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 670, 800000, 536000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 340, 180000, 61200000 FROM products WHERE sku = 'NGK-CHANH-330';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 45, 250000, 11250000 FROM products WHERE sku = 'BHL-CHAI-355';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 260, 250000, 65000000 FROM products WHERE sku = 'BHL-CHAI-450';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 1270, 180000, 228600000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-095', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4511.80, 9.0, '[{"product_sku":"BHL-DRAFT-30","quantity":67,"weight_kg":2144},{"product_sku":"NGK-CHANH-330","quantity":34,"weight_kg":856.8},{"product_sku":"BHL-CHAI-355","quantity":4,"weight_kg":60},{"product_sku":"BHL-CHAI-450","quantity":26,"weight_kg":364},{"product_sku":"BHL-LON-330","quantity":127,"weight_kg":1079.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-096', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4511.80, 9.0, '[{"product_sku":"BHL-DRAFT-30","quantity":67,"weight_kg":2144},{"product_sku":"NGK-CHANH-330","quantity":34,"weight_kg":856.8},{"product_sku":"BHL-CHAI-355","quantity":4,"weight_kg":60},{"product_sku":"BHL-CHAI-450","quantity":26,"weight_kg":364},{"product_sku":"BHL-LON-330","quantity":127,"weight_kg":1079.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-097', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4511.80, 9.0, '[{"product_sku":"BHL-DRAFT-30","quantity":67,"weight_kg":2144},{"product_sku":"NGK-CHANH-330","quantity":34,"weight_kg":856.8},{"product_sku":"BHL-CHAI-355","quantity":4,"weight_kg":60},{"product_sku":"BHL-CHAI-450","quantity":26,"weight_kg":364},{"product_sku":"BHL-LON-330","quantity":127,"weight_kg":1079.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-098', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4511.80, 9.0, '[{"product_sku":"BHL-DRAFT-30","quantity":67,"weight_kg":2144},{"product_sku":"NGK-CHANH-330","quantity":34,"weight_kg":856.8},{"product_sku":"BHL-CHAI-355","quantity":4,"weight_kg":60},{"product_sku":"BHL-CHAI-450","quantity":26,"weight_kg":364},{"product_sku":"BHL-LON-330","quantity":127,"weight_kg":1079.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-099', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4511.80, 9.0, '[{"product_sku":"BHL-DRAFT-30","quantity":67,"weight_kg":2144},{"product_sku":"NGK-CHANH-330","quantity":34,"weight_kg":856.8},{"product_sku":"BHL-CHAI-355","quantity":4,"weight_kg":60},{"product_sku":"BHL-CHAI-450","quantity":26,"weight_kg":364},{"product_sku":"BHL-LON-330","quantity":127,"weight_kg":1079.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-100', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4511.80, 9.0, '[{"product_sku":"BHL-DRAFT-30","quantity":67,"weight_kg":2144},{"product_sku":"NGK-CHANH-330","quantity":34,"weight_kg":856.8},{"product_sku":"BHL-CHAI-355","quantity":4,"weight_kg":60},{"product_sku":"BHL-CHAI-450","quantity":26,"weight_kg":364},{"product_sku":"BHL-LON-330","quantity":127,"weight_kg":1079.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-101', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4511.80, 9.0, '[{"product_sku":"BHL-DRAFT-30","quantity":67,"weight_kg":2144},{"product_sku":"NGK-CHANH-330","quantity":34,"weight_kg":856.8},{"product_sku":"BHL-CHAI-355","quantity":4,"weight_kg":60},{"product_sku":"BHL-CHAI-450","quantity":26,"weight_kg":364},{"product_sku":"BHL-LON-330","quantity":127,"weight_kg":1079.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-102', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4511.80, 9.0, '[{"product_sku":"BHL-DRAFT-30","quantity":67,"weight_kg":2144},{"product_sku":"NGK-CHANH-330","quantity":34,"weight_kg":856.8},{"product_sku":"BHL-CHAI-355","quantity":4,"weight_kg":60},{"product_sku":"BHL-CHAI-450","quantity":26,"weight_kg":364},{"product_sku":"BHL-LON-330","quantity":127,"weight_kg":1079.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-103', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4511.80, 9.0, '[{"product_sku":"BHL-DRAFT-30","quantity":67,"weight_kg":2144},{"product_sku":"NGK-CHANH-330","quantity":34,"weight_kg":856.8},{"product_sku":"BHL-CHAI-355","quantity":4,"weight_kg":60},{"product_sku":"BHL-CHAI-450","quantity":26,"weight_kg":364},{"product_sku":"BHL-LON-330","quantity":127,"weight_kg":1079.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-104', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4511.80, 9.0, '[{"product_sku":"BHL-DRAFT-30","quantity":67,"weight_kg":2144},{"product_sku":"NGK-CHANH-330","quantity":34,"weight_kg":856.8},{"product_sku":"BHL-CHAI-355","quantity":9,"weight_kg":135},{"product_sku":"BHL-CHAI-450","quantity":26,"weight_kg":364},{"product_sku":"BHL-LON-330","quantity":127,"weight_kg":1079.5}]'::jsonb);
END $$;

-- DH-023 | QN-TN | 4480kg | 1 trips (orig: 1)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'QN-TN';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-023', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    112000000, 0, 4480.00, 9.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 140, 800000, 112000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-105', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4480.00, 9.0, '[{"product_sku":"BHL-DRAFT-30","quantity":140,"weight_kg":4480}]'::jsonb);
END $$;

-- DH-024 | HH1-35 | 4024kg | 1 trips (orig: 1)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HH1-35';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-024', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    91600000, 0, 4024.00, 8.0, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 110, 800000, 88000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 20, 180000, 3600000 FROM products WHERE sku = 'NGK-CHANH-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-106', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4024.00, 8.0, '[{"product_sku":"BHL-DRAFT-30","quantity":110,"weight_kg":3520},{"product_sku":"NGK-CHANH-330","quantity":20,"weight_kg":504}]'::jsonb);
END $$;

-- DH-025 | HNI-48 | 30600kg | 7 trips (orig: 4)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HNI-48';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-025', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    648000000, 0, 30600.00, 61.2, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 3600, 180000, 648000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-107', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4371.43, 8.7, '[{"product_sku":"BHL-LON-330","quantity":514,"weight_kg":4369}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-108', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4371.43, 8.7, '[{"product_sku":"BHL-LON-330","quantity":514,"weight_kg":4369}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-109', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4371.43, 8.7, '[{"product_sku":"BHL-LON-330","quantity":514,"weight_kg":4369}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-110', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4371.43, 8.7, '[{"product_sku":"BHL-LON-330","quantity":514,"weight_kg":4369}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-111', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4371.43, 8.7, '[{"product_sku":"BHL-LON-330","quantity":514,"weight_kg":4369}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-112', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4371.43, 8.7, '[{"product_sku":"BHL-LON-330","quantity":514,"weight_kg":4369}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-113', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4371.43, 8.7, '[{"product_sku":"BHL-LON-330","quantity":516,"weight_kg":4386}]'::jsonb);
END $$;

-- DH-026 | TN-4793 | 12640kg | 3 trips (orig: 2)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'TN-4793';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-026', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    308000000, 0, 12640.00, 25.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 360, 800000, 288000000 FROM products WHERE sku = 'BHL-DRAFT-30';
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 80, 250000, 20000000 FROM products WHERE sku = 'BHL-CHAI-450';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-114', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4213.33, 8.4, '[{"product_sku":"BHL-DRAFT-30","quantity":120,"weight_kg":3840},{"product_sku":"BHL-CHAI-450","quantity":26,"weight_kg":364}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-115', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4213.33, 8.4, '[{"product_sku":"BHL-DRAFT-30","quantity":120,"weight_kg":3840},{"product_sku":"BHL-CHAI-450","quantity":26,"weight_kg":364}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-116', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4213.33, 8.4, '[{"product_sku":"BHL-DRAFT-30","quantity":120,"weight_kg":3840},{"product_sku":"BHL-CHAI-450","quantity":28,"weight_kg":392}]'::jsonb);
END $$;

-- DH-027 | HH2-69 | 16150kg | 4 trips (orig: 2)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'HH2-69';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-027', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    342000000, 0, 16150.00, 32.3, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 1900, 180000, 342000000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-117', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-118', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-119', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-120', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4037.50, 8.1, '[{"product_sku":"BHL-LON-330","quantity":475,"weight_kg":4037.5}]'::jsonb);
END $$;

-- DH-028 | DT1-34 | 29920kg | 7 trips (orig: 2)
DO $$
DECLARE v_oid UUID; v_cid UUID; v_wid UUID; v_uid UUID;
BEGIN
  SELECT id INTO v_cid FROM customers WHERE code = 'DT1-34';
  SELECT id INTO v_wid FROM warehouses WHERE code = 'WH-HL';
  SELECT id INTO v_uid FROM users WHERE role = 'dvkh' LIMIT 1;
  INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
    total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
  VALUES (gen_random_uuid(), 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-028', v_cid, v_wid, 'confirmed', CURRENT_DATE,
    633600000, 0, 29920.00, 59.8, v_uid, 'passed', 'passed')
  RETURNING id INTO v_oid;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
    SELECT v_oid, id, 3520, 180000, 633600000 FROM products WHERE sku = 'BHL-LON-330';
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-121', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4274.29, 8.5, '[{"product_sku":"BHL-LON-330","quantity":502,"weight_kg":4267}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-122', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4274.29, 8.5, '[{"product_sku":"BHL-LON-330","quantity":502,"weight_kg":4267}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-123', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4274.29, 8.5, '[{"product_sku":"BHL-LON-330","quantity":502,"weight_kg":4267}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-124', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4274.29, 8.5, '[{"product_sku":"BHL-LON-330","quantity":502,"weight_kg":4267}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-125', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4274.29, 8.5, '[{"product_sku":"BHL-LON-330","quantity":502,"weight_kg":4267}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-126', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4274.29, 8.5, '[{"product_sku":"BHL-LON-330","quantity":502,"weight_kg":4267}]'::jsonb);
  INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
    delivery_date, total_weight_kg, total_volume_m3, items)
  VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-127', v_oid, v_cid, v_wid, 'pending',
    CURRENT_DATE, 4274.29, 8.5, '[{"product_sku":"BHL-LON-330","quantity":508,"weight_kg":4318}]'::jsonb);
END $$;

UPDATE stock_quants SET quantity = 500000, reserved_qty = 0;
INSERT INTO driver_checkins (driver_id, checkin_date, status, checked_in_at)
SELECT d.id, CURRENT_DATE, 'available', NOW() - INTERVAL '1 hour'
FROM drivers d WHERE d.status = 'active'
ON CONFLICT (driver_id, checkin_date) DO UPDATE SET status = 'available';
COMMIT;
-- Total: 28 orders, 127 shipments (max 4800kg each)