-- ============================================================
-- BHL OMS-TMS-WMS — PRODUCTION SEED DATA (Tasks 4.1-4.6)
-- 800 NPP, 70 vehicles+drivers, 30 products, 500 routes,
-- credit balances, asset balances
-- Công ty CP Bia & Nước giải khát Hạ Long
-- ============================================================

-- ===================================================
-- TASK 4.3: 30 PRODUCTS (Bia Hạ Long + Nước giải khát)
-- ===================================================
INSERT INTO products (id, sku, name, unit, weight_kg, volume_m3, price, deposit_price, category) VALUES
-- Bia lon
('c0000000-0000-0000-0000-000000000001', 'BHL-LON-330',    'Bia Hạ Long Lon 330ml (thùng 24)',           'thùng', 8.50,  0.015, 185000,  5000,   'Bia lon'),
('c0000000-0000-0000-0000-000000000002', 'BHL-LON-500',    'Bia Hạ Long Lon 500ml (thùng 24)',           'thùng', 12.80, 0.020, 245000,  5000,   'Bia lon'),
('c0000000-0000-0000-0000-000000000011', 'BHL-LON-330-6',  'Bia Hạ Long Lon 330ml (lốc 6)',              'lốc',   2.20,  0.004, 48000,   0,      'Bia lon'),
('c0000000-0000-0000-0000-000000000013', 'BHL-LAGER-500',  'Bia Hạ Long Lager Lon 500ml (thùng 24)',     'thùng', 12.80, 0.020, 265000,  5000,   'Bia lon'),
('c0000000-0000-0000-0000-000000000015', 'BHL-STRONG-330', 'Bia Hạ Long Strong 8% Lon 330ml (thùng 24)','thùng', 8.50,  0.015, 235000,  5000,   'Bia mạnh'),
-- Bia chai
('c0000000-0000-0000-0000-000000000003', 'BHL-CHAI-450',   'Bia Hạ Long Chai 450ml (két 20)',            'két',   14.00, 0.025, 195000,  40000,  'Bia chai'),
('c0000000-0000-0000-0000-000000000004', 'BHL-CHAI-640',   'Bia Hạ Long Chai 640ml (két 12)',            'két',   12.50, 0.022, 175000,  40000,  'Bia chai'),
('c0000000-0000-0000-0000-000000000016', 'BHL-CHAI-355',   'Bia Hạ Long Chai 355ml (két 24)',            'két',   15.00, 0.026, 210000,  40000,  'Bia chai'),
-- Bia cao cấp
('c0000000-0000-0000-0000-000000000005', 'BHL-GOLD-330',   'Bia Hạ Long Gold Lon 330ml (thùng 24)',      'thùng', 8.50,  0.015, 225000,  5000,   'Bia lon cao cấp'),
('c0000000-0000-0000-0000-000000000006', 'BHL-GOLD-500',   'Bia Hạ Long Gold Lon 500ml (thùng 12)',      'thùng', 6.50,  0.012, 155000,  5000,   'Bia lon cao cấp'),
('c0000000-0000-0000-0000-000000000017', 'BHL-GOLD-CHAI',  'Bia Hạ Long Gold Chai 330ml (két 24)',       'két',   14.50, 0.025, 280000,  40000,  'Bia chai cao cấp'),
('c0000000-0000-0000-0000-000000000018', 'BHL-PREMIUM-355','Bia Hạ Long Premium 355ml (thùng 24)',       'thùng', 9.00,  0.016, 295000,  5000,   'Bia cao cấp'),
-- Bia đặc biệt
('c0000000-0000-0000-0000-000000000007', 'BHL-DRAFT-30',   'Bia Hạ Long Draft Keg 30L',                  'keg',   32.00, 0.035, 650000,  200000, 'Bia tươi'),
('c0000000-0000-0000-0000-000000000008', 'BHL-DARK-330',   'Bia Hạ Long Dark Lon 330ml (thùng 24)',      'thùng', 8.50,  0.015, 205000,  5000,   'Bia đen'),
('c0000000-0000-0000-0000-000000000012', 'BHL-EXPORT-330', 'Bia Hạ Long Export Lon 330ml (thùng 24)',    'thùng', 8.50,  0.015, 210000,  5000,   'Bia lon xuất khẩu'),
('c0000000-0000-0000-0000-000000000019', 'BHL-DRAFT-20',   'Bia Hạ Long Draft Keg 20L',                  'keg',   22.00, 0.025, 450000,  200000, 'Bia tươi'),
('c0000000-0000-0000-0000-000000000020', 'BHL-WHEAT-330',  'Bia Hạ Long Wheat Lon 330ml (thùng 24)',     'thùng', 8.50,  0.015, 240000,  5000,   'Bia lúa mì'),
('c0000000-0000-0000-0000-000000000021', 'BHL-IPA-330',    'Bia Hạ Long IPA Lon 330ml (thùng 24)',       'thùng', 8.50,  0.015, 260000,  5000,   'Bia IPA'),
-- Nước giải khát
('c0000000-0000-0000-0000-000000000009', 'NGK-CHANH-330',  'Nước Giải Khát Chanh 330ml (thùng 24)',      'thùng', 8.20,  0.015, 125000,  3000,   'Nước giải khát'),
('c0000000-0000-0000-0000-000000000010', 'NGK-CAM-330',    'Nước Giải Khát Cam 330ml (thùng 24)',        'thùng', 8.20,  0.015, 125000,  3000,   'Nước giải khát'),
('c0000000-0000-0000-0000-000000000014', 'NGK-DA-500',     'Nước Khoáng Đá 500ml (thùng 24)',            'thùng', 12.50, 0.018, 75000,   0,      'Nước khoáng'),
('c0000000-0000-0000-0000-000000000022', 'NGK-DAUNAH-330', 'Nước Giải Khát Dâu Nha 330ml (thùng 24)',   'thùng', 8.20,  0.015, 130000,  3000,   'Nước giải khát'),
('c0000000-0000-0000-0000-000000000023', 'NGK-TRALAI-500', 'Trà Lài 500ml (thùng 24)',                   'thùng', 12.50, 0.018, 95000,   0,      'Trà'),
('c0000000-0000-0000-0000-000000000024', 'NGK-TRADAM-500', 'Trà Đậm 500ml (thùng 24)',                   'thùng', 12.50, 0.018, 98000,   0,      'Trà'),
('c0000000-0000-0000-0000-000000000025', 'NGK-SODA-330',   'Soda Hạ Long 330ml (thùng 24)',              'thùng', 8.20,  0.015, 85000,   3000,   'Soda'),
-- Vỏ chai rỗng (tài sản luân chuyển)
('c0000000-0000-0000-0000-000000000026', 'VO-CHAI-450',    'Vỏ chai 450ml (két 20) - Thu hồi',          'két',   6.00,  0.025, 0,       40000,  'Vỏ chai'),
('c0000000-0000-0000-0000-000000000027', 'VO-CHAI-640',    'Vỏ chai 640ml (két 12) - Thu hồi',          'két',   5.00,  0.022, 0,       40000,  'Vỏ chai'),
('c0000000-0000-0000-0000-000000000028', 'VO-KET-NHUA',    'Két nhựa (chứa 24 lon) - Thu hồi',          'két',   1.50,  0.015, 0,       25000,  'Két nhựa'),
('c0000000-0000-0000-0000-000000000029', 'VO-KEG-30',      'Vỏ keg 30L - Thu hồi',                      'keg',   5.00,  0.035, 0,       200000, 'Vỏ keg'),
('c0000000-0000-0000-0000-000000000030', 'VO-KEG-20',      'Vỏ keg 20L - Thu hồi',                      'keg',   3.50,  0.025, 0,       200000, 'Vỏ keg')
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name, price = EXCLUDED.price, weight_kg = EXCLUDED.weight_kg,
  volume_m3 = EXCLUDED.volume_m3, deposit_price = EXCLUDED.deposit_price, category = EXCLUDED.category;

