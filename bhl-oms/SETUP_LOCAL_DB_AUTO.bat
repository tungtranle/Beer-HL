@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
echo Requesting administrator access to setup database...
echo (Click YES on the UAC prompt)
echo.
powershell -Command "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File ""%~dp0setup-db-elevated.ps1""' -Verb RunAs -Wait"
echo.
echo Done. Now double-click START_BACKEND_LOCAL.bat
pause
