-- Auto-generated: 28 real orders from June 13 data, date = today
-- Generated: 2026-04-17T08:57:36.309Z
-- Delivery date: 2026-04-17

BEGIN;

-- Clean existing orders/shipments for today
DELETE FROM trip_stops;
DELETE FROM trips;
DELETE FROM shipments WHERE delivery_date = '2026-04-17';
DELETE FROM order_items WHERE order_id IN (SELECT id FROM sales_orders WHERE delivery_date = '2026-04-17');
DELETE FROM sales_orders WHERE delivery_date = '2026-04-17';

-- DH-001: Khu vực Bắc Giang (nhiều NPP) (Bắc Giang)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000001', 'ORD-20260417-001', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 6210.00, 32.0000, 125000000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'BG-112';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 140, 250000, 35000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 500, 180000, 90000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000001', 'SHP-20260417-001', 'd0000000-0000-0000-0000-000000000001', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6210.00, 32.0000, '[{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":140,"weight_kg":1960},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":500,"weight_kg":4250}]'::jsonb
  FROM customers c WHERE c.code = 'BG-112';

-- DH-002: Khu vực Bắc Ninh (nhiều NPP) (Bắc Ninh)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000002', 'ORD-20260417-002', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 20336.00, 35.6000, 346400000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'BN-24';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000007', 352, 800000, 281600000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000009', 360, 180000, 64800000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000002', 'SHP-20260417-002', 'd0000000-0000-0000-0000-000000000002', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 10168.00, 17.8000, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":176,"weight_kg":5632},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":180,"weight_kg":4536}]'::jsonb
  FROM customers c WHERE c.code = 'BN-24';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000003', 'SHP-20260417-003', 'd0000000-0000-0000-0000-000000000002', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 10168.00, 17.8000, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":176,"weight_kg":5632},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":180,"weight_kg":4536}]'::jsonb
  FROM customers c WHERE c.code = 'BN-24';

-- DH-003: Tạ Hữu Bản-QY-121 (Quảng Ninh)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000003', 'ORD-20260417-003', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 6234.00, 31.7000, 123220000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'QY-121';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000016', 130, 250000, 32500000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 504, 180000, 90720000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000004', 'SHP-20260417-004', 'd0000000-0000-0000-0000-000000000003', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6234.00, 31.7000, '[{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":130,"weight_kg":1950},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":504,"weight_kg":4284}]'::jsonb
  FROM customers c WHERE c.code = 'QY-121';

-- DH-004: Lê Thị Chính-HD-54 (Hải Dương)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000004', 'ORD-20260417-004', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 5100.00, 30.0000, 108000000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'HD-54';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 600, 180000, 108000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000005', 'SHP-20260417-005', 'd0000000-0000-0000-0000-000000000004', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 5100.00, 30.0000, '[{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":600,"weight_kg":5100}]'::jsonb
  FROM customers c WHERE c.code = 'HD-54';