-- ===================================================
-- TASK 4.1: 800 NPP (Quảng Ninh, Hải Phòng, Hải Dương,
--   Bắc Ninh, Thái Bình, Nam Định, Lạng Sơn, Bắc Giang)
-- Using generate_series to create realistic NPP data
-- ===================================================

-- First insert 20 NPPs with real data (already in seed_full)
INSERT INTO customers (id, code, name, address, phone, latitude, longitude, province, district, route_code) VALUES
('d0000000-0000-0000-0000-000000000001', 'NPP-001', 'NPP Bãi Cháy - Anh Tuấn',          '45 Vườn Đào, Bãi Cháy, Hạ Long, QN',          '0912345001', 20.9590, 107.0480, 'Quảng Ninh', 'Bãi Cháy',    'R01'),
('d0000000-0000-0000-0000-000000000002', 'NPP-002', 'NPP Hòn Gai - Chị Lan',             '12 Trần Hưng Đạo, Hòn Gai, Hạ Long, QN',      '0912345002', 20.9550, 107.0860, 'Quảng Ninh', 'Hòn Gai',     'R01'),
('d0000000-0000-0000-0000-000000000003', 'NPP-003', 'NPP Uông Bí - CTY Hoàng Long',      '78 Quang Trung, Uông Bí, QN',                  '0912345003', 21.0360, 106.7640, 'Quảng Ninh', 'Uông Bí',     'R02'),
('d0000000-0000-0000-0000-000000000004', 'NPP-004', 'NPP Cẩm Phả - Anh Hùng',            '23 Trần Phú, Cẩm Phả, QN',                     '0912345004', 21.0130, 107.3010, 'Quảng Ninh', 'Cẩm Phả',     'R03'),
('d0000000-0000-0000-0000-000000000005', 'NPP-005', 'NPP Móng Cái - Chị Hương',           '56 Hữu Nghị, Móng Cái, QN',                    '0912345005', 21.5280, 107.9650, 'Quảng Ninh', 'Móng Cái',    'R04'),
('d0000000-0000-0000-0000-000000000006', 'NPP-006', 'NPP Đông Triều - Anh Nam',           '34 Lê Lợi, Đông Triều, QN',                    '0912345006', 21.0800, 106.5000, 'Quảng Ninh', 'Đông Triều',  'R02'),
('d0000000-0000-0000-0000-000000000007', 'NPP-007', 'NPP Quảng Yên - CTY Minh Đức',       '67 Nguyễn Trãi, Quảng Yên, QN',                '0912345007', 20.9330, 106.8030, 'Quảng Ninh', 'Quảng Yên',   'R02'),
('d0000000-0000-0000-0000-000000000008', 'NPP-008', 'NPP Hải An - Anh Cường',             '89 Lê Hồng Phong, Hải An, HP',                 '0912345008', 20.8350, 106.7240, 'Hải Phòng',  'Hải An',      'R05'),
('d0000000-0000-0000-0000-000000000009', 'NPP-009', 'NPP Kiến An - Chị Thảo',             '12 Trần Nhân Tông, Kiến An, HP',                '0912345009', 20.8150, 106.6200, 'Hải Phòng',  'Kiến An',     'R05'),
('d0000000-0000-0000-0000-000000000010', 'NPP-010', 'NPP Lê Chân - CTY Phú Hưng',         '45 Tô Hiệu, Lê Chân, HP',                      '0912345010', 20.8510, 106.6750, 'Hải Phòng',  'Lê Chân',     'R05'),
('d0000000-0000-0000-0000-000000000011', 'NPP-011', 'NPP Vân Đồn - Anh Sơn',              '23 Hạ Long, Vân Đồn, QN',                       '0912345011', 20.9100, 107.4200, 'Quảng Ninh', 'Vân Đồn',     'R03'),
('d0000000-0000-0000-0000-000000000012', 'NPP-012', 'NPP Tiên Yên - Chị Nhung',            '56 Nguyễn Huệ, Tiên Yên, QN',                  '0912345012', 21.3310, 107.4030, 'Quảng Ninh', 'Tiên Yên',    'R04'),
('d0000000-0000-0000-0000-000000000013', 'NPP-013', 'NPP Hạ Long Center - Anh Bình',       '100 Lê Thánh Tông, Hạ Long, QN',               '0912345013', 20.9480, 107.0700, 'Quảng Ninh', 'Hạ Long',     'R01'),
('d0000000-0000-0000-0000-000000000014', 'NPP-014', 'NPP Đồ Sơn - CTY Biển Xanh',         '34 An Dương Vương, Đồ Sơn, HP',                '0912345014', 20.7100, 106.7800, 'Hải Phòng',  'Đồ Sơn',      'R06'),
('d0000000-0000-0000-0000-000000000015', 'NPP-015', 'NPP Thuỷ Nguyên - Anh Hải',           '78 Bạch Đằng, Thuỷ Nguyên, HP',                '0912345015', 20.9200, 106.7100, 'Hải Phòng',  'Thuỷ Nguyên', 'R06'),
('d0000000-0000-0000-0000-000000000016', 'NPP-016', 'NPP Giếng Đáy - Chị Oanh',           '15 Ngô Quyền, Giếng Đáy, Hạ Long, QN',         '0912345016', 20.9430, 107.0550, 'Quảng Ninh', 'Giếng Đáy',   'R01'),
('d0000000-0000-0000-0000-000000000017', 'NPP-017', 'NPP Hà Khánh - Anh Tùng',            '88 Cao Thắng, Hà Khánh, Hạ Long, QN',          '0912345017', 20.9640, 107.0350, 'Quảng Ninh', 'Hà Khánh',    'R01'),
('d0000000-0000-0000-0000-000000000018', 'NPP-018', 'NPP Mạo Khê - CTY Việt Phát',         '45 Trần Phú, Mạo Khê, Đông Triều, QN',         '0912345018', 21.0530, 106.5500, 'Quảng Ninh', 'Mạo Khê',     'R02'),
('d0000000-0000-0000-0000-000000000019', 'NPP-019', 'NPP Cửa Ông - Anh Việt',              '30 Lý Tự Trọng, Cửa Ông, Cẩm Phả, QN',        '0912345019', 21.0240, 107.3450, 'Quảng Ninh', 'Cửa Ông',     'R03'),
('d0000000-0000-0000-0000-000000000020', 'NPP-020', 'NPP Ngô Quyền HP - Chị Hạnh',         '120 Đà Nẵng, Ngô Quyền, HP',                   '0912345020', 20.8580, 106.6920, 'Hải Phòng',  'Ngô Quyền',   'R05')
ON CONFLICT (code) DO NOTHING;

