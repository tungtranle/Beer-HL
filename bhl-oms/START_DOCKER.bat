@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
title BHL OMS — START_DOCKER (Full Docker stack)

REM =====================================================================
REM  BHL OMS — START_DOCKER.bat
REM  Mode: Full Docker for data layer (postgres :5434, redis :6379,
REM        vrp :8090, osrm :5000) + Go backend + Next.js frontend run
REM        natively on Windows.
REM
REM  Use this when you want a CLEAN slate (Docker-managed DB, no Windows
REM  PostgreSQL service required). Double-click from File Explorer.
REM
REM  WARNING: do NOT run from VS Code integrated terminal — Docker
REM  lifecycle commands can freeze VS Code on this machine.
REM =====================================================================

cd /d "%~dp0"

echo.
echo ================================================================
echo   BHL OMS  --  START_DOCKER  (full Docker data layer)
echo ================================================================
echo   PostgreSQL :5434   (Docker bhl-oms-postgres-1)
echo   Redis      :6379   (Docker bhl-oms-redis-1)
echo   VRP solver :8090   (Docker bhl-oms-vrp-1)
echo   OSRM       :5000   (Docker bhl-oms-osrm-1)
echo   Backend    :8080   (Go native)
echo   Frontend   :3000   (Next.js native)
echo ================================================================
echo.

REM --- [1/7] Free ports 8080 + 3000 ---------------------------------
echo [1/7] Cleaning up old backend/frontend on :8080 and :3000 ...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080 " ^| findstr "LISTENING" 2^>nul') do (
    powershell -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue" >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING" 2^>nul') do (
    powershell -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue" >nul 2>&1
)
echo       OK
echo.

REM --- [2/7] Start Docker Desktop ----------------------------------
echo [2/7] Ensuring Docker Desktop is running ...
docker info >nul 2>&1
if errorlevel 1 (
    echo       Launching Docker Desktop ...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    set /a _retry=0
    :wait_docker
    timeout /t 4 /nobreak >nul
    set /a _retry+=1
    docker info >nul 2>&1
    if errorlevel 1 (
        if !_retry! lss 25 goto wait_docker
        echo       ERROR: Docker daemon did not start within ~100s. Aborting.
        pause
        exit /b 1
    )
)
echo       OK
echo.

REM --- [3/7] Stop conflicting Windows services on :5434 / :6379 ---
echo [3/7] Checking for port conflicts ...
netstat -ano | findstr ":5434 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo       WARN: Something already listening on :5434 (Docker postgres needs this port).
)
sc query Redis 2>nul | find "RUNNING" >nul
if not errorlevel 1 (
    echo       NOTE: Windows Redis service is running on :6379 — Docker Redis will conflict.
    echo             Stopping Windows Redis temporarily ...
    net stop Redis >nul 2>&1
)
echo       OK
echo.

REM --- [4/7] docker compose up -d postgres redis vrp osrm ----------
echo [4/7] Bringing up Docker stack (postgres, redis, vrp, osrm) ...
docker compose up -d postgres redis vrp
if errorlevel 1 (
    echo       ERROR: docker compose up failed for postgres/redis/vrp.
    pause
    exit /b 1
)

if exist "%~dp0osrm-data\vietnam-latest.osrm" (
    docker compose up -d osrm
    if errorlevel 1 (
        echo       WARN: OSRM container failed to start. Routing falls back to Haversine.
    )
) else (
    echo       WARN: osrm-data\vietnam-latest.osrm missing. Run setup-osrm.ps1 once.
)
echo       OK
echo.

REM --- [5/7] Wait for postgres + vrp + osrm readiness -------------
echo [5/7] Waiting for services to be healthy ...
set /a _retry=0
:wait_pg
docker exec bhl-oms-postgres-1 pg_isready -U bhl >nul 2>&1
if errorlevel 1 (
    set /a _retry+=1
    if !_retry! lss 20 (
        timeout /t 2 /nobreak >nul
        goto wait_pg
    )
    echo       ERROR: Postgres did not become ready.
    pause
    exit /b 1
)
echo       OK   PostgreSQL ready

set /a _retry=0
:wait_vrp
curl -sf http://localhost:8090/status >nul 2>&1
if errorlevel 1 (
    set /a _retry+=1
    if !_retry! lss 8 (
        timeout /t 2 /nobreak >nul
        goto wait_vrp
    )
    echo       WARN: VRP solver not responding on :8090.
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
    echo       WARN: OSRM not responding on :5000.
) else (
    echo       OK   OSRM
)
echo.

REM --- [6/7] Build + start Go backend -----------------------------
echo [6/7] Building Go backend ...
go build -o bhl-oms.exe ./cmd/server
if errorlevel 1 (
    echo       BUILD FAILED. See errors above.
    pause
    exit /b 1
)
echo       Build OK.

set ENV=development
REM NOTE: Docker postgres maps host :5434 -> container :5432
set DB_URL=postgres://bhl:bhl_dev@127.0.0.1:5434/bhl_dev?sslmode=disable
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

if not exist "%~dp0logs" mkdir "%~dp0logs"
set BACKEND_LOG=%~dp0logs\backend-%RANDOM%.log
echo       Starting backend in NEW window (log: %BACKEND_LOG%) ...
start "BHL OMS Backend (:8080)" cmd /k "title BHL OMS Backend && cd /d ""%~dp0"" && bhl-oms.exe > ""%BACKEND_LOG%"" 2>&1"
echo.

REM --- [7/7] Start Next.js frontend -------------------------------
echo [7/7] Starting Next.js frontend on :3000 ...
if not exist "%~dp0web\node_modules" (
    echo       node_modules missing. Running npm install (one-time) ...
    pushd "%~dp0web"
    call npm install
    popd
)
start "BHL OMS Frontend (:3000)" cmd /k "title BHL OMS Frontend && cd /d ""%~dp0web"" && npm run dev"
echo.

echo Waiting 8s for backend warm-up ...
timeout /t 8 /nobreak >nul

curl -sf http://localhost:8080/v1/app/version >nul 2>&1
if errorlevel 1 (
    echo       WARN: backend health check failed. Check Backend window.
) else (
    echo       OK   Backend /v1/app/version
)

echo.
echo ================================================================
echo   BHL OMS DOCKER stack is up
echo ================================================================
echo   Frontend     http://localhost:3000
echo   Backend API  http://localhost:8080/v1/app/version
echo   VRP solver   http://localhost:8090/status
echo   OSRM         http://localhost:5000/nearest/v1/driving/106.6881,20.8449
echo.
echo   Containers:
docker ps --format "    {{.Names}}  {{.Status}}" --filter "name=bhl-oms"
echo.
echo   Login:  admin / demo123
echo   Backend log: %BACKEND_LOG%
echo   To stop:     run STOP_DOCKER.bat OR close Backend/Frontend windows
echo                + run: docker compose stop
echo ================================================================
echo.
pause
endlocal
