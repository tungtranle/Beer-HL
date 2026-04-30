$env:PGPASSWORD = 'bhl_dev'
$psql = 'C:\Program Files\PostgreSQL\16\bin\psql.exe'

Write-Host "=== VEHICLES ===" -ForegroundColor Cyan
& $psql -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev -c "SELECT plate_number, vehicle_type::text, capacity_kg, status FROM vehicles ORDER BY plate_number;"

Write-Host ""
Write-Host "=== VEHICLES COUNT BY TYPE ===" -ForegroundColor Cyan
& $psql -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev -c "SELECT vehicle_type::text, count(*) FROM vehicles GROUP BY vehicle_type ORDER BY vehicle_type;"

Write-Host ""
Write-Host "=== DRIVERS ===" -ForegroundColor Cyan
& $psql -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev -c "SELECT u.username, d.full_name, d.phone, d.license_number, d.status FROM drivers d JOIN users u ON u.id=d.user_id ORDER BY u.username;"

Write-Host ""
Write-Host "=== DRIVERS COUNT ===" -ForegroundColor Cyan
& $psql -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev -c "SELECT count(*) as total_drivers FROM drivers;"

Write-Host ""
Write-Host "=== VEHICLE-DRIVER MAPPING ===" -ForegroundColor Cyan
& $psql -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev -c "SELECT v.plate_number, v.vehicle_type::text, u.username as driver_username, d.full_name as driver_name FROM vehicles v LEFT JOIN drivers d ON d.id = v.default_driver_id LEFT JOIN users u ON u.id = d.user_id ORDER BY v.plate_number LIMIT 80;"

Write-Host ""
Write-Host "=== TRIPS with vehicle/driver (last 30 days from 2026-04-23) ===" -ForegroundColor Cyan
& $psql -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev -c "SELECT t.trip_code, v.plate_number, u.username, t.status::text, t.planned_date FROM trips t LEFT JOIN vehicles v ON v.id = t.vehicle_id LEFT JOIN drivers d ON d.id = t.driver_id LEFT JOIN users u ON u.id = d.user_id WHERE t.planned_date >= '2026-03-24' AND t.planned_date <= '2026-04-23' ORDER BY t.planned_date DESC, t.trip_code LIMIT 50;"