-- Generate 780 more NPPs using generate_series (NPP-021 to NPP-800)
-- 8 provinces, realistic lat/lng spread: QN, HP, HD, BN, TB, ND, LS, BG
INSERT INTO customers (code, name, address, phone, latitude, longitude, province, district, route_code)
SELECT
  'NPP-' || LPAD(n::text, 3, '0'),
  CASE (n % 12)
    WHEN 0 THEN 'NPP ' || (ARRAY['Anh','Chị','CTY','Đại lý','Quán','Nhà hàng','KS','Siêu thị','Cửa hàng','TT TM','Quầy','Tạp hóa'])[1 + (n % 12)] || ' ' ||
                (ARRAY['Tuấn','Lan','Hùng','Hương','Nam','Đức','Hoa','Mai','Long','Thắng','Bình','Hạnh'])[1 + (n % 12)]
    ELSE 'NPP ' || (ARRAY['Anh','Chị','CTY','Đại lý','Quán','Nhà hàng','KS','Siêu thị','Cửa hàng','TT TM','Quầy','Tạp hóa'])[1 + (n % 12)] || ' ' ||
                (ARRAY['Tuấn','Lan','Hùng','Hương','Nam','Đức','Hoa','Mai','Long','Thắng','Bình','Hạnh'])[1 + (n % 12)]
  END,
  (n % 200 + 1)::text || ' ' ||
  (ARRAY['Trần Phú','Lê Lợi','Nguyễn Trãi','Quang Trung','Hùng Vương','Lý Thường Kiệt','Hai Bà Trưng','Ngô Quyền','Bạch Đằng','Trần Hưng Đạo'])[1 + (n % 10)] || ', ' ||
  (ARRAY['P. Trung Tâm','P. Bắc','P. Nam','P. Đông','P. Tây','TT. Huyện','P. An Phú','P. Minh Khai','P. Quang Trung','P. Hồng Phong'])[1 + (n % 10)] || ', ' ||
  CASE
    WHEN n % 8 = 0 THEN 'Hạ Long, Quảng Ninh'
    WHEN n % 8 = 1 THEN 'Hải Phòng'
    WHEN n % 8 = 2 THEN 'Hải Dương'
    WHEN n % 8 = 3 THEN 'Bắc Ninh'
    WHEN n % 8 = 4 THEN 'Thái Bình'
    WHEN n % 8 = 5 THEN 'Nam Định'
    WHEN n % 8 = 6 THEN 'Lạng Sơn'
    ELSE 'Bắc Giang'
  END,
  '09' || LPAD((12345000 + n)::text, 8, '0'),
  -- Realistic lat/lng per province
  CASE
    WHEN n % 8 = 0 THEN 20.95 + (random() * 0.15 - 0.07)   -- QN
    WHEN n % 8 = 1 THEN 20.84 + (random() * 0.10 - 0.05)   -- HP
    WHEN n % 8 = 2 THEN 20.94 + (random() * 0.12 - 0.06)   -- HD
    WHEN n % 8 = 3 THEN 21.18 + (random() * 0.10 - 0.05)   -- BN
    WHEN n % 8 = 4 THEN 20.45 + (random() * 0.10 - 0.05)   -- TB
    WHEN n % 8 = 5 THEN 20.42 + (random() * 0.10 - 0.05)   -- ND
    WHEN n % 8 = 6 THEN 21.85 + (random() * 0.10 - 0.05)   -- LS
    ELSE 21.27 + (random() * 0.12 - 0.06)                   -- BG
  END,
  CASE
    WHEN n % 8 = 0 THEN 107.05 + (random() * 0.30 - 0.15)  -- QN
    WHEN n % 8 = 1 THEN 106.68 + (random() * 0.12 - 0.06)  -- HP
    WHEN n % 8 = 2 THEN 106.30 + (random() * 0.12 - 0.06)  -- HD
    WHEN n % 8 = 3 THEN 106.07 + (random() * 0.10 - 0.05)  -- BN
    WHEN n % 8 = 4 THEN 106.34 + (random() * 0.10 - 0.05)  -- TB
    WHEN n % 8 = 5 THEN 106.17 + (random() * 0.10 - 0.05)  -- ND
    WHEN n % 8 = 6 THEN 106.76 + (random() * 0.10 - 0.05)  -- LS
    ELSE 106.20 + (random() * 0.12 - 0.06)                  -- BG
  END,
  CASE
    WHEN n % 8 = 0 THEN 'Quảng Ninh'
    WHEN n % 8 = 1 THEN 'Hải Phòng'
    WHEN n % 8 = 2 THEN 'Hải Dương'
    WHEN n % 8 = 3 THEN 'Bắc Ninh'
    WHEN n % 8 = 4 THEN 'Thái Bình'
    WHEN n % 8 = 5 THEN 'Nam Định'
    WHEN n % 8 = 6 THEN 'Lạng Sơn'
    ELSE 'Bắc Giang'
  END,
  (ARRAY['TP','Huyện A','Huyện B','TT','Quận 1','Quận 2','Huyện C','Huyện D'])[1 + (n % 8)],
  'R' || LPAD(((n - 1) / 16 + 1)::text, 2, '0')  -- ~16 NPP per route = 50 routes
