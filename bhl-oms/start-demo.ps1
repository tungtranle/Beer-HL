# start-demo.ps1 — BHL OMS-TMS-WMS Demo Launcher for Windows
# Usage: .\start-demo.ps1
# Requires: Docker Desktop, Go 1.22+, Node.js 18+

param(
    [switch]$SkipDocker,
    [switch]$SkipMigrate,
    [switch]$SkipFrontend,
    [switch]$ResetDB
)

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  BHL OMS-TMS-WMS Demo Launcher" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# ===== 1. Check prerequisites =====
Write-Host "[1/7] Checking prerequisites..." -ForegroundColor Yellow

$missing = @()
if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) { $missing += "Docker" }
if (-not (Get-Command "go" -ErrorAction SilentlyContinue)) { $missing += "Go" }
if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) { $missing += "Node.js" }

if ($missing.Count -gt 0) {
    Write-Host "  MISSING: $($missing -join ', ')" -ForegroundColor Red
    Write-Host "  Please install the missing tools and try again." -ForegroundColor Red
    exit 1
}

$goVer = go version
$nodeVer = node --version
Write-Host "  Go:     $goVer" -ForegroundColor Green
Write-Host "  Node:   $nodeVer" -ForegroundColor Green
Write-Host "  Docker: OK" -ForegroundColor Green

# ===== 2. Generate JWT Keys =====
Write-Host ""
Write-Host "[2/7] JWT RS256 Keys..." -ForegroundColor Yellow

