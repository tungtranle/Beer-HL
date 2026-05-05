package main

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

// testDBConnection checks if QA user exists in database
func testDBConnection(pool *pgxpool.Pool) {
	ctx := context.Background()
	var count int
	err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM users WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
	`).Scan(&count)
	if err != nil {
		log.Printf("DB test failed: %v", err)
		return
	}
	log.Printf("QA user exists in DB: %d", count)

	// Also list all users for debugging
	rows, err := pool.Query(ctx, `SELECT id, name, email FROM users LIMIT 5`)
	if err != nil {
		log.Printf("List users failed: %v", err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id, name, email string
		if err := rows.Scan(&id, &name, &email); err != nil {
			log.Printf("Scan failed: %v", err)
			continue
		}
		log.Printf("User: %s - %s (%s)", id, name, email)
	}
}
