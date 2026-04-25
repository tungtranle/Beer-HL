#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)

CONTAINER=${CONTAINER:-bhl-oms-postgres-1}
DB_USER=${DB_USER:-bhl}
DB_NAME=${DB_NAME:-bhl_prod}
TARGET_FILE=${1:-$REPO_ROOT/bhl-oms/migrations/seed_master.sql}
TMP_FILE=$(mktemp)

cleanup() {
    rm -f "$TMP_FILE"
}
trap cleanup EXIT

docker exec "$CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" -q >/dev/null

cat > "$TMP_FILE" <<'EOF'
-- ============================================================
-- SEED MASTER DATA — Nguồn sự thật duy nhất cho master data
-- FILE NÀY ĐƯỢC GENERATE TỪ DB BẰNG: bash bhl-oms/scripts/export-users-seed.sh
-- Chạy sau mỗi deploy để đảm bảo data đồng bộ
-- IDEMPOTENT: dùng ON CONFLICT DO UPDATE, an toàn để chạy nhiều lần
-- KHÔNG xóa dữ liệu cũ, KHÔNG reset password users đã đổi
-- ============================================================

BEGIN;

INSERT INTO users (
  id,
  username,
  password_hash,
  full_name,
  role,
  permissions,
  warehouse_ids,
  email,
  is_active,
  is_chief_accountant
) VALUES
EOF

docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA <<'SQL' >> "$TMP_FILE"
WITH ordered AS (
    SELECT
        id::text AS id_text,
        username,
        password_hash,
        full_name,
        role,
        permissions,
        warehouse_ids,
        email,
        is_active,
        is_chief_accountant,
        row_number() OVER (ORDER BY role, username) AS rn,
        count(*) OVER () AS total_rows
    FROM users
)
SELECT format(
    '(%L, %L, %s, %L, %L, %s, %s, %s, %s, %s)%s',
    id_text,
    username,
    CASE
        WHEN password_hash IS NULL THEN 'NULL'
        ELSE quote_literal(password_hash)
    END,
    full_name,
    role,
    CASE
        WHEN permissions IS NULL OR cardinality(permissions) = 0 THEN 'ARRAY[]::text[]'
        ELSE quote_literal(permissions::text) || '::text[]'
    END,
    CASE
        WHEN warehouse_ids IS NULL OR cardinality(warehouse_ids) = 0 THEN 'ARRAY[]::uuid[]'
        ELSE quote_literal(warehouse_ids::text) || '::uuid[]'
    END,
    CASE
        WHEN email IS NULL OR email = '' THEN 'NULL'
        ELSE quote_literal(email)
    END,
    CASE WHEN is_active THEN 'true' ELSE 'false' END,
    CASE WHEN is_chief_accountant THEN 'true' ELSE 'false' END,
    CASE WHEN rn < total_rows THEN ',' ELSE '' END
)
FROM ordered
ORDER BY rn;
SQL

cat >> "$TMP_FILE" <<'EOF'

ON CONFLICT (username) DO UPDATE SET
  full_name            = EXCLUDED.full_name,
  role                 = EXCLUDED.role,
  permissions          = EXCLUDED.permissions,
  warehouse_ids        = EXCLUDED.warehouse_ids,
  email                = EXCLUDED.email,
  is_active            = EXCLUDED.is_active,
  is_chief_accountant  = EXCLUDED.is_chief_accountant,
  updated_at           = now();

-- Cố ý KHÔNG update password_hash để tránh reset mật khẩu người dùng đã đổi trên server.

COMMIT;
EOF

mkdir -p "$(dirname "$TARGET_FILE")"
mv "$TMP_FILE" "$TARGET_FILE"

echo "Da export users seed ra: $TARGET_FILE"
