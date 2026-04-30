@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"

echo ============================================
echo  BHL OMS - Start Backend (Local PG, No Docker)
echo  DB  : PostgreSQL 16 on port 5433
echo  API : http://localhost:8080
echo  Keep this window open while using the app!
echo ============================================
echo.

REM Kill any existing backend on port 8080 (match IPv4 and IPv6)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING" 2^>nul') do (
    echo Stopping old backend process (PID %%a)...
    powershell -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue" >nul 2>&1
)

REM Verify DB is reachable before starting
set PGPASSWORD=bhl_dev
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U bhl -p 5433 -h 127.0.0.1 -d bhl_dev -c "SELECT 1;" >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Cannot connect to database!
    echo Please run SETUP_LOCAL_DB.bat first to create the database.
    echo.
    pause
    exit /b 1
)
echo DB connection OK (PostgreSQL 16, port 5433)
echo.

REM Set environment variables for local PG (no Docker)
set DB_URL=postgres://bhl:bhl_dev@127.0.0.1:5433/bhl_dev?sslmode=disable
REM Note: port 5433 = PostgreSQL 16 (local, no Docker needed)
set REDIS_URL=redis://localhost:6379/0
set JWT_PRIVATE_KEY_PATH=./keys/private.pem
set JWT_PUBLIC_KEY_PATH=./keys/public.pem
set JWT_ACCESS_TTL=15m
set JWT_REFRESH_TTL=7d
set SERVER_PORT=8080
set VRP_SOLVER_URL=http://localhost:8090
set OSRM_URL=http://localhost:5000
set GROQ_API_KEY=REDACTED_GROQ_API_KEY
set GEMINI_API_KEY=
set ENV=development
set LOG_LEVEL=INFO
set GIN_MODE=debug

echo Starting Go backend on :8080 ...
echo (Redis unavailable is OK - GPS features will be limited)
echo.
echo Press Ctrl+C to stop.
echo.

REM Ensure logs directory exists
if not exist "%~dp0logs" mkdir "%~dp0logs"

REM Run backend and capture stdout/stderr to log file
REM Use a simple random-based logfile name to avoid parsing issues with date/time
set LOGFILE=%~dp0logs\backend-%RANDOM%.log
echo Starting backend, logging to %LOGFILE%
go run cmd/server/main.go > "%LOGFILE%" 2>&1

if errorlevel 1 (
    echo.
    echo Backend exited with an error. See log: %LOGFILE%
    echo Press any key to close this window...
    pause >nul
    exit /b 1
) else (
    echo.
    echo Backend exited normally. See log: %LOGFILE%
    echo Press any key to close this window...
    pause >nul
)