-- DH-005: Nội bộ Công ty Bia Hạ Long (Nội bộ)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000005', 'ORD-20260417-005', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 48217.00, 246.5000, 1034300000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'QN-VTD';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000007', 220, 800000, 176000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000009', 10, 180000, 1800000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000016', 150, 250000, 37500000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 4550, 180000, 819000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000006', 'SHP-20260417-006', 'd0000000-0000-0000-0000-000000000005', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6888.14, 35.2143, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":32,"weight_kg":1024},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":2,"weight_kg":50.4},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":22,"weight_kg":330},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":650,"weight_kg":5525}]'::jsonb
  FROM customers c WHERE c.code = 'QN-VTD';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000007', 'SHP-20260417-007', 'd0000000-0000-0000-0000-000000000005', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6888.14, 35.2143, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":32,"weight_kg":1024},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":2,"weight_kg":50.4},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":22,"weight_kg":330},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":650,"weight_kg":5525}]'::jsonb
  FROM customers c WHERE c.code = 'QN-VTD';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000008', 'SHP-20260417-008', 'd0000000-0000-0000-0000-000000000005', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6888.14, 35.2143, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":32,"weight_kg":1024},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":2,"weight_kg":50.4},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":22,"weight_kg":330},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":650,"weight_kg":5525}]'::jsonb
  FROM customers c WHERE c.code = 'QN-VTD';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000009', 'SHP-20260417-009', 'd0000000-0000-0000-0000-000000000005', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6888.14, 35.2143, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":32,"weight_kg":1024},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":2,"weight_kg":50.4},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":22,"weight_kg":330},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":650,"weight_kg":5525}]'::jsonb
  FROM customers c WHERE c.code = 'QN-VTD';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000010', 'SHP-20260417-010', 'd0000000-0000-0000-0000-000000000005', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6888.14, 35.2143, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":32,"weight_kg":1024},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":2,"weight_kg":50.4},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":22,"weight_kg":330},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":650,"weight_kg":5525}]'::jsonb
  FROM customers c WHERE c.code = 'QN-VTD';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000011', 'SHP-20260417-011', 'd0000000-0000-0000-0000-000000000005', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6888.14, 35.2143, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":32,"weight_kg":1024},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":2,"weight_kg":50.4},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":22,"weight_kg":330},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":650,"weight_kg":5525}]'::jsonb
  FROM customers c WHERE c.code = 'QN-VTD';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000012', 'SHP-20260417-012', 'd0000000-0000-0000-0000-000000000005', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6888.14, 35.2143, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":32,"weight_kg":1024},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":2,"weight_kg":50.4},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":22,"weight_kg":330},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":650,"weight_kg":5525}]'::jsonb
  FROM customers c WHERE c.code = 'QN-VTD';

-- DH-006: Ngô Hiếu Công-TY-122 (Quảng Ninh)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000006', 'ORD-20260417-006', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 5585.00, 11.2500, 127750000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'TY-122';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000007', 130, 800000, 104000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000016', 95, 250000, 23750000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000013', 'SHP-20260417-013', 'd0000000-0000-0000-0000-000000000006', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 5585.00, 11.2500, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":130,"weight_kg":4160},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":95,"weight_kg":1425}]'::jsonb
  FROM customers c WHERE c.code = 'TY-122';

-- DH-007: Phạm Văn Cửu-VD2-143 (Quảng Ninh)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000007', 'ORD-20260417-007', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 13985.00, 67.7500, 309000000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'VD2-143';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000007', 105, 800000, 84000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001', 1250, 180000, 225000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000014', 'SHP-20260417-014', 'd0000000-0000-0000-0000-000000000007', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 4661.67, 22.5833, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":35,"weight_kg":1120},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":417,"weight_kg":3544.5}]'::jsonb
  FROM customers c WHERE c.code = 'VD2-143';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000015', 'SHP-20260417-015', 'd0000000-0000-0000-0000-000000000007', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 4661.67, 22.5833, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":35,"weight_kg":1120},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":417,"weight_kg":3544.5}]'::jsonb
  FROM customers c WHERE c.code = 'VD2-143';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000016', 'SHP-20260417-016', 'd0000000-0000-0000-0000-000000000007', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 4661.67, 22.5833, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":35,"weight_kg":1120},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":417,"weight_kg":3544.5}]'::jsonb
  FROM customers c WHERE c.code = 'VD2-143';

-- DH-008: Nguyễn Duy Hải-NT1-3-110 (Quảng Ninh)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000008', 'ORD-20260417-008', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 27375.00, 141.5000, 563500000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'NT1-3-110';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000007', 50, 800000, 40000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000016', 330, 250000, 82500000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000001', 2450, 180000, 441000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000017', 'SHP-20260417-017', 'd0000000-0000-0000-0000-000000000008', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 5475.00, 28.3000, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":10,"weight_kg":320},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":66,"weight_kg":990},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":490,"weight_kg":4165}]'::jsonb
  FROM customers c WHERE c.code = 'NT1-3-110';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000018', 'SHP-20260417-018', 'd0000000-0000-0000-0000-000000000008', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 5475.00, 28.3000, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":10,"weight_kg":320},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":66,"weight_kg":990},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":490,"weight_kg":4165}]'::jsonb
  FROM customers c WHERE c.code = 'NT1-3-110';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000019', 'SHP-20260417-019', 'd0000000-0000-0000-0000-000000000008', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 5475.00, 28.3000, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":10,"weight_kg":320},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":66,"weight_kg":990},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":490,"weight_kg":4165}]'::jsonb
  FROM customers c WHERE c.code = 'NT1-3-110';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000020', 'SHP-20260417-020', 'd0000000-0000-0000-0000-000000000008', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 5475.00, 28.3000, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":10,"weight_kg":320},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":66,"weight_kg":990},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":490,"weight_kg":4165}]'::jsonb
  FROM customers c WHERE c.code = 'NT1-3-110';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000021', 'SHP-20260417-021', 'd0000000-0000-0000-0000-000000000008', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 5475.00, 28.3000, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":10,"weight_kg":320},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":66,"weight_kg":990},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":490,"weight_kg":4165}]'::jsonb
  FROM customers c WHERE c.code = 'NT1-3-110';

