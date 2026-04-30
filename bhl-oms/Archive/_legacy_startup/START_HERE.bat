@echo off
:: BHL OMS Quick Start — Double-click to run
:: Creates a PowerShell window that starts all services
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoExit -File "start.ps1"
