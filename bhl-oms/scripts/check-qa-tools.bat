@echo off
REM ============================================================
REM AQF QA Tools Status Check — Beer HL Project
REM Kiem tra nhanh cac tool da duoc cai hay chua (khong cai moi)
REM Double-click tu File Explorer de chay
REM ============================================================

echo ============================================================
echo AQF QA Tools — Status Check
echo Beer HL OMS-TMS-WMS
echo ============================================================
echo.

SET PASS=0
SET FAIL=0

REM ── Go ──────────────────────────────────────────────────────
WHERE go >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('go version 2^>nul') do set GOVER=%%i
    echo [OK] Go           : !GOVER!
    SET /A PASS+=1
) ELSE (
    echo [MISS] Go         : CHUA CAI — https://golang.org/dl/
    SET /A FAIL+=1
)

REM ── golangci-lint ────────────────────────────────────────────
WHERE golangci-lint >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('golangci-lint version 2^>nul') do set LINTVER=%%i
    echo [OK] golangci-lint: !LINTVER!
    SET /A PASS+=1
) ELSE (
    echo [MISS] golangci-lint: CHUA CAI — chay install-qa-tools.bat
    SET /A FAIL+=1
)

REM ── govulncheck ──────────────────────────────────────────────
WHERE govulncheck >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    echo [OK] govulncheck  : co
    SET /A PASS+=1
) ELSE (
    echo [MISS] govulncheck: CHUA CAI — chay install-qa-tools.bat
    SET /A FAIL+=1
)

REM ── gitleaks ─────────────────────────────────────────────────
WHERE gitleaks >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('gitleaks version 2^>nul') do set GLVER=%%i
    echo [OK] gitleaks     : !GLVER!
    SET /A PASS+=1
) ELSE (
    echo [MISS] gitleaks   : CHUA CAI — winget install gitleaks.gitleaks
    SET /A FAIL+=1
)

REM ── Node.js ──────────────────────────────────────────────────
WHERE node >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODEVER=%%i
    echo [OK] Node.js      : !NODEVER!
    SET /A PASS+=1
) ELSE (
    echo [MISS] Node.js    : CHUA CAI — https://nodejs.org (v20 LTS)
    SET /A FAIL+=1
)

REM ── Playwright ───────────────────────────────────────────────
IF EXIST "web\node_modules\.bin\playwright" (
    echo [OK] Playwright   : co trong web/node_modules
    SET /A PASS+=1
) ELSE (
    echo [MISS] Playwright : CHUA CAI — chay: scripts\install-qa-tools.bat
    SET /A FAIL+=1
)

REM ── Git pre-commit hook ──────────────────────────────────────
IF EXIST ".git\hooks\pre-commit" (
    echo [OK] Git hook     : pre-commit da cai
    SET /A PASS+=1
) ELSE (
    echo [MISS] Git hook   : CHUA CAI — chay: scripts\install-qa-tools.bat
    SET /A FAIL+=1
)

REM ── AQF golden files ─────────────────────────────────────────
echo.
echo --- AQF Golden Datasets ---
SET GOLDEN_OK=0
SET GOLDEN_MISS=0

IF EXIST "aqf\golden\credit.cases.json" (echo [OK] credit.cases.json & SET /A GOLDEN_OK+=1) ELSE (echo [MISS] credit.cases.json & SET /A GOLDEN_MISS+=1)
IF EXIST "aqf\golden\inventory-fefo.cases.json" (echo [OK] inventory-fefo.cases.json & SET /A GOLDEN_OK+=1) ELSE (echo [MISS] inventory-fefo.cases.json & SET /A GOLDEN_MISS+=1)
IF EXIST "aqf\golden\permissions.matrix.yml" (echo [OK] permissions.matrix.yml & SET /A GOLDEN_OK+=1) ELSE (echo [MISS] permissions.matrix.yml & SET /A GOLDEN_MISS+=1)
IF EXIST "aqf\golden\order-state-machine.cases.json" (echo [OK] order-state-machine.cases.json & SET /A GOLDEN_OK+=1) ELSE (echo [MISS] order-state-machine.cases.json & SET /A GOLDEN_MISS+=1)
IF EXIST "aqf\golden\trip-state-machine.cases.json" (echo [OK] trip-state-machine.cases.json & SET /A GOLDEN_OK+=1) ELSE (echo [MISS] trip-state-machine.cases.json & SET /A GOLDEN_MISS+=1)
IF EXIST "aqf\golden\cost-engine.cases.json" (echo [OK] cost-engine.cases.json & SET /A GOLDEN_OK+=1) ELSE (echo [MISS] cost-engine.cases.json & SET /A GOLDEN_MISS+=1)

REM ── Summary ──────────────────────────────────────────────────
echo.
echo ============================================================
echo QA TOOLS : %PASS%/7 co san
echo GOLDEN   : %GOLDEN_OK%/6 co san
IF %FAIL% GTR 0 (
    echo.
    echo Cac tool bi thieu: chay scripts\install-qa-tools.bat tu File Explorer
)
IF %GOLDEN_MISS% GTR 0 (
    echo Golden files bi thieu: da duoc tao boi AQF setup session
)
echo ============================================================
echo.
echo Buoc tiep theo:
echo   1. Cai tool con thieu: double-click scripts\install-qa-tools.bat
echo   2. Chay G0 gate: double-click AQF_G0_CHECK.bat
echo   3. Mo Test Portal: http://localhost:3000/test-portal
echo      -^> Tab "AQF Command Center" -^> Run Full QA
echo ============================================================
pause