-- DH-009: Khu vực Hải Dương (nhiều NPP) (Hải Dương)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000009', 'ORD-20260417-009', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 41487.50, 92.5000, 868100000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'HD-70';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000007', 845, 800000, 676000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000009', 300, 180000, 54000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000016', 15, 250000, 3750000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000003', 145, 250000, 36250000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000001', 545, 180000, 98100000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000022', 'SHP-20260417-022', 'd0000000-0000-0000-0000-000000000009', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6914.58, 15.4167, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":141,"weight_kg":4512},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":50,"weight_kg":1260},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":3,"weight_kg":45},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":25,"weight_kg":350},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":91,"weight_kg":773.5}]'::jsonb
  FROM customers c WHERE c.code = 'HD-70';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000023', 'SHP-20260417-023', 'd0000000-0000-0000-0000-000000000009', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6914.58, 15.4167, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":141,"weight_kg":4512},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":50,"weight_kg":1260},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":3,"weight_kg":45},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":25,"weight_kg":350},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":91,"weight_kg":773.5}]'::jsonb
  FROM customers c WHERE c.code = 'HD-70';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000024', 'SHP-20260417-024', 'd0000000-0000-0000-0000-000000000009', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6914.58, 15.4167, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":141,"weight_kg":4512},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":50,"weight_kg":1260},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":3,"weight_kg":45},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":25,"weight_kg":350},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":91,"weight_kg":773.5}]'::jsonb
  FROM customers c WHERE c.code = 'HD-70';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000025', 'SHP-20260417-025', 'd0000000-0000-0000-0000-000000000009', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6914.58, 15.4167, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":141,"weight_kg":4512},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":50,"weight_kg":1260},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":3,"weight_kg":45},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":25,"weight_kg":350},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":91,"weight_kg":773.5}]'::jsonb
  FROM customers c WHERE c.code = 'HD-70';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000026', 'SHP-20260417-026', 'd0000000-0000-0000-0000-000000000009', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6914.58, 15.4167, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":141,"weight_kg":4512},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":50,"weight_kg":1260},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":3,"weight_kg":45},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":25,"weight_kg":350},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":91,"weight_kg":773.5}]'::jsonb
  FROM customers c WHERE c.code = 'HD-70';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000027', 'SHP-20260417-027', 'd0000000-0000-0000-0000-000000000009', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6914.58, 15.4167, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":141,"weight_kg":4512},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":50,"weight_kg":1260},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":3,"weight_kg":45},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":25,"weight_kg":350},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":91,"weight_kg":773.5}]'::jsonb
  FROM customers c WHERE c.code = 'HD-70';

-- DH-010: Khu vực Hải Phòng (nhiều NPP) (Hải Phòng)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000010', 'ORD-20260417-010', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 14902.00, 31.0000, 313500000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'HP-4745';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000007', 320, 800000, 256000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000009', 110, 180000, 19800000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000003', 50, 250000, 12500000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000001', 140, 180000, 25200000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000028', 'SHP-20260417-028', 'd0000000-0000-0000-0000-000000000010', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7451.00, 15.5000, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":160,"weight_kg":5120},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":55,"weight_kg":1386},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":25,"weight_kg":350},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":70,"weight_kg":595}]'::jsonb
  FROM customers c WHERE c.code = 'HP-4745';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000029', 'SHP-20260417-029', 'd0000000-0000-0000-0000-000000000010', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7451.00, 15.5000, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":160,"weight_kg":5120},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":55,"weight_kg":1386},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":25,"weight_kg":350},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":70,"weight_kg":595}]'::jsonb
  FROM customers c WHERE c.code = 'HP-4745';

