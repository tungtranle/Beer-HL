@echo off
REM Restart local VRP solver container (Windows Docker Desktop)
REM Picks up code changes mounted via volume, OR rebuilds if needed.
echo Restarting bhl-oms-vrp-1 ...
docker restart bhl-oms-vrp-1
echo Done. Sleeping 4s for healthcheck...
timeout /t 4 /nobreak >nul
echo Healthcheck:
curl -s http://localhost:8090/health
echo.
