@echo off
REM AQF G0 — Pre-commit Guard (Windows version)
REM Chạy thủ công: AQF_G0_CHECK.bat
REM Hoặc tích hợp qua Git hooks

echo ===========================================
echo AQF G0: Pre-commit Guard (Gate 0)
echo Muc tieu: ^< 60 giay
echo ===========================================

SET FAIL=0
SET START_TIME=%TIME%

cd /d "%~dp0"

REM ─── [1/5] go build ──────────────────────────────────────
echo [1/5] go build...
go build ./...
IF %ERRORLEVEL% NEQ 0 (
    echo [FAIL] go build that bai. Fix truoc khi commit.
    SET FAIL=1
    goto :DONE
)

REM ─── [2/5] go vet ────────────────────────────────────────
echo [2/5] go vet...
go vet ./...
IF %ERRORLEVEL% NEQ 0 (
    echo [FAIL] go vet that bai. Fix truoc khi commit.
    SET FAIL=1
    goto :DONE
)

REM ─── [3/5] go test -short ────────────────────────────────
echo [3/5] go test -short -timeout 30s...
go test -short -timeout 30s ./...
IF %ERRORLEVEL% NEQ 0 (
    echo [FAIL] Unit tests that bai. Fix truoc khi commit.
    SET FAIL=1
    goto :DONE
)

REM ─── [4/5] Frontend typecheck ────────────────────────────
echo [4/5] TypeScript check (web/)...
cd web
call npx tsc --noEmit
IF %ERRORLEVEL% NEQ 0 (
    echo [FAIL] TypeScript errors trong web/. Fix truoc khi commit.
    cd ..
    SET FAIL=1
    goto :DONE
)
cd ..

REM ─── [5/5] Secret scan ───────────────────────────────────
echo [5/5] Secret scan (gitleaks)...
WHERE gitleaks >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    gitleaks protect --staged --no-banner
    IF %ERRORLEVEL% NEQ 0 (
        echo [FAIL] SECRET PHAT HIEN! Khong duoc commit.
        echo        Xoa secret, dung environment variable.
        SET FAIL=1
        goto :DONE
    )
) ELSE (
    echo [WARN] gitleaks chua cai. Chay: scripts\install-qa-tools.bat
)

:DONE
IF %FAIL% EQU 0 (
    echo.
    echo ============================================
    echo AQF G0 PASS -- Commit duoc phep
    echo ============================================
) ELSE (
    echo.
    echo ============================================
    echo AQF G0 FAIL -- Fix cac loi tren truoc khi commit
    echo ============================================
    exit /b 1
)