FROM generate_series(21, 800) AS n
ON CONFLICT (code) DO NOTHING;

-- ===================================================
-- TASK 4.2: 70 VEHICLES + DRIVERS
-- ===================================================

-- 70 Vehicles: 40 for WH-HL (Quảng Ninh), 30 for WH-HP (Hải Phòng)
INSERT INTO vehicles (id, plate_number, vehicle_type, capacity_kg, capacity_m3, status, warehouse_id)
SELECT
  ('e0000000-0000-0000-0000-' || LPAD(n::text, 12, '0'))::uuid,
  CASE
    WHEN n <= 40 THEN '14C-' || LPAD((10000 + n)::text, 5, '0')  -- Quảng Ninh plates
    ELSE '15C-' || LPAD((20000 + n - 40)::text, 5, '0')          -- Hải Phòng plates
  END,
  CASE
    WHEN n % 4 = 0 THEN 'truck_15t'
    WHEN n % 4 = 1 THEN 'truck_8t'
    WHEN n % 4 = 2 THEN 'truck_5t'
    ELSE 'truck_3t5'
  END::vehicle_type,
  CASE
    WHEN n % 4 = 0 THEN 15000
    WHEN n % 4 = 1 THEN 8000
    WHEN n % 4 = 2 THEN 5000
    ELSE 3500
  END,
  CASE
    WHEN n % 4 = 0 THEN 40.0
    WHEN n % 4 = 1 THEN 25.0
    WHEN n % 4 = 2 THEN 16.0
    ELSE 10.0
  END,
  'active',
  CASE
    WHEN n <= 40 THEN 'a0000000-0000-0000-0000-000000000001'::uuid  -- WH-HL
    ELSE 'a0000000-0000-0000-0000-000000000002'::uuid               -- WH-HP
  END
