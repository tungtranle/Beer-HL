@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
title BHL OMS — START_LOCAL (Windows native PG + Redis + Docker VRP/OSRM)

REM =====================================================================
REM  BHL OMS — START_LOCAL.bat
REM  Mode: Windows-native services (PostgreSQL :5433, Redis :6379)
REM        + Docker (VRP :8090, OSRM :5000)
REM        + Go backend (:8080), Next.js frontend (:3000)
REM
REM  Use this AFTER turning off Docker / VS Code / restarting laptop.
REM  Double-click from File Explorer OR run from any terminal.
REM =====================================================================

cd /d "%~dp0"

echo.
echo ================================================================
echo   BHL OMS  --  START_LOCAL  (Windows native + Docker hybrid)
echo ================================================================
echo   PostgreSQL :5433   (Windows service)
echo   Redis      :6379   (Windows service)
echo   VRP solver :8090   (Docker container bhl-oms-vrp-1)
echo   OSRM       :5000   (Docker container bhl-oms-osrm-1)
echo   Backend    :8080   (Go native)
echo   Frontend   :3000   (Next.js native)
echo ================================================================
echo.

REM --- [1/8] Free ports 8080 + 3000 (kill stale Go / node) ---------
echo [1/8] Cleaning up old backend/frontend on :8080 and :3000 ...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080 " ^| findstr "LISTENING" 2^>nul') do (
    powershell -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue" >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING" 2^>nul') do (
    powershell -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue" >nul 2>&1
)
echo       OK
echo.

REM --- [2/8] Start Windows PostgreSQL service if not running --------
echo [2/8] Ensuring PostgreSQL 16 service is running ...
sc query "postgresql-x64-16" 2>nul | find "RUNNING" >nul
if errorlevel 1 (
    net start "postgresql-x64-16" >nul 2>&1
    if errorlevel 1 (
        echo       WARN: cannot start postgresql-x64-16. Trying generic name...
        net start "postgresql" >nul 2>&1
    )
)
set PGPASSWORD=bhl_dev
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev -c "SELECT 1;" >nul 2>&1
if errorlevel 1 (
    echo.
    echo       ERROR: PostgreSQL on :5433 is not reachable.
    echo       Run SETUP_LOCAL_DB.bat once to install + create DB.
    echo.
    pause
    exit /b 1
)
echo       OK  (PostgreSQL 16 listening on :5433)
echo.

REM --- [3/8] Ensure Windows Redis service is running ---------------
echo [3/8] Ensuring Redis service is running ...
sc query Redis 2>nul | find "RUNNING" >nul
if errorlevel 1 (
    net start Redis >nul 2>&1
)
sc query Redis 2>nul | find "RUNNING" >nul
if errorlevel 1 (
    echo       WARN: Redis Windows service not running. GPS realtime will be limited.
) else (
    echo       OK  (Redis listening on :6379)
)
echo.

REM --- [4/8] Start Docker Desktop if needed (for VRP + OSRM) -------
echo [4/8] Starting Docker Desktop (needed for VRP + OSRM) ...
docker info >nul 2>&1
if errorlevel 1 (
    echo       Docker daemon not running. Launching Docker Desktop ...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    set /a _retry=0
    :wait_docker
    timeout /t 4 /nobreak >nul
    set /a _retry+=1
    docker info >nul 2>&1
    if errorlevel 1 (
        if !_retry! lss 25 goto wait_docker
        echo       ERROR: Docker Desktop did not become ready within ~100s.
        echo              VRP and OSRM will be unavailable. Continuing without them.
        goto skip_docker
    )
)
echo       OK  (Docker daemon ready)

REM --- [4b] Start VRP container -----------------------------------
docker ps --format "{{.Names}}" 2>nul | findstr /b /c:"bhl-oms-vrp-1" >nul
if errorlevel 1 (
    echo       Starting VRP container ...
    docker compose up -d vrp >nul 2>&1
    if errorlevel 1 (
        echo       WARN: failed to start VRP container. Check docker compose logs vrp.
    )
) else (
    echo       VRP container already running.
)

REM --- [4c] Start OSRM container -----------------------------------
if exist "%~dp0osrm-data\vietnam-latest.osrm" (
    docker ps --format "{{.Names}}" 2>nul | findstr /b /c:"bhl-oms-osrm-1" >nul
    if errorlevel 1 (
        echo       Starting OSRM container ...
        docker compose up -d osrm >nul 2>&1
        if errorlevel 1 (
            echo       WARN: failed to start OSRM container. Routing will fall back to Haversine.
        )
    ) else (
        echo       OSRM container already running.
    )
) else (
    echo       WARN: osrm-data\vietnam-latest.osrm missing. Run setup-osrm.ps1 once.
)
:skip_docker
echo.

