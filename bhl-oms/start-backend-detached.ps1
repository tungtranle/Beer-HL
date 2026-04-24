$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$logDir = Join-Path $PSScriptRoot "logs"
$outLog = Join-Path $logDir "api.out.log"
$errLog = Join-Path $logDir "api.err.log"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$requiredPorts = @(
    @{ Port = 5434; Name = "PostgreSQL" },
    @{ Port = 6379; Name = "Redis" },
    @{ Port = 8090; Name = "VRP Solver" }
)

$missingServices = @()
foreach ($required in $requiredPorts) {
    $listener = netstat -ano -p TCP | Select-String ":$($required.Port)\s+.*LISTENING\s+" | Select-Object -First 1
    if (-not $listener) {
        $missingServices += "$($required.Name) (port $($required.Port))"
    }
}

if ($missingServices.Count -gt 0) {
    Write-Host "Khong the bat backend vi thieu dich vu nen:" -ForegroundColor Red
    $missingServices | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
    Write-Host "Hay bat Docker Desktop hoac cac service nen truoc, sau do chay lai file START_TEST_PORTAL.bat." -ForegroundColor Yellow
    exit 1
}

$lines = netstat -ano -p TCP | Select-String ":8080\s+.*LISTENING\s+"
foreach ($line in $lines) {
    $parts = ($line.Line -split '\s+') | Where-Object { $_ }
    $processIdText = $parts[-1]
    if ($processIdText -match '^\d+$') {
        Stop-Process -Id ([int]$processIdText) -Force -ErrorAction SilentlyContinue
    }
}

$env:ENV = "development"
$env:DB_URL = "postgres://bhl:bhl_dev@localhost:5434/bhl_dev?sslmode=disable"
$env:REDIS_URL = "redis://localhost:6379/0"
$env:JWT_PRIVATE_KEY_PATH = "./keys/private.pem"
$env:JWT_PUBLIC_KEY_PATH = "./keys/public.pem"
$env:JWT_ACCESS_TTL = "15m"
$env:JWT_REFRESH_TTL = "168h"
$env:SERVER_PORT = "8080"
$env:VRP_SOLVER_URL = "http://127.0.0.1:8090"
$env:OSRM_URL = "http://localhost:5000"
$env:GIN_MODE = "debug"
$env:INTEGRATION_MOCK = "true"
$env:ENABLE_TEST_PORTAL = "true"

$process = Start-Process -FilePath "go" `
    -ArgumentList "run", "cmd/server/main.go" `
    -WorkingDirectory $PSScriptRoot `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -PassThru

Write-Host "Backend started on http://localhost:8080" -ForegroundColor Green
Write-Host "PID: $($process.Id)" -ForegroundColor Green
Write-Host "Stdout log: $outLog"
Write-Host "Stderr log: $errLog"