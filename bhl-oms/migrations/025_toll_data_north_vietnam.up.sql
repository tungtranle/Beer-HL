-- Migration 025: Cập nhật dữ liệu trạm thu phí toàn miền Bắc
-- Thay thế seed data cũ (7 trạm QN/HP) bằng dữ liệu chính xác hơn
-- Bao gồm: 15 trạm hở (quốc lộ) + 5 cao tốc kín + ~25 cổng vào/ra
-- GPS tọa độ xấp xỉ — detection_radius_m mở rộng để bù sai số

-- ═══════════════════════════════════════════════════════
-- 1. Xóa dữ liệu seed cũ (Migration 020)
-- ═══════════════════════════════════════════════════════

-- Xóa gates cũ trước (FK constraint)
DELETE FROM toll_expressway_gates
WHERE expressway_id IN (SELECT id FROM toll_expressways);

-- Xóa trạm hở cũ
DELETE FROM toll_stations;

-- Xóa cao tốc cũ
DELETE FROM toll_expressways;

-- ═══════════════════════════════════════════════════════
-- 2. Trạm thu phí hở (Quốc lộ) — phí cố định mỗi lượt
-- Quy ước nhóm xe:
--   L1: Dưới 12 chỗ, tải < 2 tấn
--   L2: 12-30 chỗ, tải 2-4 tấn
--   L3: Trên 31 chỗ, tải 4-10 tấn
--   L4: Tải 10-18 tấn, container 20ft
--   L5: Tải > 18 tấn, container 40ft
-- ═══════════════════════════════════════════════════════

INSERT INTO toll_stations (station_name, road_name, latitude, longitude, detection_radius_m, fee_l1, fee_l2, fee_l3, fee_l4, fee_l5, notes) VALUES
    -- Quốc Lộ 1A
    ('Phù Đổng',           'QL1A',  21.037, 105.941, 500, 35000, 50000, 75000, 120000, 180000, 'Hà Nội, QL1A'),

    -- Quốc Lộ 2
    ('Bắc Thăng Long',     'QL2',   21.196, 105.811, 500, 10000, 15000, 25000, 40000, 80000,   'Hà Nội, cầu Thăng Long'),
    ('Quất Lưu',           'QL2',   21.286, 105.617, 500, 35000, 50000, 75000, 120000, 180000, 'Vĩnh Phúc'),

    -- Quốc Lộ 3
    ('Bờ Đậu',             'QL3',   21.678, 105.742, 500, 35000, 50000, 75000, 120000, 180000, 'Thái Nguyên'),

    -- Quốc Lộ 5
    ('Trạm số 1 QL5',      'QL5',   20.975, 105.998, 500, 40000, 55000, 75000, 125000, 180000, 'Hưng Yên, QL5'),
    ('Trạm số 2 QL5',      'QL5',   20.875, 106.581, 500, 40000, 55000, 75000, 125000, 180000, 'Hải Phòng, QL5'),

    -- Quốc Lộ 6
    ('Lương Sơn',          'QL6',   20.865, 105.521, 500, 30000, 40000, 60000, 100000, 160000, 'Hòa Bình'),

    -- Quốc Lộ 10
    ('Tiên Cựu',           'QL10',  20.725, 106.481, 500, 35000, 50000, 75000, 120000, 180000, 'Hải Phòng, QL10'),
    ('Đông Hưng',          'QL10',  20.551, 106.332, 500, 35000, 50000, 75000, 120000, 180000, 'Thái Bình, QL10'),

    -- Quốc Lộ 18
    ('Phả Lại',            'QL18',  21.127, 106.289, 500, 35000, 50000, 75000, 120000, 180000, 'Bắc Ninh, QL18'),
    ('Đại Yên',            'QL18',  20.985, 107.012, 500, 30000, 45000, 65000, 110000, 170000, 'Quảng Ninh, QL18'),

    -- Quốc Lộ 21B
    ('Mỹ Lộc',             'QL21B', 20.463, 106.124, 500, 30000, 45000, 70000, 110000, 170000, 'Nam Định'),

    -- Quốc Lộ 32
    ('Tam Nông',           'QL32',  21.265, 105.289, 500, 35000, 50000, 75000, 120000, 180000, 'Phú Thọ'),

    -- Quốc Lộ 38
    ('Yên Lệnh',          'QL38',  20.627, 105.945, 500, 35000, 50000, 75000, 120000, 180000, 'Hà Nam, QL38'),
    ('Cầu Thái Hà',       'QL38',  20.581, 106.155, 500, 35000, 50000, 75000, 120000, 180000, 'Thái Bình, QL38');

