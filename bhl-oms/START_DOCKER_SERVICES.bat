@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo ============================================
echo  BHL OMS - Docker Services (OSRM + VRP)
echo ============================================
echo.
echo Starting OSRM (port 5000) and VRP Solver (port 8090)...
echo Keep this window open while using the app!
echo.

docker compose up -d osrm vrp

echo.
echo Waiting for services to be ready...
timeout /t 10 /nobreak

netstat -ano | findstr ":5000 :8090" | findstr "LISTENING"
if errorlevel 1 (
    echo.
    echo Services may still be starting. Check with:
    echo   docker compose ps
    echo   docker compose logs -f osrm
    echo   docker compose logs -f vrp
) else (
    echo.
    echo Services are ready!
)

echo.
pause
