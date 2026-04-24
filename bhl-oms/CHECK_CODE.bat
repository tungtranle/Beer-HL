@echo off
:: BHL Code Quality Check — Double-click to run
:: Kiem tra LH-02, LH-03 truoc khi commit code
cd /d "%~dp0"
echo.
echo Dang kiem tra code quality...
echo.
powershell -ExecutionPolicy Bypass -File "check-code-quality.ps1"
echo.
pause