-- DH-011: Ngô Thị Hường-MC4-93 (Quảng Ninh)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000011', 'ORD-20260417-011', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 16150.00, 95.0000, 342000000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'MC4-93';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000001', 1900, 180000, 342000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000030', 'SHP-20260417-030', 'd0000000-0000-0000-0000-000000000011', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 8075.00, 47.5000, '[{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":950,"weight_kg":8075}]'::jsonb
  FROM customers c WHERE c.code = 'MC4-93';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000031', 'SHP-20260417-031', 'd0000000-0000-0000-0000-000000000011', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 8075.00, 47.5000, '[{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":950,"weight_kg":8075}]'::jsonb
  FROM customers c WHERE c.code = 'MC4-93';

-- DH-012: Cty TNHH TMTH và DV Hằng Hiền (Quảng Ninh)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000012', 'ORD-20260417-012', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 6800.00, 40.0000, 144000000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'QN-VTD';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000001', 800, 180000, 144000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000032', 'SHP-20260417-032', 'd0000000-0000-0000-0000-000000000012', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6800.00, 40.0000, '[{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":800,"weight_kg":6800}]'::jsonb
  FROM customers c WHERE c.code = 'QN-VTD';

-- DH-013: Cty TNHH MTV TM Hồng Hải HL (Quảng Ninh)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000013', 'ORD-20260417-013', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 16150.00, 95.0000, 342000000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'QN-VTD';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000001', 1900, 180000, 342000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000033', 'SHP-20260417-033', 'd0000000-0000-0000-0000-000000000013', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 5383.33, 31.6667, '[{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":634,"weight_kg":5389}]'::jsonb
  FROM customers c WHERE c.code = 'QN-VTD';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000034', 'SHP-20260417-034', 'd0000000-0000-0000-0000-000000000013', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 5383.33, 31.6667, '[{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":634,"weight_kg":5389}]'::jsonb
  FROM customers c WHERE c.code = 'QN-VTD';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000035', 'SHP-20260417-035', 'd0000000-0000-0000-0000-000000000013', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 5383.33, 31.6667, '[{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":634,"weight_kg":5389}]'::jsonb
  FROM customers c WHERE c.code = 'QN-VTD';

-- DH-014: Nguyễn Văn Khu-TB-133 (Thái Bình)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000014', 'ORD-20260417-014', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 45320.00, 74.0000, 998000000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'TB-133';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000007', 1180, 800000, 944000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000009', 300, 180000, 54000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000036', 'SHP-20260417-036', 'd0000000-0000-0000-0000-000000000014', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7553.33, 12.3333, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":197,"weight_kg":6304},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":50,"weight_kg":1260}]'::jsonb
  FROM customers c WHERE c.code = 'TB-133';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000037', 'SHP-20260417-037', 'd0000000-0000-0000-0000-000000000014', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7553.33, 12.3333, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":197,"weight_kg":6304},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":50,"weight_kg":1260}]'::jsonb
  FROM customers c WHERE c.code = 'TB-133';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000038', 'SHP-20260417-038', 'd0000000-0000-0000-0000-000000000014', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7553.33, 12.3333, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":197,"weight_kg":6304},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":50,"weight_kg":1260}]'::jsonb
  FROM customers c WHERE c.code = 'TB-133';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000039', 'SHP-20260417-039', 'd0000000-0000-0000-0000-000000000014', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7553.33, 12.3333, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":197,"weight_kg":6304},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":50,"weight_kg":1260}]'::jsonb
  FROM customers c WHERE c.code = 'TB-133';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000040', 'SHP-20260417-040', 'd0000000-0000-0000-0000-000000000014', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7553.33, 12.3333, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":197,"weight_kg":6304},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":50,"weight_kg":1260}]'::jsonb
  FROM customers c WHERE c.code = 'TB-133';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000041', 'SHP-20260417-041', 'd0000000-0000-0000-0000-000000000014', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7553.33, 12.3333, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":197,"weight_kg":6304},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":50,"weight_kg":1260}]'::jsonb
  FROM customers c WHERE c.code = 'TB-133';

-- DH-015: Phan Đăng Kế-NG-109 (Hải Dương)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000015', 'ORD-20260417-015', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 14386.00, 27.0000, 320400000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'NG-109';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000007', 360, 800000, 288000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000009', 80, 180000, 14400000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000001', 100, 180000, 18000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000042', 'SHP-20260417-042', 'd0000000-0000-0000-0000-000000000015', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7193.00, 13.5000, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":180,"weight_kg":5760},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":40,"weight_kg":1008},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":50,"weight_kg":425}]'::jsonb
  FROM customers c WHERE c.code = 'NG-109';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000043', 'SHP-20260417-043', 'd0000000-0000-0000-0000-000000000015', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7193.00, 13.5000, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":180,"weight_kg":5760},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":40,"weight_kg":1008},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":50,"weight_kg":425}]'::jsonb
  FROM customers c WHERE c.code = 'NG-109';

-- DH-016: Vũ Minh Chung-NT6BC-115 (Quảng Ninh)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000016', 'ORD-20260417-016', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 26628.00, 135.0500, 534700000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'QN-VTD';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000007', 76, 800000, 60800000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000009', 105, 180000, 18900000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000016', 20, 250000, 5000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000001', 2500, 180000, 450000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000044', 'SHP-20260417-044', 'd0000000-0000-0000-0000-000000000016', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 4438.00, 22.5083, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":13,"weight_kg":416},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":18,"weight_kg":453.59999999999997},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":4,"weight_kg":60},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":417,"weight_kg":3544.5}]'::jsonb
  FROM customers c WHERE c.code = 'QN-VTD';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000045', 'SHP-20260417-045', 'd0000000-0000-0000-0000-000000000016', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 4438.00, 22.5083, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":13,"weight_kg":416},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":18,"weight_kg":453.59999999999997},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":4,"weight_kg":60},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":417,"weight_kg":3544.5}]'::jsonb
  FROM customers c WHERE c.code = 'QN-VTD';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000046', 'SHP-20260417-046', 'd0000000-0000-0000-0000-000000000016', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 4438.00, 22.5083, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":13,"weight_kg":416},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":18,"weight_kg":453.59999999999997},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":4,"weight_kg":60},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":417,"weight_kg":3544.5}]'::jsonb
  FROM customers c WHERE c.code = 'QN-VTD';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000047', 'SHP-20260417-047', 'd0000000-0000-0000-0000-000000000016', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 4438.00, 22.5083, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":13,"weight_kg":416},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":18,"weight_kg":453.59999999999997},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":4,"weight_kg":60},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":417,"weight_kg":3544.5}]'::jsonb
  FROM customers c WHERE c.code = 'QN-VTD';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000048', 'SHP-20260417-048', 'd0000000-0000-0000-0000-000000000016', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 4438.00, 22.5083, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":13,"weight_kg":416},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":18,"weight_kg":453.59999999999997},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":4,"weight_kg":60},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":417,"weight_kg":3544.5}]'::jsonb
  FROM customers c WHERE c.code = 'QN-VTD';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000049', 'SHP-20260417-049', 'd0000000-0000-0000-0000-000000000016', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 4438.00, 22.5083, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":13,"weight_kg":416},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":18,"weight_kg":453.59999999999997},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":4,"weight_kg":60},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":417,"weight_kg":3544.5}]'::jsonb
  FROM customers c WHERE c.code = 'QN-VTD';

-- DH-017: Lê Thị Nga-HH2-70 (Quảng Ninh)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000017', 'ORD-20260417-017', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 14500.00, 70.0000, 280000000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'HH2-70';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000016', 400, 250000, 100000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000001', 1000, 180000, 180000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000050', 'SHP-20260417-050', 'd0000000-0000-0000-0000-000000000017', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7250.00, 35.0000, '[{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":200,"weight_kg":3000},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":500,"weight_kg":4250}]'::jsonb
  FROM customers c WHERE c.code = 'HH2-70';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000051', 'SHP-20260417-051', 'd0000000-0000-0000-0000-000000000017', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7250.00, 35.0000, '[{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":200,"weight_kg":3000},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":500,"weight_kg":4250}]'::jsonb
  FROM customers c WHERE c.code = 'HH2-70';

-- DH-018: Phạm Thị Nhung-CP2-29 (Quảng Ninh)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000018', 'ORD-20260417-018', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 25450.00, 137.5000, 519500000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'CP2-29';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000016', 150, 250000, 37500000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000003', 200, 250000, 50000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000001', 2400, 180000, 432000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000052', 'SHP-20260417-052', 'd0000000-0000-0000-0000-000000000018', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6362.50, 34.3750, '[{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":38,"weight_kg":570},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":50,"weight_kg":700},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":600,"weight_kg":5100}]'::jsonb
  FROM customers c WHERE c.code = 'CP2-29';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000053', 'SHP-20260417-053', 'd0000000-0000-0000-0000-000000000018', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6362.50, 34.3750, '[{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":38,"weight_kg":570},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":50,"weight_kg":700},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":600,"weight_kg":5100}]'::jsonb
  FROM customers c WHERE c.code = 'CP2-29';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000054', 'SHP-20260417-054', 'd0000000-0000-0000-0000-000000000018', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6362.50, 34.3750, '[{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":38,"weight_kg":570},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":50,"weight_kg":700},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":600,"weight_kg":5100}]'::jsonb
  FROM customers c WHERE c.code = 'CP2-29';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000055', 'SHP-20260417-055', 'd0000000-0000-0000-0000-000000000018', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6362.50, 34.3750, '[{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":38,"weight_kg":570},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":50,"weight_kg":700},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":600,"weight_kg":5100}]'::jsonb
  FROM customers c WHERE c.code = 'CP2-29';

-- DH-019: Khu vực Nam Định (nhiều NPP) (Nam Định)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000019', 'ORD-20260417-019', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 5825.00, 32.5000, 120500000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'NĐ-4776';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000016', 25, 250000, 6250000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000003', 25, 250000, 6250000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000001', 600, 180000, 108000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000056', 'SHP-20260417-056', 'd0000000-0000-0000-0000-000000000019', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 5825.00, 32.5000, '[{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":25,"weight_kg":375},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":25,"weight_kg":350},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":600,"weight_kg":5100}]'::jsonb
  FROM customers c WHERE c.code = 'NĐ-4776';

-- DH-020: Khu vực Nam Định + Ninh Bình (NĐ + NB)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000020', 'ORD-20260417-020', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 11560.00, 23.5000, 146000000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'NĐ-4776';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000007', 90, 800000, 72000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000009', 300, 180000, 54000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000003', 80, 250000, 20000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000057', 'SHP-20260417-057', 'd0000000-0000-0000-0000-000000000020', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 11560.00, 23.5000, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":90,"weight_kg":2880},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":300,"weight_kg":7560},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":80,"weight_kg":1120}]'::jsonb
  FROM customers c WHERE c.code = 'NĐ-4776';

-- DH-021: Lại Thị Quyên-HB-73 (Quảng Ninh)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000021', 'ORD-20260417-021', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 15300.00, 90.0000, 324000000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'HB-73';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000001', 1800, 180000, 324000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000058', 'SHP-20260417-058', 'd0000000-0000-0000-0000-000000000021', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7650.00, 45.0000, '[{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":900,"weight_kg":7650}]'::jsonb
  FROM customers c WHERE c.code = 'HB-73';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000059', 'SHP-20260417-059', 'd0000000-0000-0000-0000-000000000021', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7650.00, 45.0000, '[{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":900,"weight_kg":7650}]'::jsonb
  FROM customers c WHERE c.code = 'HB-73';

-- DH-022: Khu vực Thái Bình (nhiều NPP) (Thái Bình)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000022', 'ORD-20260417-022', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 45118.00, 129.2500, 902050000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'TB-114';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000007', 670, 800000, 536000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000009', 340, 180000, 61200000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000016', 45, 250000, 11250000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000003', 260, 250000, 65000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000001', 1270, 180000, 228600000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000060', 'SHP-20260417-060', 'd0000000-0000-0000-0000-000000000022', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7519.67, 21.5417, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":112,"weight_kg":3584},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":57,"weight_kg":1436.3999999999999},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":8,"weight_kg":120},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":44,"weight_kg":616},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":212,"weight_kg":1802}]'::jsonb
  FROM customers c WHERE c.code = 'TB-114';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000061', 'SHP-20260417-061', 'd0000000-0000-0000-0000-000000000022', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7519.67, 21.5417, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":112,"weight_kg":3584},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":57,"weight_kg":1436.3999999999999},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":8,"weight_kg":120},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":44,"weight_kg":616},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":212,"weight_kg":1802}]'::jsonb
  FROM customers c WHERE c.code = 'TB-114';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000062', 'SHP-20260417-062', 'd0000000-0000-0000-0000-000000000022', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7519.67, 21.5417, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":112,"weight_kg":3584},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":57,"weight_kg":1436.3999999999999},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":8,"weight_kg":120},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":44,"weight_kg":616},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":212,"weight_kg":1802}]'::jsonb
  FROM customers c WHERE c.code = 'TB-114';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000063', 'SHP-20260417-063', 'd0000000-0000-0000-0000-000000000022', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7519.67, 21.5417, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":112,"weight_kg":3584},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":57,"weight_kg":1436.3999999999999},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":8,"weight_kg":120},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":44,"weight_kg":616},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":212,"weight_kg":1802}]'::jsonb
  FROM customers c WHERE c.code = 'TB-114';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000064', 'SHP-20260417-064', 'd0000000-0000-0000-0000-000000000022', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7519.67, 21.5417, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":112,"weight_kg":3584},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":57,"weight_kg":1436.3999999999999},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":8,"weight_kg":120},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":44,"weight_kg":616},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":212,"weight_kg":1802}]'::jsonb
  FROM customers c WHERE c.code = 'TB-114';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000065', 'SHP-20260417-065', 'd0000000-0000-0000-0000-000000000022', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7519.67, 21.5417, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":112,"weight_kg":3584},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":57,"weight_kg":1436.3999999999999},{"product_id":"c0000000-0000-0000-0000-000000000016","product_name":"Bia Hạ Long Chai 330ml (20 chai/két)","quantity":8,"weight_kg":120},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":44,"weight_kg":616},{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":212,"weight_kg":1802}]'::jsonb
  FROM customers c WHERE c.code = 'TB-114';

-- DH-023: Cty TNHH NN quốc tế Thái Nguyên (Thái Nguyên)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000023', 'ORD-20260417-023', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 4480.00, 7.0000, 112000000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'TN-4798';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000023', 'c0000000-0000-0000-0000-000000000007', 140, 800000, 112000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000066', 'SHP-20260417-066', 'd0000000-0000-0000-0000-000000000023', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 4480.00, 7.0000, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":140,"weight_kg":4480}]'::jsonb
  FROM customers c WHERE c.code = 'TN-4798';

-- DH-024: Vũ Ngọc Thắng-HH1-35 (Quảng Ninh)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000024', 'ORD-20260417-024', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 4024.00, 6.5000, 91600000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'HH1-35';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000024', 'c0000000-0000-0000-0000-000000000007', 110, 800000, 88000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000024', 'c0000000-0000-0000-0000-000000000009', 20, 180000, 3600000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000067', 'SHP-20260417-067', 'd0000000-0000-0000-0000-000000000024', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 4024.00, 6.5000, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":110,"weight_kg":3520},{"product_id":"c0000000-0000-0000-0000-000000000009","product_name":"Bia Hạ Long PET 2 Lít","quantity":20,"weight_kg":504}]'::jsonb
  FROM customers c WHERE c.code = 'HH1-35';

-- DH-025: Phạm Văn Thụ-HNI-48 (Giao đại lý) (Hà Nội)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000025', 'ORD-20260417-025', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 30600.00, 180.0000, 648000000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'HNI-48';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000025', 'c0000000-0000-0000-0000-000000000001', 3600, 180000, 648000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000068', 'SHP-20260417-068', 'd0000000-0000-0000-0000-000000000025', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7650.00, 45.0000, '[{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":900,"weight_kg":7650}]'::jsonb
  FROM customers c WHERE c.code = 'HNI-48';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000069', 'SHP-20260417-069', 'd0000000-0000-0000-0000-000000000025', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7650.00, 45.0000, '[{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":900,"weight_kg":7650}]'::jsonb
  FROM customers c WHERE c.code = 'HNI-48';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000070', 'SHP-20260417-070', 'd0000000-0000-0000-0000-000000000025', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7650.00, 45.0000, '[{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":900,"weight_kg":7650}]'::jsonb
  FROM customers c WHERE c.code = 'HNI-48';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000071', 'SHP-20260417-071', 'd0000000-0000-0000-0000-000000000025', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 7650.00, 45.0000, '[{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":900,"weight_kg":7650}]'::jsonb
  FROM customers c WHERE c.code = 'HNI-48';

-- DH-026: Khu vực Thái Nguyên (Thái Nguyên)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000026', 'ORD-20260417-026', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 12640.00, 22.0000, 308000000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'TN-4798';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000026', 'c0000000-0000-0000-0000-000000000007', 360, 800000, 288000000);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000026', 'c0000000-0000-0000-0000-000000000003', 80, 250000, 20000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000072', 'SHP-20260417-072', 'd0000000-0000-0000-0000-000000000026', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6320.00, 11.0000, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":180,"weight_kg":5760},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":40,"weight_kg":560}]'::jsonb
  FROM customers c WHERE c.code = 'TN-4798';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000073', 'SHP-20260417-073', 'd0000000-0000-0000-0000-000000000026', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 6320.00, 11.0000, '[{"product_id":"c0000000-0000-0000-0000-000000000007","product_name":"Bia Hạ Long Keg 30 Lít","quantity":180,"weight_kg":5760},{"product_id":"c0000000-0000-0000-0000-000000000003","product_name":"Bia Hạ Long Chai 450ml (20 chai/két)","quantity":40,"weight_kg":560}]'::jsonb
  FROM customers c WHERE c.code = 'TN-4798';

-- DH-027: Vũ Văn Tuyên-HH2-69 (Quảng Ninh)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000027', 'ORD-20260417-027', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 16150.00, 95.0000, 342000000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'HH2-69';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000027', 'c0000000-0000-0000-0000-000000000001', 1900, 180000, 342000000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000074', 'SHP-20260417-074', 'd0000000-0000-0000-0000-000000000027', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 8075.00, 47.5000, '[{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":950,"weight_kg":8075}]'::jsonb
  FROM customers c WHERE c.code = 'HH2-69';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000075', 'SHP-20260417-075', 'd0000000-0000-0000-0000-000000000027', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 8075.00, 47.5000, '[{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":950,"weight_kg":8075}]'::jsonb
  FROM customers c WHERE c.code = 'HH2-69';

-- DH-028: Nguyễn Thị Yến-DT1-34 (Quảng Ninh)
INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, total_amount, deposit_amount, atp_status, credit_status, created_by)
  SELECT 'd0000000-0000-0000-0000-000000000028', 'ORD-20260417-028', c.id, 'a0000000-0000-0000-0000-000000000001', 'confirmed'::order_status, '2026-04-17', 29920.00, 176.0000, 633600000.00, 0, 'passed', 'passed', (SELECT id FROM users WHERE role='dispatcher' LIMIT 1)
  FROM customers c WHERE c.code = 'DT1-34';
INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
  VALUES ('d0000000-0000-0000-0000-000000000028', 'c0000000-0000-0000-0000-000000000001', 3520, 180000, 633600000);
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000076', 'SHP-20260417-076', 'd0000000-0000-0000-0000-000000000028', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 14960.00, 88.0000, '[{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":1760,"weight_kg":14960}]'::jsonb
  FROM customers c WHERE c.code = 'DT1-34';
INSERT INTO shipments (id, shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
  SELECT 'e0000000-0000-0000-0000-000000000077', 'SHP-20260417-077', 'd0000000-0000-0000-0000-000000000028', c.id, 'a0000000-0000-0000-0000-000000000001', 'pending'::shipment_status, '2026-04-17', 14960.00, 88.0000, '[{"product_id":"c0000000-0000-0000-0000-000000000001","product_name":"Bia Hạ Long Lon 330ml (24 lon/thùng)","quantity":1760,"weight_kg":14960}]'::jsonb
  FROM customers c WHERE c.code = 'DT1-34';

COMMIT;
-- Total: 28 orders, 77 shipments