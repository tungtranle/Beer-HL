@echo off
echo ============================================
echo  Restart VRP Solver (Docker container)
echo  Port: 8090
echo ============================================
echo.

echo Checking whether /app/main.py is bind-mounted into container...
docker inspect bhl-oms-vrp-1 > "%TEMP%\vrp_inspect.txt" 2>nul
findstr /C:"/app/main.py" "%TEMP%\vrp_inspect.txt" >nul 2>&1
if %ERRORLEVEL% EQU 0 goto SKIP_DOCKER_CP

echo Copying updated main.py to container...
docker cp "vrp-solver\main.py" bhl-oms-vrp-1:/app/main.py
if errorlevel 1 (
    echo WARNING: docker cp failed; will continue with restart only.
) else (
    echo File copied OK.
)

:SKIP_DOCKER_CP
echo Detected bind mount to /app/main.py; skipping docker cp (if copy was skipped earlier, file changes on host are used by the container).

echo.
echo Restarting VRP solver container...
docker restart bhl-oms-vrp-1
if errorlevel 1 (
    echo ERROR: Could not restart container.
    pause
    exit /b 1
)

echo.
echo Waiting for solver to start...
timeout /t 5 /nobreak >nul

echo Checking health...
curl -s http://localhost:8090/health
echo.
echo.
echo ============================================
echo  VRP Solver restarted! Port 8090 ready.
echo ============================================
pause
