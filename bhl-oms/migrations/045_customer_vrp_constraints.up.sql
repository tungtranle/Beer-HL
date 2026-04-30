-- 045: VRP delivery constraints per customer (NPP)
-- Mục tiêu: Cho phép NPP khai báo: tải trọng xe tối đa, khung giờ nhận hàng,
--           giờ cấm, đường cấm, ghi chú tiếp cận. VRP solver dùng để filter.
--
-- Decision (xem DECISIONS.md):
--   • KHÔNG tạo bảng traffic_zones riêng (over-engineering cho 800 NPP, 1 thành phố Hạ Long).
--   • Dùng JSONB delivery_windows + forbidden_windows trên customers — đủ flexibility,
--     query bằng GIN index nếu cần.
--   • access_notes là text tự do cho dispatcher xem khi planning.
--   • max_vehicle_weight_kg = 0 nghĩa là không hạn chế.

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS max_vehicle_weight_kg INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS delivery_windows JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS forbidden_windows JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS access_notes TEXT;

COMMENT ON COLUMN customers.max_vehicle_weight_kg IS
    'Tải trọng xe tối đa được phép giao (kg). 0 = không giới hạn. VD: 5000 = chỉ xe ≤5T.';
COMMENT ON COLUMN customers.delivery_windows IS
    'Khung giờ NHẬN hàng. JSONB array: [{"days":[1,2,3,4,5,6],"start":"06:00","end":"11:00"}].';
COMMENT ON COLUMN customers.forbidden_windows IS
    'Khung giờ CẤM giao (vd cấm tải nội đô). JSONB array: [{"days":[1..7],"start":"06:00","end":"09:00","reason":"cấm tải"}].';
COMMENT ON COLUMN customers.access_notes IS
    'Ghi chú tiếp cận: cổng nhỏ, đường vòng, liên hệ ai... Hiển thị trên planning + driver app.';

-- Sample seed: 5 NPP đầu có ràng buộc demo
UPDATE customers SET
    max_vehicle_weight_kg = 5000,
    delivery_windows = '[{"days":[1,2,3,4,5,6],"start":"06:00","end":"11:00"},{"days":[1,2,3,4,5,6],"start":"14:00","end":"17:00"}]'::jsonb,
    forbidden_windows = '[{"days":[1,2,3,4,5,6,7],"start":"06:00","end":"09:00","reason":"Cấm tải nội đô Hạ Long"}]'::jsonb,
    access_notes = 'Cổng phụ phía sau chợ. Liên hệ anh Hưng 0912xxx trước khi tới.'
WHERE code IN (SELECT code FROM customers WHERE is_active = true ORDER BY code LIMIT 5);
