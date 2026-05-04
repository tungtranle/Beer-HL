@echo off
REM ===== RESTART VRP SOLVER =====
REM This script restarts the VRP Solver Docker container
REM Run this from File Explorer if the VRP solver stops responding

cd /d "d:\Beer HL\bhl-oms"

echo.
echo ===== RESTARTING VRP SOLVER =====
echo.

REM Stop the VRP container
echo [1/3] Stopping VRP Solver container...
docker compose stop vrp
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to stop VRP Solver
    pause
    exit /b 1
)

REM Wait a moment
timeout /t 2 /nobreak

REM Start the VRP container
echo [2/3] Starting VRP Solver container...
docker compose start vrp
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to start VRP Solver
    pause
    exit /b 1
)

REM Wait for VRP to be ready
echo [3/3] Waiting for VRP Solver to be ready...
timeout /t 3 /nobreak

REM Health check
echo.
echo ===== VERIFYING VRP SOLVER HEALTH =====
docker compose logs --tail=10 vrp
echo.
echo VRP Solver restart complete! ✓
echo.
pause
