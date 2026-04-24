-- Rollback 026: Revert toll coordinates to migration 025 values
-- This restores the approximate coordinates before OSM correction

-- Toll stations
UPDATE toll_stations SET latitude = 20.985, longitude = 107.012 WHERE station_name = 'Đại Yên';
UPDATE toll_stations SET latitude = 20.841, longitude = 106.764 WHERE station_name = 'Cầu Bạch Đằng';
UPDATE toll_stations SET latitude = 21.196, longitude = 105.811 WHERE station_name = 'Bắc Thăng Long';
UPDATE toll_stations SET latitude = 21.037, longitude = 105.941 WHERE station_name = 'Phù Đổng';
UPDATE toll_stations SET latitude = 21.286, longitude = 105.617 WHERE station_name = 'Quất Lưu';
UPDATE toll_stations SET latitude = 20.975, longitude = 105.998 WHERE station_name = 'Trạm số 1 QL5';
UPDATE toll_stations SET latitude = 20.875, longitude = 106.581 WHERE station_name = 'Trạm số 2 QL5';
UPDATE toll_stations SET latitude = 20.865, longitude = 105.521 WHERE station_name = 'Lương Sơn';
UPDATE toll_stations SET latitude = 20.725, longitude = 106.481 WHERE station_name = 'Tiên Cựu';
UPDATE toll_stations SET latitude = 20.551, longitude = 106.332 WHERE station_name = 'Đông Hưng';
UPDATE toll_stations SET latitude = 21.127, longitude = 106.289 WHERE station_name = 'Phả Lại';
UPDATE toll_stations SET latitude = 20.627, longitude = 105.945 WHERE station_name = 'Yên Lệnh';
UPDATE toll_stations SET latitude = 20.581, longitude = 106.155 WHERE station_name = 'Cầu Thái Hà';
UPDATE toll_stations SET latitude = 21.678, longitude = 105.742 WHERE station_name = 'Bờ Đậu';

-- Gates: restore approximate coordinates from migration 025
-- (Full rollback requires re-running migration 025 for exact gate coords)
