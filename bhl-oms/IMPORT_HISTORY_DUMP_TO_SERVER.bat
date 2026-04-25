@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0import-data-to-server.ps1"
pause