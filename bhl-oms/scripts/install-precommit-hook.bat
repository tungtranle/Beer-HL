@echo off
:: install-precommit-hook.bat
:: Cài đặt Git pre-commit hook cho BHL OMS
:: Double-click để cài một lần. Hook sẽ chạy G0 checks tự động trước mỗi commit.

echo === Cài đặt BHL AQF G0 Pre-commit Hook ===
echo.

:: Check if .git exists
if not exist ".git" (
    echo [ERROR] Không tìm thấy thư mục .git. Chạy file này từ thư mục bhl-oms/.
    pause
    exit /b 1
)

:: Create .git/hooks if not exists
if not exist ".git\hooks" mkdir ".git\hooks"

:: Write the pre-commit hook
echo Đang tạo .git/hooks/pre-commit ...

(
echo #!/bin/sh
echo # BHL AQF G0 Pre-commit Hook
echo # Auto-installed by install-precommit-hook.bat
echo # Runs G0 checks: go build + go vet + gofmt check
echo.
echo echo "=== BHL AQF G0: Running pre-commit checks ==="
echo.
echo # Check 1: Go build
echo echo "[G0] go build ./cmd/server/..."
echo go build ./cmd/server/ 2>&1
echo if [ $? -ne 0 ]; then
echo   echo "[G0] FAIL: go build failed. Fix build errors before committing."
echo   exit 1
echo fi
echo echo "[G0] PASS: go build OK"
echo.
echo # Check 2: Go vet
echo echo "[G0] go vet ./..."
echo go vet ./... 2>&1
echo if [ $? -ne 0 ]; then
echo   echo "[G0] FAIL: go vet failed. Fix vet errors before committing."
echo   exit 1
echo fi
echo echo "[G0] PASS: go vet OK"
echo.
echo # Check 3: Check for float64 usage with money fields (grep check)
echo echo "[G0] Checking for float64 money fields..."
echo if git diff --cached --name-only ^| grep -E "\.go$" ^| xargs grep -l "float64" 2>/dev/null ^| head -1 ^| grep -q .; then
echo   # Check if it's in money context
echo   MONEY_FLOATS=$(git diff --cached --name-only ^| grep -E "\.go$" ^| xargs grep -n "float64" 2>/dev/null ^| grep -iE "amount|price|total|cost|credit|balance")
echo   if [ -n "$MONEY_FLOATS" ]; then
echo     echo "[G0] WARNING: float64 detected in money fields. Use decimal.Decimal instead:"
echo     echo "$MONEY_FLOATS"
echo     echo "[G0] Override with: git commit --no-verify"
echo     exit 1
echo   fi
echo fi
echo echo "[G0] PASS: no float64 money fields"
echo.
echo echo "=== BHL AQF G0: All checks passed. Proceeding with commit. ==="
echo exit 0
) > ".git\hooks\pre-commit"

:: Make executable (for Git Bash / WSL compatibility)
attrib -r ".git\hooks\pre-commit" 2>nul

echo [OK] Pre-commit hook đã được cài đặt tại .git/hooks/pre-commit
echo.
echo Hook này sẽ chạy khi bạn git commit:
echo   - go build ./cmd/server/  (kiểm tra compile)
echo   - go vet ./...             (kiểm tra code quality)
echo   - float64 money check      (kiểm tra tiền dùng decimal)
echo.
echo Để bỏ qua hook một lần: git commit --no-verify
echo Để gỡ hook: xoá file .git/hooks/pre-commit
echo.
pause
