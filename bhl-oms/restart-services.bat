@echo off
REM ============================================
REM  BHL OMS - Restart Docker services + Backend + Frontend
REM  Run this OUTSIDE VS Code (double-click or cmd)
REM  NEVER use docker compose from VS Code terminal!
REM ============================================
chcp 65001 >nul 2>&1
setlocal

cd /d "%~dp0"
echo ============================================
echo  BHL OMS - Restart All Services
echo ============================================

REM ── 1. Kill old Go backend on port 8080 and old frontend on 3000 ──
echo.
echo [1/6] Cleaning up old backend/frontend (ports 8080, 3000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080 " ^| findstr "LISTENING"') do (
    echo      Killing backend PID %%a
    powershell -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue"
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    echo      Killing frontend PID %%a
    powershell -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue"
)
echo      Done.

REM ── 2. Restart VRP solver (picks up volume-mounted main.py) ──
echo.
echo [2/6] Restarting VRP solver...
docker restart bhl-oms-vrp-1 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo      OK - VRP solver restarted
) else (
    echo      FAIL - VRP container not found
)

REM ── 3. Recreate OSRM with updated command (max-table-size) ──
echo.
echo [3/6] Recreating OSRM container...
docker stop bhl-oms-osrm-1 >nul 2>&1
docker rm bhl-oms-osrm-1 >nul 2>&1
docker run -d --name bhl-oms-osrm-1 ^
  --network bhl-oms_default ^
  --network-alias osrm ^
  -v "%cd%\osrm-data:/data" ^
  -p 5000:5000 ^
  osrm/osrm-backend:v5.25.0 ^
  osrm-routed --algorithm mld --max-table-size 500 /data/vietnam-latest.osrm
if %ERRORLEVEL% EQU 0 (
    echo      OK - OSRM started with max-table-size=500
) else (
    echo      FAIL - OSRM could not start
)

REM ── 4. Verify containers ──
echo.
echo [4/6] Container status:
docker ps --format "  {{.Names}}  {{.Status}}" --filter "name=bhl-oms"

echo.
echo Waiting 5s for OSRM to load data...
timeout /t 5 /nobreak >nul

curl -sf "http://localhost:5000/nearest/v1/driving/106.6881,20.8449" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo      OK - OSRM responding
) else (
    echo      WARN - OSRM not ready yet, may need more time
)

curl -sf "http://localhost:8090/status" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo      OK - VRP solver responding
) else (
    echo      WARN - VRP solver not ready yet
)

REM ── 5. Start frontend in separate window ──
echo.
echo [5/6] Starting frontend on :3000 in separate window...
start "BHL OMS Frontend" cmd /k "cd /d ""%cd%\web"" && npm run dev"
echo      Frontend launch requested.

REM ── 6. Build and start Go backend ──
echo.
echo [6/6] Building Go backend...
go build -o bhl-oms.exe ./cmd/server/
if errorlevel 1 (
    echo      BUILD FAILED!
    pause
    exit /b 1
)
echo      Build OK.

echo.
echo ============================================
echo  Starting backend on :8080
echo  Press Ctrl+C to stop
echo ============================================
echo.

set DB_URL=postgres://bhl:bhl_dev@localhost:5434/bhl_dev?sslmode=disable
set REDIS_URL=redis://localhost:6379/0
set JWT_PRIVATE_KEY_PATH=keys/private.pem
set JWT_PUBLIC_KEY_PATH=keys/public.pem
set VRP_SOLVER_URL=http://127.0.0.1:8090
set GIN_MODE=debug
set JWT_REFRESH_TTL=168h
bhl-oms.exe