REM --- [5/8] Wait for VRP + OSRM readiness (best effort) ----------
echo [5/8] Waiting for VRP and OSRM to be reachable ...
set /a _retry=0
:wait_vrp
curl -sf http://localhost:8090/status >nul 2>&1
if errorlevel 1 (
    set /a _retry+=1
    if !_retry! lss 8 (
        timeout /t 2 /nobreak >nul
        goto wait_vrp
    )
    echo       WARN: VRP solver not responding on :8090 (planning/optimize may fail).
) else (
    echo       OK   VRP solver
)
set /a _retry=0
:wait_osrm
curl -sf "http://localhost:5000/nearest/v1/driving/106.6881,20.8449" >nul 2>&1
if errorlevel 1 (
    set /a _retry+=1
    if !_retry! lss 8 (
        timeout /t 2 /nobreak >nul
        goto wait_osrm
    )
    echo       WARN: OSRM not responding on :5000 (route geometry will be unavailable).
) else (
    echo       OK   OSRM
)
echo.

REM --- [6/8] Verify JWT keys --------------------------------------
echo [6/8] Verifying JWT keys ...
if not exist "%~dp0keys\private.pem" (
    echo       ERROR: keys\private.pem missing. Run start-demo.ps1 once to generate.
    pause
    exit /b 1
)
echo       OK
echo.

REM --- [7/8] Build + start Go backend on :8080 --------------------
echo [7/8] Building Go backend ...
go build -o bhl-oms.exe ./cmd/server
if errorlevel 1 (
    echo       BUILD FAILED. See errors above.
    pause
    exit /b 1
)
echo       Build OK.

set ENV=development
set DB_URL=postgres://bhl:bhl_dev@127.0.0.1:5433/bhl_dev?sslmode=disable
set REDIS_URL=redis://localhost:6379/0
set JWT_PRIVATE_KEY_PATH=./keys/private.pem
set JWT_PUBLIC_KEY_PATH=./keys/public.pem
set JWT_ACCESS_TTL=15m
set JWT_REFRESH_TTL=168h
set SERVER_PORT=8080
set VRP_SOLVER_URL=http://localhost:8090
set OSRM_URL=http://localhost:5000
set INTEGRATION_MOCK=true
set GIN_MODE=debug
set LOG_LEVEL=INFO
REM Inherit GROQ_API_KEY / GEMINI_API_KEY from .env if present (loaded by Go config).

if not exist "%~dp0logs" mkdir "%~dp0logs"
set BACKEND_LOG=%~dp0logs\backend-%RANDOM%.log
echo       Starting backend in NEW window (log: %BACKEND_LOG%) ...
start "BHL OMS Backend (:8080)" cmd /k "title BHL OMS Backend && cd /d ""%~dp0"" && bhl-oms.exe > ""%BACKEND_LOG%"" 2>&1"
echo.

REM --- [8/8] Start Next.js frontend on :3000 ----------------------
echo [8/8] Starting Next.js frontend on :3000 ...
if not exist "%~dp0web\node_modules" (
    echo       node_modules missing. Running npm install (one-time) ...
    pushd "%~dp0web"
    call npm install
    popd
)
start "BHL OMS Frontend (:3000)" cmd /k "title BHL OMS Frontend && cd /d ""%~dp0web"" && npm run dev"
echo.

REM --- Health checks ----------------------------------------------
echo Waiting 8s for backend warm-up ...
timeout /t 8 /nobreak >nul

curl -sf http://localhost:8080/v1/app/version >nul 2>&1
if errorlevel 1 (
    echo       WARN: backend health check failed. Check the Backend window for errors.
) else (
    echo       OK   Backend /v1/app/version
)

echo.
echo ================================================================
echo   BHL OMS LOCAL is up
echo ================================================================
echo   Frontend     http://localhost:3000
echo   Backend API  http://localhost:8080/v1/app/version
echo   VRP solver   http://localhost:8090/status
echo   OSRM         http://localhost:5000/nearest/v1/driving/106.6881,20.8449
echo.
echo   Login:  admin / demo123  (or any user / demo123)
echo.
echo   Backend log: %BACKEND_LOG%
echo   To stop:    close the Backend and Frontend windows.
echo ================================================================
echo.
pause
endlocal
