# BHL — Cài Windows Task Scheduler cho Health Monitor
# Chạy 1 lần với quyền Admin để thiết lập tự động kiểm tra mỗi 15 phút
# Cách dùng: Click phải → "Run as Administrator" → chọn YES

param(
    [string]$BotToken = "",
    [string]$ChatId = "",
    [switch]$Uninstall
)

$TaskName = "BHL Health Monitor"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BatFile = Join-Path $ScriptDir "RUN_HEALTH_CHECK.bat"
$EnvFile  = Join-Path $ScriptDir "scripts\.alert_env"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  BHL Health Monitor — Windows Task Scheduler Setup" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ─── Xóa task cũ nếu chạy -Uninstall ────────────────────────────────
if ($Uninstall) {
    Write-Host "Gỡ bỏ task scheduler..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "✅ Đã gỡ: $TaskName" -ForegroundColor Green
    exit 0
}

# ─── Kiểm tra quyền Admin ────────────────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ Cần chạy với quyền Administrator!" -ForegroundColor Red
    Write-Host "   Click phải vào file .ps1 → 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# ─── Kiểm tra file bat tồn tại ──────────────────────────────────────
if (-not (Test-Path $BatFile)) {
    Write-Host "❌ Không tìm thấy: $BatFile" -ForegroundColor Red
    exit 1
}

# ─── Lấy Telegram token nếu chưa có ─────────────────────────────────
if (-not $BotToken) {
    $BotToken = [System.Environment]::GetEnvironmentVariable("TELEGRAM_BOT_TOKEN", "Machine")
    if (-not $BotToken) {
        $BotToken = Read-Host "Nhập TELEGRAM_BOT_TOKEN (hoặc Enter để bỏ qua)"
    }
}
if (-not $ChatId) {
    $ChatId = [System.Environment]::GetEnvironmentVariable("TELEGRAM_CHAT_ID", "Machine")
    if (-not $ChatId) {
        $ChatId = Read-Host "Nhập TELEGRAM_CHAT_ID (hoặc Enter để bỏ qua)"
    }
}

# ─── Lưu env vars vào System environment (persistent) ───────────────
if ($BotToken -and $BotToken -ne "") {
    [System.Environment]::SetEnvironmentVariable("TELEGRAM_BOT_TOKEN", $BotToken, "Machine")
    Write-Host "✅ TELEGRAM_BOT_TOKEN đã lưu vào System environment" -ForegroundColor Green
}
if ($ChatId -and $ChatId -ne "") {
    [System.Environment]::SetEnvironmentVariable("TELEGRAM_CHAT_ID", $ChatId, "Machine")
    Write-Host "✅ TELEGRAM_CHAT_ID đã lưu vào System environment" -ForegroundColor Green
}

# ─── Tạo Task Scheduler ──────────────────────────────────────────────
Write-Host ""
Write-Host "Tạo scheduled task: $TaskName" -ForegroundColor Yellow

# Xóa task cũ nếu tồn tại
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Action: chạy RUN_HEALTH_CHECK.bat
$Action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$BatFile`"" `
    -WorkingDirectory $ScriptDir

# Trigger: mỗi 15 phút, bắt đầu ngay
$Trigger = New-ScheduledTaskTrigger `
    -RepetitionInterval (New-TimeSpan -Minutes 15) `
    -RepetitionDuration (New-TimeSpan -Days 9999) `
    -Once `
    -At (Get-Date)

# Settings
$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

# Principal: chạy với user hiện tại
$Principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "BHL OMS-TMS-WMS Health Monitor — checks every 15 minutes" `
    -Force | Out-Null

# ─── Verify ──────────────────────────────────────────────────────────
$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Task) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  ✅ Task đã tạo thành công!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Tên task : $TaskName" -ForegroundColor White
    Write-Host "  Tần suất : Mỗi 15 phút" -ForegroundColor White
    Write-Host "  Script   : $BatFile" -ForegroundColor White
    Write-Host "  Kết quả  : Telegram alert nếu hệ thống fail" -ForegroundColor White
    Write-Host ""
    Write-Host "  Xem trong: Task Scheduler → Task Scheduler Library" -ForegroundColor Yellow
    Write-Host ""

    # Chạy thử ngay
    Write-Host "Chạy thử ngay..." -ForegroundColor Yellow
    Start-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 5
    $LastRun = (Get-ScheduledTaskInfo -TaskName $TaskName).LastRunTime
    $LastResult = (Get-ScheduledTaskInfo -TaskName $TaskName).LastTaskResult
    Write-Host "  Lần chạy cuối : $LastRun" -ForegroundColor White
    Write-Host "  Kết quả       : $(if ($LastResult -eq 0) {'✅ OK'} else {"⚠️ Code $LastResult"})" -ForegroundColor White
} else {
    Write-Host "❌ Tạo task thất bại" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Hoàn thành! Nhấn Enter để đóng..." -ForegroundColor Cyan
Read-Host
