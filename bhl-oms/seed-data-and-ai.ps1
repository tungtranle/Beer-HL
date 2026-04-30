# seed-data-and-ai.ps1 - Run as Administrator
# Loads production seed data + UAT test data + enables all AI feature flags
$PSQL = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
$PORT = 5433
$env:PGPASSWORD = "bhl_dev"
$MIGS = "d:\Beer HL\bhl-oms\migrations"

Write-Host "=== BHL OMS - Load Seed Data + Enable AI ===" -ForegroundColor Cyan

# Seed files in order
$seeds = @(
    @{ file = "seed_production.sql";         desc = "Production: 800 NPP, 70 vehicles, 70 drivers, 30 products" },
    @{ file = "seed_comprehensive_test.sql"; desc = "Management/warehouse staff, lots, stock" },
    @{ file = "seed_test_uat.sql";           desc = "UAT: 700 orders, 70 trips" },
    @{ file = "seed_planning_test.sql";      desc = "Planning: 80 pending shipments" }
)

foreach ($s in $seeds) {
    $path = Join-Path $MIGS $s.file
    if (Test-Path $path) {
        Write-Host "  Seeding: $($s.desc)..." -ForegroundColor Yellow
        & $PSQL -U bhl -p $PORT -h 127.0.0.1 -d bhl_dev -f $path 2>&1 | Where-Object { $_ -match "ERROR" } | ForEach-Object { Write-Host "    WARN: $_" -ForegroundColor DarkYellow }
        Write-Host "  Done: $($s.file)" -ForegroundColor Green
    } else {
        Write-Host "  SKIP (not found): $($s.file)" -ForegroundColor Gray
    }
}

# Enable ALL AI feature flags at org scope
Write-Host ""
Write-Host "  Enabling AI feature flags..." -ForegroundColor Yellow
$flags = @(
    "ai.master", "ai.copilot", "ai.briefing", "ai.voice", "ai.camera",
    "ai.simulation", "ai.intent", "ai.automation.t3", "ai.automation.t2",
    "ai.gps_anomaly", "ai.forecast", "ai.credit_score", "ai.adaptive_ui",
    "ai.transparency", "ai.trust_loop", "ai.explainability", "ai.feedback"
)

$adminId = & $PSQL -U bhl -p $PORT -h 127.0.0.1 -d bhl_dev -tAc "SELECT id FROM users WHERE username='admin' LIMIT 1;" 2>&1
$adminId = $adminId.Trim()

foreach ($flag in $flags) {
    & $PSQL -U bhl -p $PORT -h 127.0.0.1 -d bhl_dev -tAc @"
INSERT INTO ai_feature_flags (flag_key, scope_type, scope_id, enabled, config, updated_by)
VALUES ('$flag', 'org', 'bhl', true, '{"reason":"dev_seed"}', '$adminId')
ON CONFLICT (flag_key, scope_type, scope_id) DO UPDATE SET enabled = true, updated_at = NOW();
"@ 2>&1 | Out-Null
}
Write-Host "  All $($flags.Count) AI flags enabled" -ForegroundColor Green

# Verify
Write-Host ""
Write-Host "=== Verification ===" -ForegroundColor Cyan
& $PSQL -U bhl -p $PORT -h 127.0.0.1 -d bhl_dev -c "SELECT COUNT(*) as sales_orders FROM sales_orders; SELECT COUNT(*) as trips FROM trips; SELECT COUNT(*) as vehicles FROM vehicles; SELECT COUNT(*) as users FROM users; SELECT COUNT(*) as ai_flags FROM ai_feature_flags WHERE enabled=true;" 2>&1

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Green
Write-Host "Press any key to close..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
