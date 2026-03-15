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
    if ($ResetDB) {
        Write-Host "  Resetting database..." -ForegroundColor Gray
        $downSql = Get-Content "migrations\001_init.down.sql" -Raw -Encoding UTF8
        $downSql | docker compose exec -T postgres psql -U bhl -d bhl_dev 2>&1 | Out-Null
    }

    $migrationSql = Get-Content "migrations\001_init.up.sql" -Raw -Encoding UTF8
    $result = $migrationSql | docker compose exec -T postgres psql -U bhl -d bhl_dev 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Migrations applied" -ForegroundColor Green
    } else {
        Write-Host "  Migrations may already be applied (tables exist)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Skipped (--SkipMigrate)" -ForegroundColor Gray
}

# ===== 5. Seed Demo Data =====
Write-Host ""
Write-Host "[5/7] Seeding demo data..." -ForegroundColor Yellow

if (-not $SkipMigrate) {
    $seedSql = Get-Content "migrations\seed.sql" -Raw -Encoding UTF8
    $result = $seedSql | docker compose exec -T postgres psql -U bhl -d bhl_dev 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Demo data seeded (5 users, 15 products, 15 customers)" -ForegroundColor Green
    } else {
        Write-Host "  Seed data may already exist (duplicates)" -ForegroundColor Yellow
    }
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
$env:DB_URL = "postgres://bhl:bhl_dev@localhost:5432/bhl_dev?sslmode=disable"
$env:REDIS_URL = "redis://localhost:6379/0"
$env:JWT_PRIVATE_KEY_PATH = "./keys/private.pem"
$env:JWT_PUBLIC_KEY_PATH = "./keys/public.pem"
$env:JWT_ACCESS_TTL = "15m"
$env:JWT_REFRESH_TTL = "7d"
$env:SERVER_PORT = "8080"
$env:VRP_SOLVER_URL = "http://localhost:8090"
$env:OSRM_URL = "http://localhost:5000"

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
Write-Host "  Demo Accounts:" -ForegroundColor Yellow
Write-Host "    admin / demo123       (Admin - full access)" -ForegroundColor White
Write-Host "    dvkh01 / demo123      (DVKH - create orders)" -ForegroundColor White
Write-Host "    dispatcher01 / demo123 (Dispatcher - planning)" -ForegroundColor White
Write-Host "    accountant01 / demo123 (Accountant - approve)" -ForegroundColor White
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
