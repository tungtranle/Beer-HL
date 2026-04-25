#!/bin/bash
# =============================================================
# Script cài đặt GitHub Actions Self-hosted Runner trên Mac mini
# Chạy bằng: bash setup-runner.sh [TOKEN_TỪ_GITHUB] [REPO_URL]
# Nếu không truyền TOKEN, script sẽ tự lấy qua GitHub CLI nếu đã `gh auth login`.
# =============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

normalize_repo_url() {
  local raw_url="$1"

  if [ -z "$raw_url" ]; then
    echo ""
    return
  fi

  case "$raw_url" in
    git@*:*/*.git)
      echo "https://github.com/${raw_url#*:}" | sed 's/\.git$//'
      ;;
    git@*:*/*)
      echo "https://github.com/${raw_url#*:}"
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

repo_slug_from_url() {
  local normalized_url
  normalized_url="$(normalize_repo_url "$1")"
  echo "${normalized_url#https://github.com/}"
}

read_current_runner_repo() {
  if [ ! -f "$RUNNER_DIR/.runner" ]; then
    return 0
  fi

  awk -F'"' '/gitHubUrl/ { print $4; exit }' "$RUNNER_DIR/.runner"
}

fetch_runner_token() {
  local repo_slug="$1"

  if ! command -v gh >/dev/null 2>&1; then
    return 1
  fi

  GH_PROMPT_DISABLED=1 gh api -X POST "repos/${repo_slug}/actions/runners/registration-token" --jq .token
}

cleanup_existing_runner() {
  if [ ! -d "$RUNNER_DIR" ]; then
    return 0
  fi

  cd "$RUNNER_DIR"

  if [ -x ./svc.sh ]; then
    ./svc.sh stop || true
    ./svc.sh uninstall || true
  fi

  rm -f .runner .credentials .credentials_rsaparams .service
}

DEFAULT_REPO="$(git -C "$SCRIPT_DIR" remote get-url origin 2>/dev/null || true)"
ARG1="${1:-}"
ARG2="${2:-}"

if [[ "$ARG1" == https://* || "$ARG1" == git@* ]]; then
  TOKEN=""
  REPO_INPUT="$ARG1"
else
  TOKEN="$ARG1"
  REPO_INPUT="${ARG2:-${GITHUB_REPO_URL:-$DEFAULT_REPO}}"
fi

REPO="$(normalize_repo_url "$REPO_INPUT")"
RUNNER_DIR="$HOME/actions-runner"
RUNNER_VERSION="2.322.0"

if [ -z "$REPO" ]; then
  echo ""
  echo "❌ Không xác định được repo GitHub."
  echo "   Chạy theo dạng: bash setup-runner.sh [TOKEN] https://github.com/tungtranle/Beer-HL"
  echo ""
  exit 1
fi

REPO_SLUG="$(repo_slug_from_url "$REPO")"

if [ -z "$TOKEN" ]; then
  if TOKEN="$(fetch_runner_token "$REPO_SLUG" 2>/dev/null)" && [ -n "$TOKEN" ]; then
    echo "🔐 Đã tự lấy runner token cho $REPO_SLUG qua GitHub CLI."
  else
    echo ""
    echo "❌ Thiếu token và không tự lấy được qua GitHub CLI."
    echo "   1. Chạy: gh auth login"
    echo "   2. Hoặc mở: $REPO/settings/actions/runners/new?runnerOs=osx"
    echo "   3. Chạy lại: bash setup-runner.sh <TOKEN> [REPO_URL]"
    echo ""
    exit 1
  fi
fi

echo "📦 Tạo thư mục runner..."
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

if [ ! -x ./config.sh ]; then
  echo "⬇️  Tải GitHub Actions Runner (macOS ARM64)..."
  curl -o actions-runner-osx-arm64.tar.gz -L \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-osx-arm64-${RUNNER_VERSION}.tar.gz"

  echo "📂 Giải nén..."
  tar xzf ./actions-runner-osx-arm64.tar.gz
  rm actions-runner-osx-arm64.tar.gz
fi

CURRENT_REPO="$(normalize_repo_url "$(read_current_runner_repo || true)")"
if [ -n "$CURRENT_REPO" ] && [ "$CURRENT_REPO" != "$REPO" ]; then
  echo "🔁 Runner hiện đang trỏ tới $CURRENT_REPO, sẽ chuyển sang $REPO"
  cleanup_existing_runner
fi

echo "⚙️  Cấu hình runner..."
./config.sh \
  --url "$REPO" \
  --token "$TOKEN" \
  --name "mac-mini-prod" \
  --labels "self-hosted,macOS,production" \
  --work "_work" \
  --replace \
  --unattended

echo "🔧 Cài đặt runner chạy tự động khi Mac mini khởi động..."
./svc.sh install
./svc.sh start

echo ""
echo "✅ Xong! Runner đã được cài và đang chạy."
echo "   Kiểm tra tại: $REPO/settings/actions/runners"
echo ""
echo "🚀 Từ giờ: push code lên GitHub → hệ thống tự động deploy!"
