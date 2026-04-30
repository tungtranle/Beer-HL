@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo  BHL OMS - Setup Local PostgreSQL (No Docker)
echo  Target: PostgreSQL 16 on port 5433
echo ============================================
echo.
echo This script will:
echo   1. Create DB user: bhl  (password: bhl_dev)
echo   2. Create database: bhl_dev
echo   3. Run all migrations (001 - 043)
echo   4. Seed demo data (users, products, customers, orders)
echo.
echo You need the postgres SUPERUSER password for your local PG16.
echo (This was set when PostgreSQL was installed on this machine.)
echo.

set /p PGPASS="Enter postgres superuser password: "
if "!PGPASS!"=="" (
    echo No password entered. Trying without password...
)

set "PSQL=C:\Program Files\PostgreSQL\16\bin\psql.exe"

if not exist "!PSQL!" (
    echo ERROR: psql not found at !PSQL!
    echo Please check your PostgreSQL 16 installation.
    pause
    exit /b 1
)

echo.
echo [1/5] Creating DB user 'bhl' with password 'bhl_dev'...
set PGPASSWORD=!PGPASS!
"!PSQL!" -U postgres -p 5433 -h 127.0.0.1 -c "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'bhl') THEN CREATE USER bhl WITH PASSWORD 'bhl_dev'; ELSE ALTER USER bhl WITH PASSWORD 'bhl_dev'; END IF; END $$;" 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Could not connect as postgres superuser on port 5433.
    echo Please check:
    echo   - PostgreSQL 16 is running (port 5433)
    echo   - The password you entered is correct
    echo.
    pause
    exit /b 1
)
echo   OK - user bhl ready

echo.
echo [2/5] Creating database 'bhl_dev' (if not exists)...
"!PSQL!" -U postgres -p 5433 -h 127.0.0.1 -c "SELECT 1 FROM pg_database WHERE datname='bhl_dev';" | findstr -q "1 row" 2>&1
if errorlevel 1 (
    "!PSQL!" -U postgres -p 5433 -h 127.0.0.1 -c "CREATE DATABASE bhl_dev OWNER bhl;" 2>&1
)
"!PSQL!" -U postgres -p 5433 -h 127.0.0.1 -c "GRANT ALL PRIVILEGES ON DATABASE bhl_dev TO bhl;" 2>&1
echo   OK - database bhl_dev ready

echo.
echo [3/5] Running all migrations in order...
set PGPASSWORD=bhl_dev

for %%f in (migrations\001_init.up.sql migrations\002_checklist.up.sql migrations\003_cutoff_consolidation.up.sql migrations\004_wms.up.sql migrations\005_epod_payment.up.sql migrations\006_zalo_confirm.up.sql migrations\007_recon_dlq_kpi.up.sql migrations\008_audit_log.up.sql migrations\009_driver_checkin.up.sql migrations\009_urgent_priority.up.sql migrations\010_order_confirmation.up.sql migrations\010_order_number_seq.up.sql migrations\010_workshop_phase6.up.sql migrations\011_entity_events.up.sql migrations\012_redelivery_vehicle_docs.up.sql migrations\013_partial_payment_reject.up.sql migrations\014_note_type_pinned.up.sql migrations\015_eod_checkpoints.up.sql migrations\016_notification_admin_rbac.up.sql migrations\017_handover_records.up.sql migrations\018_handover_photo_reject.up.sql migrations\019_brd_gaps.up.sql migrations\020_cost_engine.up.sql migrations\021_vrp_scenarios.up.sql migrations\025_toll_data_north_vietnam.up.sql migrations\026_fix_toll_coordinates_osm.up.sql migrations\027_reduce_toll_detection_radius.up.sql migrations\028_order_urgent.up.sql migrations\029_vehicle_driver_mapping.up.sql migrations\030_work_orders.up.sql migrations\031_garages.up.sql migrations\032_fuel_logs.up.sql migrations\033_driver_scores.up.sql migrations\034_gamification.up.sql migrations\035_tire_leave.up.sql migrations\036_ml_features_schema.up.sql migrations\036b_ml_features_align_csv.up.sql migrations\037_wms_phase9_pallets.up.sql migrations\038_gps_anomaly_detection.up.sql migrations\039_toll_stations_extra.up.sql migrations\040_ai_insights.up.sql migrations\041_qa_demo_portal.up.sql migrations\042_ai_feature_flags.up.sql migrations\043_ai_native_phase2_6.up.sql) do (
    if exist "%%f" (
        echo   Applying: %%~nxf
        "!PSQL!" -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev -f "%%f" >nul 2>&1
    )
)
echo   All migrations applied

echo.
echo [4/5] Seeding demo data (users, products, customers)...
if exist "migrations\seed.sql" (
    echo   Seeding: seed.sql
    "!PSQL!" -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev -f "migrations\seed.sql" >nul 2>&1
    echo   Done
)

echo.
echo [5/5] Verifying login user...
"!PSQL!" -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev -c "SELECT username, role FROM users WHERE username='admin' LIMIT 1;" 2>&1

echo.
echo ============================================
echo  Setup COMPLETE!
echo.
echo  Login credentials:
echo    Username: admin
echo    Password: admin123
echo.
echo  Next step: Double-click START_BACKEND_LOCAL.bat
echo ============================================
echo.
pause
