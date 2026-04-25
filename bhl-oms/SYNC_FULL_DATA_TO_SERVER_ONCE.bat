@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0sync-full-data-once.ps1"
pause