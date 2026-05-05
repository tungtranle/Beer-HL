package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/lib/pq"
)

func main() {
	// Try different connection strings
	credentials := []string{
		"host=localhost port=5432 user=bhl password=bhl_dev dbname=bhl_dev sslmode=disable",
		"host=localhost port=5432 user=bhl password= dbname=bhl_dev sslmode=disable",
		"host=localhost port=5432 user=postgres password=postgres dbname=bhl_dev sslmode=disable",
	}

	var db *sql.DB
	var err error
	for _, dsn := range credentials {
		db, err = sql.Open("postgres", dsn)
		if err == nil {
			err = db.Ping()
			if err == nil {
				fmt.Printf("✓ Connected\n")
				break
			}
		}
		fmt.Printf("✗ Failed: %v\n", err)
		if db != nil {
			db.Close()
		}
	}

	if err != nil {
		fmt.Printf("Could not connect to database\n")
		os.Exit(1)
	}
	defer db.Close()

	sql := `INSERT INTO ai_feature_flags (flag_key, scope_type, scope_id, enabled, config, updated_at)
VALUES
  ('ai.master', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.briefing', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.explainability', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.credit_score', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.forecast', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.gps_anomaly', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.copilot', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.intent', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.simulation', 'org', 'bhl', true, '{}'::jsonb, NOW()),
  ('ai.voice', 'org', 'bhl', false, '{}'::jsonb, NOW()),
  ('ai.camera', 'org', 'bhl', false, '{}'::jsonb, NOW())
ON CONFLICT (flag_key, scope_type, scope_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW();`

	result, err := db.Exec(sql)
	if err != nil {
		fmt.Printf("Exec error: %v\n", err)
		os.Exit(1)
	}

	rows, _ := result.RowsAffected()
	fmt.Printf("✓ AI features enabled! Rows affected: %d\n", rows)

	// Verify
	rows2, _ := db.Query("SELECT flag_key, enabled FROM ai_feature_flags WHERE scope_type = 'org' ORDER BY flag_key")
	defer rows2.Close()
	fmt.Println("\nCurrent AI flags:")
	for rows2.Next() {
		var key string
		var enabled bool
		rows2.Scan(&key, &enabled)
		status := "OFF"
		if enabled {
			status = "ON"
		}
		fmt.Printf("  %s: %s\n", key, status)
	}
}
