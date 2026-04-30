-- ================================================================
-- Seed xe + tai xe thuc te Cong ty BHL
-- Moc tham chieu: 23/04/2026 — da xac nhan tu DB
--
-- Phan bo thuc te:
--   Kho Ha Long  (WH-HL): 50 xe (5×3t5, 5×5t, 40×8t), 41 tai xe
--   Kho Dong Mai (WH-DM):  8 xe (2×3t5, 3×5t, 3×8t),   9 tai xe
--
-- QUAN TRONG: Khong tao them xe/tai xe ngoai danh sach nay.
-- QA8T-VRP-* la xe test gia, da duoc danh dau inactive trong migration 048.
-- ================================================================

-- ================================================================
-- VEHICLES — Kho Ha Long (WH-HL): 50 xe thuc
-- ================================================================
INSERT INTO vehicles (plate_number, vehicle_type, capacity_kg, capacity_m3, status, warehouse_id)
VALUES
  -- truck_3t5 (5 xe)
  ('14C26445T', 'truck_3t5', 3500, 12.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C26594T', 'truck_3t5', 3500, 12.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C30113T', 'truck_3t5', 3500, 12.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C30190T', 'truck_3t5', 3500, 12.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14M8012',   'truck_3t5', 3500, 12.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  -- truck_5t (5 xe)
  ('14C19245T', 'truck_5t',  5000, 18.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C23267T', 'truck_5t',  5000, 18.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C26481T', 'truck_5t',  5000, 18.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C26577T', 'truck_5t',  5000, 18.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C30108T', 'truck_5t',  5000, 18.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  -- truck_8t — bien 14C (30 xe)
  ('14C12129T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C12157T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C16737T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C16797T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C19190T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C19301T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C19436T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C19586T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C19613T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C19648T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C19665T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C20679T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C20780T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C22971T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C23017T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C23092T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C23119T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C23179T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C23193T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C26320T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C26421T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C26495T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C26525T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C26526T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C26533T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C30013T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C30043T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C30109T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C30223T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14C30246T', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  -- truck_8t — bien 14M/14N/14P (10 xe)
  ('14M0641',   'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14M1802',   'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14M1950',   'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14M2320',   'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14M2390',   'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14M4540',   'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14M6537',   'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14N1262',   'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14P2848',   'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001'),
  ('14P4637',   'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (plate_number) DO UPDATE
  SET vehicle_type = EXCLUDED.vehicle_type,
      capacity_kg  = EXCLUDED.capacity_kg,
      capacity_m3  = EXCLUDED.capacity_m3,
      warehouse_id = EXCLUDED.warehouse_id,
      updated_at   = NOW();

-- ================================================================
-- VEHICLES — Kho Dong Mai (WH-DM): 8 xe
-- ================================================================
INSERT INTO vehicles (plate_number, vehicle_type, capacity_kg, capacity_m3, status, warehouse_id)
VALUES
  ('14H00904V', 'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000002'),
  ('15C-21001',  'truck_5t',  5000, 18.0, 'active', 'a0000000-0000-0000-0000-000000000002'),
  ('15C-21002',  'truck_5t',  5000, 18.0, 'active', 'a0000000-0000-0000-0000-000000000002'),
  ('15C-21003',  'truck_5t',  5000, 18.0, 'active', 'a0000000-0000-0000-0000-000000000002'),
  ('15C-21004',  'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000002'),
  ('15C-21005',  'truck_8t',  8000, 28.0, 'active', 'a0000000-0000-0000-0000-000000000002'),
  ('15C-21006',  'truck_3t5', 3500, 12.0, 'active', 'a0000000-0000-0000-0000-000000000002'),
  ('15C-21007',  'truck_3t5', 3500, 12.0, 'active', 'a0000000-0000-0000-0000-000000000002')
ON CONFLICT (plate_number) DO UPDATE
  SET vehicle_type = EXCLUDED.vehicle_type,
      capacity_kg  = EXCLUDED.capacity_kg,
      capacity_m3  = EXCLUDED.capacity_m3,
      warehouse_id = EXCLUDED.warehouse_id,
      updated_at   = NOW();

-- ================================================================
-- DRIVER USERS (50 tai xe thuc te — username chinh xac tu he thong)
-- Password: demo123
-- ================================================================
INSERT INTO users (username, password_hash, full_name, role, warehouse_ids)
VALUES
  -- WH-HL (41 nguoi)
  ('b.nguyen',     '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'B. Nguyen',    'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('chi.nguyen',   '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Chi Nguyen',   'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('chung.nguyen', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Chung Nguyen', 'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('cuong.doan',   '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Cuong Doan',   'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('cuong.ngo',    '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Cuong Ngo',    'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('cuong.nguyen', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Cuong Nguyen', 'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('cuong.nung',   '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Cuong Nung',   'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('cuong.pham',   '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Cuong Pham',   'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('dinh.le',      '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Dinh Le',      'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('dung.do',      '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Dung Do',      'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('dung.vu',      '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Dung Vu',      'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('hai.doan',     '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hai Doan',     'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('hien.luu',     '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hien Luu',     'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('hoa.vu',       '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hoa Vu',       'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('hoang.nguyen', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hoang Nguyen', 'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('hoi.pham',     '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hoi Pham',     'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('hong.tran',    '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hong Tran',    'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('hong.vu',      '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hong Vu',      'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('hung.nguyen',  '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hung Nguyen',  'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('hung.pham',    '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hung Pham',    'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('lam.le',       '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Lam Le',       'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('mien.ha',      '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Mien Ha',      'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('nam.nguyen',   '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Nam Nguyen',   'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('nhat.bui',     '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Nhat Bui',     'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('ninh.dang',    '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Ninh Dang',    'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('phoc.vo',      '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Phoc Vo',      'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('phuc.vu',      '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Phuc Vu',      'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('quan.bui',     '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Quan Bui',     'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('quan.tran',    '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Quan Tran',    'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('quynh.nguyen', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Quynh Nguyen', 'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('quynh.vu',     '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Quynh Vu',     'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('son.doan',     '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Son Doan',     'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('thanh.bui',    '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Thanh Bui',    'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('thanh.vu',     '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Thanh Vu',     'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('thuan.pham',   '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Thuan Pham',   'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('tien.nguyen',  '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Tien Nguyen',  'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('toan.luong',   '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Toan Luong',   'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('trong.doan',   '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Trong Doan',   'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('tuan.vu',      '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Tuan Vu',      'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('tuyen.ha',     '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Tuyen Ha',     'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  ('van.nguyen',   '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Van Nguyen',   'driver', ARRAY['a0000000-0000-0000-0000-000000000001']::uuid[]),
  -- WH-DM (9 nguoi)
  ('a.hoang',      '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'A. Hoang',     'driver', ARRAY['a0000000-0000-0000-0000-000000000002']::uuid[]),
  ('chuyen.tran',  '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Chuyen Tran',  'driver', ARRAY['a0000000-0000-0000-0000-000000000002']::uuid[]),
  ('hao.le',       '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hao Le',       'driver', ARRAY['a0000000-0000-0000-0000-000000000002']::uuid[]),
  ('hiep.dang',    '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hiep Dang',    'driver', ARRAY['a0000000-0000-0000-0000-000000000002']::uuid[]),
  ('lap.tran',     '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Lap Tran',     'driver', ARRAY['a0000000-0000-0000-0000-000000000002']::uuid[]),
  ('son.nguyen',   '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Son Nguyen',   'driver', ARRAY['a0000000-0000-0000-0000-000000000002']::uuid[]),
  ('thuy.pham',    '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Thuy Pham',    'driver', ARRAY['a0000000-0000-0000-0000-000000000002']::uuid[]),
  ('tien.tran',    '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Tien Tran',    'driver', ARRAY['a0000000-0000-0000-0000-000000000002']::uuid[]),
  ('tung.le',      '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Tung Le',      'driver', ARRAY['a0000000-0000-0000-0000-000000000002']::uuid[])
ON CONFLICT (username) DO NOTHING;

-- ================================================================
-- PHAN TICH NHANH (THAM KHAO):
-- ================================================================
-- WH-HL (Kho Ha Long): 50 xe, 41 tai xe
--   3t5 (5xe): 14C26445T, 14C26594T, 14C30113T, 14C30190T, 14M8012
--   5t  (5xe): 14C19245T, 14C23267T, 14C26481T, 14C26577T, 14C30108T
--   8t (40xe): 14C12129T..14C30246T, 14M0641..14M6537, 14N1262, 14P2848, 14P4637
--
-- WH-DM (Kho Dong Mai): 8 xe, 9 tai xe
--   Xe: 14H00904V, 15C-21001..15C-21007
--
-- Cap nhat truoc day: bien so dang dung format fake 14C-00101..
-- Sau migration 048: QA8T-VRP-* da duoc danh dau inactive
-- ================================================================
