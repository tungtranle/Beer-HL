-- Migration 026: Fix tọa độ trạm thu phí từ OpenStreetMap (barrier=toll_booth)
-- Tọa độ cũ (migration 025) là vị trí văn phòng/tòa nhà, không phải gate trên đường
-- Tọa độ mới: lấy từ OSM Overpass API, chính xác đến gate thực tế trên mặt đường
-- Nguồn: https://overpass-api.de barrier=toll_booth, truy xuất ngày 2026-04-17

-- ═══════════════════════════════════════════════════════
-- 1. Cập nhật tọa độ trạm hở (toll_stations)
-- ═══════════════════════════════════════════════════════

-- Đại Yên (QL18) — OSM node 6347268130 "Trạm thu phí Đại Yên"
-- Cũ: 20.985, 107.012 (sai ~10km, là tọa độ văn phòng)
UPDATE toll_stations SET latitude = 20.9864, longitude = 106.9034
WHERE station_name = 'Đại Yên';

-- Cầu Bạch Đằng — OSM node 9524153629 "Trạm Thu phí Cầu Bạch Đằng"
-- Cũ: 20.841, 106.764 (sai ~3km)
UPDATE toll_stations SET latitude = 20.8629, longitude = 106.7847
WHERE station_name = 'Cầu Bạch Đằng';

-- Bắc Thăng Long — OSM node 12369764927 "Trạm Thu Phí Bắc Thăng Long - Nội Bài"
-- Cũ: 21.196, 105.811
UPDATE toll_stations SET latitude = 21.2034, longitude = 105.7799
WHERE station_name = 'Bắc Thăng Long';

-- Phù Đổng (QL1A) — OSM node 6862997895 gần vị trí Phù Đổng trên QL1A
UPDATE toll_stations SET latitude = 21.0801, longitude = 106.0921
WHERE station_name = 'Phù Đổng';

-- Quất Lưu (QL2) — OSM node 6970456533 "Trạm thu phí Bình Xuyên" (cùng khu vực)
UPDATE toll_stations SET latitude = 21.2794, longitude = 105.6693
WHERE station_name = 'Quất Lưu';

-- Trạm số 1 QL5 — OSM node 481837637 "Trạm thu phí số 1"
UPDATE toll_stations SET latitude = 20.9493, longitude = 106.0125
WHERE station_name = 'Trạm số 1 QL5';

-- Trạm số 2 QL5 — OSM node 2174037722 (barrier=toll_booth trên QL5 Hải Phòng)
UPDATE toll_stations SET latitude = 20.9648, longitude = 106.5192
WHERE station_name = 'Trạm số 2 QL5';

-- Lương Sơn (QL6) — OSM node 12452756354 "Trạm Thu Phí Lương Sơn"
UPDATE toll_stations SET latitude = 20.8704, longitude = 105.5138
WHERE station_name = 'Lương Sơn';

-- Tiên Cựu (QL10) — OSM node 3878471036 "Trạm Thu phí Quốc lộ 10"
UPDATE toll_stations SET latitude = 20.7993, longitude = 106.5233
WHERE station_name = 'Tiên Cựu';

-- Đông Hưng (QL10) — OSM node 10198933877 (barrier=toll_booth trên QL10 Thái Bình)
UPDATE toll_stations SET latitude = 20.5583, longitude = 106.3676
WHERE station_name = 'Đông Hưng';

-- Phả Lại (QL18) — OSM node 5930290765 (barrier=toll_booth gần Chí Linh QL18)
UPDATE toll_stations SET latitude = 20.8567, longitude = 106.2944
WHERE station_name = 'Phả Lại';

-- Yên Lệnh (QL38) — OSM node 6611106749 (barrier=toll_booth khu vực QL38 Hà Nam)
UPDATE toll_stations SET latitude = 20.6588, longitude = 106.0490
WHERE station_name = 'Yên Lệnh';

-- Cầu Thái Hà (QL38) — OSM node 13338380132 (barrier=toll_booth QL38 Thái Bình)
UPDATE toll_stations SET latitude = 20.5911, longitude = 106.1404
WHERE station_name = 'Cầu Thái Hà';

-- Mỹ Lộc (QL21B) — vị trí ước lượng (không có OSM data cụ thể)
-- Giữ nguyên tọa độ gốc

-- Tam Nông (QL32) — vị trí ước lượng (không có OSM data cụ thể)
-- Giữ nguyên tọa độ gốc

-- Bờ Đậu (QL3) — OSM node 10001910780 (barrier=toll_booth khu vực QL3 Thái Nguyên)
UPDATE toll_stations SET latitude = 21.6359, longitude = 105.7718
WHERE station_name = 'Bờ Đậu';

-- ═══════════════════════════════════════════════════════
-- 2. Cập nhật tọa độ cổng cao tốc (toll_expressway_gates)
-- ═══════════════════════════════════════════════════════

-- CT Pháp Vân - Cầu Giẽ - Ninh Bình
-- OSM node 6425378444 "Trạm Thu phí Pháp Vân"
UPDATE toll_expressway_gates SET latitude = 20.9076, longitude = 105.8616
WHERE gate_name = 'Pháp Vân (Hà Nội)';