-- ═══════════════════════════════════════════════════════
-- 3. Trạm cố định đặc biệt: Cầu Bạch Đằng (ranh HP-QN)
--    Trạm này thu phí cố định (không theo km), nhưng nằm trên
--    tuyến cao tốc HP-HL. Model: toll_station (phí cố định)
-- ═══════════════════════════════════════════════════════

INSERT INTO toll_stations (station_name, road_name, latitude, longitude, detection_radius_m, fee_l1, fee_l2, fee_l3, fee_l4, fee_l5, notes) VALUES
    ('Cầu Bạch Đằng',     'CT HP-QN', 20.841, 106.764, 600, 35000, 50000, 75000, 120000, 180000,
     'Ranh giới HP-QN. Thu phí cố định (không theo km). Tọa độ xấp xỉ.');

-- ═══════════════════════════════════════════════════════
-- 4. Cao tốc kín — tính phí theo km
--    Công thức: Quãng đường (km) × Đơn giá/km
--    Đơn giá user cung cấp cho L1, tỷ lệ L2-L5 dựa trên
--    pattern chuẩn ngành GTVT VN: L2≈1.43x, L3≈2x, L4≈3x, L5≈4.3x so với L1
-- ═══════════════════════════════════════════════════════

INSERT INTO toll_expressways (expressway_name, rate_per_km_l1, rate_per_km_l2, rate_per_km_l3, rate_per_km_l4, rate_per_km_l5, notes) VALUES
    -- CT Pháp Vân - Cầu Giẽ - Ninh Bình: L1 = 1500 VND/km
    ('CT Pháp Vân - Cầu Giẽ - Ninh Bình',
     1500, 2150, 3000, 4500, 6450,
     'Hà Nội → Ninh Bình. ~80km. L1=1500đ/km'),

    -- CT Hà Nội - Hải Phòng (QL5B): L1 = 2000 VND/km, max ~210K
    ('CT Hà Nội - Hải Phòng',
     2000, 2860, 4000, 6000, 8600,
     '105km. VIDIFI vận hành. Max toàn tuyến ~210K (L1). L1=2000đ/km'),

    -- CT Nội Bài - Lào Cai: L1 = 1500 VND/km, max ~300K
    ('CT Nội Bài - Lào Cai',
     1500, 2150, 3000, 4500, 6450,
     '265km. VEC vận hành. Max toàn tuyến ~300K (L1). L1=1500đ/km'),

    -- CT Hải Phòng - Hạ Long - Vân Đồn - Móng Cái: L1 ≈ 2000 VND/km
    ('CT Hải Phòng - Hạ Long - Vân Đồn - Móng Cái',
     2000, 2860, 4000, 6000, 8600,
     'Nhiều đoạn: HP-HL ~25km, HL-VĐ ~60km, VĐ-MC ~80km. L1≈1900-2100đ/km'),

    -- CT Bắc Giang - Lạng Sơn: L1 = 2100 VND/km, max ~135K
    ('CT Bắc Giang - Lạng Sơn',
     2100, 3000, 4200, 6300, 9030,
     '64km. Max toàn tuyến ~135K (L1). L1=2100đ/km');

-- ═══════════════════════════════════════════════════════
-- 5. Cổng vào/ra cao tốc (toll_expressway_gates)
--    detection_radius_m = 800 (GPS xấp xỉ, cần phạm vi rộng hơn)
-- ═══════════════════════════════════════════════════════

-- ─── 5a. CT Pháp Vân - Cầu Giẽ - Ninh Bình (6 cổng) ───
INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'Pháp Vân (Hà Nội)', 'entry_exit', 0, 20.949, 105.858, 800
FROM toll_expressways WHERE expressway_name = 'CT Pháp Vân - Cầu Giẽ - Ninh Bình';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'Thường Tín (Hà Nội)', 'entry_exit', 10, 20.871, 105.882, 800
FROM toll_expressways WHERE expressway_name = 'CT Pháp Vân - Cầu Giẽ - Ninh Bình';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'Vạn Điểm (Hà Nội)', 'entry_exit', 20, 20.785, 105.915, 800
FROM toll_expressways WHERE expressway_name = 'CT Pháp Vân - Cầu Giẽ - Ninh Bình';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'Vực Vòng (Hà Nam)', 'entry_exit', 40, 20.627, 105.945, 800
FROM toll_expressways WHERE expressway_name = 'CT Pháp Vân - Cầu Giẽ - Ninh Bình';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'Liêm Tuyền (Hà Nam)', 'entry_exit', 55, 20.518, 105.976, 800
FROM toll_expressways WHERE expressway_name = 'CT Pháp Vân - Cầu Giẽ - Ninh Bình';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'Cao Bồ (Nam Định)', 'entry_exit', 80, 20.252, 106.012, 800
FROM toll_expressways WHERE expressway_name = 'CT Pháp Vân - Cầu Giẽ - Ninh Bình';

