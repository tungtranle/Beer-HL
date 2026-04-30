$env:PGPASSWORD = 'bhl_dev'
$psql = 'C:\Program Files\PostgreSQL\16\bin\psql.exe'
$connArgs = @('-U', 'bhl', '-p', '5433', '-h', '127.0.0.1', '-d', 'bhl_dev', '--no-psqlrc', '-P', 'pager=off')

Write-Host "=== ALL VEHICLES (sorted) ===" -ForegroundColor Cyan
& $psql @connArgs -c "SELECT plate_number, vehicle_type::text, capacity_kg, status, w.name as warehouse FROM vehicles v LEFT JOIN warehouses w ON w.id=v.warehouse_id ORDER BY v.plate_number;"

Write-Host ""
Write-Host "=== VEHICLE COUNT BY TYPE AND WAREHOUSE ===" -ForegroundColor Cyan
& $psql @connArgs -c "SELECT w.name as warehouse, v.vehicle_type::text, count(*) FROM vehicles v LEFT JOIN warehouses w ON w.id=v.warehouse_id GROUP BY w.name, v.vehicle_type ORDER BY w.name, v.vehicle_type;"

Write-Host ""
Write-Host "=== DRIVER USERNAMES + STATUS (no Vietnamese) ===" -ForegroundColor Cyan
& $psql @connArgs -c "SELECT u.username, d.phone, d.license_number, d.status::text, d.warehouse_id FROM drivers d JOIN users u ON u.id=d.user_id ORDER BY u.username;"

Write-Host ""
Write-Host "=== TRIPS TABLE COLUMNS ===" -ForegroundColor Cyan
& $psql @connArgs -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='trips' ORDER BY ordinal_position;"

Write-Host ""
Write-Host "=== RECENT TRIPS (around 2026-04-23) ===" -ForegroundColor Cyan
& $psql @connArgs -c "SELECT t.code, v.plate_number, u.username, t.status::text, t.planned_date FROM trips t LEFT JOIN vehicles v ON v.id = t.vehicle_id LEFT JOIN drivers d ON d.id = t.driver_id LEFT JOIN users u ON u.id = d.user_id WHERE t.planned_date >= '2026-04-20' AND t.planned_date <= '2026-04-25' ORDER BY t.planned_date DESC, t.code;"

Write-Host ""
Write-Host "=== VEHICLE-DRIVER MAPPING (username only) ===" -ForegroundColor Cyan
& $psql @connArgs -c "SELECT v.plate_number, v.vehicle_type::text, u.username as default_driver FROM vehicles v LEFT JOIN drivers d ON d.id = v.default_driver_id LEFT JOIN users u ON u.id = d.user_id ORDER BY v.plate_number;"
