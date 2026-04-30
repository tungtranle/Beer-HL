# start.ps1 — BHL OMS Quick Start (assumes DB already initialized)
# Usage: .\start.ps1
#   First time? Run .\start-demo.ps1 instead (full setup with migrations + seed)
#
# What it does:
#   1. Start Docker (postgres, redis, vrp) if not running
#   2. Start Go API server on :8080
#   3. Start Next.js frontend on :3000

param(
    [switch]$NoFrontend,
    [switch]$NoVRP,
    [switch]$MockServer
)

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  BHL OMS — Quick Start" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# ===== 1. Kill existing processes on ports 8080, 3000 =====
Write-Host "[1/4] Cleaning up old processes..." -ForegroundColor Yellow

$ports = @(8080, 3000)
foreach ($port in $ports) {
    $procs = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
        $proc = Get-Process -Id $p.OwningProcess -ErrorAction SilentlyContinue
        if ($proc -and $proc.Name -ne "System") {
            Write-Host "  Stopping $($proc.Name) on port $port (PID $($proc.Id))" -ForegroundColor Gray
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

# ===== 2. Start Docker services =====
Write-Host ""
Write-Host "[2/4] Docker services..." -ForegroundColor Yellow

$dockerServices = @("postgres", "redis")
if (-not $NoVRP) { $dockerServices += "vrp" }

# Check if Docker is running
$dockerStatus = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Docker is not running! Starting Docker Desktop..." -ForegroundColor Red
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
    Write-Host "  Waiting for Docker to start (up to 60s)..." -ForegroundColor Gray
    $retries = 0
    do {
        Start-Sleep -Seconds 3
        $retries++
        docker info 2>&1 | Out-Null
    } while ($LASTEXITCODE -ne 0 -and $retries -lt 20)
    if ($retries -ge 20) {
        Write-Host "  Docker failed to start! Please start Docker Desktop manually." -ForegroundColor Red
        exit 1
    }
}

docker compose up -d $dockerServices 2>&1 | Out-Null

# Start OSRM container (required for real road routing)
$osrmDataPath = Join-Path $PSScriptRoot "osrm-data"
$osrmMapFile = Join-Path $osrmDataPath "vietnam-latest.osrm"
if (-not (Test-Path $osrmMapFile)) {
    Write-Host "  Missing OSRM data: $osrmMapFile" -ForegroundColor Red
    Write-Host "  Run .\setup-osrm.ps1 once, then retry." -ForegroundColor Red
    exit 1
}

docker stop bhl-oms-osrm-1 2>&1 | Out-Null
docker rm bhl-oms-osrm-1 2>&1 | Out-Null
docker run -d --name bhl-oms-osrm-1 -v "${osrmDataPath}:/data" -p 5000:5000 osrm/osrm-backend:v5.25.0 osrm-routed --algorithm mld --max-table-size 500 /data/vietnam-latest.osrm 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Failed to start OSRM container!" -ForegroundColor Red
    exit 1
}

# Wait for PostgreSQL
$retry = 0
do {
    Start-Sleep -Seconds 1
    $retry++
    docker compose exec -T postgres pg_isready -U bhl 2>&1 | Out-Null
} while ($LASTEXITCODE -ne 0 -and $retry -lt 15)

if ($retry -ge 15) {
    Write-Host "  PostgreSQL did not start!" -ForegroundColor Red
    exit 1
}

# Wait for OSRM readiness
$osrmReady = $false
for ($i = 0; $i -lt 25; $i++) {
    try {
        Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:5000/nearest/v1/driving/106.6881,20.8449" -TimeoutSec 3 | Out-Null
        $osrmReady = $true
        break
    } catch {
        Start-Sleep -Seconds 2
    }
}
if (-not $osrmReady) {
    Write-Host "  OSRM did not become ready on :5000" -ForegroundColor Red
    exit 1
}

Write-Host "  PostgreSQL :5433  OK" -ForegroundColor Green
Write-Host "  Redis      :6379  OK" -ForegroundColor Green
if (-not $NoVRP) { Write-Host "  VRP Solver :8090  OK" -ForegroundColor Green }
Write-Host "  OSRM       :5000  OK" -ForegroundColor Green

