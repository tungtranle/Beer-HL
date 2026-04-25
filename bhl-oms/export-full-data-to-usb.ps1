# ============================================================
# BHL OMS - Export full data package de copy qua USB
# Tao 1 thu muc package chua dump + script import tren Mac.
# Sau do chi can copy ca thu muc nay qua USB.
# ============================================================
param()

$ErrorActionPreference = "Stop"

function Write-Step { param($n, $s) Write-Host "`n[$n] $s" -ForegroundColor Cyan }
function Write-Ok { param($s) Write-Host "  OK $s" -ForegroundColor Green }
function Write-Warn { param($s) Write-Host "  ! $s" -ForegroundColor Yellow }

function Get-LocalPostgresContainer {
    $names = docker ps --format "{{.Names}}" 2>$null
    $match = $names | Where-Object { $_ -match "^bhl-oms-postgres" -or $_ -match "postgres" } | Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace($match)) {
        throw "Khong tim thay local postgres container. Hay bat local stack truoc."
    }
    return $match
}

$PackageRoot = Join-Path $PSScriptRoot "backups"
$Timestamp = Get-Date -Format "yyyyMMddTHHmmss"
$PackageDir = Join-Path $PackageRoot "usb-sync-$Timestamp"
$DumpFile = Join-Path $PackageDir "full-sync.dump"
$MacImportScriptSource = Join-Path $PSScriptRoot "import-full-data-from-usb.sh"
$MacCommandSource = Join-Path $PSScriptRoot "IMPORT_ON_MAC.command"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  BHL OMS - EXPORT FULL DATA TO USB" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Script nay se gom full data local vao 1 thu muc de ban copy qua USB." -ForegroundColor Yellow

Write-Step "1/3" "Tao thu muc package..."
New-Item -ItemType Directory -Force -Path $PackageDir | Out-Null
Write-Ok "Package: $PackageDir"

Write-Step "2/3" "Export full DB dump tu local Docker Postgres..."
$container = Get-LocalPostgresContainer
$containerDumpPath = "/tmp/full-sync-$Timestamp.dump"
docker exec $container sh -lc "pg_dump -U bhl -d bhl_dev -Fc -f '$containerDumpPath'" | Out-Null
docker cp "${container}:$containerDumpPath" $DumpFile | Out-Null
docker exec $container sh -lc "rm -f '$containerDumpPath'" | Out-Null
Write-Ok "Da tao dump: $DumpFile"

Write-Step "3/3" "Copy script import cho Mac vao package..."
Copy-Item $MacImportScriptSource (Join-Path $PackageDir "import-full-data-from-usb.sh") -Force
Copy-Item $MacCommandSource (Join-Path $PackageDir "IMPORT_ON_MAC.command") -Force
Write-Ok "Package da san sang"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "  XONG - HAY COPY THU MUC NAY QUA USB" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  1. Copy ca thu muc nay qua USB:" -ForegroundColor Green
Write-Host "     $PackageDir" -ForegroundColor Gray
Write-Host "  2. Cam USB vao Mac Mini." -ForegroundColor Green
Write-Host "  3. Copy thu muc usb-sync-... vao trong thu muc du an BHL tren Mac." -ForegroundColor Green
Write-Host "  4. Double-click IMPORT_ON_MAC.command tren Mac." -ForegroundColor Green
Write-Host ""