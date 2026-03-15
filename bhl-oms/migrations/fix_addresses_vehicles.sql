-- Fix customer addresses & provinces to match their actual GPS coordinates
-- Also update some vehicles to have varied statuses for demo

BEGIN;

-- Fix province to match coordinate area
-- TP district → Hạ Long city (QN)
UPDATE customers SET province = 'Quảng Ninh', 
  address = regexp_replace(address, ', [^,]+$', ', Quảng Ninh')
WHERE district = 'TP' AND province != 'Quảng Ninh';

-- Huyện C → Cẩm Phả (QN)
UPDATE customers SET province = 'Quảng Ninh',
  address = regexp_replace(address, 'Lạng Sơn', 'Cẩm Phả, Quảng Ninh')
WHERE district LIKE 'Huy%C%' AND province = 'Lạng Sơn';

-- Huyện D → Đông Triều (QN) 
UPDATE customers SET province = 'Quảng Ninh',
  address = regexp_replace(address, 'Bắc Giang', 'Đông Triều, Quảng Ninh')
WHERE district LIKE 'Huy%D%' AND province = 'Bắc Giang';

-- Quận 2 → Uông Bí (QN)
UPDATE customers SET province = 'Quảng Ninh',
  address = regexp_replace(address, 'Nam Định', 'Uông Bí, Quảng Ninh')
WHERE district LIKE 'Qu%2%' AND province = 'Nam Định';

-- TT → Quảng Yên (QN)
UPDATE customers SET province = 'Quảng Ninh',
  address = regexp_replace(address, 'Hải Dương', 'Quảng Yên, Quảng Ninh')
WHERE district = 'TT' AND province = 'Hải Dương';

-- Huyện A → Hải An, HP
UPDATE customers SET province = 'Hải Phòng',
  address = regexp_replace(address, 'Thái Bình', 'Hải An, Hải Phòng')
WHERE district LIKE 'Huy%A%' AND province = 'Thái Bình';

-- Huyện B → Kiến An, HP
UPDATE customers SET province = 'Hải Phòng',
  address = regexp_replace(address, 'Bắc Ninh', 'Kiến An, Hải Phòng')
WHERE district LIKE 'Huy%B%' AND province = 'Bắc Ninh';

-- Quận 1 → Lê Chân, HP (keep HP ones as-is)
UPDATE customers SET province = 'Hải Phòng',
  address = regexp_replace(address, 'Hải Dương', 'Lê Chân, Hải Phòng')
WHERE district LIKE 'Qu%1%' AND province = 'Hải Dương';

-- Add vehicle status variety for demo
-- Set a few vehicles to maintenance/broken/impounded
UPDATE vehicles SET status = 'maintenance' WHERE plate_number IN ('14C-10027', '14C-10031', '14C-50049');
UPDATE vehicles SET status = 'broken' WHERE plate_number IN ('14C-50041', '14C-10035');
UPDATE vehicles SET status = 'impounded' WHERE plate_number = '14C-50045';

COMMIT;
