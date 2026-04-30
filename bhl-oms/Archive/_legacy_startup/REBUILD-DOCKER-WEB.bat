@echo off
chcp 65001 >nul 2>&1
setlocal

echo ============================================
echo  BHL OMS - Rebuild Docker web (Clarity Fix)
echo  Double-click from File Explorer
echo  KHONG chay trong VS Code terminal!
echo ============================================
echo.

cd /d "%~dp0"

echo [1/3] Rebuild Docker image "web" voi code moi...
docker compose -f docker-compose.prod.yml build --no-cache web
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build that bai! Kiem tra loi o tren.
    pause
    exit /b 1
)
echo      Build OK!

echo.
echo [2/3] Restart container web...
docker compose -f docker-compose.prod.yml up -d --no-deps web
if %errorlevel% neq 0 (
    echo ERROR: Restart that bai!
    pause
    exit /b 1
)
echo      Restart OK!

echo.
echo [3/3] Kiem tra container dang chay...
timeout /t 5 /nobreak >nul
docker compose -f docker-compose.prod.yml ps web

echo.
echo ============================================
echo  XONG! https://bhl.symper.us da duoc cap nhat
echo  Microsoft Clarity ID: wgqlli4s7j
echo  Reload trang va kiem tra Network - clarity.ms
echo ============================================
echo.
pause
