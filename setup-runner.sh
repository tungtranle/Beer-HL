#!/bin/bash
# =============================================================
# Script cài đặt GitHub Actions Self-hosted Runner trên Mac mini
# Chạy bằng: bash setup-runner.sh <TOKEN_TỪ_GITHUB>
# =============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

normalize_repo_url() {
  local raw_url="$1"

  if [ -z "$raw_url" ]; then
    echo ""
    return
  fi

  case "$raw_url" in
    git@github.com:*.git)
      echo "https://github.com/${raw_url#git@github.com:}" | sed 's/\.git$//'
      ;;
    https://github.com/*.git)
      echo "${raw_url%.git}"
      ;;
    https://github.com/*)
      echo "$raw_url"
      ;;
    *)
      echo "$raw_url"
      ;;
  esac
}

DEFAULT_REPO="$(git -C "$SCRIPT_DIR" remote get-url origin 2>/dev/null || true)"
REPO="$(normalize_repo_url "${2:-${GITHUB_REPO_URL:-$DEFAULT_REPO}}")"
TOKEN="${1:-}"
RUNNER_DIR="$HOME/actions-runner"
RUNNER_VERSION="2.322.0"

if [ -z "$TOKEN" ]; then
  echo ""
  echo "❌ Thiếu token! Cách lấy token:"
  if [ -n "$REPO" ]; then
    echo "   1. Mở: $REPO/settings/actions/runners/new?runnerOs=osx"
  else
    echo "   1. Xác định repo URL mới, ví dụ: https://github.com/tungtranle/Beer-HL"
    echo "   2. Mở: <REPO_URL>/settings/actions/runners/new?runnerOs=osx"
  fi
  echo "   2. Copy lệnh có dạng: --token XXXXX"
  echo "   3. Chạy lại: bash setup-runner.sh <TOKEN> [REPO_URL]"
  echo ""
  exit 1
fi

if [ -z "$REPO" ]; then
  echo ""
  echo "❌ Không xác định được repo GitHub."
  echo "   Chạy theo dạng: bash setup-runner.sh <TOKEN> https://github.com/tungtranle/Beer-HL"
  echo ""
  exit 1
fi

echo "📦 Tạo thư mục runner..."
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

echo "⬇️  Tải GitHub Actions Runner (macOS ARM64)..."
curl -o actions-runner-osx-arm64.tar.gz -L \
  "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-osx-arm64-${RUNNER_VERSION}.tar.gz"

echo "📂 Giải nén..."
tar xzf ./actions-runner-osx-arm64.tar.gz
rm actions-runner-osx-arm64.tar.gz

echo "⚙️  Cấu hình runner..."
./config.sh \
  --url "$REPO" \
  --token "$TOKEN" \
  --name "mac-mini-prod" \
  --labels "self-hosted,macOS,production" \
  --work "_work" \
  --unattended

echo "🔧 Cài đặt runner chạy tự động khi Mac mini khởi động..."
./svc.sh install
./svc.sh start

echo ""
echo "✅ Xong! Runner đã được cài và đang chạy."
echo "   Kiểm tra tại: $REPO/settings/actions/runners"
echo ""
echo "🚀 Từ giờ: push code lên GitHub → hệ thống tự động deploy!"
