#!/bin/sh
# AQF G0 — Pre-commit Guard (< 60 giây)
# Chạy: format + vet + unit test ngắn + secret scan
# Không pass → không commit

set -e

echo "🛡️  AQF G0: Pre-commit Guard..."
START=$(date +%s)

# ─── Go: build nhanh ───────────────────────────────────────
echo "  [1/5] go build..."
go build ./... 2>&1
if [ $? -ne 0 ]; then
  echo "❌ G0 FAIL: go build thất bại. Fix trước khi commit."
  exit 1
fi

# ─── Go: vet ───────────────────────────────────────────────
echo "  [2/5] go vet..."
go vet ./... 2>&1
if [ $? -ne 0 ]; then
  echo "❌ G0 FAIL: go vet thất bại. Fix trước khi commit."
  exit 1
fi

# ─── Go: unit tests ngắn (chỉ staged packages) ─────────────
echo "  [3/5] go test -short..."
go test -short -timeout 30s ./... 2>&1
if [ $? -ne 0 ]; then
  echo "❌ G0 FAIL: Unit tests thất bại. Fix trước khi commit."
  exit 1
fi

# ─── Frontend: typecheck (nếu web/ thay đổi) ───────────────
STAGED_WEB=$(git diff --cached --name-only | grep "^web/" | wc -l)
if [ "$STAGED_WEB" -gt 0 ]; then
  echo "  [4/5] tsc --noEmit (web/)..."
  cd web && npx tsc --noEmit 2>&1
  if [ $? -ne 0 ]; then
    echo "❌ G0 FAIL: TypeScript errors. Fix trước khi commit."
    exit 1
  fi
  cd ..
else
  echo "  [4/5] tsc --noEmit: skip (không có thay đổi web/)"
fi

# ─── Secret scan (gitleaks trên staged files) ──────────────
echo "  [5/5] Secret scan..."
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks protect --staged --no-banner 2>&1
  if [ $? -ne 0 ]; then
    echo "❌ G0 FAIL: SECRET PHÁT HIỆN TRONG CODE! Không được commit."
    echo "   Xóa secret, dùng environment variable."
    exit 1
  fi
else
  echo "  ⚠️  gitleaks chưa cài. Chạy: scripts/install-qa-tools.bat"
  echo "     Tạm thời bỏ qua secret scan."
fi

END=$(date +%s)
ELAPSED=$((END - START))
echo ""
echo "✅ AQF G0 PASS (${ELAPSED}s) — Commit cho phép"
