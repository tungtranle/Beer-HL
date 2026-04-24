-- Rollback: Restore original detection_radius_m values
UPDATE toll_stations SET detection_radius_m = 500 WHERE detection_radius_m = 200;
UPDATE toll_stations SET detection_radius_m = 600 WHERE station_name = 'Cầu Bạch Đằng';
UPDATE toll_expressway_gates SET detection_radius_m = 800 WHERE detection_radius_m = 300;
