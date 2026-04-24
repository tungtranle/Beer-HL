#!/usr/bin/env bash
# Wrapper to run anomaly report. Set PG env vars before running.
# Example:
# PGHOST=localhost PGPORT=5434 PGUSER=bhl PGPASSWORD=... PGDATABASE=bhl_prod ./bhl-oms/scripts/run_user_anomaly_report.sh
python3 "$(dirname "$0")/run_user_anomaly_report.py"
