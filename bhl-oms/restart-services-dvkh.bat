@echo off
REM Start Docker services for BHL OMS
REM This script starts PostgreSQL, Redis, OSRM, and VRP containers

setlocal enabledelayedexpansion

echo [%date% %time%] Starting BHL OMS Docker services...
cd /d "D:\Beer HL\bhl-oms"

echo [%date% %time%] Starting docker-compose services...
docker-compose up -d --no-build 2>&1

echo [%date% %time%] Waiting 10 seconds for services to initialize...
timeout /t 10 /nobreak

echo [%date% %time%] Checking container status...
docker ps -a --filter "name=bhl-oms" --format "table {{.Names}}\t{{.Status}}"

echo.
echo [%date% %time%] Services started. Logs:
docker logs --tail 20 bhl-oms-postgres-1 2>&1

echo.
echo Press any key to close this window...
pause
