@echo off
:: ============================================================
:: apply_ai_demo_seed.bat
:: Áp dụng seed data để trải nghiệm đầy đủ AI-native features
:: Double-click để chạy — an toàn, không xóa data lịch sử
:: ============================================================
setlocal

echo.
echo [AI Demo Seed] Copying seed script to postgres container...
docker cp "%~dp0scripts\seed_ai_demo_data.sql" bhl-oms-postgres-1:/tmp/seed_ai_demo.sql

echo [AI Demo Seed] Running seed script...
docker exec bhl-oms-postgres-1 psql -U bhl -d bhl_dev -f /tmp/seed_ai_demo.sql

echo.
echo [AI Demo Seed] DONE. 
echo.
echo Buoc tiep theo:
echo   1. Lay Gemini API key mien phi tai: https://aistudio.google.com
echo   2. Set bien moi truong TRUOC KHI start backend:
echo        set GEMINI_API_KEY=YOUR_KEY_HERE
echo   3. Khoi dong lai backend (go run cmd/server/main.go)
echo   4. Kiem tra log: tim dong "ai_initialized" -> provider phai la "gemini-2.0-flash->..."
echo   5. Mo dashboard -> Brief dieu phoi phai co noi dung thuc tu Gemini
echo.
pause