-- ─── 5b. CT Hà Nội - Hải Phòng (6 cổng) ───
INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'Đầu tuyến Km10 (Hà Nội)', 'entry_exit', 0, 20.977, 105.952, 800
FROM toll_expressways WHERE expressway_name = 'CT Hà Nội - Hải Phòng';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'QL39 - Yên Mỹ (Hưng Yên)', 'entry_exit', 25, 20.892, 106.035, 800
FROM toll_expressways WHERE expressway_name = 'CT Hà Nội - Hải Phòng';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'QL38B - Gia Lộc (Hải Dương)', 'entry_exit', 52, 20.815, 106.291, 800
FROM toll_expressways WHERE expressway_name = 'CT Hà Nội - Hải Phòng';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'QL10 - An Lão (Hải Phòng)', 'entry_exit', 73, 20.801, 106.535, 800
FROM toll_expressways WHERE expressway_name = 'CT Hà Nội - Hải Phòng';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'TL353 - Đồ Sơn (Hải Phòng)', 'entry_exit', 90, 20.806, 106.664, 800
FROM toll_expressways WHERE expressway_name = 'CT Hà Nội - Hải Phòng';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'Đình Vũ (Hải Phòng)', 'entry_exit', 105, 20.825, 106.745, 800
FROM toll_expressways WHERE expressway_name = 'CT Hà Nội - Hải Phòng';

-- ─── 5c. CT Nội Bài - Lào Cai (6 cổng) ───
INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'Km6 Sóc Sơn (Hà Nội)', 'entry_exit', 0, 21.242, 105.795, 800
FROM toll_expressways WHERE expressway_name = 'CT Nội Bài - Lào Cai';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'IC3 Bình Xuyên (Vĩnh Phúc)', 'entry_exit', 25, 21.285, 105.655, 800
FROM toll_expressways WHERE expressway_name = 'CT Nội Bài - Lào Cai';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'IC4 Tam Đảo (Vĩnh Phúc)', 'entry_exit', 40, 21.321, 105.589, 800
FROM toll_expressways WHERE expressway_name = 'CT Nội Bài - Lào Cai';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'IC8 Phù Ninh (Phú Thọ)', 'entry_exit', 85, 21.421, 105.285, 800
FROM toll_expressways WHERE expressway_name = 'CT Nội Bài - Lào Cai';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'IC12 Trấn Yên (Yên Bái)', 'entry_exit', 155, 21.651, 104.892, 800
FROM toll_expressways WHERE expressway_name = 'CT Nội Bài - Lào Cai';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'Km237 Lào Cai', 'entry_exit', 237, 22.451, 103.985, 800
FROM toll_expressways WHERE expressway_name = 'CT Nội Bài - Lào Cai';

-- ─── 5d. CT Hải Phòng - Hạ Long - Vân Đồn - Móng Cái (4 cổng) ───
-- Lưu ý: Cầu Bạch Đằng đã được model riêng ở toll_stations (phí cố định)
-- Ở đây model cổng trên đoạn cao tốc tính phí theo km
INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'Cầu Bạch Đằng (Ranh HP-QN)', 'entry_exit', 0, 20.841, 106.764, 800
FROM toll_expressways WHERE expressway_name = 'CT Hải Phòng - Hạ Long - Vân Đồn - Móng Cái';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'Hạ Long - Vân Đồn', 'entry_exit', 60, 21.012, 107.315, 800
FROM toll_expressways WHERE expressway_name = 'CT Hải Phòng - Hạ Long - Vân Đồn - Móng Cái';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'Tiên Yên (Vân Đồn - Móng Cái)', 'entry_exit', 100, 21.295, 107.412, 800
FROM toll_expressways WHERE expressway_name = 'CT Hải Phòng - Hạ Long - Vân Đồn - Móng Cái';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'Hải Hà (Móng Cái)', 'entry_exit', 165, 21.481, 107.751, 800
FROM toll_expressways WHERE expressway_name = 'CT Hải Phòng - Hạ Long - Vân Đồn - Móng Cái';

-- ─── 5e. CT Bắc Giang - Lạng Sơn (2 cổng) ───
INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'Km93 (Bắc Giang)', 'entry_exit', 0, 21.391, 106.295, 800
FROM toll_expressways WHERE expressway_name = 'CT Bắc Giang - Lạng Sơn';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, gate_type, km_marker, latitude, longitude, detection_radius_m)
SELECT id, 'QL279 (Lạng Sơn)', 'entry_exit', 64, 21.512, 106.451, 800
FROM toll_expressways WHERE expressway_name = 'CT Bắc Giang - Lạng Sơn';
