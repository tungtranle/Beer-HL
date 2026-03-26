<#
.SYNOPSIS
    Start BHL OMS for sharing with testers via ngrok
.DESCRIPTION
    Starts backend, frontend, nginx reverse proxy, and ngrok tunnel.
    Gives you a public URL to share with 2-3 testers.
.NOTES
    Prerequisites: Docker Desktop running, ngrok installed
#>

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  BHL OMS - Share Mode Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 0: Check prerequisites ──
Write-Host "[0/5] Checking prerequisites..." -ForegroundColor Yellow

# Check Docker
$dockerRunning = docker info 2>&1 | Select-String "Server Version"
if (-not $dockerRunning) {
    Write-Host "  ERROR: Docker Desktop is not running!" -ForegroundColor Red
    Write-Host "  Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}
Write-Host "  Docker OK" -ForegroundColor Green

# Check ngrok
$ngrokExists = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrokExists) {
    Write-Host "  ngrok not found. Installing via winget..." -ForegroundColor Yellow
    winget install ngrok.ngrok --accept-package-agreements --accept-source-agreements
    $ngrokExists = Get-Command ngrok -ErrorAction SilentlyContinue
    if (-not $ngrokExists) {
        Write-Host "  ERROR: Could not install ngrok." -ForegroundColor Red
        Write-Host "  Please install manually: https://ngrok.com/download" -ForegroundColor Red
        Write-Host "  Then run: ngrok config add-authtoken <your-token>" -ForegroundColor Red
        exit 1
    }
}
Write-Host "  ngrok OK" -ForegroundColor Green

# Check ngrok auth
$ngrokConfig = ngrok config check 2>&1
if ($ngrokConfig -match "ERROR") {
    Write-Host ""
    Write-Host "  ngrok chua dang nhap!" -ForegroundColor Red
    Write-Host "  1. Dang ky tai: https://dashboard.ngrok.com/signup" -ForegroundColor Yellow
    Write-Host "  2. Copy authtoken tai: https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor Yellow
    Write-Host "  3. Chay: ngrok config add-authtoken <your-token>" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# ── Step 1: Start DB + Redis (Docker) ──
Write-Host ""
Write-Host "[1/5] Starting PostgreSQL + Redis..." -ForegroundColor Yellow
Push-Location $PSScriptRoot
docker compose up -d postgres redis 2>&1 | Out-Null
Start-Sleep -Seconds 3
Write-Host "  PostgreSQL (5434) + Redis (6379) OK" -ForegroundColor Green

# ── Step 2: Start Go Backend ──
Write-Host ""
Write-Host "[2/5] Starting Go backend (port 8080)..." -ForegroundColor Yellow

# Check if port 8080 is free
$port8080 = netstat -ano | Select-String ":8080 " | Select-String "LISTEN"
if ($port8080) {
    Write-Host "  Port 8080 already in use - assuming backend is running" -ForegroundColor Yellow
} else {
    Start-Process -FilePath "go" -ArgumentList "run", "./cmd/server/" -WorkingDirectory $PSScriptRoot -WindowStyle Minimized
    Start-Sleep -Seconds 5
    Write-Host "  Backend started on :8080" -ForegroundColor Green
}

# ── Step 3: Start Next.js Frontend ──
Write-Host ""
Write-Host "[3/5] Starting Next.js frontend (port 3000)..." -ForegroundColor Yellow

$port3000 = netstat -ano | Select-String ":3000 " | Select-String "LISTEN"
if ($port3000) {
    Write-Host "  Port 3000 already in use - assuming frontend is running" -ForegroundColor Yellow
} else {
    Start-Process -FilePath "cmd" -ArgumentList "/c", "cd /d $PSScriptRoot\web && npm run dev" -WindowStyle Minimized
    Start-Sleep -Seconds 8
    Write-Host "  Frontend started on :3000" -ForegroundColor Green
}

# ── Step 4: Start nginx reverse proxy ──
Write-Host ""
Write-Host "[4/5] Starting nginx reverse proxy (port 9000)..." -ForegroundColor Yellow

# Stop existing share-nginx if running
docker rm -f bhl-share-nginx 2>&1 | Out-Null

docker run -d `
    --name bhl-share-nginx `
    --add-host=host.docker.internal:host-gateway `
    -p 9000:80 `
    -v "${PSScriptRoot}\nginx\nginx-share.conf:/etc/nginx/nginx.conf:ro" `
    nginx:alpine 2>&1 | Out-Null

Start-Sleep -Seconds 2

# Verify nginx is up
$port9000 = netstat -ano | Select-String ":9000 " | Select-String "LISTEN"
if ($port9000) {
    Write-Host "  nginx proxy started on :9000" -ForegroundColor Green
} else {
    Write-Host "  WARNING: nginx may not have started correctly" -ForegroundColor Red
    Write-Host "  Check: docker logs bhl-share-nginx" -ForegroundColor Yellow
}

# ── Step 5: Start ngrok tunnel ──
Write-Host ""
Write-Host "[5/5] Starting ngrok tunnel..." -ForegroundColor Yellow
Write-Host ""

# Start ngrok pointing to nginx port 9000
Start-Process -FilePath "ngrok" -ArgumentList "http", "9000" -WindowStyle Normal

Start-Sleep -Seconds 3

# Get the public URL from ngrok API
try {
    $tunnels = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction Stop
    $publicUrl = $tunnels.tunnels[0].public_url
    
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  SHARE URL (gui cho tester):" -ForegroundColor Green
    Write-Host ""
    Write-Host "  $publicUrl" -ForegroundColor White -BackgroundColor DarkGreen
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Test accounts:" -ForegroundColor Cyan
    Write-Host "  - Dieu phoi:  dieuphoi_hl01 / demo123" -ForegroundColor White
    Write-Host "  - Thu kho:    thukho_hl01 / demo123" -ForegroundColor White
    Write-Host "  - Lai xe:     laixe_hl01 / demo123" -ForegroundColor White
    Write-Host "  - Ke toan:    ketoan_hl01 / demo123" -ForegroundColor White
    Write-Host "  - Bao ve:     baove_hl01 / demo123" -ForegroundColor White
    Write-Host "  - Ban giam doc: bgd_hl01 / demo123" -ForegroundColor White
    Write-Host ""
    Write-Host "  Ngrok dashboard: http://localhost:4040" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  De dung: dong cua so ngrok + chay:" -ForegroundColor Yellow
    Write-Host "  docker rm -f bhl-share-nginx" -ForegroundColor Yellow
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "  ngrok dang khoi dong..." -ForegroundColor Yellow
    Write-Host "  Xem URL tai: http://localhost:4040" -ForegroundColor Cyan
    Write-Host "  Hoac doi 5 giay va chay lai script nay" -ForegroundColor Cyan
}

Pop-Location
