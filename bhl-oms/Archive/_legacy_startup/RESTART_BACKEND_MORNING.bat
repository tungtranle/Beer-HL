@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"

echo ============================================
echo  Restart backend để load DEMO-MORNING-01
echo ============================================

REM Kill existing backend
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING" 2^>nul') do (
    echo Stopping old backend (PID %%a)...
    powershell -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue" >nul 2>&1
)
timeout /t 2 /nobreak >nul

REM Start new binary
echo Starting new backend...
start "BHL OMS Backend" bhl-oms.exe

echo Done. Backend restarting on :8080
pause
