@echo off
:: ============================================================
:: start-ai-full.bat
:: Khởi động backend với AI key để trải nghiệm AI đầy đủ
::
:: Đang dùng: Groq (14,400 req/day, free)
:: Provider chain: Gemini → Groq → Mock
:: ============================================================

:: ===== GEMINI (optional, 1,500 req/day) =====
SET GEMINI_API_KEY=
:: ============================================

:: ===== GROQ (active, 14,400 req/day) ========
SET GROQ_API_KEY=REDACTED_GROQ_API_KEY
:: ============================================

IF "%GEMINI_API_KEY%"=="" IF "%GROQ_API_KEY%"=="" (
    echo [WARN] Chua co AI key nao duoc cau hinh!
    echo        Mo file start-ai-full.bat bang Notepad va dien key vao.
    echo        Lay Groq key mien phi tai: https://console.groq.com
    echo.
    echo Tiep tuc se chay o che do Mock ^(AI se khong co noi dung thuc^)...
) ELSE (
    IF NOT "%GROQ_API_KEY%"=="" echo [AI] Groq key configured ^(14400 req/day^)
    IF NOT "%GEMINI_API_KEY%"=="" echo [AI] Gemini key configured ^(1500 req/day^)
)

:: Kill backend cu tren port 8080
echo [1/3] Stopping old backend...
FOR /F "tokens=5" %%a IN ('netstat -aon ^| findstr ":8080.*LISTENING"') DO (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Set env vars
SET DB_URL=postgres://bhl:bhl_dev@localhost:5433/bhl_dev?sslmode=disable
SET REDIS_URL=redis://localhost:6379
SET JWT_PRIVATE_KEY_PATH=./keys/private.pem
SET JWT_PUBLIC_KEY_PATH=./keys/public.pem
SET SERVER_PORT=8080
SET VRP_SOLVER_URL=http://localhost:8090
SET OSRM_URL=http://localhost:5000
SET INTEGRATION_MOCK=true
SET ENV=development

:: Start backend
echo [2/3] Starting backend with AI key...
cd /d "%~dp0"
start "BHL Backend" cmd /k "go run cmd/server/main.go"
timeout /t 4 /nobreak >nul

:: Health check
echo [3/3] Health check...
curl -s http://localhost:8080/health && echo. && echo [OK] Backend started!
echo.
echo Dashboard: http://localhost:3000
echo AI features: mo Dashboard -> Brief dieu phoi / Control Tower / Customers
echo.
pause