FROM generate_series(1, 70) AS n
ON CONFLICT (plate_number) DO UPDATE SET
  vehicle_type = EXCLUDED.vehicle_type, capacity_kg = EXCLUDED.capacity_kg, capacity_m3 = EXCLUDED.capacity_m3;

-- 70 Driver users
INSERT INTO users (id, username, password_hash, full_name, role, permissions, warehouse_ids)
SELECT
  ('f0000000-0000-0000-0000-' || LPAD(n::text, 12, '0'))::uuid,
  'driver' || LPAD(n::text, 2, '0'),
  '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', -- demo123
  (ARRAY['Phạm','Nguyễn','Trần','Lê','Hoàng','Vũ','Đặng','Bùi','Đỗ','Lương'])[1 + (n % 10)] || ' Văn ' ||
  (ARRAY['Đức','Hùng','Toàn','Dũng','Thắng','Long','Mạnh','Sáng','Hải','Tùng','Vinh','Quân','Trung','Cường','Minh','Nam','Phong','Bảo','Khải','An'])[1 + (n % 20)],
  'driver',
  ARRAY['trip:view', 'epod:create'],
  CASE
    WHEN n <= 40 THEN ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]  -- WH-HL
    ELSE ARRAY['a0000000-0000-0000-0000-000000000002']::uuid[]               -- WH-HP
  END
