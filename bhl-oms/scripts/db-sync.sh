#!/usr/bin/env bash
# ============================================================
# db-sync.sh — Đồng bộ DB sau mỗi deploy
# Chạy: bash bhl-oms/scripts/db-sync.sh
# Tự động: được gọi bởi GitHub Actions sau khi services up
# ============================================================
# Làm gì:
#   1. Tạo bảng schema_migrations nếu chưa có
#   2. Áp dụng các migration NNN_*.up.sql chưa chạy
#   3. Áp dụng seed_master.sql (users, idempotent)
# Không làm gì:
#   - Không xóa data vận hành (orders, deliveries, payments)
#   - Không reset password của users đã đổi
#   - Không chạy lại migration đã áp dụng
# ============================================================
set -euo pipefail

CONTAINER="bhl-oms-postgres-1"
DB_USER="bhl"
DB_NAME="bhl_prod"

# Đường dẫn migrations (relative từ repo root)
MIGRATIONS_DIR="bhl-oms/migrations"

# Màu sắc output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DB-SYNC]${NC} $1"; }
warn() { echo -e "${YELLOW}[DB-SYNC]${NC} $1"; }
err()  { echo -e "${RED}[DB-SYNC ERROR]${NC} $1"; }

# Helper: chạy SQL trong container
run_sql() {
    docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "$1" -q 2>&1
}

# Helper: chạy SQL file trong container
run_sql_file() {
    docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q < "$1" 2>&1
}

# ── Bước 0: Kiểm tra container đang chạy ──────────────────
log "Kiểm tra postgres container..."
if ! docker exec "$CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" -q 2>/dev/null; then
    err "Postgres container '$CONTAINER' chưa sẵn sàng!"
    exit 1
fi
log "Postgres sẵn sàng."

# ── Bước 1: Tạo bảng tracking migrations ──────────────────
log "Khởi tạo bảng schema_migrations..."
run_sql "
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    VARCHAR(200) PRIMARY KEY,
    applied_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
" > /dev/null
log "Bảng schema_migrations OK."

# ── Bước 2: Áp dụng migrations chưa chạy ─────────────────
log "Scanning migration files..."

APPLIED=0
SKIPPED=0

# Chỉ xử lý files dạng NNN_*.up.sql (đúng thứ tự số)
for filepath in $(ls "$MIGRATIONS_DIR"/[0-9]*.up.sql 2>/dev/null | sort); do
    filename=$(basename "$filepath")

    # Kiểm tra đã áp dụng chưa
    count=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT COUNT(*) FROM schema_migrations WHERE filename='$filename';" 2>/dev/null | tr -d ' ')

    if [ "${count:-0}" -gt 0 ]; then
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    log "Áp dụng migration: $filename"
    if run_sql_file "$filepath" > /dev/null; then
        run_sql "INSERT INTO schema_migrations (filename) VALUES ('$filename');" > /dev/null
        log "  ✓ $filename"
        APPLIED=$((APPLIED + 1))
    else
        err "  ✗ $filename THẤT BẠI"
        exit 1
    fi
done

log "Migrations: $APPLIED áp dụng mới, $SKIPPED đã có."

# ── Bước 3: Đồng bộ master data (users) ───────────────────
SEED_FILE="$MIGRATIONS_DIR/seed_master.sql"
if [ -f "$SEED_FILE" ]; then
    log "Đồng bộ master data (users)..."
    if run_sql_file "$SEED_FILE" > /dev/null; then
        log "  ✓ seed_master.sql — users đã đồng bộ"
    else
        err "  ✗ seed_master.sql THẤT BẠI"
        exit 1
    fi
else
    warn "Không tìm thấy seed_master.sql, bỏ qua."
fi

# ── Kết quả ────────────────────────────────────────────────
log "DB sync hoàn tất."
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
    "SELECT role, COUNT(*) as count FROM users WHERE is_active GROUP BY role ORDER BY role;" 2>/dev/null || true