# ===== 3. Set environment variables =====
$env:ENV = "development"
$env:DB_URL = "postgres://bhl:bhl_dev@localhost:5433/bhl_dev?sslmode=disable"
# AI Intelligence Layer — Groq (active), Gemini (optional)
# Groq: 14,400 req/ngày free — https://console.groq.com
$env:GROQ_API_KEY   = "REDACTED_GROQ_API_KEY"
# Gemini: 1,500 req/ngày free — https://aistudio.google.com (optional, higher priority)
# $env:GEMINI_API_KEY = "YOUR_GEMINI_KEY_HERE"
$env:REDIS_URL = "redis://localhost:6379"
$env:JWT_PRIVATE_KEY_PATH = "./keys/private.pem"
$env:JWT_PUBLIC_KEY_PATH = "./keys/public.pem"
$env:JWT_ACCESS_TTL = "15m"
$env:JWT_REFRESH_TTL = "168h"
$env:SERVER_PORT = "8080"
$env:VRP_SOLVER_URL = "http://localhost:8090"
$env:OSRM_URL = "http://localhost:5000"
$env:INTEGRATION_MOCK = "true"

# ===== 4. Generate JWT keys if missing =====
if (-not (Test-Path "keys\private.pem")) {
    Write-Host ""
    Write-Host "[!] JWT keys not found. Run .\start-demo.ps1 for first-time setup." -ForegroundColor Red
    exit 1
}

# ===== 5. Start Go backend =====
Write-Host ""
Write-Host "[3/4] Starting Go API on :8080..." -ForegroundColor Yellow

# Start mock server if requested
$mockProcess = $null
if ($MockServer) {
    Write-Host "  Starting Mock Server (Bravo:9001, DMS:9002, Zalo:9003)..." -ForegroundColor Cyan
    $env:INTEGRATION_MOCK = "false"
    $env:ZALO_BASE_URL = "http://localhost:9003"
    $mockProcess = Start-Process -FilePath "go" -ArgumentList "run", "cmd/mock_server/main.go" -PassThru -NoNewWindow
    Start-Sleep -Seconds 2
}

$goProcess = Start-Process -FilePath "go" -ArgumentList "run", "cmd/server/main.go" -PassThru -NoNewWindow
Start-Sleep -Seconds 3

# ===== 6. Start Next.js frontend =====
if (-not $NoFrontend) {
    Write-Host "[4/4] Starting Next.js on :3000..." -ForegroundColor Yellow
    Push-Location "web"
    if (-not (Test-Path "node_modules")) {
        Write-Host "  Installing npm dependencies..." -ForegroundColor Gray
        npm install 2>&1 | Out-Null
    }
    Pop-Location
    $npmProcess = Start-Process -FilePath "cmd" -ArgumentList "/c", "cd web && npm run dev" -PassThru -NoNewWindow
} else {
    Write-Host "[4/4] Frontend skipped (--NoFrontend)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  BHL OMS is running!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor White
Write-Host "  API:       http://localhost:8080/health" -ForegroundColor White
if (-not $NoVRP) { Write-Host "  VRP:       http://localhost:8090/health" -ForegroundColor White }
Write-Host "  OSRM:      http://localhost:5000/nearest/v1/driving/106.6881,20.8449" -ForegroundColor White
if ($MockServer) {
    Write-Host "  Mock Bravo: http://localhost:9001/health" -ForegroundColor White
    Write-Host "  Mock DMS:   http://localhost:9002/health" -ForegroundColor White
    Write-Host "  Mock Zalo:  http://localhost:9003/health" -ForegroundColor White
}
Write-Host ""
Write-Host "  Login: admin / demo123" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

try {
    Wait-Process -Id $goProcess.Id
} finally {
    Write-Host "Stopping..." -ForegroundColor Yellow
    if ($goProcess -and -not $goProcess.HasExited) { Stop-Process -Id $goProcess.Id -Force -ErrorAction SilentlyContinue }
    if ($npmProcess -and -not $npmProcess.HasExited) { Stop-Process -Id $npmProcess.Id -Force -ErrorAction SilentlyContinue }
    if ($mockProcess -and -not $mockProcess.HasExited) { Stop-Process -Id $mockProcess.Id -Force -ErrorAction SilentlyContinue }
    # Kill any remaining node processes for this project
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match "bhl" -or $true } | ForEach-Object {
        # Don't kill all node processes, just ones on port 3000
    }
    Write-Host "Done." -ForegroundColor Green
}
