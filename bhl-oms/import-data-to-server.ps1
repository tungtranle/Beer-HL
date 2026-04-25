# ============================================================
# BHL OMS - Chon file dump/sql tren Windows va restore len server
# Ho tro .dump/.backup/.tar (pg_restore) va .sql (psql)
# ============================================================
param(
    [string]$DataFile = "",
    [switch]$SkipCodeDeploy
)

$ErrorActionPreference = "Stop"

function Write-Step { param($n, $s) Write-Host "`n[$n] $s" -ForegroundColor Cyan }
function Write-Ok { param($s) Write-Host "  OK $s" -ForegroundColor Green }
function Write-Warn { param($s) Write-Host "  ! $s" -ForegroundColor Yellow }
function Write-Fail { param($s) Write-Host "  X $s" -ForegroundColor Red }

$ConfigFile = Join-Path $PSScriptRoot ".deploy-config.json"

function Load-Config {
    if (Test-Path $ConfigFile) {
        return Get-Content $ConfigFile | ConvertFrom-Json
    }
    return $null
}

function Ensure-Config {
    $cfg = Load-Config
    if ($null -ne $cfg) {
        return $cfg
    }

    Write-Warn "Chua co thong tin server. Mo setup truoc..."
    & (Join-Path $PSScriptRoot "deploy.ps1") -Setup
    $cfg = Load-Config
    if ($null -eq $cfg) {
        throw "Setup server chua hoan tat."
    }

    return $cfg
}

function Select-DataFile {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = "Chon file dump hoac SQL de nap len server"
    $dialog.Filter = "Database files (*.dump;*.backup;*.bak;*.tar;*.sql)|*.dump;*.backup;*.bak;*.tar;*.sql|All files (*.*)|*.*"
    $dialog.Multiselect = $false

    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        return $dialog.FileName
    }

    return ""
}

function Get-ImportMode([string]$Path) {
    $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    switch ($extension) {
        '.sql' { return 'plain' }
        '.dump' { return 'custom' }
        '.backup' { return 'custom' }
        '.bak' { return 'custom' }
        '.tar' { return 'custom' }
        default {
            throw "Chi ho tro file .sql, .dump, .backup, .bak hoac .tar. File hien tai: $extension"
        }
    }
}

function Get-SafeRemoteName([string]$FileName) {
    $base = [System.IO.Path]::GetFileNameWithoutExtension($FileName)
    $ext = [System.IO.Path]::GetExtension($FileName)
    $safeBase = ($base -replace '[^a-zA-Z0-9._-]', '-') -replace '-+', '-'
    if ([string]::IsNullOrWhiteSpace($safeBase)) {
        $safeBase = 'server-import'
    }
    return "$safeBase$ext"
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  BHL OMS - IMPORT DATA FILE TO SERVER" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Script nay cho phep chon file dump/sql tren may Windows va restore len server." -ForegroundColor Yellow
Write-Host "Server se tu backup DB hien tai truoc khi restore." -ForegroundColor Yellow

$cfg = Ensure-Config

if ([string]::IsNullOrWhiteSpace($DataFile)) {
    $DataFile = Select-DataFile
}

if ([string]::IsNullOrWhiteSpace($DataFile)) {
    throw "Chua chon file data."
}

$resolvedDataFile = Resolve-Path $DataFile
$dataFilePath = $resolvedDataFile.Path

if (-not (Test-Path $dataFilePath -PathType Leaf)) {
    throw "Khong tim thay file: $dataFilePath"
}

$importMode = Get-ImportMode $dataFilePath
$timestamp = Get-Date -Format 'yyyyMMddTHHmmss'
$safeName = Get-SafeRemoteName ([System.IO.Path]::GetFileName($dataFilePath))
$serverRelativeFile = "backups/history-$timestamp-$safeName"
$sshTarget = "$($cfg.User)@$($cfg.Host)"
$sshPort = [string]$cfg.Port
$serverPath = [string]$cfg.Path

if (-not $SkipCodeDeploy) {
    Write-Step "1/4" "Deploy code len server truoc khi restore data..."
    $message = "deploy: restore data $timestamp"
    & (Join-Path $PSScriptRoot "deploy.ps1") -Message $message
    if ($LASTEXITCODE -ne 0) {
        throw "Deploy code that bai."
    }
    Write-Ok "Code da duoc deploy"
}
else {
    Write-Step "1/4" "Bo qua code deploy theo yeu cau..."
    Write-Warn "Dang bo qua deploy code"
}

Write-Step "2/4" "Upload restore script va file data len server..."
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

$scpDataArgs = @(
    '-P', $sshPort,
    '-o', 'StrictHostKeyChecking=no',
    $dataFilePath,
    "${sshTarget}:${serverPath}/${serverRelativeFile}"
)
& scp @scpDataArgs | Out-Null
Write-Ok "Upload xong: $serverRelativeFile"

Write-Step "3/4" "Restore data tren server..."
$remoteCommand = @(
    "cd '$serverPath'"
    "chmod +x restore-full-data-once.sh"
    "bash restore-full-data-once.sh '$serverRelativeFile' '$importMode'"
) -join '; '

$sshRestoreArgs = @(
    '-p', $sshPort,
    '-t',
    '-o', 'StrictHostKeyChecking=no',
    $sshTarget,
    $remoteCommand
)
& ssh @sshRestoreArgs
if ($LASTEXITCODE -ne 0) {
    throw "Restore data that bai."
}
Write-Ok "Server da restore file data"

Write-Step "4/4" "Hoan tat"
Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "  IMPORT DATA THANH CONG" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  File da restore: $dataFilePath" -ForegroundColor Gray
Write-Host "  Backup server nam trong: $serverRelativeFile va backup truoc restore tren server" -ForegroundColor Gray
Write-Host "  App test: https://bhl.symper.us" -ForegroundColor Cyan