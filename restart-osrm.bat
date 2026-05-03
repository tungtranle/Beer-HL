@echo off
cd /d "d:\Beer HL\bhl-oms"
echo Starting OSRM container...
docker compose up -d osrm
timeout /t 3 /nobreak
docker logs --tail 20 bhl-oms-osrm-1
echo.
echo Testing OSRM health...
powershell -Command "try { $r = Invoke-WebRequest http://localhost:5000/health -UseBasicParsing; Write-Host 'OSRM OK: ' $r.StatusCode } catch { Write-Host 'OSRM not responding' }"
pause
