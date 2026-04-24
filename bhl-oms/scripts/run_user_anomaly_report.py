#!/usr/bin/env python3
"""
Run user anomaly queries and write JSON reports to ./reports/
Usage:
  pip install psycopg2-binary
  export PGHOST=localhost PGPORT=5434 PGUSER=bhl PGPASSWORD=... PGDATABASE=bhl_prod
  python bhl-oms/scripts/run_user_anomaly_report.py
"""
import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor

QUERIES = {
    "duplicate_usernames": """
        SELECT lower(username) AS uname_lc, count(*) AS cnt
        FROM users
        GROUP BY lower(username)
        HAVING count(*) > 1
        ORDER BY cnt DESC;
    """,
    "missing_password": """
        SELECT id, username, email, role, is_active, created_at
        FROM users
        WHERE coalesce(password_hash, '') = '' OR password_hash IS NULL
        ORDER BY created_at DESC;
    """,
    "null_or_empty_roles": """
        SELECT id, username, email, role
        FROM users
        WHERE role IS NULL OR trim(role) = '';
    """,
    "unknown_roles": """
        SELECT id, username, role
        FROM users
        WHERE role IS NOT NULL AND role NOT IN ('admin','dispatcher','driver','warehouse','accountant','management','dvkh','security','workshop')
        ORDER BY role;
    """,
    "multiple_emails_per_username": """
        SELECT lower(username) AS uname_lc, array_agg(DISTINCT email) AS emails, count(*)
        FROM users
        GROUP BY lower(username)
        HAVING count(DISTINCT email) > 1;
    """,
    "ranked_sample": """
        WITH ranked AS (
            SELECT *,
                row_number() OVER (
                    PARTITION BY lower(username)
                    ORDER BY (CASE WHEN is_active THEN 0 ELSE 1 END),
                             (CASE WHEN password_hash IS NOT NULL AND password_hash <> '' THEN 0 ELSE 1 END),
                             created_at DESC NULLS LAST
                ) AS rn
            FROM users
        )
        SELECT * FROM ranked WHERE rn = 1 LIMIT 100;
    """,
}

OUT_DIR = os.path.join(os.path.dirname(__file__), "reports")


def ensure_reports_dir():
    os.makedirs(OUT_DIR, exist_ok=True)


def connect():
    conn = psycopg2.connect(
        host=os.environ.get("PGHOST", "localhost"),
        port=os.environ.get("PGPORT", "5434"),
        user=os.environ.get("PGUSER", "bhl"),
        password=os.environ.get("PGPASSWORD", ""),
        dbname=os.environ.get("PGDATABASE", "bhl_prod"),
    )
    return conn


def run_queries():
    ensure_reports_dir()
    conn = connect()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        summary = {}
        for name, q in QUERIES.items():
            print(f"Running: {name}")
            cur.execute(q)
            rows = cur.fetchall()
            out_path = os.path.join(OUT_DIR, f"{name}.json")
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(rows, f, default=str, ensure_ascii=False, indent=2)
            summary[name] = {
                "count": len(rows),
                "path": os.path.relpath(out_path)
            }
        # write summary
        with open(os.path.join(OUT_DIR, "summary.json"), "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        print("Reports written to", OUT_DIR)
    finally:
        conn.close()


if __name__ == "__main__":
    run_queries()
