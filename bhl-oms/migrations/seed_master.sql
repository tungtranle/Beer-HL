-- ============================================================
-- SEED MASTER DATA — Nguồn sự thật duy nhất cho master data
-- FILE NÀY ĐƯỢC GENERATE TỪ DB BẰNG: bash bhl-oms/scripts/export-users-seed.sh
-- Chạy sau mỗi deploy để đảm bảo data đồng bộ
-- IDEMPOTENT: dùng ON CONFLICT DO UPDATE, an toàn để chạy nhiều lần
-- KHÔNG xóa dữ liệu cũ, KHÔNG reset password users đã đổi
-- ============================================================

BEGIN;

INSERT INTO users (
  id,
  username,
  password_hash,
  full_name,
  role,
  permissions,
  warehouse_ids,
  email,
  is_active,
  is_chief_accountant
) VALUES
('9c30b7bf-3570-4d78-73bd-e6006fee9783', 'accountant', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Kế Toán Trưởng', 'accountant', ARRAY[]::text[], '{a0000000-0000-0000-0000-000000000001}'::uuid[], 'accountant@bhl.local', true, false),
('ae64d33e-2140-458f-94f7-e0140db2d3a4', 'accountant2', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Kế Toán Tổng Hợp', 'accountant', ARRAY[]::text[], '{a0000000-0000-0000-0000-000000000001}'::uuid[], 'accountant2@bhl.local', true, false),
('eb57be3f-e8a3-4b4e-d806-3e7863d25eb4', 'admin', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Quản Trị Hệ Thống', 'admin', ARRAY[]::text[], '{a0000000-0000-0000-0000-000000000001}'::uuid[], 'admin@bhl.local', true, false),
('e9f7c693-cd2a-45c2-4c8a-d13428e92bec', 'dispatcher.hl', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Điều Phối Hạ Long', 'dispatcher', ARRAY[]::text[], '{a0000000-0000-0000-0000-000000000001}'::uuid[], 'dispatcher.hl@bhl.local', true, false),
('55cf323c-bdab-496d-018e-942ce6284694', 'dispatcher.hp', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Điều Phối Hải Phòng', 'dispatcher', ARRAY[]::text[], '{a0000000-0000-0000-0000-000000000002}'::uuid[], 'dispatcher.hp@bhl.local', true, false),
('f6a446b7-bcd4-42f6-0ea6-5b80756a1dc1', 'a.hoang', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Hoàng Quốc Việt A', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'a.hoang@bhl.local', true, false),
('731142b1-c9a3-4ebe-1fdd-e449640b599a', 'b.nguyen', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Nguyễn Mạnh Hùng B', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'b.nguyen@bhl.local', true, false),
('a6c9faad-08de-4c62-e502-ed66fdcb6090', 'chi.nguyen', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Nguyễn Xuân Chí', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'chi.nguyen@bhl.local', true, false),
('0dba5525-05a3-4914-17d8-550d5a223b17', 'chung.nguyen', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Nguyễn Quang Chung', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'chung.nguyen@bhl.local', true, false),
('8eff1b12-2a93-48aa-2167-2bc66c094562', 'chuyen.tran', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Trần Đình Chuyển', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'chuyen.tran@bhl.local', true, false),
('cdd2dbdb-3cb6-40df-bebe-e8eec2d85e00', 'cuong.doan', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Đoàn Hùng Cường', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'cuong.doan@bhl.local', true, false),
('27ea2b14-8ba9-4c71-8af8-4abdca5b18d7', 'cuong.ngo', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Ngô Minh Cường', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'cuong.ngo@bhl.local', true, false),
('d3b58bba-d1f2-4cab-b9bb-b01dee3a34d3', 'cuong.nguyen', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Nguyễn Mạnh Cường', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'cuong.nguyen@bhl.local', true, false),
('610c6e62-c385-4463-001a-c4c683a1884c', 'cuong.nung', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Nùng Văn Cường', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'cuong.nung@bhl.local', true, false),
('b85839e4-7681-4c02-3176-316a76434d44', 'cuong.pham', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Phạm Hồng Cường', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'cuong.pham@bhl.local', true, false),
('f80ed122-6f7b-4d6c-7d50-5636c00a1963', 'dinh.le', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Lê Đức Định', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'dinh.le@bhl.local', true, false),
('51edb546-272f-4931-c6ff-a5f2aa489323', 'dung.do', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Đỗ Văn Dũng', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'dung.do@bhl.local', true, false),
('ff86db54-5f72-4b5b-4671-7b6c15ce837b', 'dung.vu', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Vũ Khắc Dũng', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'dung.vu@bhl.local', true, false),
('dec59071-a679-4756-2854-b7d2d9e3ef59', 'hai.doan', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Đoàn Thanh Hải', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'hai.doan@bhl.local', true, false),
('ac79e7cc-f568-49ed-3d8e-7a70a40df59c', 'hao.le', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Lê Thanh Hảo', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'hao.le@bhl.local', true, false),
('a3b4cdf5-2657-46fd-5a04-5a9ce1b9ea77', 'hien.luu', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Lưu Văn Hiền', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'hien.luu@bhl.local', true, false),
('35a91ff1-9476-4701-dd69-cddc27fc68e6', 'hiep.dang', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Đặng Vũ Thái Hiệp', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'hiep.dang@bhl.local', true, false),
('98eb1c41-c251-4b87-9068-78e58d5481d9', 'hoa.vu', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Vũ Xuân Hòa', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'hoa.vu@bhl.local', true, false),
('62848f03-568b-4c77-4755-50ab442a65a1', 'hoang.nguyen', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Nguyễn Huy Hoàng', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'hoang.nguyen@bhl.local', true, false),
('14cd659c-9a98-4d46-2a5a-34004cab4a3a', 'hoi.pham', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Phạm Quý Hợi', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'hoi.pham@bhl.local', true, false),
('51dfe9ac-e7d6-4951-9488-670a2736a198', 'hong.tran', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Trần Văn Hồng', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'hong.tran@bhl.local', true, false),
('6f6bd0bd-5012-404b-2887-ffed90da4f17', 'hong.vu', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Vũ Bách Hồng', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'hong.vu@bhl.local', true, false),
('40ab26e2-e488-40a7-6ba6-fc8af736f8a7', 'hung.nguyen', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Nguyễn Minh Hùng', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'hung.nguyen@bhl.local', true, false),
('f0f1cae3-0413-40e1-8157-e63c1a75da06', 'hung.pham', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Phạm Mạnh Hùng', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'hung.pham@bhl.local', true, false),
('a94605b8-1d5a-483b-ccbd-ad845c4ec611', 'lam.le', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Lê Văn Lâm', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'lam.le@bhl.local', true, false),
('bf174333-8fb3-4a40-90a0-6c4ceb6224b2', 'lap.tran', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Trần Trung Lập', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'lap.tran@bhl.local', true, false),
('881ec3ef-82c2-46d8-a421-53fb400094b3', 'mien.ha', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Hà Văn Miện', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'mien.ha@bhl.local', true, false),
('1e5c8cad-1323-40a8-e2d8-fa8a396c0d69', 'nam.nguyen', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Nguyễn Đại Nam', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'nam.nguyen@bhl.local', true, false),
('bddb343a-d59b-4b1f-fe73-3ed8b4129c77', 'nhat.bui', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Bùi Trọng Nhất', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'nhat.bui@bhl.local', true, false),
('9bd943cb-2edd-41c9-2a10-55667f332a1e', 'ninh.dang', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Đặng Đình Ninh', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'ninh.dang@bhl.local', true, false),
('dd754796-e41e-4608-2d5f-549e761758b5', 'phoc.vo', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Vò Hång Phóc', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'phoc.vo@bhl.local', true, false),
('f97d215a-4cf8-46a0-e9a3-8a139aa005f2', 'phuc.vu', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Vũ Hồng Phúc', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'phuc.vu@bhl.local', true, false),
('bfbe5b30-ce01-4194-280b-b80beff97715', 'quan.bui', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Bùi Thế Quân', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'quan.bui@bhl.local', true, false),
('061ae748-a906-432f-04f3-cc4bbaf7bb53', 'quan.tran', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Trần Văn Quân', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'quan.tran@bhl.local', true, false),
('71ff0f28-5898-48d6-ea4e-df91890502bb', 'quynh.nguyen', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Nguyễn Đắc Quỳnh', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'quynh.nguyen@bhl.local', true, false),
('cc9fa603-a715-45e9-b1c9-0bf046201605', 'quynh.vu', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Vũ Văn Quynh', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'quynh.vu@bhl.local', true, false),
('77440817-47f9-4037-cce9-a91386968ab1', 'son.doan', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Đoàn Thanh Sơn', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'son.doan@bhl.local', true, false),
('f4f50693-34ce-4778-b2bc-0788d96ad43b', 'son.nguyen', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Nguyễn Thái Sơn', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'son.nguyen@bhl.local', true, false),
('c8152258-559f-43f6-588f-e4439f998f6b', 'thanh.bui', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Bùi Huy Thành', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'thanh.bui@bhl.local', true, false),
('23f9c870-6485-4d0a-e0b4-f37df2971e8e', 'thanh.vu', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Vũ Ngọc Thanh', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'thanh.vu@bhl.local', true, false),
('d2eb945a-2259-462d-ddac-e3aed8122e98', 'thuan.pham', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Phạm Văn Thuân', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'thuan.pham@bhl.local', true, false),
('d12ef1c2-b06b-4670-c250-bc1298c65db6', 'thuy.pham', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Phạm Quốc Thụy', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'thuy.pham@bhl.local', true, false),
('617faab0-c585-43b5-1487-235960db3919', 'tien.nguyen', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Nguyễn Đức Tiến', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'tien.nguyen@bhl.local', true, false),
('9492dfd8-53a5-4c67-663d-21e77182677b', 'tien.tran', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Trần Văn Tiến', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'tien.tran@bhl.local', true, false),
('1627f282-fced-4839-1b43-d2593bbe80bf', 'toan.luong', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Lương Thanh Toàn', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'toan.luong@bhl.local', true, false),
('6639421c-513b-41f4-c386-352ff77da6db', 'trong.doan', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Đoàn Đức Trọng', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'trong.doan@bhl.local', true, false),
('4444c8fd-ca6c-46e9-85aa-1b4be08af844', 'tuan.vu', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Vũ Minh Tuấn', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'tuan.vu@bhl.local', true, false),
('acb49927-b85f-4627-5296-51e60d922f65', 'tung.le', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Lê Mạnh Tùng', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'tung.le@bhl.local', true, false),
('c63fd7c1-8b22-4d5d-6bb3-c061d751d04d', 'tuyen.ha', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Hà Văn Tuyên', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'tuyen.ha@bhl.local', true, false),
('ac1d5a9d-077f-40fb-9d5e-5ac39d356e6c', 'van.nguyen', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Nguyễn Duy Văn', 'driver', ARRAY[]::text[], ARRAY[]::uuid[], 'van.nguyen@bhl.local', true, false),
('39103d66-70c0-4f3f-8122-a115701fe43a', 'dvkh', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Nhân Viên DVKH', 'dvkh', ARRAY[]::text[], '{a0000000-0000-0000-0000-000000000001}'::uuid[], 'dvkh@bhl.local', true, false),
('c4eb0be3-6666-423d-e95f-5e599544b344', 'management', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Ban Lãnh Đạo', 'management', ARRAY[]::text[], '{a0000000-0000-0000-0000-000000000001}'::uuid[], 'management@bhl.local', true, false),
('e39a5104-4a2c-4708-4891-7a316d0053cd', 'security.hl', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Bảo Vệ Hạ Long', 'security', ARRAY[]::text[], '{a0000000-0000-0000-0000-000000000001}'::uuid[], 'security.hl@bhl.local', true, false),
('3d6b4c6c-6817-44bc-1fb7-a0533450a696', 'security.hp', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Bảo Vệ Hải Phòng', 'security', ARRAY[]::text[], '{a0000000-0000-0000-0000-000000000002}'::uuid[], 'security.hp@bhl.local', true, false),
('0e39b13a-4c5e-4ee8-d642-ac19f395cb16', 'wh.handler.hl', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Thủ Kho Hạ Long', 'warehouse_handler', ARRAY[]::text[], '{a0000000-0000-0000-0000-000000000001}'::uuid[], 'wh.handler.hl@bhl.local', true, false),
('114c67fe-0f4a-4d16-fb29-ad5679ce248f', 'wh.handler.hp', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Thủ Kho Hải Phòng', 'warehouse_handler', ARRAY[]::text[], '{a0000000-0000-0000-0000-000000000002}'::uuid[], 'wh.handler.hp@bhl.local', true, false),
('9f24101f-9493-44e0-1f2c-0b2f9646b1f5', 'workshop', '$2a$10$VwRQalAxJFxy71yg/9OYfOv7yFBxByFPDjcxKSXxr.FwLBFFkd3Y2', 'Kỹ Thuật Cơ Điện', 'workshop', ARRAY[]::text[], '{a0000000-0000-0000-0000-000000000001}'::uuid[], 'workshop@bhl.local', true, false)

ON CONFLICT (username) DO UPDATE SET
  full_name            = EXCLUDED.full_name,
  role                 = EXCLUDED.role,
  permissions          = EXCLUDED.permissions,
  warehouse_ids        = EXCLUDED.warehouse_ids,
  email                = EXCLUDED.email,
  is_active            = EXCLUDED.is_active,
  is_chief_accountant  = EXCLUDED.is_chief_accountant,
  updated_at           = now();

-- Cố ý KHÔNG update password_hash để tránh reset mật khẩu người dùng đã đổi trên server.

COMMIT;
