@echo off
chcp 65001 >nul 2>&1
echo ============================================
echo  BHL OMS - Start OSRM Routing Engine
echo ============================================
echo.
echo [1/2] Dung container cu...
docker stop bhl-oms-osrm-1 >nul 2>&1
docker rm bhl-oms-osrm-1 >nul 2>&1
echo [2/2] Khoi dong OSRM...
docker run -d --name bhl-oms-osrm-1 -v "d:/Beer HL/bhl-oms/osrm-data:/data" -p 5000:5000 osrm/osrm-backend:v5.25.0 osrm-routed --algorithm mld --max-table-size 500 /data/vietnam-latest.osrm
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Khoi dong that bai. Kiem tra Docker Desktop.
    pause
    exit /b 1
)
echo.
echo OK - Cho 20 giay OSRM load du lieu...
timeout /t 20 /nobreak >nul
curl -sf "http://localhost:5000/nearest/v1/driving/106.6881,20.8449" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo OSRM san sang! http://localhost:5000
) else (
    echo Cho them 30 giay...
    timeout /t 30 /nobreak >nul
    curl -sf "http://localhost:5000/nearest/v1/driving/106.6881,20.8449" >nul 2>&1
    if %ERRORLEVEL% EQU 0 ( echo OSRM san sang! ) else ( echo WARN: OSRM chua ready. )
)
echo.
pause
