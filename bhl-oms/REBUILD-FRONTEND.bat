@echo off
chcp 65001 >nul 2>&1
setlocal

echo =============================================
echo  BHL OMS - Rebuild Frontend (Clarity Fix)
echo =============================================
echo.

cd /d "%~dp0"

REM -- Kill old frontend on port 3000 --
echo [1/4] Stopping old frontend (port 3000)...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    echo      Killing PID %%a
    powershell -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue" >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo      Done.

REM -- Set Clarity env var --
echo [2/4] Setting NEXT_PUBLIC_CLARITY_ID=wgqlli4s7j...
set NEXT_PUBLIC_CLARITY_ID=wgqlli4s7j

REM -- Build frontend --
echo [3/4] Building frontend (this takes 1-3 minutes)...
cd web
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build failed! Check errors above.
    pause
    exit /b 1
)
echo      Build OK!

REM -- Start frontend in production mode --
echo [4/4] Starting frontend on port 3000...
start "BHL Frontend" cmd /k "set NEXT_PUBLIC_CLARITY_ID=wgqlli4s7j && npm start"

echo.
echo =============================================
echo  Frontend rebuild DONE!
echo  - Site: http://localhost:3000 (or https://bhl.symper.us)
echo  - Microsoft Clarity: wgqlli4s7j
echo  - Cookie consent banner: enabled
echo =============================================
echo.
pause
