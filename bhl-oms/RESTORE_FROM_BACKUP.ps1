# RESTORE_FROM_BACKUP.ps1
# Restore real data from backup 25/4/2026, then re-apply new migrations
# Run as: Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File "d:\Beer HL\bhl-oms\RESTORE_FROM_BACKUP.ps1"' -Verb RunAs

$PG_BIN    = "C:\Program Files\PostgreSQL\16\bin"
$PSQL      = "$PG_BIN\psql.exe"
$PG_RESTORE= "$PG_BIN\pg_restore.exe"
$PGDATA    = "C:\Program Files\PostgreSQL\16\data"
$PG_HBA    = "$PGDATA\pg_hba.conf"
$DUMP      = "d:\Beer HL\bhl-oms\backups\full-sync-20260425T233012.dump"
$MIG_DIR   = "d:\Beer HL\bhl-oms\migrations"

Write-Host "=== BHL OMS - Restore from backup ==="
Write-Host "Backup: $DUMP"
Write-Host ""

# ── Step 1: temporarily allow trust auth for postgres AND bhl ──────────────
Write-Host "[1/6] Setting pg_hba.conf to trust..."
$hbaOriginal = [System.IO.File]::ReadAllText($PG_HBA)
$hbaTemp = "# TEMP TRUST`nhost all all 127.0.0.1/32 trust`nhost all all ::1/128 trust`n" + $hbaOriginal
[System.IO.File]::WriteAllText($PG_HBA, $hbaTemp, [System.Text.UTF8Encoding]::new($false))
Restart-Service -Name "postgresql-x64-16" -Force
Start-Sleep -Seconds 5
Write-Host "  -> Trust auth: OK"

# ── Step 2: drop & recreate bhl_dev ────────────────────────────────────────
Write-Host "[2/6] Dropping and recreating bhl_dev database..."
$env:PGPASSWORD = ""
& $PSQL -U postgres -p 5433 -h 127.0.0.1 -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='bhl_dev' AND pid <> pg_backend_pid();" 2>&1 | Out-Null
& $PSQL -U postgres -p 5433 -h 127.0.0.1 -d postgres -c "DROP DATABASE IF EXISTS bhl_dev;" 2>&1 | Out-Null
& $PSQL -U postgres -p 5433 -h 127.0.0.1 -d postgres -c "DROP USER IF EXISTS bhl;" 2>&1 | Out-Null
& $PSQL -U postgres -p 5433 -h 127.0.0.1 -d postgres -c "CREATE USER bhl WITH PASSWORD 'bhl_dev' CREATEDB;" 2>&1 | Out-Null
& $PSQL -U postgres -p 5433 -h 127.0.0.1 -d postgres -c "CREATE DATABASE bhl_dev OWNER bhl ENCODING 'UTF8' LC_COLLATE='en_US.UTF-8' LC_CTYPE='en_US.UTF-8' TEMPLATE template0;" 2>&1 | Out-Null
Write-Host "  -> Database recreated"

# ── Step 3: restore from dump as bhl user (matches dump ownership) ─────────
Write-Host "[3/6] Restoring backup (this may take 1-2 minutes)..."
$restoreOut = & $PG_RESTORE -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev --no-owner "$DUMP" 2>&1
$restoreOut | Where-Object { $_ -match "error" } | ForEach-Object { Write-Warning $_ }
Write-Host "  -> Restore complete (exit code: $LASTEXITCODE)"

# Check tables were created
$tblCount = (& $PSQL -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev -tAc "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public';" 2>&1).Trim()
Write-Host "  -> Tables in public schema: $tblCount"
if ([int]$tblCount -lt 10) {
    Write-Error "RESTORE FAILED - less than 10 tables found! Aborting."
    [System.IO.File]::WriteAllText($PG_HBA, $hbaOriginal, [System.Text.UTF8Encoding]::new($false))
    Restart-Service -Name "postgresql-x64-16" -Force
    exit 1
}

# ── Step 4: run new migrations (041, 042, 043) ─────────────────────────────
Write-Host "[4/6] Applying new migrations (041, 042, 043)..."
$newMigs = @("041_qa_demo_portal.up.sql", "042_ai_feature_flags.up.sql", "043_ai_native_phase2_6.up.sql")
foreach ($mig in $newMigs) {
    $f = "$MIG_DIR\$mig"
    if (Test-Path $f) {
        Write-Host "  -> $mig"
        $migOut = & $PSQL -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev -f $f 2>&1
        $migOut | Where-Object { $_ -match "ERROR" } | ForEach-Object { Write-Warning $_ }
    } else {
        Write-Warning "  NOT FOUND: $f"
    }
}

# ── Step 5: enable all AI feature flags ────────────────────────────────────
Write-Host "[5/6] Enabling AI feature flags..."
$adminId = (& $PSQL -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev -tAc "SELECT id FROM users WHERE username='admin' LIMIT 1;" 2>&1)
$adminId = ($adminId | Where-Object { $_ -match "^[0-9a-f-]{36}$" } | Select-Object -First 1)
if (-not $adminId) { $adminId = "b0000000-0000-0000-0000-000000000001" }
Write-Host "  -> Admin ID: $adminId"
$flags = @("ai.master","ai.copilot","ai.briefing","ai.voice","ai.camera","ai.simulation",
           "ai.intent","ai.automation.t3","ai.automation.t2","ai.gps_anomaly","ai.forecast",
           "ai.credit_score","ai.adaptive_ui","ai.transparency","ai.trust_loop","ai.explainability","ai.feedback")
foreach ($f in $flags) {
    & $PSQL -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev -tAc `
      "INSERT INTO ai_feature_flags (flag_key,scope_type,scope_id,enabled,config,updated_by) VALUES ('$f','org','bhl',true,'{}','$adminId') ON CONFLICT (flag_key,scope_type,scope_id) DO UPDATE SET enabled=true,updated_at=NOW();" 2>&1 | Out-Null
}
$cnt = (& $PSQL -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev -tAc "SELECT COUNT(*) FROM ai_feature_flags WHERE enabled=true;" 2>&1)
$cnt = ($cnt | Where-Object { $_ -match "^\d+$" } | Select-Object -First 1)
Write-Host "  -> AI flags enabled: $cnt"

# ── Step 6: restore pg_hba.conf ────────────────────────────────────────────
Write-Host "[6/6] Restoring pg_hba.conf..."
[System.IO.File]::WriteAllText($PG_HBA, $hbaOriginal, [System.Text.UTF8Encoding]::new($false))
Restart-Service -Name "postgresql-x64-16" -Force
Start-Sleep -Seconds 5
Write-Host "  -> pg_hba.conf restored"

# ── Final verification ──────────────────────────────────────────────────────
$env:PGPASSWORD = "bhl_dev"
Write-Host ""
Write-Host "=== Verification ==="
& $PSQL -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev -c `
  "SELECT 'users' as tbl, COUNT(*) FROM users UNION ALL SELECT 'customers', COUNT(*) FROM customers UNION ALL SELECT 'sales_orders', COUNT(*) FROM sales_orders UNION ALL SELECT 'trips', COUNT(*) FROM trips UNION ALL SELECT 'vehicles', COUNT(*) FROM vehicles UNION ALL SELECT 'ai_flags_ON', COUNT(*) FROM ai_feature_flags WHERE enabled=true;" 2>&1

Write-Host ""
Write-Host "=== DONE! Backup restored successfully. ==="
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
