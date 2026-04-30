@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0\web"

echo ============================================
echo  BHL OMS - Start Frontend (Next.js :3000)
echo  URL : http://localhost:3000
echo  Keep this window open while using the app!
echo ============================================
echo.

REM Kill any existing process on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING" 2^>nul') do (
    echo Stopping old frontend process (PID %%a)...
    powershell -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue" >nul 2>&1
)

echo Starting Next.js on :3000 ...
echo.
npm run dev
