@echo off
REM Restart VRP Solver service
cd /d "d:\Beer HL\bhl-oms"
echo Restarting VRP Solver...
docker compose restart vrp
echo Done! VRP Solver restarting...
pause
