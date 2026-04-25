-- ============================================================
-- SEED MASTER DATA — Nguồn sự thật duy nhất cho master data
-- Chạy sau mỗi deploy để đảm bảo data đồng bộ
-- IDEMPOTENT: dùng ON CONFLICT DO UPDATE, an toàn để chạy nhiều lần
-- KHÔNG xóa dữ liệu cũ, KHÔNG reset password users đã đổi
-- ============================================================
-- Mật khẩu mặc định cho users mới: Admin@123
-- Hash: $2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK
-- ============================================================

BEGIN;

-- ===================================================
-- USERS — Danh sách users chuẩn
-- ON CONFLICT (username): cập nhật role/full_name/is_active/permissions
-- KHÔNG cập nhật password_hash (giữ nguyên mật khẩu người dùng đã đổi)
-- ===================================================

INSERT INTO users (id, username, password_hash, full_name, role, permissions, is_active) VALUES

-- ===== ADMIN =====
('b0000000-0000-0000-0000-000000000001', 'admin',         '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Admin Hệ thống',      'admin',      ARRAY['*'],                                                                   true),
('b0000000-0000-0000-0000-000000000013', 'manager01',     '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Trưởng phòng KD',     'admin',      ARRAY['*'],                                                                   true),
('0b615d94-62a6-45bf-9567-bdf1fc2ea3d8', 'management',   '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Management',          'management', ARRAY[]::text[],                                                              true),

-- ===== DISPATCHER =====
('b0000000-0000-0000-0000-000000000003', 'dispatcher01',  '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Trần Văn Minh',       'dispatcher', ARRAY['order:create','order:view','planning:run','planning:approve','trip:view','trip:assign'], true),
('ca44fad9-e628-4c19-9ddf-c65c070287e5', 'dispatcher.hl','$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Dispatcher HL',       'dispatcher', ARRAY[]::text[],                                                              true),
('b57bc1b8-a2f4-4633-b35a-ea3af2cb2855', 'dispatcher.hp','$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Dispatcher HP',       'dispatcher', ARRAY[]::text[],                                                              true),

-- ===== ACCOUNTANT =====
('b0000000-0000-0000-0000-000000000004', 'accountant01',  '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Lê Thị Mai',          'accountant', ARRAY['order:view','order:approve','payment:view','report:view'],              true),
('71914477-8aab-4df2-8c46-0912ded986f0', 'accountant',   '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Accountant',          'accountant', ARRAY[]::text[],                                                              true),
('a153e68e-2fc0-4004-af57-1b3a9343e77a', 'accountant2',  '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Accountant 2',        'accountant', ARRAY[]::text[],                                                              true),