if (-not (Test-Path "keys\private.pem")) {
    New-Item -ItemType Directory -Force -Path "keys" | Out-Null

    # Use Go to generate RSA keys (no openssl needed!)
    $keyGenCode = @'
package main

import (
    "crypto/rand"
    "crypto/rsa"
    "crypto/x509"
    "encoding/pem"
    "os"
)

func main() {
    key, _ := rsa.GenerateKey(rand.Reader, 2048)

    privFile, _ := os.Create("keys/private.pem")
    pem.Encode(privFile, &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
    privFile.Close()

    pubBytes, _ := x509.MarshalPKIXPublicKey(&key.PublicKey)
    pubFile, _ := os.Create("keys/public.pem")
    pem.Encode(pubFile, &pem.Block{Type: "PUBLIC KEY", Bytes: pubBytes})
    pubFile.Close()
}
'@
    $keyGenCode | Out-File -Encoding utf8 -FilePath "_keygen.go"
    go run _keygen.go
    Remove-Item "_keygen.go" -Force
    Write-Host "  Generated keys/private.pem & keys/public.pem" -ForegroundColor Green
} else {
    Write-Host "  Keys already exist, skipping" -ForegroundColor Green
}

# ===== 3. Start Docker Services =====
Write-Host ""
Write-Host "[3/7] Starting Docker services (PG, Redis, VRP)..." -ForegroundColor Yellow

if (-not $SkipDocker) {
    docker compose up -d postgres redis vrp 2>&1 | Out-Null
    Write-Host "  Waiting for PostgreSQL to be ready..." -ForegroundColor Gray
    $maxRetries = 30
    $retry = 0
    do {
        Start-Sleep -Seconds 1
        $retry++
        $pgReady = docker compose exec -T postgres pg_isready -U bhl 2>&1
    } while ($LASTEXITCODE -ne 0 -and $retry -lt $maxRetries)

    if ($retry -ge $maxRetries) {
        Write-Host "  PostgreSQL did not start in time!" -ForegroundColor Red
        exit 1
    }
    Write-Host "  PostgreSQL ready" -ForegroundColor Green
    Write-Host "  Redis ready" -ForegroundColor Green
    Write-Host "  VRP Solver ready (port 8090)" -ForegroundColor Green
} else {
    Write-Host "  Skipped (--SkipDocker)" -ForegroundColor Gray
}

# ===== 4. Run DB Migrations =====
Write-Host ""
Write-Host "[4/7] Running database migrations..." -ForegroundColor Yellow

if (-not $SkipMigrate) {
    # IMPORTANT: Use docker cp + docker exec -f instead of piping through PowerShell
    # PowerShell pipe encoding corrupts Vietnamese UTF-8 characters (ắ, ạ, ờ, etc.)

    $containerName = "bhl-oms-postgres-1"

    if ($ResetDB) {
        Write-Host "  Resetting database..." -ForegroundColor Gray
        docker cp "migrations\001_init.down.sql" "${containerName}:/tmp/001_init.down.sql"
        docker exec $containerName psql -U bhl -d bhl_dev -f /tmp/001_init.down.sql 2>&1 | Out-Null
    }

    # Apply ALL migrations in order
    $migrations = @(
        "001_init", "002_checklist", "003_cutoff_consolidation", "004_wms",
        "005_epod_payment", "006_zalo_confirm", "007_recon_dlq_kpi", "008_audit_log",
        "009_driver_checkin", "009_urgent_priority", "010_order_confirmation"
    )
    foreach ($m in $migrations) {
        $sqlFile = "migrations\${m}.up.sql"
        if (Test-Path $sqlFile) {
            docker cp $sqlFile "${containerName}:/tmp/${m}.up.sql" 2>&1 | Out-Null
            docker exec $containerName psql -U bhl -d bhl_dev -f "/tmp/${m}.up.sql" 2>&1 | Out-Null
            Write-Host "  Applied: $m" -ForegroundColor Green
        }
    }
    Write-Host "  All migrations applied" -ForegroundColor Green
} else {
    Write-Host "  Skipped (--SkipMigrate)" -ForegroundColor Gray
}

# ===== 5. Seed Demo Data =====
Write-Host ""
Write-Host "[5/7] Seeding demo data..." -ForegroundColor Yellow

if (-not $SkipMigrate) {
    $containerName = "bhl-oms-postgres-1"

    # Seed files in correct order (docker cp preserves UTF-8 encoding)
    $seedFiles = @(
        @{ File = "seed.sql";                    Desc = "Base (users, products, customers)" },
        @{ File = "seed_production.sql";         Desc = "Production scale (800 NPP, 70 vehicles, 70 drivers)" },
        @{ File = "seed_test_uat.sql";           Desc = "UAT test data (700 orders, 70 trips)" },
        @{ File = "seed_comprehensive_test.sql"; Desc = "Management, warehouse staff, lots, stock" },
        @{ File = "seed_planning_test.sql";      Desc = "Planning test (80 pending shipments)" }
    )
    foreach ($seed in $seedFiles) {
        $sqlFile = "migrations\$($seed.File)"
        if (Test-Path $sqlFile) {
            docker cp $sqlFile "${containerName}:/tmp/$($seed.File)" 2>&1 | Out-Null
            docker exec $containerName psql -U bhl -d bhl_dev -f "/tmp/$($seed.File)" 2>&1 | Out-Null
            Write-Host "  Seeded: $($seed.Desc)" -ForegroundColor Green
        }
    }
    Write-Host "  All seed data loaded" -ForegroundColor Green
} else {
    Write-Host "  Skipped (--SkipMigrate)" -ForegroundColor Gray
}

# ===== 6. Install Frontend Dependencies =====
Write-Host ""
Write-Host "[6/7] Setting up frontend..." -ForegroundColor Yellow

if (-not $SkipFrontend) {
    Push-Location "web"
    if (-not (Test-Path "node_modules")) {
        Write-Host "  Installing npm dependencies..." -ForegroundColor Gray
        npm install 2>&1 | Out-Null
        Write-Host "  npm install complete" -ForegroundColor Green
    } else {
        Write-Host "  node_modules exists, skipping install" -ForegroundColor Green
    }
    Pop-Location
} else {
    Write-Host "  Skipped (--SkipFrontend)" -ForegroundColor Gray
}

# ===== 7. Start Services =====
Write-Host ""
Write-Host "[7/7] Starting application..." -ForegroundColor Yellow
Write-Host ""

# Start Go backend in background
Write-Host "  Starting Go API server on :8080..." -ForegroundColor Cyan
$env:ENV = "development"
$env:DB_URL = "postgres://bhl:bhl_dev@localhost:5434/bhl_dev?sslmode=disable"
$env:REDIS_URL = "redis://localhost:6379"
$env:JWT_PRIVATE_KEY_PATH = "./keys/private.pem"
$env:JWT_PUBLIC_KEY_PATH = "./keys/public.pem"
$env:JWT_ACCESS_TTL = "15m"
$env:JWT_REFRESH_TTL = "168h"
$env:SERVER_PORT = "8080"
$env:VRP_SOLVER_URL = "http://localhost:8090"
$env:OSRM_URL = "http://localhost:5000"
$env:INTEGRATION_MOCK = "true"

$goProcess = Start-Process -FilePath "go" -ArgumentList "run", "cmd/server/main.go" -PassThru -NoNewWindow
Start-Sleep -Seconds 3

if (-not $SkipFrontend) {
    Write-Host "  Starting Next.js frontend on :3000..." -ForegroundColor Cyan
    $npmProcess = Start-Process -FilePath "cmd" -ArgumentList "/c", "cd web && npm run dev" -PassThru -NoNewWindow
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  Demo is running!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor White
Write-Host "  API:       http://localhost:8080/health" -ForegroundColor White
Write-Host "  VRP:       http://localhost:8090/health" -ForegroundColor White
Write-Host ""
Write-Host "  Demo Accounts (password: demo123):" -ForegroundColor Yellow
Write-Host "    admin              (Admin - full access)" -ForegroundColor White
Write-Host "    dvkh01             (DVKH - create orders)" -ForegroundColor White
Write-Host "    dispatcher01       (Dispatcher - planning)" -ForegroundColor White
Write-Host "    accountant01       (Accountant - approve/reconcile)" -ForegroundColor White
Write-Host "    driver01-driver70  (Driver - mobile app)" -ForegroundColor White
Write-Host "    truongkho_hl       (Warehouse manager)" -ForegroundColor White
Write-Host ""
Write-Host "  Press Ctrl+C to stop all services" -ForegroundColor Gray
Write-Host ""

# Wait and cleanup on exit
try {
    Wait-Process -Id $goProcess.Id
} finally {
    Write-Host "Stopping services..." -ForegroundColor Yellow
    if ($goProcess -and -not $goProcess.HasExited) { Stop-Process -Id $goProcess.Id -Force -ErrorAction SilentlyContinue }
    if ($npmProcess -and -not $npmProcess.HasExited) { Stop-Process -Id $npmProcess.Id -Force -ErrorAction SilentlyContinue }
    Write-Host "Done." -ForegroundColor Green
}
