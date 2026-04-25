User catalog scripts

Files:
- `run_user_anomaly_report.py` — Python script that runs anomaly queries and writes JSON reports to `bhl-oms/scripts/reports/`.
- `run_user_anomaly_report.sh` — small wrapper to run the Python script.
- `rebuild_user_catalog.sql` — SQL helper to create `users_canonical`, preview chosen rows, and (commented) INSERT+swap steps. Includes `role_mapping` helper.
- `execute_migration.sh` — safe backup + instructions wrapper.
- `db-sync.sh` — production-safe sync script: create `schema_migrations`, apply missing `.up.sql` migrations, then sync `seed_master.sql`.
- `export-users-seed.sh` — export users từ DB hiện tại ra `bhl-oms/migrations/seed_master.sql` để commit/push lên GitHub.
- `export-full-data-package.sh` — export toàn bộ DB `bhl_prod` ra package `usb-sync-...` để mang từ máy code sang Mac mini.
- `import-full-data-from-usb.sh` — restore full dump package trên Mac mini, có backup DB hiện tại trước khi restore.

Recommended for current production workflow:

```bash
bash bhl-oms/scripts/db-sync.sh
```

Use this after each deploy when you need server schema + users/master data to match the repository without touching operational data.

Nếu users/master data đang được chỉnh trực tiếp trong DB local/dev, chạy thêm:

```bash
bash bhl-oms/scripts/export-users-seed.sh
```

Sau đó commit/push file `bhl-oms/migrations/seed_master.sql`. Đây là bước bắt buộc nếu muốn thay đổi data được đưa từ máy code lên GitHub rồi xuống server.

Nếu muốn mang **toàn bộ data** từ máy code sang server, dùng:

```bash
bash bhl-oms/scripts/export-full-data-package.sh
```

Script này tạo folder `usb-sync-...` gồm `full-sync.dump`, `import-full-data-from-usb.sh`, `IMPORT_ON_MAC.command` và `README.txt`.

Quick start (on a machine with network access to the Postgres instance):

1) Install Python deps for the report:

```bash
pip install psycopg2-binary
```

2) Set Postgres env vars and run the anomaly report:

```bash
export PGHOST=localhost
export PGPORT=5434
export PGUSER=bhl
export PGPASSWORD=<password>
export PGDATABASE=bhl_staging
./bhl-oms/scripts/run_user_anomaly_report.sh
```

3) Inspect `bhl-oms/scripts/reports/*.json` and `bhl-oms/scripts/reports/summary.json` for anomalies.

4) To apply migration on staging:
  - Backup `users` table (see `execute_migration.sh`).
  - Edit `rebuild_user_catalog.sql` mapping table as needed (insert normalization mappings).
  - Run the dry-run selects, review results, then uncomment the `INSERT`/`COMMIT` block and run inside a transaction.

CAUTION: Do not run swap on production without full backup and verification on staging.
