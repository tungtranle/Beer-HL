@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0export-full-data-to-usb.ps1"
pause