# ============================================================
# BHL OMS - Deploy tu may dev len server
# 1 lenh lam tat ca: commit -> push GitHub -> SSH -> update server
# Usage:
#   .\deploy.ps1                          # commit tat ca + push + deploy
#   .\deploy.ps1 -Message "fix: ..."     # voi commit message tuy chon
#   .\deploy.ps1 -OnlyDeploy             # chi deploy, khong commit/push
# ============================================================
param(
    [string]$Message = "",
    [switch]$OnlyDeploy,
    [switch]$Setup
)

$ErrorActionPreference = "Stop"

# Helpers
function Write-Step  { param($n, $s) Write-Host "`n[$n] $s" -ForegroundColor Cyan }
function Write-Ok    { param($s) Write-Host "  OK $s" -ForegroundColor Green }
function Write-Warn  { param($s) Write-Host "  ! $s" -ForegroundColor Yellow }
function Write-Fail  { param($s) Write-Host "  X $s" -ForegroundColor Red }

# Config file
$ConfigFile = "$PSScriptRoot\.deploy-config.json"

function Load-Config {
    if (Test-Path $ConfigFile) {
        return Get-Content $ConfigFile | ConvertFrom-Json
    }
    return $null
}

function Save-Config($cfg) {
    $cfg | ConvertTo-Json | Out-File -FilePath $ConfigFile -Encoding utf8
    Write-Ok "Da luu config vao .deploy-config.json"
}

# Setup: lan dau nhap thong tin server
function Run-Setup {
    Write-Host ""
    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host "  BHL OMS - Thiet lap ket noi server" -ForegroundColor Cyan
    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  De lay thong tin SSH cua Mac Mini:" -ForegroundColor Yellow
    Write-Host "  1. Tren Mac Mini: vao System Settings -> General -> Sharing"
    Write-Host "  2. Bật 'Remote Login'"
    Write-Host "  3. Se thay: 'ssh ten_tai_khoan@dia_chi_ip'"
    Write-Host ""

    $host_    = Read-Host "  IP hoac hostname cua Mac Mini (vd: 192.168.1.100)"
    $user_    = Read-Host "  Username trên Mac Mini (vd: admin)"
    $path_    = Read-Host "  Duong dan thu muc BHL tren Mac Mini (vd: /Users/admin/bhl-oms)"
    $port_    = Read-Host "  SSH port (Enter de dung mac dinh 22)"
    if ([string]::IsNullOrEmpty($port_)) { $port_ = "22" }

    $cfg = @{
        Host = $host_
        User = $user_
        Path = $path_
        Port = $port_
    }

    # Test ket noi
    Write-Host ""
    Write-Host "  Dang test ket noi SSH..." -ForegroundColor Yellow
    $sshTestArgs = @(
        '-p', $port_,
        '-o', 'ConnectTimeout=10',
        '-o', 'StrictHostKeyChecking=no',
        "$user_@$host_",
        'echo OK'
    )
    $sshTest = & ssh @sshTestArgs 2>&1
    
    if ($sshTest -match "OK") {
        Write-Ok "Ket noi SSH thanh cong!"
        Save-Config $cfg
        return $cfg
    }
    else {
        Write-Fail "Khong ket noi duoc SSH!"
        Write-Host "  Loi: $sshTest" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Kiem tra:" -ForegroundColor Yellow
        Write-Host "  1. Mac Mini da bat Remote Login chua?"
        Write-Host "  2. IP dung chua? (ping $host_)"
        Write-Host "  3. Ca 2 may cung mang WiFi/LAN?"
        exit 1
    }
}

# Banner
Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  BHL OMS - Deploy to Server" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# Setup mode
if ($Setup) {
    Run-Setup
    exit 0
}

# Load config
$cfg = Load-Config
if ($null -eq $cfg) {
    Write-Warn "Chua co thong tin server. Chay setup..."
    $cfg = Run-Setup
}

Write-Host ""
Write-Host "  Server: $($cfg.User)@$($cfg.Host):$($cfg.Port)" -ForegroundColor Gray
Write-Host "  Path:   $($cfg.Path)" -ForegroundColor Gray

$ScriptRoot = Split-Path -Parent $PSScriptRoot

# Step 1: Git commit & push
if (-not $OnlyDeploy) {
    Write-Step "1/3" "Commit va push code len GitHub..."

    Set-Location $ScriptRoot

    # Kiem tra co thay doi khong
    $status = git status --short 2>&1
    if ([string]::IsNullOrWhiteSpace($status)) {
        Write-Warn "Khong co thay doi moi, bo qua commit"
    }
    else {
        # Tao commit message tu dong neu khong co
        if ([string]::IsNullOrEmpty($Message)) {
            $date = Get-Date -Format "yyyy-MM-dd HH:mm"
            $Message = "deploy: update $date"
        }

        git add -A 2>&1 | Out-Null
        git commit -m $Message 2>&1
        Write-Ok "Committed: $Message"
    }

    # Push
    $pushResult = git push 2>&1
    if ($LASTEXITCODE -ne 0 -and $pushResult -notmatch "up-to-date|Everything up-to-date|master -> master") {
        Write-Fail "Push that bai: $pushResult"
        exit 1
    }
    Write-Ok "Da push len GitHub"
}
else {
    Write-Warn "Bo qua commit/push (OnlyDeploy mode)"
}

# Step 2: Upload update-server.sh len server
Write-Step "2/3" "Cap nhat script tren server..."

$sshTarget = "$($cfg.User)@$($cfg.Host)"
$sshPort   = $cfg.Port
$serverPath = $cfg.Path

$scpArgs = @(
    '-P', $sshPort,
    '-o', 'StrictHostKeyChecking=no',
    "$PSScriptRoot\update-server.sh",
    "${sshTarget}:${serverPath}/update-server.sh"
)
& scp @scpArgs 2>&1 | Out-Null

Write-Ok "Script da duoc upload"

# Step 3: SSH vao server va chay update
Write-Step "3/3" "SSH vao server va cap nhat..."
Write-Host ""

$remoteCommand = @(
    "cd '$serverPath'"
    "chmod +x update-server.sh"
    "bash update-server.sh"
) -join "; "

$sshUpdateArgs = @(
    '-p', $sshPort,
    '-t',
    '-o', 'StrictHostKeyChecking=no',
    $sshTarget,
    $remoteCommand
)

& ssh @sshUpdateArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==============================================" -ForegroundColor Green
    Write-Host "  Deploy thanh cong!" -ForegroundColor Green
    Write-Host "==============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  https://bhl.symper.us" -ForegroundColor Cyan
    Write-Host ""
}
else {
    Write-Host ""
    Write-Fail "Deploy that bai! Xem loi ben tren."
    exit 1
}
