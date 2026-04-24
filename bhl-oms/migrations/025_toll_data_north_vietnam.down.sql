-- Migration 025 DOWN: Rollback dữ liệu trạm thu phí miền Bắc
-- Khôi phục lại seed data gốc từ Migration 020

-- Xóa gates mới
DELETE FROM toll_expressway_gates;

-- Xóa trạm hở mới
DELETE FROM toll_stations;

-- Xóa cao tốc mới
DELETE FROM toll_expressways;

-- ═══════════════════════════════════════════════════════
-- Khôi phục seed data từ Migration 020
-- ═══════════════════════════════════════════════════════

-- Trạm hở cũ
INSERT INTO toll_stations (station_name, road_name, latitude, longitude, fee_l1, fee_l2, fee_l3, fee_l4, fee_l5, notes) VALUES
    ('Trạm Đại Yên',     'QL18',  20.9556, 107.0103, 15000, 25000, 40000, 80000, 120000, 'Gần Hạ Long, trên QL18'),
    ('Trạm Bắc Phả',     'QL18',  20.9417, 106.7533, 15000, 25000, 40000, 80000, 120000, 'Giữa Uông Bí và Đông Triều'),
    ('Trạm Biên Cương',   'QL18',  21.3222, 107.3472, 20000, 30000, 50000, 100000, 150000, 'Gần Móng Cái'),
    ('Trạm Quảng Yên',    'QL10',  20.9342, 106.8150, 10000, 20000, 30000, 60000,  90000, 'QL10 đoạn Quảng Yên'),
    ('Trạm An Dương',     'QL5',   20.8900, 106.5800, 15000, 25000, 40000, 80000, 120000, 'QL5 Hải Phòng'),
    ('Trạm Phù Lỗ',      'QL3',   21.2000, 105.8900, 10000, 20000, 30000, 60000,  90000, 'QL3 Hà Nội - Thái Nguyên'),
    ('Trạm cầu Bãi Cháy', 'QL18', 20.9530, 107.0700, 10000, 15000, 25000, 50000,  80000, 'Cầu Bãi Cháy QL18');

-- Cao tốc cũ
INSERT INTO toll_expressways (expressway_name, rate_per_km_l1, rate_per_km_l2, rate_per_km_l3, rate_per_km_l4, rate_per_km_l5, notes) VALUES
    ('CT Hà Nội - Hải Phòng',   1400, 2000, 2800, 4200, 6000, '105km, VIDIFI vận hành'),
    ('CT Hải Phòng - Quảng Ninh', 1050, 1500, 2100, 3200, 4500, '25km, nối QL18 với CT HN-HP'),
    ('CT Hà Nội - Lào Cai',      1050, 1500, 2100, 3200, 4500, '265km, VEC vận hành'),
    ('CT Cầu Giẽ - Ninh Bình',   1050, 1500, 2100, 3200, 4500, '50km'),
    ('CT Bắc Giang - Lạng Sơn',  1400, 2100, 2900, 4400, 6300, '64km');

-- Gates cũ
INSERT INTO toll_expressway_gates (expressway_id, gate_name, km_marker, latitude, longitude)
SELECT id, 'Nút giao Đình Vũ (HP)', 0, 20.8304, 106.7247
FROM toll_expressways WHERE expressway_name = 'CT Hà Nội - Hải Phòng';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, km_marker, latitude, longitude)
SELECT id, 'Nút giao Quốc Oai (HN)', 105, 20.9890, 105.6600
FROM toll_expressways WHERE expressway_name = 'CT Hà Nội - Hải Phòng';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, km_marker, latitude, longitude)
SELECT id, 'IC Hưng Yên', 52, 20.8400, 106.1000
FROM toll_expressways WHERE expressway_name = 'CT Hà Nội - Hải Phòng';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, km_marker, latitude, longitude)
SELECT id, 'IC Hải Dương', 73, 20.8600, 106.3300
FROM toll_expressways WHERE expressway_name = 'CT Hà Nội - Hải Phòng';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, km_marker, latitude, longitude)
SELECT id, 'Nút giao Đình Vũ (HP)', 0, 20.8304, 106.7247
FROM toll_expressways WHERE expressway_name = 'CT Hải Phòng - Quảng Ninh';

INSERT INTO toll_expressway_gates (expressway_id, gate_name, km_marker, latitude, longitude)
SELECT id, 'Nút giao Hạ Long', 25, 20.9400, 107.0200
FROM toll_expressways WHERE expressway_name = 'CT Hải Phòng - Quảng Ninh';
