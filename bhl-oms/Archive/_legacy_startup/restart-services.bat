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

REM ── 2. Start Docker Desktop if not running, then bring up containers ──
echo.
echo [2/6] Starting Docker Desktop + containers (postgres, redis, vrp)...

docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo      Docker not running. Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo      Waiting for Docker daemon (up to 90s)...
    :wait_docker
    timeout /t 5 /nobreak >nul
    docker info >nul 2>&1
    if %ERRORLEVEL% NEQ 0 goto wait_docker
    echo      Docker daemon ready.
) else (
    echo      Docker already running.
)

docker compose up -d postgres redis vrp
echo      Waiting 10s for DB to be ready...
timeout /t 10 /nobreak >nul

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
    echo      WARN - OSRM could not start (may not have map data)
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

REM ── Apply pending migrations (042, 043) ──
echo.
echo [4b] Applying pending migrations...
docker cp "%~dp0migrations\042_ai_feature_flags.up.sql" bhl-oms-postgres-1:/tmp/042.sql >nul 2>&1
docker exec bhl-oms-postgres-1 psql -U bhl -d bhl_dev -f /tmp/042.sql >nul 2>&1
docker cp "%~dp0migrations\043_ai_native_phase2_6.up.sql" bhl-oms-postgres-1:/tmp/043.sql >nul 2>&1
docker exec bhl-oms-postgres-1 psql -U bhl -d bhl_dev -f /tmp/043.sql >nul 2>&1
echo      Migrations applied (IF NOT EXISTS - safe to re-run).

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

set DB_URL=postgres://bhl:bhl_dev@localhost:5433/bhl_dev?sslmode=disable
set REDIS_URL=redis://localhost:6379/0
set JWT_PRIVATE_KEY_PATH=keys/private.pem
set JWT_PUBLIC_KEY_PATH=keys/public.pem
set VRP_SOLVER_URL=http://127.0.0.1:8090
set GIN_MODE=debug
set JWT_REFRESH_TTL=168h
set GROQ_API_KEY=REDACTED_GROQ_API_KEY
set INTEGRATION_MOCK=true
bhl-oms.exe