-- ===== DVKH =====
('b0000000-0000-0000-0000-000000000002', 'dvkh01',        '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Nguyễn Thị Hoa',      'dvkh',       ARRAY['order:create','order:view','customer:view','product:view'],             true),
('14bf4ec7-4704-450c-909e-94d4967ccdd2', 'dvkh',         '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'DVKH',                'dvkh',       ARRAY[]::text[],                                                              true),

-- ===== WAREHOUSE HANDLER =====
('b7f73f6e-e07e-447c-b1c6-47895a1fb6ad', 'wh.handler.hl','$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Warehouse Handler HL','warehouse_handler', ARRAY[]::text[],                                                   true),
('36ecae90-7c1b-4029-891d-e508532148ee', 'wh.handler.hp','$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Warehouse Handler HP','warehouse_handler', ARRAY[]::text[],                                                   true),

-- ===== SECURITY =====
('58e52a31-f61a-4fb5-993d-a313dcc06bc1', 'security.hl',  '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Security HL',         'security',   ARRAY[]::text[],                                                              true),
('3a8c642d-f69e-4fe1-9d22-5bba361b9d1c', 'security.hp',  '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Security HP',         'security',   ARRAY[]::text[],                                                              true),

-- ===== WORKSHOP =====
('d2e3278c-37cf-4d5c-8941-15804b168a2a', 'workshop',     '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Workshop',            'workshop',   ARRAY[]::text[],                                                              true),

-- ===== DRIVERS (driver01–08, seed gốc) =====
('b0000000-0000-0000-0000-000000000005', 'driver01', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Phạm Văn Đức',    'driver', ARRAY['trip:view','epod:create'], true),
('b0000000-0000-0000-0000-000000000006', 'driver02', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Nguyễn Văn Hùng', 'driver', ARRAY['trip:view','epod:create'], true),
('b0000000-0000-0000-0000-000000000007', 'driver03', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Trần Văn Toàn',   'driver', ARRAY['trip:view','epod:create'], true),
('b0000000-0000-0000-0000-000000000008', 'driver04', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Lê Văn Dũng',     'driver', ARRAY['trip:view','epod:create'], true),
('b0000000-0000-0000-0000-000000000009', 'driver05', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hoàng Văn Thắng', 'driver', ARRAY['trip:view','epod:create'], true),
('b0000000-0000-0000-0000-000000000010', 'driver06', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Vũ Văn Long',     'driver', ARRAY['trip:view','epod:create'], true),
('b0000000-0000-0000-0000-000000000011', 'driver07', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Đỗ Văn Mạnh',     'driver', ARRAY['trip:view','epod:create'], true),
('b0000000-0000-0000-0000-000000000012', 'driver08', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Bùi Văn Sáng',    'driver', ARRAY['trip:view','epod:create'], true),

-- ===== DRIVERS (driver09–70, extended) =====
('f0000000-0000-0000-0000-000000000009', 'driver09', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Lương Văn Tùng',  'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000010', 'driver10', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Phạm Văn Vinh',   'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000011', 'driver11', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Nguyễn Văn Quân', 'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000012', 'driver12', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Trần Văn Trung',  'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000013', 'driver13', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Lê Văn Cường',    'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000014', 'driver14', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hoàng Văn Minh',  'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000015', 'driver15', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Vũ Văn Nam',      'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000016', 'driver16', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Đặng Văn Phong',  'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000017', 'driver17', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Bùi Văn Bảo',     'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000018', 'driver18', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Đỗ Văn Khải',     'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000019', 'driver19', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Lương Văn An',    'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000020', 'driver20', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Phạm Văn Đức',    'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000021', 'driver21', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Nguyễn Văn Hùng', 'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000022', 'driver22', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Trần Văn Toàn',   'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000023', 'driver23', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Lê Văn Dũng',     'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000024', 'driver24', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hoàng Văn Thắng', 'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000025', 'driver25', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Vũ Văn Long',     'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000026', 'driver26', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Đặng Văn Mạnh',   'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000027', 'driver27', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Bùi Văn Sáng',    'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000028', 'driver28', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Đỗ Văn Hải',      'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000029', 'driver29', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Lương Văn Tùng',  'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000030', 'driver30', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Phạm Văn Vinh',   'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000031', 'driver31', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Nguyễn Văn Quân', 'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000032', 'driver32', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Trần Văn Trung',  'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000033', 'driver33', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Lê Văn Cường',    'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000034', 'driver34', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hoàng Văn Minh',  'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000035', 'driver35', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Vũ Văn Nam',      'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000036', 'driver36', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Đặng Văn Phong',  'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000037', 'driver37', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Bùi Văn Bảo',     'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000038', 'driver38', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Đỗ Văn Khải',     'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000039', 'driver39', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Lương Văn An',    'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000040', 'driver40', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Phạm Văn Đức',    'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000041', 'driver41', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Nguyễn Văn Hùng', 'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000042', 'driver42', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Trần Văn Toàn',   'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000043', 'driver43', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Lê Văn Dũng',     'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000044', 'driver44', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hoàng Văn Thắng', 'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000045', 'driver45', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Vũ Văn Long',     'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000046', 'driver46', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Đặng Văn Mạnh',   'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000047', 'driver47', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Bùi Văn Sáng',    'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000048', 'driver48', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Đỗ Văn Hải',      'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000049', 'driver49', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Lương Văn Tùng',  'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000050', 'driver50', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Phạm Văn Vinh',   'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000051', 'driver51', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Nguyễn Văn Quân', 'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000052', 'driver52', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Trần Văn Trung',  'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000053', 'driver53', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Lê Văn Cường',    'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000054', 'driver54', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hoàng Văn Minh',  'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000055', 'driver55', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Vũ Văn Nam',      'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000056', 'driver56', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Đặng Văn Phong',  'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000057', 'driver57', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Bùi Văn Bảo',     'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000058', 'driver58', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Đỗ Văn Khải',     'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000059', 'driver59', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Lương Văn An',    'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000060', 'driver60', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Phạm Văn Đức',    'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000061', 'driver61', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Nguyễn Văn Hùng', 'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000062', 'driver62', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Trần Văn Toàn',   'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000063', 'driver63', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Lê Văn Dũng',     'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000064', 'driver64', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Hoàng Văn Thắng', 'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000065', 'driver65', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Vũ Văn Long',     'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000066', 'driver66', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Đặng Văn Mạnh',   'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000067', 'driver67', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Bùi Văn Sáng',    'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000068', 'driver68', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Đỗ Văn Hải',      'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000069', 'driver69', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Lương Văn Tùng',  'driver', ARRAY['trip:view','epod:create'], true),
('f0000000-0000-0000-0000-000000000070', 'driver70', '$2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK', 'Phạm Văn Vinh',   'driver', ARRAY['trip:view','epod:create'], true)

ON CONFLICT (username) DO UPDATE SET
  role        = EXCLUDED.role,
  full_name   = EXCLUDED.full_name,
  is_active   = EXCLUDED.is_active,
  permissions = EXCLUDED.permissions,
  updated_at  = now()
  -- KHÔNG cập nhật password_hash: giữ mật khẩu đã đổi của người dùng
  -- KHÔNG cập nhật id: giữ UUID để FK references không bị vỡ
;

-- ===================================================
-- GHI CHÚ: Cách thêm user mới
-- ===================================================
-- 1. Thêm dòng INSERT vào file này (username phải unique)
-- 2. Commit + push lên GitHub
-- 3. Auto deploy sẽ chạy db-sync.sh → user xuất hiện trên server
--
-- Ví dụ thêm user mới:
-- ('gen_random_uuid()', 'ten.nhanvien', '<hash>', 'Tên Đầy Đủ', 'driver', ARRAY['trip:view','epod:create'], true),
-- Dùng hash: $2a$10$JoEl4RXE/c/cvSPQTy01ceDBSF6dy/3UsCcDh2vWD8gll0EFy7WlK = mật khẩu Admin@123
-- Để tạo hash mới: cd bhl-oms && go run cmd/_make_hash/main.go "matkhaumoi"
-- ===================================================

COMMIT;
