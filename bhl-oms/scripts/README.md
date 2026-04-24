User catalog scripts

Files:
- `run_user_anomaly_report.py` — Python script that runs anomaly queries and writes JSON reports to `bhl-oms/scripts/reports/`.
- `run_user_anomaly_report.sh` — small wrapper to run the Python script.
- `rebuild_user_catalog.sql` — SQL helper to create `users_canonical`, preview chosen rows, and (commented) INSERT+swap steps. Includes `role_mapping` helper.
- `execute_migration.sh` — safe backup + instructions wrapper.

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
