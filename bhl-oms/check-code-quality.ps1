# BHL Code Quality Check
# Chạy script này trước mỗi commit để phát hiện LH-02 và LH-03
# Cách dùng: cd bhl-oms && .\check-code-quality.ps1

$ErrorActionPreference = "Stop"
$failed = @()
$warnings = @()

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  BHL Code Quality Check" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'dd/MM/yyyy HH:mm')" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ─────────────────────────────────────────────
# GATE 1: Không có .catch(console.error) — LH-03
# ─────────────────────────────────────────────
Write-Host "[1/4] Kiểm tra silent error (.catch(console.error))..." -ForegroundColor Yellow

$silentCatch = Get-ChildItem -Path "web/src" -Recurse -Include "*.ts","*.tsx" |
    Select-String -Pattern "\.catch\(console\.(error|log|warn)\)" -ErrorAction SilentlyContinue

if ($silentCatch) {
    Write-Host "  ❌ FAIL: Tìm thấy $($silentCatch.Count) chỗ dùng .catch(console.*)" -ForegroundColor Red
    $silentCatch | ForEach-Object {
        Write-Host "     $($_.Filename):$($_.LineNumber) → $($_.Line.Trim())" -ForegroundColor Red
    }
    $failed += "LH-03: silent catch"
} else {
    Write-Host "  ✅ PASS: Không có .catch(console.*)" -ForegroundColor Green
}

# ─────────────────────────────────────────────
# GATE 2: Không có parseFloat/parseInt cho tiền — LH-02
# ─────────────────────────────────────────────
Write-Host "[2/4] Kiểm tra parseFloat/parseInt cho tiền tệ..." -ForegroundColor Yellow

$floatMoney = Get-ChildItem -Path "web/src" -Recurse -Include "*.ts","*.tsx" |
    Select-String -Pattern "parseFloat|parseInt" -ErrorAction SilentlyContinue |
    Where-Object { $_.Line -match "price|amount|total|payment|vnd|tien" }

if ($floatMoney) {
    Write-Host "  ❌ FAIL: Tìm thấy $($floatMoney.Count) chỗ dùng parseFloat/parseInt cho tiền" -ForegroundColor Red
    $floatMoney | ForEach-Object {
        Write-Host "     $($_.Filename):$($_.LineNumber) → $($_.Line.Trim())" -ForegroundColor Red
    }
    Write-Host "  → Dùng safeParseVND() thay thế (web/src/lib/safeParseVND.ts)" -ForegroundColor Yellow
    $failed += "LH-02: parseFloat money"
} else {
    Write-Host "  ✅ PASS: Không có parseFloat cho tiền" -ForegroundColor Green
}

# ─────────────────────────────────────────────
# GATE 3: safeParseVND.ts phải tồn tại
# ─────────────────────────────────────────────
Write-Host "[3/4] Kiểm tra safeParseVND.ts..." -ForegroundColor Yellow

if (Test-Path "web/src/lib/safeParseVND.ts") {
    Write-Host "  ✅ PASS: safeParseVND.ts tồn tại" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  WARN: web/src/lib/safeParseVND.ts chưa có" -ForegroundColor Yellow
    Write-Host "  → Cần tạo trước khi xử lý bất kỳ input tiền nào" -ForegroundColor Yellow
    $warnings += "safeParseVND.ts missing"
}

# ─────────────────────────────────────────────
# GATE 4: ENABLE_TEST_PORTAL phải = false trên production
# ─────────────────────────────────────────────
Write-Host "[4/4] Kiểm tra ENABLE_TEST_PORTAL trong .env.production..." -ForegroundColor Yellow

if (Test-Path ".env.production") {
    $prodEnv = Get-Content ".env.production" -Raw
    if ($prodEnv -match "ENABLE_TEST_PORTAL\s*=\s*true") {
        Write-Host "  ❌ CRITICAL: ENABLE_TEST_PORTAL=true trong .env.production!" -ForegroundColor Red
        Write-Host "  → KHÔNG ĐƯỢC DEPLOY khi còn dòng này!" -ForegroundColor Red
        $failed += "TEST_PORTAL enabled on prod"
    } else {
        Write-Host "  ✅ PASS: Test portal tắt trên production" -ForegroundColor Green
    }
} else {
    Write-Host "  ⚠️  INFO: .env.production chưa có (OK nếu chưa đến bước deploy)" -ForegroundColor Gray
}

# ─────────────────────────────────────────────
# KẾT QUẢ
# ─────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan

if ($failed.Count -gt 0) {
    Write-Host "  ❌ FAIL — $($failed.Count) vấn đề cần fix trước commit:" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host "     • $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "  Xem chi tiết: bhl-oms/.copilot-instructions.md §QA" -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    exit 1
} elseif ($warnings.Count -gt 0) {
    Write-Host "  ⚠️  PASS với $($warnings.Count) cảnh báo:" -ForegroundColor Yellow
    $warnings | ForEach-Object { Write-Host "     • $_" -ForegroundColor Yellow }
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    exit 0
} else {
    Write-Host "  ✅ TẤT CẢ PASS — OK để commit" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    exit 0
}
