@echo off
cd /d "%~dp0"
:menu
cls
echo ==============================================
echo   BHL OMS - SERVER TOOLS
echo ==============================================
echo.
echo   1. Thiet lap ket noi server lan dau
echo   2. Deploy code len server
echo   3. Dua data hien tai tren may nay len server
echo   4. Nap file dump/sql lich su len server
echo   5. Mo huong dan deploy
echo   0. Thoat
echo.
set /p choice=Chon chuc nang: 

if "%choice%"=="1" goto setup
if "%choice%"=="2" goto deploy
if "%choice%"=="3" goto syncfull
if "%choice%"=="4" goto importhistory
if "%choice%"=="5" goto guide
if "%choice%"=="0" goto end

echo Lua chon khong hop le.
pause
goto menu

:setup
call "%~dp0SETUP_SERVER_CONNECTION.bat"
goto menu

:deploy
call "%~dp0DEPLOY_CODE_ONLY.bat"
goto menu

:syncfull
call "%~dp0SYNC_FULL_DATA_TO_SERVER_ONCE.bat"
goto menu

:importhistory
call "%~dp0IMPORT_HISTORY_DUMP_TO_SERVER.bat"
goto menu

:guide
start "" "%~dp0docs\DEPLOY_GUIDE.md"
goto menu

:end