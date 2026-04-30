@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
echo ============================================
echo  BHL OMS - Start Backend (Minimal)
echo  This script is minimal and keeps the window open to show errors.
echo ============================================
echo.
if not exist "%~dp0logs" mkdir "%~dp0logs"
set LOGFILE=%~dp0logs\backend-minimal-%RANDOM%.log
echo Logging to %LOGFILE%
echo Setting essential env vars...
set DB_URL=postgres://bhl:bhl_dev@127.0.0.1:5433/bhl_dev?sslmode=disable
set REDIS_URL=redis://localhost:6379/0
set SERVER_PORT=8080
set OSRM_URL=http://localhost:5000
set ENV=development

echo Starting Go backend (output will be saved to %LOGFILE%)...

powershell -NoProfile -Command "& { & go run cmd/server/main.go 2>&1 | Tee-Object -FilePath '%LOGFILE%' }"

echo.
echo Backend process exited. See log: %LOGFILE%
echo Press any key to close...
pause >nul
