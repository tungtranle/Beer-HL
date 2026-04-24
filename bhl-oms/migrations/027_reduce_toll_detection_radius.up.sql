-- Migration 027: Giảm detection_radius_m cho trạm thu phí
-- 
-- Vấn đề: Bán kính 500m (open) / 800m (gate) quá lớn.
-- Quốc lộ thường chạy song song cao tốc cách 200-500m
-- (VD: QL5 // CT HP-HN, QL18 // CT HP-HL).
-- Khi VRP chọn đường tránh toll (exclude=toll), polyline
-- đi trên quốc lộ vẫn nằm trong bán kính 500m của trạm
-- trên cao tốc bên cạnh → detect_tolls_on_polyline tính
-- phí sai (false positive).
--
-- Fix: Giảm bán kính xuống mức chỉ match khi xe thực sự
-- đi TRÊN đường có trạm:
--   - Open toll: 500m → 200m (trạm nằm ngay trên mặt đường)
--   - Expressway gate: 800m → 300m (cổng cao tốc rộng hơn)

-- ═══════════════════════════════════════════════════════
-- 1. Trạm hở: 500 → 200m
-- ═══════════════════════════════════════════════════════
UPDATE toll_stations 
SET detection_radius_m = 200 
WHERE detection_radius_m >= 500;

-- Cầu Bạch Đằng giữ 300m (trạm trên cầu, GPS trôi nhiều hơn)
UPDATE toll_stations 
SET detection_radius_m = 300 
WHERE station_name = 'Cầu Bạch Đằng';

-- ═══════════════════════════════════════════════════════
-- 2. Cổng cao tốc: 800 → 300m
-- ═══════════════════════════════════════════════════════
UPDATE toll_expressway_gates 
SET detection_radius_m = 300 
WHERE detection_radius_m >= 800;
