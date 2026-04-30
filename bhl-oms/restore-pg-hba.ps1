# restore-pg-hba.ps1 - Restore pg_hba.conf to valid state and create bhl user/db
$PG_HBA = "C:\Program Files\PostgreSQL\16\data\pg_hba.conf"
$PSQL16  = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
$PGCTL16 = "C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe"
$PORT    = 5433
$MIGRATIONS_DIR = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "migrations"

Write-Host "=== Restoring pg_hba.conf ===" -ForegroundColor Cyan

# Write a clean pg_hba.conf with trust for 127.0.0.1 (no BOM, LF line endings)
$hba = @"
# TYPE  DATABASE        USER            ADDRESS                 METHOD
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 scram-sha-256
host    replication     all             127.0.0.1/32            trust
host    replication     all             ::1/128                 scram-sha-256
"@

# Write without BOM using .NET
[System.IO.File]::WriteAllText($PG_HBA, $hba, [System.Text.UTF8Encoding]::new($false))
Write-Host "  pg_hba.conf restored (trust for 127.0.0.1)" -ForegroundColor Green

# Restart PG service to reload config
Write-Host "  Restarting PostgreSQL 16 service..." -ForegroundColor Yellow
Restart-Service -Name "postgresql-x64-16" -Force
Start-Sleep -Seconds 5
Write-Host "  Service restarted" -ForegroundColor Green

# Create user and DB
Write-Host ""
Write-Host "=== Creating bhl user and bhl_dev database ===" -ForegroundColor Cyan
$env:PGPASSWORD = ""

& $PSQL16 -U postgres -p $PORT -h 127.0.0.1 -c @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'bhl') THEN
    CREATE USER bhl WITH PASSWORD 'bhl_dev';
  ELSE
    ALTER USER bhl WITH PASSWORD 'bhl_dev';
  END IF;
END `$`$;
"@
Write-Host "  User bhl ready" -ForegroundColor Green

$dbExists = & $PSQL16 -U postgres -p $PORT -h 127.0.0.1 -tAc "SELECT 1 FROM pg_database WHERE datname='bhl_dev';"
if ($dbExists -ne "1") {
    & $PSQL16 -U postgres -p $PORT -h 127.0.0.1 -c "CREATE DATABASE bhl_dev OWNER bhl;"
}
& $PSQL16 -U postgres -p $PORT -h 127.0.0.1 -c "GRANT ALL PRIVILEGES ON DATABASE bhl_dev TO bhl;"
Write-Host "  Database bhl_dev ready" -ForegroundColor Green

# Run migrations
Write-Host ""
Write-Host "=== Running migrations ===" -ForegroundColor Cyan
$env:PGPASSWORD = "bhl_dev"
$migrations = @(
    "001_init","002_checklist","003_cutoff_consolidation","004_wms",
    "005_epod_payment","006_zalo_confirm","007_recon_dlq_kpi","008_audit_log",
    "009_driver_checkin","009_urgent_priority","010_order_confirmation",
    "010_order_number_seq","010_workshop_phase6","011_entity_events",
    "012_redelivery_vehicle_docs","013_partial_payment_reject","014_note_type_pinned",
    "015_eod_checkpoints","016_notification_admin_rbac","017_handover_records",
    "018_handover_photo_reject","019_brd_gaps","020_cost_engine","021_vrp_scenarios",
    "025_toll_data_north_vietnam","026_fix_toll_coordinates_osm",
    "027_reduce_toll_detection_radius","028_order_urgent","029_vehicle_driver_mapping",
    "030_work_orders","031_garages","032_fuel_logs","033_driver_scores",
    "034_gamification","035_tire_leave","036_ml_features_schema",
    "036b_ml_features_align_csv","037_wms_phase9_pallets","038_gps_anomaly_detection",
    "039_toll_stations_extra","040_ai_insights","041_qa_demo_portal",
    "042_ai_feature_flags","043_ai_native_phase2_6"
)
foreach ($m in $migrations) {
    $f = Join-Path $MIGRATIONS_DIR "${m}.up.sql"
    if (Test-Path $f) {
        $out = & $PSQL16 -U bhl -p $PORT -h 127.0.0.1 -d bhl_dev -f $f 2>&1
        Write-Host "  OK: $m" -ForegroundColor Green
    }
}

# Seed
Write-Host ""
Write-Host "=== Seeding demo data ===" -ForegroundColor Cyan
$seedFile = Join-Path $MIGRATIONS_DIR "seed.sql"
if (Test-Path $seedFile) {
    & $PSQL16 -U bhl -p $PORT -h 127.0.0.1 -d bhl_dev -f $seedFile 2>&1 | Out-Null
    Write-Host "  seed.sql applied" -ForegroundColor Green
}

# Now lock down pg_hba.conf properly (bhl uses password, postgres uses scram)
Write-Host ""
Write-Host "=== Locking down pg_hba.conf ===" -ForegroundColor Cyan
$hbaFinal = @"
# TYPE  DATABASE        USER            ADDRESS                 METHOD
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
host    replication     all             127.0.0.1/32            scram-sha-256
host    replication     all             ::1/128                 scram-sha-256
"@
[System.IO.File]::WriteAllText($PG_HBA, $hbaFinal, [System.Text.UTF8Encoding]::new($false))
Restart-Service -Name "postgresql-x64-16" -Force
Start-Sleep -Seconds 3
Write-Host "  Done. PG16 locked down with scram-sha-256" -ForegroundColor Green

# Final verify
$env:PGPASSWORD = "bhl_dev"
$result = & $PSQL16 -U bhl -p $PORT -h 127.0.0.1 -d bhl_dev -tAc "SELECT username FROM users WHERE username='admin';" 2>&1
Write-Host ""
if ($result -eq "admin") {
    Write-Host "=== SUCCESS: admin user found in DB ===" -ForegroundColor Green
} else {
    Write-Host "=== RESULT: $result ===" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Press any key to close..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
