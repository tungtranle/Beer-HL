-- Fix customer GPS coordinates to be solidly on-land in Quảng Ninh / Hải Phòng areas
-- Each district gets a safe bounding box that avoids water (Hạ Long Bay)

BEGIN;

-- "TP" district → Hạ Long city center (inland part): 20.948-20.975, 107.062-107.098
UPDATE customers SET
  latitude  = 20.948 + random() * 0.027,
  longitude = 107.062 + random() * 0.036
WHERE district = 'TP';

-- "Huyện C" → Cẩm Phả town center: 21.003-21.023, 107.280-107.318
UPDATE customers SET
  latitude  = 21.003 + random() * 0.020,
  longitude = 107.280 + random() * 0.038
WHERE district LIKE 'Huy%C%' OR district = 'Huyện C';

-- "Huyện D" → Đông Triều town: 21.070-21.095, 106.480-106.530
UPDATE customers SET
  latitude  = 21.070 + random() * 0.025,
  longitude = 106.480 + random() * 0.050
WHERE district LIKE 'Huy%D%' OR district = 'Huyện D';

-- "Quận 2" → Uông Bí town: 21.025-21.050, 106.748-106.785
UPDATE customers SET
  latitude  = 21.025 + random() * 0.025,
  longitude = 106.748 + random() * 0.037
WHERE district LIKE 'Qu%2%' OR district = 'Quận 2';

-- "TT" → Quảng Yên town (inland): 20.925-20.945, 106.790-106.820
UPDATE customers SET
  latitude  = 20.925 + random() * 0.020,
  longitude = 106.790 + random() * 0.030
WHERE district = 'TT';

-- "Huyện A" → Hải Phòng - Hải An district: 20.838-20.870, 106.660-106.720
UPDATE customers SET
  latitude  = 20.838 + random() * 0.032,
  longitude = 106.660 + random() * 0.060
WHERE district LIKE 'Huy%A%' OR district = 'Huyện A';

-- "Huyện B" → Hải Phòng - Kiến An / An Lão: 20.810-20.845, 106.620-106.665
UPDATE customers SET
  latitude  = 20.810 + random() * 0.035,
  longitude = 106.620 + random() * 0.045
WHERE district LIKE 'Huy%B%' OR district = 'Huyện B';

-- "Quận 1" → Hải Phòng - Lê Chân / Ngô Quyền: 20.840-20.865, 106.670-106.705
UPDATE customers SET
  latitude  = 20.840 + random() * 0.025,
  longitude = 106.670 + random() * 0.035
WHERE district LIKE 'Qu%1%' OR district = 'Quận 1';

-- Fix individually named districts (single customers) to safe on-land coords
UPDATE customers SET latitude = 20.955, longitude = 107.080 WHERE district = 'Hạ Long';
UPDATE customers SET latitude = 21.082, longitude = 106.505 WHERE district = 'Đông Triều';
UPDATE customers SET latitude = 20.935, longitude = 106.803 WHERE district = 'Quảng Yên';
UPDATE customers SET latitude = 21.038, longitude = 106.766 WHERE district = 'Uông Bí';
UPDATE customers SET latitude = 21.012, longitude = 107.301 WHERE district = 'Cẩm Phả' OR district = 'Cửa Ông';
UPDATE customers SET latitude = 20.960, longitude = 107.048 WHERE district = 'Bãi Cháy';
UPDATE customers SET latitude = 20.858, longitude = 106.692 WHERE district = 'Ngô Quyền';
UPDATE customers SET latitude = 20.835, longitude = 106.724 WHERE district = 'Hải An';
UPDATE customers SET latitude = 20.720, longitude = 106.780 WHERE district = 'Đồ Sơn';
UPDATE customers SET latitude = 21.528, longitude = 107.965 WHERE district = 'Móng Cái';
UPDATE customers SET latitude = 21.331, longitude = 107.403 WHERE district = 'Tiên Yên';

-- Vân Đồn - use mainland part (not the island): 20.940, 107.380
UPDATE customers SET latitude = 20.940, longitude = 107.380 WHERE district = 'Vân Đồn';

COMMIT;
