-- =============================================================================
-- MIGRATION: Thêm cột toll_fees_vnd vào trips
-- Logic: Các chuyến qua trạm BOT phát sinh phí cầu đường
-- Kho Hạ Long → hướng HP: qua CT HP-HL, toll_stations QL18
-- Kho Hải Phòng → hướng HN: qua CT HN-HP
-- =============================================================================

ALTER TABLE trips ADD COLUMN IF NOT EXISTS toll_fees_vnd NUMERIC DEFAULT 0;

-- Cập nhật toll dựa trên kho xuất phát và quãng đường
-- Truck type phân loại: truck_3t5 = L2, truck_5t/truck_8t = L3
UPDATE trips t
SET toll_fees_vnd = CASE
  -- Kho Hạ Long (warehouse HL): nhiều chuyến đi về phía Hải Phòng qua CT HP-HL
  WHEN t.warehouse_id = 'a0000000-0000-0000-0000-000000000001'::uuid THEN
    CASE
      -- Chuyến dài > 100km: qua cao tốc HP-HL + toll stations QL18
      WHEN t.total_distance_km > 100 THEN
        CASE v.vehicle_type::text
          WHEN 'truck_3t5' THEN 280000 + ((hashtext(t.id::text)::bigint & 2147483647) % 120000)  -- 280-400K
          WHEN 'truck_5t'  THEN 360000 + ((hashtext(t.id::text)::bigint & 2147483647) % 160000)  -- 360-520K
          ELSE                  420000 + ((hashtext(t.id::text)::bigint & 2147483647) % 180000)  -- 420-600K (truck_8t)
        END
      -- Chuyến trung 50-100km: toll stations QL18 + cầu Bạch Đằng
      WHEN t.total_distance_km > 50 THEN
        CASE v.vehicle_type::text
          WHEN 'truck_3t5' THEN 120000 + ((hashtext(t.id::text)::bigint & 2147483647) % 80000)   -- 120-200K
          WHEN 'truck_5t'  THEN 150000 + ((hashtext(t.id::text)::bigint & 2147483647) % 100000)  -- 150-250K
          ELSE                  180000 + ((hashtext(t.id::text)::bigint & 2147483647) % 120000)  -- 180-300K
        END
      -- Chuyến ngắn < 50km: toll QL18 nhỏ hoặc không
      WHEN (hashtext(t.id::text)::bigint & 2147483647) % 3 > 0 THEN  -- 67% có toll nhỏ
        CASE v.vehicle_type::text
          WHEN 'truck_3t5' THEN  50000 + ((hashtext(t.id::text)::bigint & 2147483647) % 50000)   -- 50-100K
          WHEN 'truck_5t'  THEN  60000 + ((hashtext(t.id::text)::bigint & 2147483647) % 60000)   -- 60-120K
          ELSE                   70000 + ((hashtext(t.id::text)::bigint & 2147483647) % 80000)   -- 70-150K
        END
      ELSE 0  -- 33% chuyến nội khu không qua trạm
    END

  -- Kho Hải Phòng (warehouse HP): chuyến đi HN qua CT HN-HP (đắt hơn)
  ELSE
    CASE
      -- Chuyến dài > 120km: có thể vào CT HN-HP (xe tải ~500-800K toàn tuyến)
      WHEN t.total_distance_km > 120 THEN
        CASE v.vehicle_type::text
          WHEN 'truck_3t5' THEN 350000 + ((hashtext(t.id::text)::bigint & 2147483647) % 150000)  -- 350-500K
          WHEN 'truck_5t'  THEN 450000 + ((hashtext(t.id::text)::bigint & 2147483647) % 200000)  -- 450-650K
          ELSE                  550000 + ((hashtext(t.id::text)::bigint & 2147483647) % 250000)  -- 550-800K
        END
      -- Chuyến trung bình nội HP
      WHEN t.total_distance_km > 40 THEN
        CASE v.vehicle_type::text
          WHEN 'truck_3t5' THEN  80000 + ((hashtext(t.id::text)::bigint & 2147483647) % 60000)
          WHEN 'truck_5t'  THEN 100000 + ((hashtext(t.id::text)::bigint & 2147483647) % 80000)
          ELSE                  120000 + ((hashtext(t.id::text)::bigint & 2147483647) % 100000)
        END
      -- Chuyến ngắn nội thành HP: phần lớn không có toll
      WHEN (hashtext(t.id::text)::bigint & 2147483647) % 4 = 0 THEN  -- 25% có phà/cầu nhỏ
        30000 + ((hashtext(t.id::text)::bigint & 2147483647) % 40000)   -- 30-70K
      ELSE 0
    END
END
FROM vehicles v
WHERE v.id = t.vehicle_id
  AND t.total_distance_km > 0
  AND t.status::text NOT IN ('draft','cancelled');

-- Kết quả
SELECT
  w.name AS warehouse,
  COUNT(*) AS trips,
  SUM(CASE WHEN toll_fees_vnd > 0 THEN 1 ELSE 0 END) AS trips_with_toll,
  ROUND(AVG(CASE WHEN toll_fees_vnd > 0 THEN toll_fees_vnd END)::numeric / 1000, 0) AS avg_toll_k_vnd,
  ROUND(SUM(toll_fees_vnd)::numeric / 1000000, 1) AS total_toll_m_vnd
FROM trips t
JOIN warehouses w ON w.id = t.warehouse_id
WHERE t.total_distance_km > 0
GROUP BY w.name;