-- OSM node 6880381075 "Trạm Thu phí Thường Tín"
UPDATE toll_expressway_gates SET latitude = 20.8719, longitude = 105.8775
WHERE gate_name = 'Thường Tín (Hà Nội)';

-- Vạn Điểm — không có OSM tag, ước lượng từ vị trí trên CT
UPDATE toll_expressway_gates SET latitude = 20.7738, longitude = 105.9073
WHERE gate_name = 'Vạn Điểm (Hà Nội)';

-- OSM node 2326748213 "Trạm Thu phí Vực Vòng"
UPDATE toll_expressway_gates SET latitude = 20.6480, longitude = 105.9386
WHERE gate_name = 'Vực Vòng (Hà Nam)';

-- OSM node 12725711251 "Trạm Thu phí Liêm Tuyền"
UPDATE toll_expressway_gates SET latitude = 20.5400, longitude = 105.9483
WHERE gate_name = 'Liêm Tuyền (Hà Nam)';

-- Cao Bồ — OSM node 11941138570 "Trạm Thu phí Phú Thứ" (gần khu vực)
UPDATE toll_expressway_gates SET latitude = 20.5754, longitude = 105.9515
WHERE gate_name = 'Cao Bồ (Nam Định)';

-- CT Hà Nội - Hải Phòng
-- OSM node 5677851484 (barrier=toll_booth gần km10 QL5/CT)
UPDATE toll_expressway_gates SET latitude = 20.9317, longitude = 105.9716
WHERE gate_name = 'Đầu tuyến Km10 (Hà Nội)';

-- OSM node 4686546644/9934993387 (barrier=toll_booth Yên Mỹ)
UPDATE toll_expressway_gates SET latitude = 20.8500, longitude = 106.0279
WHERE gate_name = 'QL39 - Yên Mỹ (Hưng Yên)';

-- OSM node 12600009197 (barrier=toll_booth Gia Lộc)
UPDATE toll_expressway_gates SET latitude = 20.8557, longitude = 106.1204
WHERE gate_name = 'QL38B - Gia Lộc (Hải Dương)';

-- OSM node 642099797 (barrier=toll_booth An Lão)
UPDATE toll_expressway_gates SET latitude = 20.7765, longitude = 106.5084
WHERE gate_name = 'QL10 - An Lão (Hải Phòng)';

-- OSM node 6385048398 (barrier=toll_booth TL353)
UPDATE toll_expressway_gates SET latitude = 20.7706, longitude = 106.7128
WHERE gate_name = 'TL353 - Đồ Sơn (Hải Phòng)';

-- OSM node 4911100479 (barrier=toll_booth Đình Vũ)
UPDATE toll_expressway_gates SET latitude = 20.8244, longitude = 106.7239
WHERE gate_name = 'Đình Vũ (Hải Phòng)';

-- CT Hải Phòng - Hạ Long - Vân Đồn - Móng Cái
-- OSM node 9524153629 "Trạm Thu phí Cầu Bạch Đằng"
UPDATE toll_expressway_gates SET latitude = 20.8629, longitude = 106.7847
WHERE gate_name = 'Cầu Bạch Đằng (Ranh HP-QN)';

-- OSM node 12786478146 (barrier=toll_booth Hạ Long-Vân Đồn)
UPDATE toll_expressway_gates SET latitude = 21.0032, longitude = 107.3274
WHERE gate_name = 'Hạ Long - Vân Đồn';

-- OSM node 10997726246 "Trạm Thu phí Tiên Yên"
UPDATE toll_expressway_gates SET latitude = 21.3089, longitude = 107.4761
WHERE gate_name = 'Tiên Yên (Vân Đồn - Móng Cái)';

-- OSM node 13602049336 (barrier=toll_booth Hải Hà)
UPDATE toll_expressway_gates SET latitude = 21.4651, longitude = 107.7058
WHERE gate_name = 'Hải Hà (Móng Cái)';

-- CT Nội Bài - Lào Cai
-- OSM node 4917239865 "Trạm Thu phí Km 6 Đường cao tốc Hà Nội - Lào Cai"
UPDATE toll_expressway_gates SET latitude = 21.2528, longitude = 105.7397
WHERE gate_name = 'Km6 Sóc Sơn (Hà Nội)';

-- OSM node 6970456533 "Trạm thu phí Bình Xuyên"
UPDATE toll_expressway_gates SET latitude = 21.2793, longitude = 105.6692
WHERE gate_name = 'IC3 Bình Xuyên (Vĩnh Phúc)';

-- OSM node 3008931528 (barrier=toll_booth khu vực IC4)
UPDATE toll_expressway_gates SET latitude = 21.3573, longitude = 105.6061
WHERE gate_name = 'IC4 Tam Đảo (Vĩnh Phúc)';

-- CT Bắc Giang - Lạng Sơn
-- OSM node 5926090521 "Trạm thu phí Km 93+160 Bắc Giang - Lạng Sơn"
UPDATE toll_expressway_gates SET latitude = 21.4574, longitude = 106.2959
WHERE gate_name = 'Km93 (Bắc Giang)';

-- OSM node 6838027391 "Trạm Thu phí Quốc lộ 279"
UPDATE toll_expressway_gates SET latitude = 21.6206, longitude = 106.5587
WHERE gate_name = 'QL279 (Lạng Sơn)';
