package main

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dbURL := "postgres://bhl:bhl_dev@localhost:5434/bhl_dev?sslmode=disable"
	fmt.Printf("Connecting: %s\n", dbURL)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		fmt.Printf("ERROR: %v\n", err)
		return
	}

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		fmt.Printf("ERROR: %v\n", err)
		return
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		fmt.Printf("PING ERROR: %v\n", err)
		return
	}

	fmt.Println("SUCCESS!")
}
