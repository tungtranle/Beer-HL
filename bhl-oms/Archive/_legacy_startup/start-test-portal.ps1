$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  BHL OMS Test Portal Launcher" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Dang bat backend va frontend cho Test Portal..." -ForegroundColor Yellow

& (Join-Path $PSScriptRoot "start-backend-detached.ps1")
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& (Join-Path $PSScriptRoot "start-web-detached.ps1")
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Trinh duyet se mo trang Test Portal sau it giay." -ForegroundColor Green
Start-Sleep -Seconds 4
Start-Process "http://localhost:3001/test-portal"

Write-Host ""
Write-Host "Neu trang web bao backend chua san sang, cho them vai giay roi tai lai." -ForegroundColor Yellow
Write-Host "Log backend: $PSScriptRoot\logs\api.out.log" -ForegroundColor Gray
Write-Host "Log frontend: $PSScriptRoot\logs\web-dev.out.log" -ForegroundColor Gray