FROM generate_series(1, 70) AS n
ON CONFLICT (username) DO NOTHING;

-- 70 Driver records linked to users
INSERT INTO drivers (id, user_id, full_name, phone, license_number, status, warehouse_id)
SELECT
  ('f1000000-0000-0000-0000-' || LPAD(n::text, 12, '0'))::uuid,
  u.id,
  u.full_name,
  '09' || LPAD((87654000 + n)::text, 8, '0'),
  'B2-' || LPAD((100000 + n)::text, 6, '0'),
  'active',
  CASE
    WHEN n <= 40 THEN 'a0000000-0000-0000-0000-000000000001'::uuid
    ELSE 'a0000000-0000-0000-0000-000000000002'::uuid
  END
FROM generate_series(1, 70) AS n
JOIN users u ON u.id = ('f0000000-0000-0000-0000-' || LPAD(n::text, 12, '0'))::uuid
ON CONFLICT DO NOTHING;

-- ===================================================
-- TASK 4.4: 500 DELIVERY ROUTES
-- ===================================================
-- 50 main routes assigned to 800 NPP (~16 NPP/route), spread across 2 warehouses
-- Plus 450 sub-routes for seasonal/event coverage

INSERT INTO delivery_routes (code, name, warehouse_id, customer_ids)
SELECT
  'R' || LPAD(n::text, 2, '0'),
  CASE
    WHEN n <= 6  THEN 'Tuyến Quảng Ninh ' || n
    WHEN n <= 12 THEN 'Tuyến Hải Phòng ' || (n - 6)
    WHEN n <= 18 THEN 'Tuyến Hải Dương ' || (n - 12)
    WHEN n <= 24 THEN 'Tuyến Bắc Ninh ' || (n - 18)
    WHEN n <= 30 THEN 'Tuyến Thái Bình ' || (n - 24)
    WHEN n <= 36 THEN 'Tuyến Nam Định ' || (n - 30)
    WHEN n <= 42 THEN 'Tuyến Lạng Sơn ' || (n - 36)
    ELSE 'Tuyến Bắc Giang ' || (n - 42)
  END,
  CASE
    WHEN n <= 25 THEN 'a0000000-0000-0000-0000-000000000001'::uuid  -- WH-HL
    ELSE 'a0000000-0000-0000-0000-000000000002'::uuid               -- WH-HP
  END,
  (SELECT ARRAY_AGG(id) FROM customers WHERE route_code = 'R' || LPAD(n::text, 2, '0'))
FROM generate_series(1, 50) AS n
ON CONFLICT (code) DO UPDATE SET
  customer_ids = EXCLUDED.customer_ids,
  name = EXCLUDED.name;

