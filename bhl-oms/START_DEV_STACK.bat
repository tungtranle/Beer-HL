@echo off
cd /d "%~dp0"
echo [%date% %time%] Starting BHL Dev Stack...

REM Check Docker is running
docker ps >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker daemon is not running. Please start Docker Desktop.
    pause
    exit /b 1
)

echo [%date% %time%] Starting Docker Compose services (PostgreSQL, Redis, VRP, OSRM)...
docker compose up -d

echo [%date% %time%] Waiting for services to be ready...
timeout /t 5 /nobreak

echo [%date% %time%] Checking service health...
for /L %%i in (1,1,30) do (
    docker ps --filter "status=running" | find "postgres" >nul && (
        echo [%date% %time%] ✓ PostgreSQL ready
        goto postgres_ok
    )
    timeout /t 1 /nobreak
)

:postgres_ok
echo [%date% %time%] All services starting. Containers:
docker ps

echo.
echo [%date% %time%] Dev stack is now running:
echo   - PostgreSQL: localhost:5434
echo   - Redis: localhost:6379
echo   - OSRM: localhost:5000
echo   - VRP: localhost:8090
echo.
echo Keep this window open while developing.
pause
