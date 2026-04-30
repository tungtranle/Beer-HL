@echo off
REM ============================================
REM  BHL OMS - Restart Backend ONLY (no Docker)
REM  Dùng khi DB/Redis đang chạy native (local dev)
REM  Double-click từ File Explorer là được!
REM ============================================
chcp 65001 >nul 2>&1
setlocal

cd /d "%~dp0"

echo ============================================
echo  BHL OMS - Restart Backend Only
echo ============================================

REM Kill old backend on port 8080
echo.
echo [1/3] Killing old backend on port 8080...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080 " ^| findstr "LISTENING"') do (
    echo      Killing PID %%a
    powershell -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue"
)
echo      Done.

REM Build fresh binary
echo.
echo [2/3] Building backend...
go build -o bhl-oms.exe ./cmd/server/ 2>&1
if errorlevel 1 (
    echo.
    echo      BUILD FAILED! See errors above.
    pause
    exit /b 1
)
echo      Build OK.

REM Start backend
echo.
echo [3/3] Starting backend on :8080...
echo      (Press Ctrl+C to stop)
echo.

set DB_URL=postgres://bhl:bhl_dev@localhost:5433/bhl_dev?sslmode=disable
set REDIS_URL=redis://localhost:6379/0
set JWT_PRIVATE_KEY_PATH=keys/private.pem
set JWT_PUBLIC_KEY_PATH=keys/public.pem
set VRP_SOLVER_URL=http://127.0.0.1:8090
set GIN_MODE=debug
set JWT_REFRESH_TTL=168h
set GROQ_API_KEY=REDACTED_GROQ_API_KEY
set INTEGRATION_MOCK=true
set ENV=development

bhl-oms.exe