-- Additional 450 seasonal/event sub-routes
INSERT INTO delivery_routes (code, name, warehouse_id, customer_ids)
SELECT
  'RS' || LPAD(n::text, 3, '0'),
  'Tuyến phụ ' || n || ' - ' ||
  CASE
    WHEN n % 5 = 0 THEN 'Lễ Tết'
    WHEN n % 5 = 1 THEN 'Mùa hè'
    WHEN n % 5 = 2 THEN 'Cuối tuần'
    WHEN n % 5 = 3 THEN 'Sự kiện'
    ELSE 'Bổ sung'
  END,
  CASE
    WHEN n % 2 = 0 THEN 'a0000000-0000-0000-0000-000000000001'::uuid
    ELSE 'a0000000-0000-0000-0000-000000000002'::uuid
  END,
  -- Each sub-route picks 8-12 random customers from the main routes
  (SELECT ARRAY_AGG(id) FROM (
    SELECT id FROM customers ORDER BY random() LIMIT (8 + (n % 5))
  ) sub)
FROM generate_series(1, 450) AS n
ON CONFLICT (code) DO NOTHING;

-- ===================================================
-- TASK 4.5: CREDIT BALANCES (Bravo sync)
-- ===================================================
-- Set credit limits for all 800 NPPs
-- Small NPP: 100-300M, Medium: 300-600M, Large: 600M-1B
INSERT INTO credit_limits (customer_id, credit_limit)
SELECT
  c.id,
  CASE
    WHEN c.code LIKE 'NPP-0__' THEN (300 + (random() * 500)::int) * 1000000  -- First 100: high limit
    WHEN c.code LIKE 'NPP-1__' THEN (200 + (random() * 400)::int) * 1000000  -- 100-199
    WHEN c.code LIKE 'NPP-2__' THEN (150 + (random() * 300)::int) * 1000000  -- 200-299
    ELSE (100 + (random() * 200)::int) * 1000000                              -- 300+
  END
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM credit_limits cl WHERE cl.customer_id = c.id)
ON CONFLICT DO NOTHING;

-- ===================================================
-- TASK 4.6: ASSET BALANCES (vỏ chai/két/keg)
-- ===================================================
-- Each NPP starts with a baseline of returnable assets
-- This represents the outstanding deposit assets at NPP locations
INSERT INTO asset_ledger (customer_id, asset_type, direction, quantity, condition, reference_type, reference_id, notes)
SELECT
  c.id,
  asset_t::asset_type,
  'out'::asset_direction,
  CASE asset_t
    WHEN 'bottle' THEN (5 + (random() * 50)::int)   -- 5-55 két vỏ chai
    WHEN 'crate' THEN (3 + (random() * 30)::int)     -- 3-33 két nhựa
    WHEN 'keg' THEN (1 + (random() * 5)::int)         -- 1-6 keg
  END,
  'good'::asset_condition,
  'migration',
  gen_random_uuid(),
  'Số dư đầu kỳ - Migration'
FROM customers c
CROSS JOIN (VALUES ('bottle'), ('crate'), ('keg')) AS assets(asset_t)
WHERE c.code LIKE 'NPP-%'
  AND random() < 0.7  -- 70% of NPPs have each asset type
ON CONFLICT DO NOTHING;

-- ===================================================
-- SUMMARY COUNTS (for verification)
-- ===================================================
DO $$
DECLARE
  cnt_customers INTEGER;
  cnt_products INTEGER;
  cnt_vehicles INTEGER;
  cnt_drivers INTEGER;
  cnt_routes INTEGER;
  cnt_credits INTEGER;
  cnt_assets INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt_customers FROM customers;
  SELECT COUNT(*) INTO cnt_products FROM products;
  SELECT COUNT(*) INTO cnt_vehicles FROM vehicles;
  SELECT COUNT(*) INTO cnt_drivers FROM drivers;
  SELECT COUNT(*) INTO cnt_routes FROM delivery_routes;
  SELECT COUNT(*) INTO cnt_credits FROM credit_limits;
  SELECT COUNT(*) INTO cnt_assets FROM asset_ledger;

  RAISE NOTICE '=== SEED DATA SUMMARY ===';
  RAISE NOTICE 'Customers (NPP): %', cnt_customers;
  RAISE NOTICE 'Products: %', cnt_products;
  RAISE NOTICE 'Vehicles: %', cnt_vehicles;
  RAISE NOTICE 'Drivers: %', cnt_drivers;
  RAISE NOTICE 'Routes: %', cnt_routes;
  RAISE NOTICE 'Credit limits: %', cnt_credits;
  RAISE NOTICE 'Asset ledger entries: %', cnt_assets;
END $$;
