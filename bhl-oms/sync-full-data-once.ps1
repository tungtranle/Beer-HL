# ============================================================
# BHL OMS - One-click sync full data tu local len server
# Dung 1 lan de dua toan bo data local hien tai len Mac Mini test.
# Sau lan nay, quay lai dung deploy.ps1 cho code-only deploy.
# ============================================================
param(
    [string]$Message = "",
    [switch]$SkipCodeDeploy
)

$ErrorActionPreference = "Stop"

function Write-Step { param($n, $s) Write-Host "`n[$n] $s" -ForegroundColor Cyan }
function Write-Ok { param($s) Write-Host "  OK $s" -ForegroundColor Green }
function Write-Warn { param($s) Write-Host "  ! $s" -ForegroundColor Yellow }
function Write-Fail { param($s) Write-Host "  X $s" -ForegroundColor Red }

$ConfigFile = Join-Path $PSScriptRoot ".deploy-config.json"
$BackupsDir = Join-Path $PSScriptRoot "backups"

function Load-Config {
    if (Test-Path $ConfigFile) {
        return Get-Content $ConfigFile | ConvertFrom-Json
    }
    return $null
}

function Get-LocalPostgresContainer {
    $names = docker ps --format "{{.Names}}" 2>$null
    $match = $names | Where-Object { $_ -match "^bhl-oms-postgres" -or $_ -match "postgres" } | Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace($match)) {
        throw "Khong tim thay local postgres container. Hay bat local stack truoc."
    }
    return $match
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  BHL OMS - FULL DATA SYNC (ONE TIME)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Script nay se lay full data local hien tai va dua len server de test." -ForegroundColor Yellow
Write-Host "Cac lan sau, chi can double-click DEPLOY_CODE_ONLY.bat." -ForegroundColor Yellow

$cfg = Load-Config
if ($null -eq $cfg) {
    Write-Warn "Chua co thong tin server. Mo setup truoc..."
    & (Join-Path $PSScriptRoot "deploy.ps1") -Setup
    $cfg = Load-Config
    if ($null -eq $cfg) {
        throw "Setup server chua hoan tat."
    }
}

$sshTarget = "$($cfg.User)@$($cfg.Host)"
$sshPort = [string]$cfg.Port
$serverPath = [string]$cfg.Path
$timestamp = Get-Date -Format "yyyyMMddTHHmmss"
$dumpName = "full-sync-$timestamp.dump"
$localDumpFile = Join-Path $BackupsDir $dumpName
$serverDumpFile = "backups/$dumpName"

if (-not $SkipCodeDeploy) {
    Write-Step "1/5" "Deploy code len server truoc khi restore data..."
    if ([string]::IsNullOrWhiteSpace($Message)) {
        $Message = "deploy: full data sync $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    }
    & (Join-Path $PSScriptRoot "deploy.ps1") -Message $Message
    if ($LASTEXITCODE -ne 0) {
        throw "Deploy code that bai."
    }
    Write-Ok "Code da duoc deploy"
}
else {
    Write-Step "1/5" "Bo qua code deploy theo yeu cau..."
    Write-Warn "Dang bo qua deploy code"
}

Write-Step "2/5" "Export full DB dump tu local Docker Postgres..."
New-Item -ItemType Directory -Force -Path $BackupsDir | Out-Null
$container = Get-LocalPostgresContainer
$containerDumpPath = "/tmp/$dumpName"
docker exec $container sh -lc "pg_dump -U bhl -d bhl_dev -Fc -f '$containerDumpPath'" | Out-Null
docker cp "${container}:$containerDumpPath" $localDumpFile | Out-Null
docker exec $container sh -lc "rm -f '$containerDumpPath'" | Out-Null
Write-Ok "Da tao dump: $localDumpFile"

Write-Step "3/5" "Upload dump va restore script len Mac Mini..."
$sshMkdirArgs = @(
    '-p', $sshPort,
    '-o', 'StrictHostKeyChecking=no',
    $sshTarget,
    "mkdir -p '$serverPath/backups'"
)
& ssh @sshMkdirArgs | Out-Null

$scpScriptArgs = @(
    '-P', $sshPort,
    '-o', 'StrictHostKeyChecking=no',
    (Join-Path $PSScriptRoot 'restore-full-data-once.sh'),
    "${sshTarget}:${serverPath}/restore-full-data-once.sh"
)
& scp @scpScriptArgs | Out-Null

$scpDumpArgs = @(
    '-P', $sshPort,
    '-o', 'StrictHostKeyChecking=no',
    $localDumpFile,
    "${sshTarget}:${serverPath}/${serverDumpFile}"
)
& scp @scpDumpArgs | Out-Null
Write-Ok "Upload xong"

Write-Step "4/5" "Restore full data tren server..."
$remoteCommand = @(
    "cd '$serverPath'"
    "chmod +x restore-full-data-once.sh"
    "bash restore-full-data-once.sh '$serverDumpFile' 'custom'"
) -join "; "
$sshRestoreArgs = @(
    '-p', $sshPort,
    '-t',
    '-o', 'StrictHostKeyChecking=no',
    $sshTarget,
    $remoteCommand
)
& ssh @sshRestoreArgs
if ($LASTEXITCODE -ne 0) {
    throw "Restore full data that bai."
}
Write-Ok "Server da nhan full data local"

Write-Step "5/5" "Hoan tat"
Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "  FULL DATA SYNC THANH CONG" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  1. Lan nay server da nhan toan bo data local hien tai de test." -ForegroundColor Green
Write-Host "  2. Lan sau chi can double-click DEPLOY_CODE_ONLY.bat de deploy code." -ForegroundColor Green
Write-Host "  3. Dump local duoc giu o: $localDumpFile" -ForegroundColor Gray
Write-Host "  4. App test: https://bhl.symper.us" -ForegroundColor Cyan