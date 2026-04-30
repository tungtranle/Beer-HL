$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$webPath = Join-Path $PSScriptRoot "web"
$logDir = Join-Path $PSScriptRoot "logs"
$outLog = Join-Path $logDir "web-dev.out.log"
$errLog = Join-Path $logDir "web-dev.err.log"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

foreach ($port in @(3000, 3001, 3002)) {
    $lines = netstat -ano -p TCP | Select-String ":$port\s+.*LISTENING\s+"
    foreach ($line in $lines) {
        $parts = ($line.Line -split '\s+') | Where-Object { $_ }
        $processIdText = $parts[-1]
        if ($processIdText -match '^\d+$') {
            Stop-Process -Id ([int]$processIdText) -Force -ErrorAction SilentlyContinue
        }
    }
}

$nextDir = Join-Path $webPath ".next"
if (Test-Path $nextDir) {
    Remove-Item (Join-Path $nextDir "cache") -Recurse -Force -ErrorAction SilentlyContinue
}

$process = Start-Process -FilePath "npm.cmd" `
    -ArgumentList "run", "dev", "--", "--port", "3001" `
    -WorkingDirectory $webPath `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -PassThru

Write-Host "Frontend started on http://localhost:3001" -ForegroundColor Green
Write-Host "PID: $($process.Id)" -ForegroundColor Green
Write-Host "Stdout log: $outLog"
Write-Host "Stderr log: $errLog"