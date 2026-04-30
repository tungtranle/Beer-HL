# setup-db-elevated.ps1
# Runs as Administrator: patches pg_hba.conf for trust auth, creates bhl user/db,
# runs all migrations, then restores pg_hba.conf
# Called by SETUP_LOCAL_DB_AUTO.bat via Start-Process -Verb RunAs

$ErrorActionPreference = "Stop"
$PSQL16 = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
$PGCTL16 = "C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe"
$PG_HBA = "C:\Program Files\PostgreSQL\16\data\pg_hba.conf"
$PORT = 5433
$MIGRATIONS_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path | Join-Path -ChildPath "migrations"

Write-Host "=== BHL OMS - Elevated DB Setup ===" -ForegroundColor Cyan

# 1. Read current pg_hba.conf
Write-Host "[1/6] Patching pg_hba.conf for trust auth..." -ForegroundColor Yellow
$hbaContent = Get-Content $PG_HBA -Raw
$trustLine = "host    all             all             127.0.0.1/32            trust`n"
if ($hbaContent -notmatch "127\.0\.0\.1/32.*trust") {
    Set-Content $PG_HBA ($trustLine + $hbaContent) -Encoding UTF8 -NoNewline
    Write-Host "  Added trust rule for 127.0.0.1" -ForegroundColor Green
} else {
    Write-Host "  Trust rule already present" -ForegroundColor Green
}

# 2. Reload PG to pick up new hba
Write-Host "[2/6] Reloading PostgreSQL config..." -ForegroundColor Yellow
& $PGCTL16 reload -D "C:\Program Files\PostgreSQL\16\data" 2>&1 | Out-Null
Start-Sleep -Seconds 2

# 3. Create user and database
Write-Host "[3/6] Creating user 'bhl' and database 'bhl_dev'..." -ForegroundColor Yellow
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
& $PSQL16 -U postgres -p $PORT -h 127.0.0.1 -c "SELECT 1 FROM pg_database WHERE datname='bhl_dev'" | Select-String "1 row" | Out-Null
if (-not $?) {
    & $PSQL16 -U postgres -p $PORT -h 127.0.0.1 -c "CREATE DATABASE bhl_dev OWNER bhl;" 2>&1 | Out-Null
}
& $PSQL16 -U postgres -p $PORT -h 127.0.0.1 -c "GRANT ALL PRIVILEGES ON DATABASE bhl_dev TO bhl;" 2>&1 | Out-Null
Write-Host "  User and database ready" -ForegroundColor Green

# 4. Run all migrations as bhl user
Write-Host "[4/6] Running migrations..." -ForegroundColor Yellow
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
        & $PSQL16 -U bhl -p $PORT -h 127.0.0.1 -d bhl_dev -f $f 2>&1 | Out-Null
        Write-Host "  $m" -ForegroundColor Green
    }
}

# 5. Seed demo data
Write-Host "[5/6] Seeding demo data..." -ForegroundColor Yellow
$seedFile = Join-Path $MIGRATIONS_DIR "seed.sql"
if (Test-Path $seedFile) {
    & $PSQL16 -U bhl -p $PORT -h 127.0.0.1 -d bhl_dev -f $seedFile 2>&1 | Out-Null
    Write-Host "  seed.sql applied" -ForegroundColor Green
}

# 6. Restore pg_hba.conf (remove trust line)
Write-Host "[6/6] Restoring pg_hba.conf..." -ForegroundColor Yellow
$restored = (Get-Content $PG_HBA) | Where-Object { $_ -notmatch "127\.0\.0\.1/32\s+trust" }
Set-Content $PG_HBA $restored -Encoding UTF8
& $PGCTL16 reload -D "C:\Program Files\PostgreSQL\16\data" 2>&1 | Out-Null
Write-Host "  pg_hba.conf restored" -ForegroundColor Green

Write-Host ""
Write-Host "=== SETUP COMPLETE ===" -ForegroundColor Cyan
Write-Host "Login: admin / admin123" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to close..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
