@echo off
REM ============================================================
REM AQF QA Tools Installer — Beer HL Project
REM Cai dat cac cong cu can thiet cho qua trinh QA theo AQF 4.0
REM Chay lan dau sau khi clone repo
REM ============================================================

echo ============================================================
echo AQF QA Tools Setup — Beer HL OMS-TMS-WMS
echo ============================================================
echo.

SET FAIL=0

REM --- 1. Check Go ---
echo [1/8] Kiem tra Go...
WHERE go >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [WARN] Go chua duoc cai. Tai tai: https://golang.org/dl/
    echo        Can Go 1.23+
    SET FAIL=1
) ELSE (
    go version
    echo [OK] Go da co
)

REM --- 2. golangci-lint ---
echo.
echo [2/8] Cai golangci-lint (Go linter)...
WHERE golangci-lint >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    echo [OK] golangci-lint da co
    golangci-lint version
) ELSE (
    echo Dang cai golangci-lint...
    go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.62.2
    IF %ERRORLEVEL% NEQ 0 (
        echo [FAIL] Cai golangci-lint that bai
        SET FAIL=1
    ) ELSE (
        echo [OK] golangci-lint da cai xong
    )
)

REM --- 3. govulncheck ---
echo.
echo [3/8] Cai govulncheck (Go vulnerability scanner)...
WHERE govulncheck >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    echo [OK] govulncheck da co
) ELSE (
    go install golang.org/x/vuln/cmd/govulncheck@latest
    IF %ERRORLEVEL% NEQ 0 (
        echo [FAIL] Cai govulncheck that bai
        SET FAIL=1
    ) ELSE (
        echo [OK] govulncheck da cai xong
    )
)

REM --- 4. gitleaks ---
echo.
echo [4/8] Kiem tra gitleaks (Secret scanner)...
WHERE gitleaks >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    echo [OK] gitleaks da co
    gitleaks version
) ELSE (
    echo [INFO] gitleaks chua co.
    echo        Tai tai: https://github.com/gitleaks/gitleaks/releases
    echo        Hoac dung winget: winget install gitleaks.gitleaks
    echo.
    WHERE winget >nul 2>&1
    IF %ERRORLEVEL% EQU 0 (
        echo Dang thu cai qua winget...
        winget install gitleaks.gitleaks --silent --accept-package-agreements
        IF %ERRORLEVEL% EQU 0 (
            echo [OK] gitleaks da cai qua winget
        ) ELSE (
            echo [WARN] Cai gitleaks that bai - hay cai thu cong
        )
    ) ELSE (
        echo [WARN] winget khong co - hay cai gitleaks thu cong
    )
)

REM --- 5. Node.js + npm ---
echo.
echo [5/8] Kiem tra Node.js...
WHERE node >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [WARN] Node.js chua duoc cai. Tai tai: https://nodejs.org/ (v20 LTS)
    SET FAIL=1
) ELSE (
    node --version
    echo [OK] Node.js da co
)

REM --- 6. npm install cho web/ ---
echo.
echo [6/8] Cai npm packages cho web/ (bao gom Playwright + ESLint)...
IF EXIST "web\package.json" (
    cd web
    call npm ci
    IF %ERRORLEVEL% NEQ 0 (
        echo [FAIL] npm ci that bai
        cd ..
        SET FAIL=1
    ) ELSE (
        echo [OK] npm packages da cai
        REM Install Playwright browsers
        echo Cai Playwright browsers...
        call npx playwright install chromium
        IF %ERRORLEVEL% NEQ 0 (
            echo [WARN] Cai Playwright browsers that bai - chay thu: npx playwright install
        ) ELSE (
            echo [OK] Playwright chromium da cai
        )
        cd ..
    )
) ELSE (
    echo [SKIP] Khong tim thay web/package.json
)

REM --- 7. Setup Git pre-commit hook ---
echo.
echo [7/8] Cai dat Git pre-commit hook (AQF G0)...
IF EXIST ".git\hooks" (
    REM Copy script shell hook
    copy /Y "scripts\aqf-g0-precommit.sh" ".git\hooks\pre-commit" >nul 2>&1
    IF %ERRORLEVEL% EQU 0 (
        echo [OK] Git pre-commit hook da cai (Unix shell)
    )
    REM Tao wrapper bat cho Windows (Git Bash se chay .sh)
    echo #!/bin/sh > .git\hooks\pre-commit
    echo exec "$(dirname "$0")/../../scripts/aqf-g0-precommit.sh" >> .git\hooks\pre-commit
    echo [OK] Git pre-commit hook configured
) ELSE (
    echo [SKIP] Khong tim thay .git/hooks - hay chay trong thu muc goc cua repo
)

REM --- 8. Kiem tra Playwright ---
echo.
echo [8/8] Kiem tra cai dat Playwright...
IF EXIST "web\node_modules\.bin\playwright" (
    echo [OK] Playwright da co trong web/node_modules
) ELSE (
    echo [WARN] Playwright chua cai trong web/ - chay: cd web ^&^& npx playwright install
)

REM --- Summary ---
echo.
echo ============================================================
IF %FAIL% EQU 0 (
    echo AQF SETUP HOAN THANH
    echo.
    echo Cong cu da cai:
    echo   - golangci-lint  : Go linter
    echo   - govulncheck    : Go vuln scanner
    echo   - gitleaks       : Secret scanner
    echo   - Playwright     : E2E testing
    echo   - ESLint         : Frontend linter
    echo   - Git pre-commit : AQF G0 gate
    echo.
    echo Buoc tiep theo:
    echo   1. Double-click AQF_G0_CHECK.bat de test G0 gate
    echo   2. Mo PR tren GitHub de test G1 gate (ci.yml)
    echo   3. Doc aqf/aqf.config.yml de hieu cau hinh QA
) ELSE (
    echo AQF SETUP CO LOI — Xem cac canh bao FAIL o tren
    echo Mot so cong cu can cai thu cong
)
echo ============================================================
pause
